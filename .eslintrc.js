/* eslint-env node */
module.exports = {
  plugins: ["mozilla"],
  extends: [
    "eslint:recommended",
    "plugin:prettier/recommended",
    "plugin:mozilla/recommended",
  ],
  overrides: [
    {
      files: ["extension/**"],
      env: {
        webextensions: true,
      },
    },
  ],
};
