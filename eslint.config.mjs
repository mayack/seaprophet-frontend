import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import prettier from 'eslint-plugin-prettier'
import eslintPluginTypescript from '@typescript-eslint/eslint-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  ...compat.extends('next/core-web-vitals', 'plugin:prettier/recommended'),
  {
    plugins: { prettier, '@typescript-eslint': eslintPluginTypescript },
    rules: {
      'prettier/prettier': 'error', // Enforce Prettier formatting as errors
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { vars: 'all', args: 'after-used', ignoreRestSiblings: true },
      ], // Warn on unused vars
      'no-console': 'warn', // Warn on console.log (common practice)
      eqeqeq: ['error', 'always'], // Require === and !== (common strictness)
      'no-var': 'error', // Disallow var, use let/const (modern JS)
      'prefer-const': 'error', // Prefer const over let when possible
    },
  },
]
