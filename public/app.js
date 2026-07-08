const state = {
  status: "all",
  priority: "all",
  search: "",
  automationRuns: 0
};

function qs(selector) {
  return document.querySelector(selector);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
  return response.json();
}

function riskClass(level) {
  return `risk-${level}`;
}

function statusLabel(status) {
  return {
    entregue: "Entregue",
    em_rota: "Em rota",
    pendente: "Pendente",
    risco_sla: "Risco SLA",
    falha: "Falha",
    sem_motorista: "Sem motorista"
  }[status] || status;
}

function renderSummary(summary) {
  qs("#onTimeRate").textContent = `${summary.onTimeRate}%`;
  qs("#stopProgress").textContent = `${summary.completedStops}/${summary.totalStops} paradas`;
  qs("#atRiskRoutes").textContent = summary.atRiskRoutes;
  qs("#openIncidents").textContent = summary.openIncidents;
  qs("#pendingHandoffs").textContent = `${summary.pendingHandoffs} handoffs pendentes`;
  qs("#capacityPressure").textContent = `${summary.avgCapacityPressure}%`;
  qs("#failedAttempts").textContent = `${summary.failedAttempts} falhas`;
}

function renderMap(routes) {
  const canvas = qs("#routeCanvas");
  canvas.innerHTML = routes.map((route, index) => {
    const x = 12 + (index * 17) % 72;
    const y = 18 + (index * 21) % 62;
    const width = 130 + index * 16;
    const angle = index % 2 === 0 ? 19 : -12;
    return `
      <div class="route-line" style="left:${x + 4}%; top:${y + 4}%; width:${width}px; transform:rotate(${angle}deg)"></div>
      <div class="route-dot ${route.riskLevel}" style="left:${x}%; top:${y}%">${route.id.replace("RTE-", "")}</div>
    `;
  }).join("");
}

function renderRoutes(routes) {
  qs("#routeCount").textContent = `${routes.length} rotas em monitoramento`;
  qs("#routeBoard").innerHTML = routes.map((route) => `
    <article class="route-card ${route.riskLevel}">
      <header>
        <strong>${route.id} - ${route.zone}</strong>
        <span class="risk-pill ${riskClass(route.riskLevel)}">${route.riskScore}</span>
      </header>
      <p>${route.driver.name} - ${route.driver.vehicle}</p>
      <div class="route-progress"><span style="width:${route.progress}%"></span></div>
      <div class="route-meta">
        <span><strong>${route.openStops}</strong> abertas</span>
        <span><strong>${route.etaMinutes}min</strong> ETA</span>
        <span><strong>${route.capacityPressure}%</strong> carga</span>
      </div>
    </article>
  `).join("");
}

function renderExceptions(queue) {
  qs("#exceptionQueue").innerHTML = queue.slice(0, 7).map((item) => `
    <article class="exception-item ${item.severity}">
      <header>
        <strong>${item.routeId}</strong>
        <span class="risk-pill risk-${item.severity === "critica" ? "critico" : item.severity === "alta" ? "alto" : "medio"}">${item.priorityScore}</span>
      </header>
      <p>${item.title}</p>
      <p>${item.owner}</p>
    </article>
  `).join("");
}

function renderAutomations(payload) {
  qs("#automationList").innerHTML = payload.suggestions.slice(0, 5).map((item) => `
    <article class="automation-item">
      <header>
        <strong>${item.action}</strong>
        <span class="tag">${item.channel}</span>
      </header>
      <p>${item.routeId} - ${item.reason}</p>
    </article>
  `).join("");
}

function renderDeliveries(payload) {
  qs("#deliveryCount").textContent = `${payload.count} de ${payload.total} entregas`;
  qs("#deliveryBody").innerHTML = payload.deliveries.map((delivery) => `
    <tr>
      <td><strong>${delivery.id}</strong><small>${delivery.customer}</small></td>
      <td>${delivery.routeId}</td>
      <td>${delivery.window}</td>
      <td>${delivery.packages}</td>
      <td><span class="tag">${delivery.priority}</span></td>
      <td><span class="risk-pill ${delivery.status === "falha" || delivery.status === "risco_sla" ? "risk-critico" : "risk-baixo"}">${statusLabel(delivery.status)}</span></td>
      <td>${delivery.attempts}</td>
    </tr>
  `).join("");
}

async function loadDashboard() {
  const deliveryParams = new URLSearchParams({
    status: state.status,
    priority: state.priority,
    search: state.search
  });

  const [summary, routes, exceptions, automations, deliveries] = await Promise.all([
    fetchJson("/api/summary"),
    fetchJson("/api/routes"),
    fetchJson("/api/exceptions"),
    fetchJson("/api/automations"),
    fetchJson(`/api/deliveries?${deliveryParams}`)
  ]);

  renderSummary(summary);
  renderMap(routes.routes);
  renderRoutes(routes.routes);
  renderExceptions(exceptions.queue);
  renderAutomations(automations);
  renderDeliveries(deliveries);
}

async function optimizeRoutes() {
  const result = await fetchJson("/api/optimize", { method: "POST" });
  qs("#optimizationLog").textContent = result.message;
}

async function runAutomations() {
  const result = await fetchJson("/api/automations/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 4 })
  });

  state.automationRuns += result.sent;
  qs("#automationLog").textContent = `${result.sent} acoes simuladas. Total nesta sessao: ${state.automationRuns}.`;
}

function bindEvents() {
  qs("#refreshBtn").addEventListener("click", loadDashboard);
  qs("#optimizeBtn").addEventListener("click", optimizeRoutes);
  qs("#runAutomationBtn").addEventListener("click", runAutomations);
  qs("#statusFilter").addEventListener("change", (event) => {
    state.status = event.target.value;
    loadDashboard();
  });
  qs("#priorityFilter").addEventListener("change", (event) => {
    state.priority = event.target.value;
    loadDashboard();
  });
  qs("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    loadDashboard();
  });
}

bindEvents();
loadDashboard().catch((error) => {
  qs("#automationLog").textContent = error.message;
});
