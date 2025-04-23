import { esbuildDecorators } from '@aurora-launcher/esbuild-decorators';
import { context } from 'esbuild';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2));
const watch = args.watch;
const format = 'cjs'; // Всегда используем CommonJS для Electron main process

if (!watch) {
    console.log('Building main process (CommonJS)...');
    console.time('Build completed');
}

const buildOptions = {
    entryPoints: ['src/main/index.ts'],
    bundle: true,
    sourcemap: args.sourcemap ? 'inline' : false,
    platform: 'node',
    target: 'node20',
    format,
    outfile: 'build/main/index.cjs', // Явное указание .cjs
    external: ['electron'],
    keepNames: true,
    loader: {
        '.png': 'file',
        '.pem': 'base64',
    },
    plugins: [esbuildDecorators()],
};

try {
    const ctx = await context(buildOptions);

    if (watch) {
        console.log('Watching for changes...');
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
        console.timeEnd('Build completed');
    }
} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
}