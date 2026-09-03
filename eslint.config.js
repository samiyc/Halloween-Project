import js from "@eslint/js";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";

/**
 * Flat config. `eslint-plugin-sonarjs` is the same rule engine that powers
 * SonarLint in the IDE, so violations here match what SonarLint reports.
 *
 * The complexity budget below is the point of this file: it is what stops
 * `game.js` from growing back into a 230-line god module.
 */
const COMPLEXITY_BUDGET = {
  complexity: ["error", { max: 8 }],
  "max-lines-per-function": [
    "error",
    { max: 40, skipBlankLines: true, skipComments: true },
  ],
  "max-lines": ["error", { max: 220, skipBlankLines: true, skipComments: true }],
  "max-depth": ["error", 3],
  "max-params": ["error", 4],
  "max-statements": ["error", 20],
  "max-nested-callbacks": ["error", 2],
  "sonarjs/cognitive-complexity": ["error", 10],
};

export default [
  { ignores: ["node_modules/**", "coverage/**", ".idea/**"] },

  js.configs.recommended,
  sonarjs.configs.recommended,

  {
    // Browser-side game code.
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      ...COMPLEXITY_BUDGET,
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  {
    // Test files: Node globals, and long `describe` bodies are expected.
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...COMPLEXITY_BUDGET,
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      "max-nested-callbacks": ["error", 4],
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-hardcoded-passwords": "off",
    },
  },

  {
    // Config files run in Node.
    files: ["*.js"],
    languageOptions: { globals: globals.node },
  },
];
