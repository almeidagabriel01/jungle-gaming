import type { SVGProps } from 'react'

// Ícones exportados do Figma (API /v1/images, SVG): Iconly/Curved/Hide (9:963) e X (9:947). Herdam a cor do texto.
type IconProps = SVGProps<SVGSVGElement>

const eye = [
  'M6.06334 14.7749C3.95723 13.5582 2.59723 11.7249 2.59723 10.1165C2.59723 7.3832 6.50723 4.0332 11.3333 4.0332C13.3072 4.0332 15.1395 4.59154 16.6128 5.4582',
  'M18.747 7.17529C19.5885 8.11696 20.0786 9.15863 20.0786 10.117C20.0786 12.8503 16.1592 16.2003 11.3331 16.2003C10.4736 16.2003 9.63402 16.092 8.84918 15.9003',
  'M9.22318 11.9724C8.66123 11.4816 8.34673 10.8124 8.34957 10.1149C8.34579 8.66074 9.67934 7.47907 11.3283 7.47657C12.1217 7.4749 12.8829 7.7524 13.4439 8.2474',
  'M14.2701 10.5825C14.0491 11.6592 13.0942 12.5034 11.874 12.7009',
]
const slash = 'M18.7866 3.5415L3.88892 16.6865'

/** Olho riscado do layout; com `shown`, o mesmo traço sem o risco (o Figma só tem o estado oculto). */
export const PasswordEyeIcon = ({ shown = false, ...props }: IconProps & { shown?: boolean }) => (
  <svg viewBox="0 0 23 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {eye.map((d) => (
      <path key={d} d={d} />
    ))}
    {!shown && <path d={slash} />}
  </svg>
)

export const CloseIcon = (props: IconProps) => (
  <svg viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.17007 3.17007C3.39682 2.94331 3.76447 2.94331 3.99122 3.17007L9 8.17884L14.0088 3.17007C14.2355 2.94331 14.6032 2.94331 14.8299 3.17007C15.0567 3.39682 15.0567 3.76447 14.8299 3.99122L9.82116 9L14.8299 14.0088C15.0567 14.2355 15.0567 14.6032 14.8299 14.8299C14.6032 15.0567 14.2355 15.0567 14.0088 14.8299L9 9.82116L3.99122 14.8299C3.76447 15.0567 3.39682 15.0567 3.17007 14.8299C2.94331 14.6032 2.94331 14.2355 3.17007 14.0088L8.17884 9L3.17007 3.99122C2.94331 3.76447 2.94331 3.39682 3.17007 3.17007Z"
    />
  </svg>
)
