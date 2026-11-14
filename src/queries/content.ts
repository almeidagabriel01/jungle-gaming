import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { keys } from '@/api/keys'

/** Conteúdo editorial muda pouco: fica em cache durante a sessão. */
export const useJournal = () => useQuery({ queryKey: keys.journal, queryFn: ({ signal }) => api.journal(signal), staleTime: Infinity })
