import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { HomePage } from '@/components/home/home-page'
import { NFT_SEARCH_DEFAULTS, NftSearch } from '@/contracts/nft'

export const Route = createFileRoute('/')({
  validateSearch: NftSearch,
  search: { middlewares: [stripSearchParams(NFT_SEARCH_DEFAULTS)] },
  component: function HomeRoute() {
    return <HomePage search={Route.useSearch()} />
  },
})
