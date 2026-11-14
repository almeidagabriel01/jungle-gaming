import type { SVGProps } from 'react'

/** Ícones exportados do Figma (Iconly/Curved/Delete e X do modal de confirmação), em currentColor. */

export function DeleteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M18.8894 9.55409C18.8894 17.5731 20.0437 21.1979 12.2799 21.1979C4.51515 21.1979 5.69324 17.5731 5.69324 9.55409" />
      <path d="M20.3653 6.47981H4.21484" />
      <path d="M15.7148 6.47981C15.7148 6.47981 16.2434 2.7141 12.2891 2.7141C8.33578 2.7141 8.86435 6.47981 8.86435 6.47981" />
    </svg>
  )
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.17007 3.05472C3.39682 2.83621 3.76447 2.83621 3.99122 3.05472L9 7.88125L14.0088 3.05472C14.2355 2.83621 14.6032 2.83621 14.8299 3.05472C15.0567 3.27322 15.0567 3.62749 14.8299 3.846L9.82116 8.67253L14.8299 13.4991C15.0567 13.7176 15.0567 14.0718 14.8299 14.2903C14.6032 14.5088 14.2355 14.5088 14.0088 14.2903L9 9.46381L3.99122 14.2903C3.76447 14.5088 3.39682 14.5088 3.17007 14.2903C2.94331 14.0718 2.94331 13.7176 3.17007 13.4991L8.17884 8.67253L3.17007 3.846C2.94331 3.62749 2.94331 3.27322 3.17007 3.05472Z"
      />
    </svg>
  )
}
