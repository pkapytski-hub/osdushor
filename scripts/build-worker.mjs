import { build } from "esbuild";

await build({
  entryPoints: ["worker/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile: "worker-dist/index.js",
  loader: { ".sql": "text" },
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});
console.log("Worker bundled to worker-dist/index.js");
