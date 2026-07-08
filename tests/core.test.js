import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAutomationBatch,
  buildAutomationSuggestions,
  buildExceptionQueue,
  buildSummary,
  calculateCapacityPressure,
  enrichRoutes,
  filterDeliveries,
  loadData,
  simulateOptimization
} from "../src/core.js";

const data = loadData();

test("calcula pressao de capacidade do motorista", () => {
  const driver = data.drivers.find((item) => item.id === "DRV-03");
  assert.equal(calculateCapacityPressure(driver), 91);
});

test("enriquece rotas com score, motorista e progresso", () => {
  const routes = enrichRoutes(data);
  const abc = routes.find((route) => route.id === "RTE-2410");

  assert.equal(abc.driver.name, "Igor Santos");
  assert.equal(abc.progress, 42);
  assert.equal(abc.riskLevel, "critico");
});

test("resumo operacional consolida SLA, falhas e handoffs", () => {
  const summary = buildSummary(data);

  assert.equal(summary.activeRoutes, 5);
  assert.equal(summary.failedAttempts, 1);
  assert.equal(summary.pendingHandoffs, 2);
  assert.ok(summary.atRiskRoutes >= 2);
});

test("fila de excecoes prioriza eventos criticos", () => {
  const queue = buildExceptionQueue(data);

  assert.equal(queue[0].severity, "critica");
  assert.ok(queue[0].priorityScore > queue.at(-1).priorityScore);
});

test("sugestoes de automacao conectam excecoes a regras", () => {
  const suggestions = buildAutomationSuggestions(data);

  assert.ok(suggestions.length >= 4);
  assert.ok(suggestions.some((item) => item.channel === "WMS"));
});

test("filtro de entregas combina status, prioridade e busca", () => {
  const deliveries = filterDeliveries(data, {
    status: "risco_sla",
    priority: "critica",
    search: "clinica"
  });

  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].id, "DEL-10052");
});

test("simulacao de otimizacao recomenda redistribuicao", () => {
  const result = simulateOptimization(data);

  assert.equal(result.applied, true);
  assert.ok(result.improvement > 0);
  assert.ok(result.message.includes("reduz risco"));
});

test("batch de automacoes limita a quantidade enviada", () => {
  const result = applyAutomationBatch(data, 2);

  assert.equal(result.sent, 2);
  assert.equal(result.actions.length, 2);
});
