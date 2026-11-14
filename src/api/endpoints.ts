import { z } from 'zod'
import {
  AuthResponse,
  SessionResponse,
  User,
  WalletConnection,
  WalletList,
  type ChangePasswordBody,
  type LoginBody,
  type RegisterBody,
  type UpdateProfileBody,
  type WalletBody,
} from '@/contracts/account'
import { Cart, Quote, type AddCartItemBody, type QuoteRequest } from '@/contracts/cart'
import { ArticleList } from '@/contracts/content'
import type { Network } from '@/contracts/common'
import { Favorites, Nft, NftList, type NftSearch } from '@/contracts/nft'
import { Order, OrderList, type CreateOrderBody } from '@/contracts/order'
import { request, send } from './client'

/** Serializa a busca para a query string da API (listas por vírgula, defaults omitidos). */
const toCatalogParams = (s: NftSearch) => ({
  q: s.q || undefined,
  tab: s.tab === 'all' ? undefined : s.tab,
  categories: s.categories.length > 0 ? s.categories.join(',') : undefined,
  networks: s.networks.length > 0 ? s.networks.join(',') : undefined,
  collection: s.collection || undefined,
  minPrice: s.minPrice,
  maxPrice: s.maxPrice,
  sort: s.sort,
  page: s.page,
})

const NftItems = z.object({ items: z.array(Nft) })
const id = encodeURIComponent

export const api = {
  auth: {
    register: (body: RegisterBody) => request(AuthResponse, { method: 'POST', url: '/auth/register', data: body }),
    login: (body: LoginBody) => request(AuthResponse, { method: 'POST', url: '/auth/login', data: body }),
    session: (signal?: AbortSignal) => request(SessionResponse, { url: '/session', signal }),
    logout: (refreshToken: string) => send({ method: 'POST', url: '/auth/logout', data: { refreshToken } }),
  },
  journal: (signal?: AbortSignal) => request(ArticleList, { url: '/journal', signal }),
  nfts: {
    list: (search: NftSearch, signal?: AbortSignal) => request(NftList, { url: '/nfts', params: toCatalogParams(search), signal }),
    featured: (signal?: AbortSignal) => request(NftItems, { url: '/nfts/featured', signal }),
    get: (nftId: string, signal?: AbortSignal) => request(Nft, { url: `/nfts/${id(nftId)}`, signal }),
  },
  favorites: {
    list: (signal?: AbortSignal) => request(Favorites, { url: '/me/favorites', signal }),
    add: (nftId: string) => request(Favorites, { method: 'PUT', url: `/me/favorites/${id(nftId)}` }),
    remove: (nftId: string) => request(Favorites, { method: 'DELETE', url: `/me/favorites/${id(nftId)}` }),
  },
  cart: {
    get: (signal?: AbortSignal) => request(Cart, { url: '/cart', signal }),
    add: (body: AddCartItemBody) => request(Cart, { method: 'POST', url: '/cart/items', data: body }),
    update: (itemId: string, quantity: number) => request(Cart, { method: 'PATCH', url: `/cart/items/${id(itemId)}`, data: { quantity } }),
    remove: (itemId: string) => request(Cart, { method: 'DELETE', url: `/cart/items/${id(itemId)}` }),
    merge: (guestId: string) => request(Cart, { method: 'POST', url: '/cart/merge', data: { guestId } }),
  },
  quotes: {
    create: (body: QuoteRequest, signal?: AbortSignal) => request(Quote, { method: 'POST', url: '/quotes', data: body, signal }),
  },
  orders: {
    create: (body: CreateOrderBody, idempotencyKey: string) =>
      request(Order, { method: 'POST', url: '/orders', data: body, headers: { 'Idempotency-Key': idempotencyKey } }),
    get: (orderId: string, signal?: AbortSignal) => request(Order, { url: `/orders/${id(orderId)}`, signal }),
    list: (status?: Order['status'], signal?: AbortSignal) => request(OrderList, { url: '/orders', params: { status }, signal }),
  },
  profile: {
    get: (signal?: AbortSignal) => request(User, { url: '/me/profile', signal }),
    update: (body: UpdateProfileBody) => request(User, { method: 'PATCH', url: '/me/profile', data: body }),
    avatar: (dataUrl: string | null) => request(User, { method: 'PUT', url: '/me/avatar', data: { dataUrl } }),
    changePassword: (body: ChangePasswordBody) => send({ method: 'POST', url: '/me/password', data: body }),
  },
  wallets: {
    list: (signal?: AbortSignal) => request(WalletList, { url: '/me/wallets', signal }),
    create: (body: WalletBody) => request(WalletList, { method: 'POST', url: '/me/wallets', data: body }),
    update: (walletId: string, body: WalletBody) => request(WalletList, { method: 'PATCH', url: `/me/wallets/${id(walletId)}`, data: body }),
    connect: (walletId: string, network: Network) =>
      request(WalletConnection, { method: 'POST', url: `/me/wallets/${id(walletId)}/connection`, data: { network } }),
    disconnect: (walletId: string) => send({ method: 'DELETE', url: `/me/wallets/${id(walletId)}/connection` }),
  },
}
