/**
 * Substitui o `tldts` no bundle (alias em `vite.config.ts`). O único consumidor é o `tough-cookie`,
 * que o MSW usa para guardar cookies das respostas simuladas. A API simulada autentica por Bearer e
 * não define cookies, então a lista completa de sufixos públicos (~100 kB gzip no caminho crítico do
 * boot) não tem uso aqui.
 *
 * ponytail: domínio registrável = dois últimos rótulos; erra em sufixos compostos (`co.uk`). Se a API
 * simulada passar a usar cookies com `Domain`, remova o alias e volte ao `tldts`.
 */
export function getDomain(hostname: string): string | null {
  // IPs (v4/v6) não têm domínio registrável, como no tldts.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return null
  const labels = hostname.replace(/\.$/, '').split('.')
  return labels.length >= 2 ? labels.slice(-2).join('.') : null
}
