import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'public/mockServiceWorker.js', 'src/routeTree.gen.ts', 'playwright-report', 'test-results', '.lighthouseci'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowExportNames: ['Route'] }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/only-throw-error': 'off',
      // `!` é usado de propósito em acessos já garantidos (noUncheckedIndexedAccess ligado).
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      // A UI nunca importa a camada de mocks: tudo simulado fica na rede (MSW).
      'no-restricted-imports': ['error', { patterns: [{ group: ['@/mocks/*', '**/mocks/*'], message: 'Mocks só entram pelo boot (main.tsx).' }] }],
    },
  },
  // Arquivos de rota exportam `Route` + componentes locais; o plugin do router cuida do HMR.
  { files: ['src/routes/**', 'src/app.tsx'], rules: { 'react-refresh/only-export-components': 'off' } },
  { files: ['src/mocks/**', 'src/main.tsx'], rules: { 'no-restricted-imports': 'off' } },
  // Fixtures do Playwright usam `use()`, que não é o hook do React.
  { files: ['e2e/**'], rules: { 'react-hooks/rules-of-hooks': 'off', 'no-restricted-imports': 'off' } },
  { files: ['src/components/ui/**'], rules: { 'react-refresh/only-export-components': 'off' } },
)
