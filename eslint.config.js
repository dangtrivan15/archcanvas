import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "src-tauri", "bak"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // These two rules ship in eslint-plugin-react-hooks v6's recommended set
      // to flag code the React Compiler can't optimize. This project does not
      // run the compiler (plain @vitejs/plugin-react), so they are advisory,
      // not correctness bugs — several flagged sites are intentional patterns
      // (e.g. prev-value refs for animation). Keep them visible as warnings
      // rather than blocking; revisit as errors if the compiler is adopted.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // Honor the codebase's `_`-prefix convention for intentionally-unused
      // bindings (unused params, discarded destructure siblings, caught errors).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
);
