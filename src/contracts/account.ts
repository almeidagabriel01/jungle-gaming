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

export const RegisterBody = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(60),
  email: z.email('E-mail inválido'),
  password: Password,
})
export type RegisterBody = z.infer<typeof RegisterBody>

export const RefreshBody = z.object({ refreshToken: z.string() })

export const UpdateProfileBody = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(60),
  username: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{3,20}$/, 'Use de 3 a 20 letras minúsculas, números ou _'),
  bio: z.string().trim().max(160, 'Máximo de 160 caracteres'),
})
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>

/** Avatar enviado como data URL (PNG/JPEG/WebP) de até ~1 MB. */
export const AvatarBody = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Use PNG, JPEG ou WebP')
    .max(1_400_000, 'Imagem acima de 1 MB'),
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

export const Wallet = z.object({
  id: Id,
  label: z.string(),
  address: WalletAddress,
  network: Network,
  role: WalletRole,
  createdAt: IsoDate,
})
export type Wallet = z.infer<typeof Wallet>

export const WalletBody = z.object({
  label: z.string().trim().min(2, 'Informe um nome').max(30),
  address: WalletAddress,
  network: Network,
  role: WalletRole,
})
export type WalletBody = z.infer<typeof WalletBody>
