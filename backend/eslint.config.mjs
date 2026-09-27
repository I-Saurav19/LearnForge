import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
  { files: ["**/*.ts"], languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: "latest", sourceType: "module" } }, rules: { "no-unused-vars": "off" } },
  globalIgnores(["dist/**", "node_modules/**"]),
]);
