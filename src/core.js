import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_PATH = path.join(__dirname, "..", "data", "seed.json");

export function loadData(filePath = DEFAULT_DATA_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function getDriver(data, driverId) {
  return data.drivers.find((driver) => driver.id === driverId);
}

export function getRouteProgress(route) {
  return Math.round((route.completedStops / route.plannedStops) * 100);
}

export function calculateCapacityPressure(driver) {
  if (!driver) return 0;
  return Math.round((driver.used / driver.capacity) * 100);
}

export function calculateSlaRisk(route, data) {
  const driver = getDriver(data, route.driverId);
  const pressure = calculateCapacityPressure(driver);
  const etaGap = route.etaMinutes - route.slaDeadlineMinutes;
  const failedDeliveries = data.deliveries.filter((delivery) => delivery.routeId === route.id && delivery.status === "falha").length;
  const criticalDeliveries = data.deliveries.filter((delivery) => delivery.routeId === route.id && delivery.priority === "critica").length;
  const handoffPenalty = route.handoff === "pendente" ? 22 : route.handoff === "parcial" ? 12 : 0;
  const incidentPenalty = route.incidents.length * 8;
  const score = 18 + Math.max(0, etaGap) * 1.2 + Math.max(0, pressure - 75) * 0.9 + failedDeliveries * 16 + criticalDeliveries * 8 + handoffPenalty + incidentPenalty;

  return Math.max(0, Math.min(99, Math.round(score)));
}

export function classifyRisk(score) {
  if (score >= 80) return "critico";
  if (score >= 55) return "alto";
  if (score >= 38) return "medio";
  return "baixo";
}

export function enrichRoutes(data) {
  return data.routes.map((route) => {
    const driver = getDriver(data, route.driverId);
    const deliveries = data.deliveries.filter((delivery) => delivery.routeId === route.id);
    const riskScore = calculateSlaRisk(route, data);

    return {
      ...route,
      driver,
      progress: getRouteProgress(route),
      capacityPressure: calculateCapacityPressure(driver),
      openStops: route.plannedStops - route.completedStops,
      riskScore,
      riskLevel: classifyRisk(riskScore),
      deliveries,
      failedStops: deliveries.filter((delivery) => delivery.status === "falha").length,
      slaRiskStops: deliveries.filter((delivery) => delivery.status === "risco_sla").length
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

export function buildSummary(data) {
  const routes = enrichRoutes(data);
  const totalStops = routes.reduce((sum, route) => sum + route.plannedStops, 0);
  const completedStops = routes.reduce((sum, route) => sum + route.completedStops, 0);
  const atRiskRoutes = routes.filter((route) => route.riskLevel === "critico" || route.riskLevel === "alto");
  const failedDeliveries = data.deliveries.filter((delivery) => delivery.status === "falha");
  const unassigned = data.deliveries.filter((delivery) => delivery.routeId === "BACKLOG" || delivery.status === "sem_motorista");

  return {
    onTimeRate: Math.round((completedStops / totalStops) * 100),
    activeRoutes: routes.length,
    atRiskRoutes: atRiskRoutes.length,
    failedAttempts: failedDeliveries.length,
    unassignedDeliveries: unassigned.length,
    avgCapacityPressure: Math.round(data.drivers.reduce((sum, driver) => sum + calculateCapacityPressure(driver), 0) / data.drivers.length),
    openIncidents: data.incidents.length,
    pendingHandoffs: data.inventoryHandoffs.filter((handoff) => handoff.status !== "ok").length,
    totalStops,
    completedStops
  };
}

export function buildExceptionQueue(data) {
  const routeMap = new Map(enrichRoutes(data).map((route) => [route.id, route]));
  const incidentItems = data.incidents.map((incident) => {
    const route = routeMap.get(incident.routeId);
    return {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      routeId: incident.routeId,
      title: incident.message,
      owner: route?.driver?.name || "Operação",
      priorityScore: (route?.riskScore || 30) + (incident.severity === "critica" ? 20 : incident.severity === "alta" ? 12 : 4)
    };
  });

  const deliveryItems = data.deliveries
    .filter((delivery) => ["falha", "risco_sla", "sem_motorista"].includes(delivery.status))
    .map((delivery) => ({
      id: delivery.id,
      type: delivery.status,
      severity: delivery.priority === "critica" ? "critica" : "alta",
      routeId: delivery.routeId,
      title: `${delivery.customer} - ${delivery.window}`,
      owner: delivery.routeId === "BACKLOG" ? "Sem motorista" : routeMap.get(delivery.routeId)?.driver?.name,
      priorityScore: delivery.priority === "critica" ? 92 : 72
    }));

  const handoffItems = data.inventoryHandoffs
    .filter((handoff) => handoff.status !== "ok")
    .map((handoff) => ({
      id: `${handoff.sku}-${handoff.routeId}`,
      type: "handoff",
      severity: handoff.status === "pendente" ? "alta" : "media",
      routeId: handoff.routeId,
      title: `${handoff.sku}: ${handoff.scanned}/${handoff.required} volumes no ${handoff.dock}`,
      owner: "Dock/WMS",
      priorityScore: handoff.status === "pendente" ? 78 : 58
    }));

  return [...incidentItems, ...deliveryItems, ...handoffItems].sort((a, b) => b.priorityScore - a.priorityScore);
}

export function buildAutomationSuggestions(data) {
  const queue = buildExceptionQueue(data);
  return queue.slice(0, 6).map((item) => {
    let rule = data.automationRules.find((automation) => automation.trigger === item.type);
    if (!rule && item.type === "capacidade") rule = data.automationRules.find((automation) => automation.id === "AUTO-REALLOCATE");
    if (!rule && item.type === "handoff") rule = data.automationRules.find((automation) => automation.id === "AUTO-DOCK");
    if (!rule && item.type === "falha") rule = data.automationRules.find((automation) => automation.id === "AUTO-FAIL");
    if (!rule) rule = data.automationRules.find((automation) => automation.id === "AUTO-ETA");

    return {
      exceptionId: item.id,
      routeId: item.routeId,
      ruleId: rule.id,
      action: rule.name,
      channel: rule.channel,
      reason: item.title,
      priorityScore: item.priorityScore
    };
  });
}

export function filterDeliveries(data, { route = "all", status = "all", priority = "all", search = "" } = {}) {
  const normalizeText = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const normalized = normalizeText(search.trim());
  return data.deliveries.filter((delivery) => {
    const matchesRoute = route === "all" || delivery.routeId === route;
    const matchesStatus = status === "all" || delivery.status === status;
    const matchesPriority = priority === "all" || delivery.priority === priority;
    const matchesSearch = !normalized || normalizeText(`${delivery.id} ${delivery.customer} ${delivery.window}`).includes(normalized);
    return matchesRoute && matchesStatus && matchesPriority && matchesSearch;
  });
}

export function simulateOptimization(data) {
  const routes = enrichRoutes(data);
  const mostRisky = routes[0];
  const availableDriver = data.drivers
    .filter((driver) => driver.status === "disponivel" || calculateCapacityPressure(driver) < 82)
    .sort((a, b) => calculateCapacityPressure(a) - calculateCapacityPressure(b))[0];
  const criticalDelivery = data.deliveries.find((delivery) => delivery.routeId === mostRisky.id && ["critica", "alta"].includes(delivery.priority) && delivery.status !== "entregue");

  if (!mostRisky || !availableDriver || !criticalDelivery) {
    return { applied: false, message: "Nenhuma redistribuicao recomendada agora.", improvement: 0 };
  }

  const before = mostRisky.riskScore;
  const after = Math.max(12, before - 18);

  return {
    applied: true,
    movedDeliveryId: criticalDelivery.id,
    fromRouteId: mostRisky.id,
    toDriverId: availableDriver.id,
    toDriver: availableDriver.name,
    etaReductionMinutes: 24,
    improvement: before - after,
    message: `Mover ${criticalDelivery.id} para ${availableDriver.name} reduz risco de ${before} para ${after}.`
  };
}

export function applyAutomationBatch(data, limit = 3) {
  const suggestions = buildAutomationSuggestions(data).slice(0, limit);
  return {
    sent: suggestions.length,
    actions: suggestions.map((suggestion) => ({
      ...suggestion,
      status: "simulado",
      message: `${suggestion.action} via ${suggestion.channel} para ${suggestion.routeId}.`
    }))
  };
}
