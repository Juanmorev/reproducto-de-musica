// Copies the static site into dist/ so hosts that publish "dist" (Netlify, Vercel) work.
import { cpSync, mkdirSync, rmSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
for (const f of ["index.html", "style.css", "app.js", "config.js"]) cpSync(f, `dist/${f}`);
cpSync("lib", "dist/lib", { recursive: true });
console.log("dist/ ready");
