import * as esbuild from 'esbuild';

async function startDevServer() {
  const ctx = await esbuild.context({
    entryPoints: ['src/main.tsx'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    outfile: 'public/dist/bundle.js',
    tsconfig: 'tsconfig.json',
  });

  await ctx.watch();

  const { host, port } = await ctx.serve({
    servedir: 'public',
    port: 5173,
    host: '127.0.0.1',
  });

  console.log(`Serving at http://${host}:${port}`);
}

startDevServer().catch((err) => {
  console.error(err);
  process.exit(1);
});

