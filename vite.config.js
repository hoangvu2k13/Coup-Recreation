import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import compression from "vite-plugin-compression";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [
    svelte({
      hot: !isProd,
      compilerOptions: {
        dev: !isProd,
      },
    }),
    compression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024,
    }),
  ],

  build: {
    target: "es2020",
    cssTarget: "chrome80",

    sourcemap: false,
    reportCompressedSize: false,

    minify: "esbuild",
    assetsInlineLimit: 2048,
    terserOptions: undefined,

    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",

        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("firebase")) return "firebase";
            if (id.includes("@iconify")) return "iconify";
            if (id.includes("svelte")) return "svelte";
            return "vendor";
          }
        },
      },
    },

    chunkSizeWarningLimit: 800,
  },

  optimizeDeps: {
    include: ["firebase/app", "firebase/auth", "firebase/database"],
    esbuildOptions: {
      target: "es2020",
    },
  },

  esbuild: {
    legalComments: "none",
    target: "es2020",
    drop: isProd ? ["console", "debugger"] : [],
  },

  server: {
    port: 1710,
    strictPort: true,
    open: false,
  },

  preview: {
    port: 1710,
    strictPort: true,
    open: false,
  },
});
