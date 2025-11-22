import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." }
      ]
    })
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      input: {
        background: path.resolve(__dirname, "src/background.ts"),
        content: path.resolve(__dirname, "src/content.ts"),
        popup: path.resolve(__dirname, "src/popup/index.html")
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "popup") return "popup/assets/[name].js";
          return "[name].js";
        },
        chunkFileNames: "popup/assets/[name].js",
        assetFileNames: (asset) => {
          if (asset.name?.endsWith(".css")) return "popup/assets/[name]";
          return "assets/[name]";
        }
      }
    }
  }
});
