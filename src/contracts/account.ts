import { z } from 'zod'
import { Id, IsoDate, Network } from './common'

export const Password = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(64)
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

export const User = z.object({
  id: Id,
  name: z.string(),
  email: z.email(),
  username: z.string(),
  bio: z.string(),
  /** Nome ENS do perfil (ex.: ana.kurio.eth); vazio até o colecionador preencher. */
  ensName: z.string(),
  /** Apelido público da carteira no perfil. */
  walletLabel: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof User>

export const Tokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Expiração do access token (ISO). */
  expiresAt: IsoDate,
})
export type Tokens = z.infer<typeof Tokens>

export const AuthResponse = z.object({ user: User, tokens: Tokens })
export type AuthResponse = z.infer<typeof AuthResponse>

export const LoginBody = z.object({
  email: z.email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginBody = z.infer<typeof LoginBody>

/** Nome de usuário: a mesma regra no cadastro, no perfil e no pagamento. */
export const Username = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{3,20}$/, 'Use de 3 a 20 letras minúsculas, números ou _')

export const RegisterBody = z.object({
  username: Username,
  email: z.email('E-mail inválido'),
  password: Password,
})
export type RegisterBody = z.infer<typeof RegisterBody>

export const RefreshBody = z.object({ refreshToken: z.string() })

/** Nome ENS completo; o formulário compõe nome + sufixo ".eth". */
export const EnsName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,}(\.[a-z0-9-]+)*\.eth$/, 'Informe o nome ENS (mínimo de 3 caracteres, ex.: colecionador)')

const DisplayName = z.string().trim().min(2, 'Informe o nome de exibição').max(60, 'Máximo de 60 caracteres')
const Email = z.email('E-mail inválido').trim().toLowerCase()
const WalletLabel = z.string().trim().min(2, 'Informe o apelido da carteira').max(30, 'Máximo de 30 caracteres')

/** Campos do layout Perfil do colecionador (a bio não está no layout e não é editada aqui). */
export const UpdateProfileBody = z.object({
  name: DisplayName,
  username: Username,
  email: Email,
  ensName: EnsName,
  walletLabel: WalletLabel,
})
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>

/** Avatar enviado como data URL (PNG/JPEG/WebP) de até ~1 MB; `null` remove. */
export const AvatarBody = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Use PNG, JPEG ou WebP')
    .max(1_400_000, 'Imagem acima de 1 MB')
    .nullable(),
})

export const ChangePasswordBody = z
  .object({ currentPassword: z.string().min(1, 'Informe a senha atual'), newPassword: Password })
  .refine((b) => b.currentPassword !== b.newPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>

export const WalletRole = z.enum(['primary', 'secondary'])

export const WalletAddress = z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço deve ter 0x + 40 caracteres hexadecimais')

/** "Tipo de carteira" do layout (provedor usado para conectar). */
export const WalletProvider = z.enum(['metamask', 'coinbase', 'walletconnect'], 'Selecione uma carteira')
export type WalletProvider = z.infer<typeof WalletProvider>

/**
 * Campos do formulário de carteira do layout (Carteiras e Pagamento): uma definição só,
 * usada pela API de carteiras e pelo comprador do pedido.
 */
export const WalletDetails = z.object({
  displayName: DisplayName,
  label: WalletLabel,
  network: z.enum(Network.options, 'Selecione uma rede'),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil').max(40, 'Máximo de 40 caracteres'),
  address: WalletAddress,
  /** "ENS ou carteira secundária (opcional)": vazio, nome .eth ou endereço 0x. */
  secondaryAddress: z
    .string()
    .trim()
    .regex(/^$|^0x[a-fA-F0-9]{40}$|^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i, 'Use um nome ENS (ex.: nome.eth) ou um endereço 0x'),
  provider: WalletProvider,
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,16}$/, 'Use de 4 a 16 letras, números ou hífen'),
  email: Email,
  ensName: EnsName,
})
export type WalletDetails = z.infer<typeof WalletDetails>

export const Wallet = WalletDetails.extend({
  id: Id,
  network: Network,
  role: WalletRole,
  createdAt: IsoDate,
})
export type Wallet = z.infer<typeof Wallet>

export const WalletBody = WalletDetails.extend({ role: WalletRole })
export type WalletBody = z.infer<typeof WalletBody>

export const WalletConnectBody = z.object({ network: Network })

export const WalletConnection = z.object({ walletId: Id, network: Network, connectedAt: IsoDate })
export type WalletConnection = z.infer<typeof WalletConnection>
/** Conexão ativa do usuário (uma por vez), ou `null`: a fonte da verdade fica no servidor e sobrevive ao refresh. */
export const CurrentWalletConnection = z.object({ connection: WalletConnection.nullable() })

export const SessionResponse = z.object({ user: User })

export const WalletList = z.object({ items: z.array(Wallet) })
