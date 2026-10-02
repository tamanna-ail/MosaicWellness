/**
 * Builds the whole app into one self-contained HTML page (for hosting as a
 * claude.ai Artifact or any static file host).
 *   node artifact/build.mjs [out.html]
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.resolve(process.argv[2] ?? path.join(root, "artifact", "continuum.html"));
const tmp = mkdtempSync(path.join(tmpdir(), "continuum-"));

await build({
  entryPoints: [path.join(here, "main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  outfile: path.join(tmp, "app.js"),
  alias: {
    "@": path.join(root, "src"),
    "next/link": path.join(here, "router.tsx"),
    "next/navigation": path.join(here, "router.tsx"),
  },
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_HOST": '"artifact"' },
  logLevel: "warning",
});

execFileSync(path.join(root, "node_modules/.bin/tailwindcss"), ["-i", path.join(here, "styles.css"), "-o", path.join(tmp, "app.css"), "--minify"], { cwd: root, stdio: "inherit" });

const js = readFileSync(path.join(tmp, "app.js"), "utf8").replace(/<\/script/gi, "<\\/script");
const css = readFileSync(path.join(tmp, "app.css"), "utf8");

const html = `<title>healthly</title>
<meta name="description" content="Your lifelong medical record, organised, with an AI companion that answers from your own documents.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Geist+Mono:wght@400;500&family=Geist:wght@300..700&display=swap">
<style>
:root {
  --font-geist-sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-geist-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-serif-display: "Cormorant Garamond", "Iowan Old Style", Georgia, serif;
  --font-hand: "Caveat", "Segoe Script", cursive;
}
${css}
</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
