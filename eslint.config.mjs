import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import prettier from 'eslint-plugin-prettier'
import eslintPluginTypescript from '@typescript-eslint/eslint-plugin'
import tailwind from 'eslint-plugin-tailwindcss'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  ...compat.extends(
    'next/core-web-vitals',
    'plugin:prettier/recommended',
    'plugin:tailwindcss/recommended'
  ),
  {
    plugins: {
      prettier,
      '@typescript-eslint': eslintPluginTypescript,
      tailwind,
    },
    rules: {
      'prettier/prettier': 'error', // Enforce Prettier formatting as errors
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { vars: 'all', args: 'after-used', ignoreRestSiblings: true },
      ], // Warn on unused vars
      '@typescript-eslint/explicit-function-return-type': 'warn', // Encourage explicit return types
      '@typescript-eslint/no-explicit-any': 'error', // Ban 'any' for stricter typing
      'no-console': 'warn', // Warn on console.log
      eqeqeq: ['error', 'always'], // Require === and !==
      'no-var': 'error', // Disallow var, use let/const
      'prefer-const': 'error', // Prefer const over let when possible
      'tailwindcss/no-custom-classname': [
        'warn',
        {
          whitelist: ['embla', 'embla__container', 'embla__slide'],
        },
      ], // Allow Embla carousel classes
    },
  },
]
