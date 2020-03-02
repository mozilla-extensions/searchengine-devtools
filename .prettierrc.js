/* eslint-env node */

module.exports = {
  endOfLine: "lf",
  printWidth: 80,
  tabWidth: 2,
  trailingComma: "es5",
  overrides: [
    {
      files: ["*.html", "*.xhtml"],
      options: { parser: "babel" },
    },
  ],
};
