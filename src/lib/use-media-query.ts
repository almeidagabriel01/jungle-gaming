import { useSyncExternalStore } from 'react'

/** Breakpoint `md` do Tailwind: acima dele o layout é o desktop do Figma. */
export const DESKTOP_QUERY = '(min-width: 768px)'

/** Breakpoint `lg`: largura em que cabem as medidas fixas do frame desktop (sidebar 310 + grade). */
export const WIDE_QUERY = '(min-width: 1024px)'

/** Estado de uma media query, reativo a resize (só cliente; o app é SPA). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => {
        list.removeEventListener('change', onChange)
      }
    },
    () => window.matchMedia(query).matches,
  )
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
