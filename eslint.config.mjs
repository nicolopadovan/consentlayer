import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import compat from "eslint-plugin-compat";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/.nuxt/**", "**/.output/**", "**/.svelte-kit/**", "**/build/**", "**/node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false
        }
      ]
    }
  },
  {
    files: ["packages/consentlayer/{src,test}/{vue,solid}{,.test}.ts", "packages/consentlayer/src/solidstart.ts", "packages/consentlayer/src/nuxt/*.ts", "apps/example-solidstart/**/*.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    ...compat.configs["flat/recommended"],
    files: ["packages/consentlayer/src/**/*.{ts,tsx}"],
    ignores: ["packages/consentlayer/src/{server,nuxt}/**", "packages/consentlayer/src/sentry/{server,next}.ts"],
  }
);

