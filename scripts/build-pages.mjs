import { mkdir, writeFile } from "node:fs/promises";

const target = new URL(process.env.LIVE_SITE_URL || "");
if (target.protocol !== "https:" || target.username || target.password) {
  throw new Error("LIVE_SITE_URL must be a public HTTPS URL without credentials.");
}
const url = target.href.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${url}">
  <link rel="canonical" href="${url}">
  <meta name="description" content="Open ScopeLog, your workspace for security assessments, evidence, findings, and reports.">
  <title>Open ScopeLog</title>
  <style>
    :root{color-scheme:dark;font-family:system-ui,sans-serif;background:#121212;color:#ededed}
    body{min-height:100vh;margin:0;display:grid;place-items:center}
    main{max-width:34rem;padding:3rem}h1{font-size:3rem;letter-spacing:-.05em;margin:.5rem 0}
    p{color:#a1a1a1;line-height:1.6}a{display:inline-block;margin-top:1rem;background:#3ecf8e;color:#082718;padding:.8rem 1.2rem;border-radius:.5rem;font-weight:650;text-decoration:none}
    a:focus-visible{outline:3px solid white;outline-offset:4px}
  </style>
</head>
<body><main><p>Security research, organized</p><h1>ScopeLog</h1><p>Opening your workspace. If you are not redirected automatically, use the link below.</p><a href="${url}">Open ScopeLog &rarr;</a></main></body>
</html>
`;
await mkdir(".pages", { recursive: true });
await Promise.all([
  writeFile(".pages/index.html", html),
  writeFile(".pages/404.html", html),
  writeFile(".pages/.nojekyll", ""),
]);
console.log(`GitHub Pages will open ${target.origin}`);
