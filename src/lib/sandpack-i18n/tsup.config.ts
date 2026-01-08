import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["./index.ts"],
    format: ["esm"],
    treeshake: true,
    minify: true,
    dts: false,
    external: ["react", "react-dom"],
    clean: true,
    outDir: "./dist",
    platform: "browser",
    target: "es2020",
    bundle: true,
    noExternal: ["i18next", "react-i18next", "i18next-browser-languagedetector"],
  },
]);
