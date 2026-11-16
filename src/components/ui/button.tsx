import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-bold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-out select-none active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#dd9a5f]",
        outline: "border-primary text-accent-text hover:bg-primary/10",
        secondary: "bg-raised text-foreground hover:bg-band",
        ghost: "text-foreground hover:bg-raised",
        destructive: "border-destructive text-destructive hover:bg-destructive/10",
        link: "h-auto px-0 font-medium text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 text-sm",
        xs: "h-7 px-2 text-xs",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Botão ocupado (mutation em andamento) sem perder o foco do teclado: `disabled` tira o botão da ordem
 * de foco e o foco cai no body; `aria-disabled` o mantém focável e o clique, inclusive o submit implícito
 * do Enter num campo, é ignorado até a operação terminar.
 */
function busyProps(busy: boolean | undefined, onClick?: React.MouseEventHandler<HTMLButtonElement>) {
  return {
    "aria-disabled": busy || undefined,
    "aria-busy": busy || undefined,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (busy) {
        event.preventDefault()
        return
      }
      onClick?.(event)
    },
  }
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  pending,
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Operação em andamento: bloqueia o clique sem tirar o botão da ordem de foco (ver `busyProps`). */
    pending?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      {...(pending === undefined ? { onClick } : busyProps(pending, onClick))}
    />
  )
}

export { Button, buttonVariants, busyProps }
