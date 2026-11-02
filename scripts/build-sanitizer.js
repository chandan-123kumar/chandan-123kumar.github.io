import {build} from 'esbuild';
// Bundle the sanitizer's ESM parser dependencies into one CommonJS module.
// Vercel's require instrumentation cannot load the parser's ESM entry directly.
await build({entryPoints:['node_modules/sanitize-html/index.js'],outfile:'server/learn/generated-sanitizer.cjs',bundle:true,platform:'node',format:'cjs',target:'node20',logLevel:'warning'});
