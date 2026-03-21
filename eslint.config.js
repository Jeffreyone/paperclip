import tseslintParser from "@typescript-eslint/parser";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.git/**",
      "**/build/**",
      "cli/**",
      "tests/e2e/**",
      "ui/**",
    ],
  },
  {
    files: ["server/src/**/*.ts", "packages/**/*.ts"],
    ignores: [
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.config.ts",
      "**/vitest.config.ts",
      "**/drizzle.config.ts",
    ],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["server/src/__tests__/**/*.ts", "**/*.test.ts"],
    languageOptions: {
      parser: tseslintParser,
    },
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
