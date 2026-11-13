import './index.css'

const root = document.getElementById('root')!

/**
 * Boot em duas etapas: a camada MSW (REST + Socket.IO) precisa estar ativa ANTES de
 * qualquer import do app. O engine.io-client captura `globalThis.WebSocket` quando o
 * módulo é avaliado; import estático antes do worker usaria o WebSocket nativo.
 */
async function boot() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { renderApp } = await import('./app')
  renderApp(root)
}

boot().catch((error: unknown) => {
  console.error(error)
  const message = document.createElement('p')
  message.setAttribute('role', 'alert')
  message.style.cssText = 'padding:2rem;font-family:system-ui'
  message.textContent = 'Não foi possível iniciar a aplicação. Recarregue a página.'
  root.replaceChildren(message)
})
