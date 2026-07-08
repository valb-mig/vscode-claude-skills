const esbuild = require('esbuild');
const fs = require('fs');

const watch = process.argv.includes('--watch');

fs.rmSync('out', { recursive: true, force: true });

const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  minify: !watch,
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('watching...');
  } else {
    await esbuild.build(options);
  }
}

run().catch(() => process.exit(1));
