import tseslint from '@electron-toolkit/eslint-config-ts'

// Minimal flat config so `pnpm lint` works with ESLint v9.
// We currently rely on `tsc` for most correctness checks.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.electron-vite/**',
      '**/.turbo/**',
      '**/.cache/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {},
  }
)
