import { defineConfig } from "vite";

export default defineConfig({
    // relative asset URLs so the build also runs from a subpath (GitHub Pages)
    base: "./",
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        target: "esnext",
        sourcemap: true,
    },
    // .wgsl imported via ?raw
    assetsInclude: ["**/*.hdr", "**/*.env"],
});
