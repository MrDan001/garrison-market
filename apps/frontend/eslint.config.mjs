import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // These rules are useful guidance, but they currently flag a large
      // amount of existing UI code. Keep the CI lint pass focused on
      // actionable Next.js/TypeScript issues while the code is migrated.
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      // Existing server components intentionally use try/catch around data
      // loading and return JSX from the guarded path. Keep this migration
      // warning non-blocking rather than changing application behavior.
      "react-hooks/error-boundaries": "off",
      // Existing internal navigation uses plain anchors in several legacy
      // server/client components. Keep this guidance non-blocking for CI.
      "@next/next/no-html-link-for-pages": "off"
    }
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts"
  ])
]);
