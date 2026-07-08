import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, () => resolve(server.address().port));
  });
}

async function withServer(callback) {
  const server = createServer();
  const port = await listen(server);
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /api/summary retorna KPIs logisticos", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.activeRoutes, 5);
    assert.ok(payload.openIncidents > 0);
  });
});

test("GET /api/deliveries aplica filtros comerciais", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/deliveries?status=sem_motorista&priority=critica`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.count, 1);
    assert.equal(payload.deliveries[0].routeId, "BACKLOG");
  });
});

test("POST /api/optimize simula melhoria de rota", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/optimize`, { method: "POST" });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.applied, true);
    assert.ok(payload.etaReductionMinutes > 0);
  });
});

test("POST /api/automations/run simula acoes operacionais", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/automations/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 4 })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.sent, 4);
    assert.ok(payload.actions[0].message.includes("via"));
  });
});
