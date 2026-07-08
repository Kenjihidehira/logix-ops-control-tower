import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAutomationBatch,
  buildAutomationSuggestions,
  buildExceptionQueue,
  buildSummary,
  enrichRoutes,
  filterDeliveries,
  loadData,
  simulateOptimization
} from "./core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload muito grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
      if (url.pathname === "/api/health") {
        return sendJson(res, 200, { ok: true, service: "logix-ops-control-tower" });
      }

      if (url.pathname === "/api/summary") {
        return sendJson(res, 200, buildSummary(loadData()));
      }

      if (url.pathname === "/api/routes") {
        return sendJson(res, 200, { routes: enrichRoutes(loadData()) });
      }

      if (url.pathname === "/api/deliveries") {
        const data = loadData();
        const deliveries = filterDeliveries(data, {
          route: url.searchParams.get("route") || "all",
          status: url.searchParams.get("status") || "all",
          priority: url.searchParams.get("priority") || "all",
          search: url.searchParams.get("search") || ""
        });
        return sendJson(res, 200, { count: deliveries.length, total: data.deliveries.length, deliveries });
      }

      if (url.pathname === "/api/exceptions") {
        return sendJson(res, 200, { queue: buildExceptionQueue(loadData()) });
      }

      if (url.pathname === "/api/automations") {
        const data = loadData();
        return sendJson(res, 200, { rules: data.automationRules, suggestions: buildAutomationSuggestions(data) });
      }

      if (url.pathname === "/api/optimize" && req.method === "POST") {
        return sendJson(res, 200, simulateOptimization(loadData()));
      }

      if (url.pathname === "/api/automations/run" && req.method === "POST") {
        const body = await parseBody(req);
        return sendJson(res, 200, applyAutomationBatch(loadData(), Number(body.limit || 3)));
      }

      if (url.pathname.startsWith("/api/")) {
        return sendJson(res, 404, { error: "Endpoint nao encontrado" });
      }

      return serveStatic(req, res);
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(port, () => {
    console.log(`LogixOps Control Tower rodando em http://localhost:${port}`);
  });
}
