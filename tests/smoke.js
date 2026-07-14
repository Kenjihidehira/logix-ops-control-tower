import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "../src/server.js";

const requiredFiles = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "data/seed.json",
  "docs/dashboard-preview.svg",
  "README.md"
];

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(new URL(`../${file}`, import.meta.url)), `${file} ausente`);
}

const server = createServer();
const port = await new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  assert.equal(health.ok, true);

  const html = await fetch(baseUrl).then((response) => response.text());
  assert.ok(html.includes("LogixOps - Torre de Controle"));
  assert.ok(html.includes("Otimizar rotas"));

  const routes = await fetch(`${baseUrl}/api/routes`).then((response) => response.json());
  assert.equal(routes.routes.length, 5);

  const exceptions = await fetch(`${baseUrl}/api/exceptions`).then((response) => response.json());
  assert.ok(exceptions.queue.length >= 6);

  console.log("Smoke test OK: app, API, rotas e exceções respondem corretamente.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
