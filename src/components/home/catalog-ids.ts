import type { NftTab } from '@/contracts/nft'

/** Ligação aba ↔ painel do catálogo (aria-controls / aria-labelledby). */
export const CATALOG_PANEL_ID = 'catalog-panel'
export const tabId = (tab: NftTab) => `catalog-tab-${tab}`
