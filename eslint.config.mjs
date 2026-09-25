import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'server/uploads/**', 'client/playwright-report/**', 'client/test-results/**'],
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

  // API server, its tests and tooling config files run in Node
  {
    files: ['server/**/*.js', 'client/vite.config.js', 'client/playwright.config.js', 'eslint.config.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Browser tests run in Node, but code passed to page.evaluate runs in the page
  {
    files: ['client/e2e/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // React client
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // Counts components used only in JSX as used
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Screens talk to the server through api-client/api.js, never fetch directly
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Call the server through api-client/api.js.' }],
    },
  },
  {
    files: ['client/src/api-client/api.js'],
    rules: { 'no-restricted-globals': 'off' },
  },
];
