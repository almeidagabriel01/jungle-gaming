import { useRouterState } from '@tanstack/react-router'

/** Telas que no layout mobile têm a própria barra de ação no rodapé (compra, resumo, formulário). */
const OWN_BOTTOM_BAR = /^\/(nfts|cart|checkout|orders|login|register)(\/|$)/

export const useShowsMobileNav = () => !OWN_BOTTOM_BAR.test(useRouterState({ select: (s) => s.location.pathname }))
