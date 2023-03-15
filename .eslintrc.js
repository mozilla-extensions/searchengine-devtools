/* eslint-env node */
module.exports = {
  plugins: ["mozilla"],
  extends: ["eslint:recommended", "plugin:mozilla/recommended"],
  rules: {
    // Prettier is handled separately.
    "prettier/prettier": "off",
  },
  overrides: [
    {
      files: ["extension/**"],
      env: {
        webextensions: true,
      },
    },
    {
      files: ["extension/content/*.js", "extension/content/*.mjs"],
      parserOptions: {
        sourceType: "module",
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
  },
};
