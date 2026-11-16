/**
 * Depois de remover uma linha de lista, o foco do teclado não pode cair no body: vai para o mesmo
 * controle (`selector`) na próxima linha, senão na anterior, senão para o título da lista (vazia).
 * Só age se o foco estava na linha removida, para não roubar o foco de quem já foi para outro lugar.
 */
export function moveFocusAfterRemoval(row: Element | null, selector: string, fallback: HTMLElement | null) {
  const item = row?.closest('li')
  if (!item?.contains(document.activeElement)) return
  const sibling = item.nextElementSibling ?? item.previousElementSibling
  const target = sibling?.querySelector<HTMLElement>(selector) ?? fallback
  target?.focus()
}
