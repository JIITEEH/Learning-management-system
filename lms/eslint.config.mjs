import js from "@eslint/js";
import globals from "globals";

// The two halves of this project run in different places, so they get
// different globals: server/ and scripts/ are Node with ES modules, public/ is
// the browser.
export default [
  {
    ignores: ["node_modules/**", "storage/**"],
  },
  js.configs.recommended,
  {
    files: ["server/**/*.js", "scripts/**/*.mjs", "*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // Routes take `next` and error handlers take four arguments whether or
      // not they use them, so an unused argument prefixed with _ is fine.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-console": "off",
    },
  },
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // The browser half talks to the server through api.js and nowhere else.
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Pages call the API through assets/js/api.js, not fetch directly." },
      ],
    },
  },
  {
    // api.js is the one place the rule above does not apply: it IS the wrapper.
    files: ["public/assets/js/api.js"],
    rules: { "no-restricted-globals": "off" },
  },
];
