import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "release/**",
      "node_modules/**",
      "mcpd-setup/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  tseslint.configs.recommended,
  // CommonJS files legitimately use require().
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Project-wide overrides.
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Too many any usages to fix at once; warn for now, tighten later.
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow require() in Electron main process for dynamic imports.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
