# LogixOps - Torre de Controle

Torre de controle logística para operações de última milha: rotas, entregas, motoristas, SLA, transferência de estoque, incidentes e automações operacionais.

Este projeto foi criado para portfólio comercial. A ideia é demonstrar capacidade de construir um sistema de operação real, com regras de negócio, API, painel, simulações e dados de exemplo. Não é um CRUD simples.

## Valor comercial

Empresas de entrega, e-commerce, assistências técnicas, distribuidoras e operadores locais precisam reagir rápido a atrasos, falhas de entrega, motoristas sobrecarregados e divergências de separação. O LogixOps centraliza:

- rotas ativas com pontuação de risco;
- SLA por ETA, incidentes, capacidade e tentativas;
- entregas criticas sem motorista ou com risco de atraso;
- transferência de estoque por doca;
- fila de exceções priorizada;
- sugestões de automação para despacho, WMS, cliente e retaguarda.

## Prévia

![Prévia do painel](docs/dashboard-preview.svg)

## Funcionalidades

- Painel responsivo com KPIs operacionais.
- Canvas visual de rotas e risco.
- Quadro de rotas com progresso, ETA, capacidade e motorista.
- Fila de exceções com prioridade combinada.
- Tabela de entregas com busca e filtros por status/prioridade.
- Simulação de otimização de rota.
- Simulação de automações operacionais.
- API REST com Node.js nativo.
- Testes unitarios e testes de API com `node:test`.
- Dockerfile e instruções de publicação.

## Stack

- Node.js nativo
- HTML, CSS e JavaScript puro
- `node:test`
- Dados JSON de exemplo
- Docker

## Como rodar

Requisito: Node.js 20 ou superior.

```bash
npm start
```

Acesse:

```text
http://localhost:3000
```

## Validação

```bash
npm test
npm run smoke
```

Ou tudo junto:

```bash
npm run validate
```

## Endpoints

### `GET /api/health`

Status do serviço.

### `GET /api/summary`

KPIs de operação: taxa no prazo, rotas ativas, rotas em risco, falhas, entregas sem motorista, incidentes e transferências pendentes.

### `GET /api/routes`

Rotas enriquecidas com motorista, progresso, pressão de capacidade, pontuação de SLA e entregas vinculadas.

### `GET /api/deliveries`

Lista entregas com filtros:

- `status=all|risco_sla|falha|sem_motorista|em_rota|entregue`
- `priority=all|critica|alta|media|baixa`
- `search=texto`

### `GET /api/exceptions`

Fila de exceções priorizada por risco operacional.

### `GET /api/automations`

Regras e sugestões de automação.

### `POST /api/optimize`

Simula uma redistribuição de entrega crítica para reduzir risco de rota.

### `POST /api/automations/run`

Simula execução de automações.

Body:

```json
{
  "limit": 4
}
```

## Publicação

### Docker

```bash
docker build -t logix-ops-control-tower .
docker run -p 3000:3000 logix-ops-control-tower
```

### Render, Railway, Fly.io ou similar

- Comando de inicialização: `node src/server.js`
- Porta: usar a variavel `PORT` fornecida pela plataforma.
- O Dockerfile tambem pode ser usado diretamente.

A publicação real não foi incluída porque depende de conta ou credencial configurada na plataforma escolhida.

## Melhorias possíveis

- Persistencia em Postgres.
- WebSocket para atualizacao em tempo real.
- Integração real com roteirizador.
- Integração com WMS/TMS.
- Controle de permissoes por perfil.
- Histórico de incidentes e auditoria.
- Exportação CSV/PDF para operação.
- Notificações reais por WhatsApp, SMS ou email.

## Diferenciais para portfólio

- Resolve uma dor operacional plausível e vendável.
- Tem várias entidades de negócio conectadas.
- Mostra regras de risco, simulação de otimização e automação.
- Inclui API, interface, dados de exemplo, testes e Docker.
- E facil de explicar em proposta freelance como MVP para controle logistico.
