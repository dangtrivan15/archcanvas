import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'node_modules',
      '.vite-cache',
      'src/proto/archcanvas.pb.js',
      'src/proto/archcanvas.pb.d.ts',
      'scripts/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      'prefer-const': 'warn',
      // Platform abstraction enforcement (P06):
      // All localStorage/sessionStorage access must go through platform.preferences adapter.
      // All clipboard access must go through platform.clipboard adapter.
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Use preferences from @/core/platform/preferencesAdapter instead.',
        },
        {
          name: 'sessionStorage',
          message: 'Use preferences from @/core/platform/preferencesAdapter instead.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'navigator',
          property: 'clipboard',
          message: 'Use getClipboardAdapter() from @/core/platform/clipboardAdapter instead.',
        },
      ],
    },
  },
  // Allow direct browser API access inside the platform adapter layer (it IS the abstraction)
  {
    files: ['src/core/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
);
