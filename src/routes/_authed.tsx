import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ensureSession } from '@/session/session'

/** Rotas privadas (checkout, pedidos, perfil, carteiras, favoritos) exigem sessão válida. */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    if (!(await ensureSession())) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: Outlet,
})
