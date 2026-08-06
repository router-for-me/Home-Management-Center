import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

import noControlSizeOverride from './eslint-rules/no-control-size-override.js'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'src/routeTree.gen.ts',
      'tests',
      '.workbench',
      '.tanstack',
      'eslint.config.js',
      'prettier.config.mjs',
      // Lint tooling, same as the two configs above: it runs on the ESLint AST,
      // which the app's type-aware rules have no types for.
      'eslint-rules',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.mjs', 'scripts/*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'home-ui': { rules: { 'no-control-size-override': noControlSizeOverride } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      'home-ui/no-control-size-override': 'error',
    },
  },
  eslintConfigPrettier,
)
