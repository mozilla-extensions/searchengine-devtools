/* eslint-env node */
module.exports = {
  plugins: ["mozilla"],
  extends: ["plugin:mozilla/recommended"],
  env: {
    es2024: true,
  },
  overrides: [
    {
      files: ["extension/**"],
      env: {
        webextensions: true,
      },
    },
    {
      files: ["extension/content/*.mjs"],
      env: {
        browser: true,
      },
      parserOptions: {
        sourceType: "module",
      },
    },
    {
      files: ["extension/experiments/**"],
      env: {
        "mozilla/privileged": true,
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
  },
};
