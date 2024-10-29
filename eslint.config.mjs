import globals from "globals";
import json from "eslint-plugin-json";
import mozilla from "eslint-plugin-mozilla";

export default [
  {
    ignores: [
      "node_modules/",
      "web-ext-artifacts/",
      "extension/content/diff.js",
      "extension/content/validate.js",
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.es2024,
      },
    },
  },
  ...mozilla.configs["flat/recommended"],
  {
    files: ["**/*.json"],
    plugins: { json },
    processor: json.processors[".json"],
    rules: json.configs.recommended.rules,
  },
  {
    files: ["extension/**"],
    languageOptions: {
      globals: {
        ...globals.webextensions,
      },
    },
  },
  {
    files: ["extension/content/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["extension/experiments/**"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...mozilla.environments.privileged.globals,
      },
    },
  },
  {
    files: [
      ".prettierrc.js",
      "schemas/generateValidator.js",
      "webpack.config.js",
    ],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.node,
      },
    },
  },
];
