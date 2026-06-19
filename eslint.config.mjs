import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // The codebase is `any`-free today; keep it that way.
      '@typescript-eslint/no-explicit-any': 'error',
      // Allow intentional error/warn logging; flag stray debug logs.
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  // Must be last: turns off any ESLint rules that would conflict with Prettier
  // formatting so the two don't fight.
  prettier,
]

export default eslintConfig
