import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'server/uploads/**'],
  },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // Unused function arguments before a used one are common in Express handlers
      'no-unused-vars': ['error', { args: 'after-used', ignoreRestSiblings: true, caughtErrors: 'none' }],
    },
  },

  // API server and tooling config run in Node
  {
    files: ['server/**/*.js', 'eslint.config.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // The plain HTML pages, until the React client replaces them
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Pages call the API through assets/js/api.js, not fetch directly.' },
      ],
    },
  },
  {
    files: ['public/assets/js/api.js'],
    rules: { 'no-restricted-globals': 'off' },
  },
];
