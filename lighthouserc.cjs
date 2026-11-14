// Auditoria Lighthouse (§10): início e detalhe, 3 execuções por página, build otimizado
// com o cenário padrão dos mocks. O perfil vem de LH_PRESET (mobile | desktop);
// `pnpm lighthouse` roda os dois em sequência e grava HTML/JSON em .lighthouseci/<perfil>.
const preset = process.env.LH_PRESET === 'desktop' ? 'desktop' : 'mobile'

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm preview',
      startServerReadyPattern: 'Local',
      url: ['http://localhost:4173/', 'http://localhost:4173/nfts/nft_001'],
      numberOfRuns: 3,
      settings: {
        ...(preset === 'desktop' ? { preset: 'desktop' } : {}),
        // O app inicia o worker do MSW antes de montar; o worker precisa de rede local.
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
      },
    },
    upload: { target: 'filesystem', outputDir: `.lighthouseci/${preset}`, reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%' },
  },
}
