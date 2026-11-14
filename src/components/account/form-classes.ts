/** Borda e tipografia dos campos do layout (borda `border-input` por contraste AA de componente). */
export const controlClass =
  'h-10 w-full min-w-0 rounded-[3px] border border-input bg-transparent px-3 text-sm text-foreground transition-colors outline-none placeholder:text-subtle hover:border-subtle focus-visible:border-accent-text focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30'

/** Círculo de seleção do layout (rádio e "Igual à carteira principal"): anel primário, miolo preenchido quando marcado. */
export const roundCheckClass =
  'size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.2px] border-primary transition-[background] checked:bg-[radial-gradient(circle,var(--primary)_0_4px,transparent_4.5px)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50'
