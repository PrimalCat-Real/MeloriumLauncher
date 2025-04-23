import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from "@tailwindcss/vite";
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const toDir = (dir: string) => join(__dirname, dir);

export default defineConfig({
    root: toDir('src/renderer'),
    cacheDir: toDir('node_modules/.vite'),
    base: '',
    build: {
        sourcemap: true,
        outDir: toDir('build/renderer'),
        assetsDir: '.',
        emptyOutDir: true,
    },
    plugins: [react(), tailwindcss(), svgr()],
    server: { port: 3000 },
    resolve: {
        alias: [
            // {
            //     "@": path.resolve(__dirname, "./src"),
            // },
            {
                find: '@',
                replacement: path.resolve(__dirname, "./src"),
            },
            {
                find: /@runtime\/components\/(.*)/,
                replacement: toDir('src/renderer/runtime/components/$1.ts'),
            },
            {
                find: /@runtime\/(.*)/,
                replacement: toDir('src/renderer/runtime/$1.ts'),
            },
            {
                find: /@scripts\/(.*)/,
                replacement: toDir('src/renderer/scripts/$1.ts'),
            },
        ],
    },
});