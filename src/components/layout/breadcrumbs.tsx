import { Link, type LinkProps } from '@tanstack/react-router'
import { Fragment } from 'react'

type Crumb = { label: string; link?: Pick<LinkProps, 'to' | 'params' | 'search' | 'hash'> }

/** Trilha "Início / Mercado / …" do layout desktop; o último item é a página atual. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="pt-8 pb-1 text-[15px] leading-4 font-bold max-md:hidden">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && (
              <li aria-hidden="true" className="text-muted-foreground">
                /
              </li>
            )}
            <li>
              {item.link ? (
                <Link {...item.link} className="transition-colors hover:text-accent-text">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
