// Simple build script using esbuild to bundle app.js with n3 and Comunica optionally
const esbuild = require('esbuild')

esbuild.build({
  entryPoints: ['app.js'],
  bundle: true,
  globalName: 'TTLViewerBundle',
  outfile: 'dist/bundle.js',
  minify: true,
  sourcemap: false,
  target: ['es2018'],
  define: { 'process.env.NODE_ENV': '"production"' }
}).catch(()=>process.exit(1))
