import { defineConfig, type Plugin } from "vitest/config"
import path from "path"
import ts from "typescript"

/**
 * Next pins `jsx: "preserve"` in tsconfig.json, so Vite's default transform
 * leaves JSX untouched and any test importing a `.tsx` module fails to parse.
 * Compile those modules with the TypeScript compiler that is already a dev
 * dependency, keeping Next's own settings out of the way.
 */
function jsxTransform(): Plugin {
  return {
    name: "test-tsx-transform",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0]
      if (!file.endsWith(".tsx")) return null
      const { outputText, sourceMapText } = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          jsxImportSource: "react",
          sourceMap: true,
        },
      })
      return { code: outputText, map: sourceMapText ?? null }
    },
  }
}

export default defineConfig({
  plugins: [jsxTransform()],
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
})
