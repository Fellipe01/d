# DAE Media Intelligence — Contexto para IA

## O que é este projeto

**DAE Media Intelligence** é uma plataforma interna de inteligência de mídia para a agência DAE Assessoria. O sistema consolida dados de campanhas pagas (Meta Ads), CRM (RD Station), gera insights com IA (Claude) e automatiza relatórios semanais.

**Stack:**
- **Frontend:** React 18 + TypeScript + Vite + TanStack Query + Zustand + Recharts + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript + Supabase (PostgreSQL) + Anthropic SDK + node-cron
- **Database:** PostgreSQL via Supabase (project ref: `vebsfoygbyrfnvgbxbrx`)
- **Deployment alvo:** Backend → Railway | Frontend → Vercel

---

## Estrutura de diretórios

```
dae-media-intelligence/
├── CLAUDE.md                        # Este arquivo
├── PRD.md                           # PRD completo do produto
├── .gitignore                       # Ignora backend/.env e frontend/.env
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── supabase-schema.sql          # Schema PostgreSQL para rodar no Supabase
│   └── src/
│       ├── index.ts                 # Entrypoint — inicia scheduler + servidor
│       ├── app.ts                   # Express app + montagem das rotas
│       ├── config/
│       │   ├── env.ts               # Variáveis de ambiente (validadas com Zod)
│       │   ├── supabase.ts          # Cliente Supabase (service role)
│       │   └── database.ts          # Compat shim (aponta para supabase.ts)
│       ├── middleware/
│       │   ├── auth.ts              # Validação de API key (bypass em dev)
│       │   └── error-handler.ts     # Handler global de erros
│       ├── scheduler/
│       │   └── scheduler.ts         # Cron jobs (node-cron, timezone: America/Sao_Paulo)
│       ├── shared/
│       │   ├── errors.ts            # AppError, NotFoundError, ValidationError
│       │   └── utils/
│       │       ├── date.ts          # Utilitários de data (ranges, formatação pt-BR)
│       │       ├── kpi-evaluator.ts # Scoring de KPIs (lower/higher/range)
│       │       └── metrics-calculator.ts # Fórmulas: CTR, CPM, CPC, CPL, frequência
│       └── modules/
│           ├── clients/             # CRUD clientes + KPIs
│           ├── campaigns/           # Campanhas, ad sets, criativos
│           ├── metrics/             # Métricas diárias agregadas
│           ├── insights/            # Geração de insights com Claude AI
│           ├── alerts/              # Alertas automáticos de KPI breach
│           ├── activities/          # Log de atividades manuais
│           ├── funnel/              # Funil CRM (Lead→MQL→SQL→Venda)
│           ├── reports/             # Relatórios gerados
│           └── ingestion/           # Ingestão de dados (mock Meta Ads)
│
└── frontend/
    ├── package.json
    ├── vite.config.ts               # Proxy /api → localhost:3001
    ├── tailwind.config.ts
    └── src/
        ├── main.tsx                 # QueryClientProvider + render
        ├── App.tsx                  # Rotas (BrowserRouter)
        ├── store/index.ts           # Zustand: clienteId, dateRange, sidebar
        ├── api/                     # Módulos axios por domínio
        ├── components/
        │   ├── layout/              # AppShell, Sidebar, TopBar
        │   └── ui/                  # Card, Badge, EmptyState
        ├── pages/                   # Dashboard, Clients, Campaigns, Creatives,
        │                            # Funnel, Insights, Reports, Alerts, Activities
        └── utils/formatters.ts      # fmtCurrency, fmtPct, kpiColor, etc.
```

---

## Banco de dados (PostgreSQL / Supabase)

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `clients` | Clientes da agência (status: active/paused/churned) |
| `client_kpis` | KPIs por cliente (lower_is_better / higher_is_better / range) |
| `campaigns` | Campanhas (platform: meta/google/tiktok) |
| `ad_sets` | Conjuntos de anúncios |
| `creatives` | Criativos (image/video/carousel/story/reel) |
| `metrics_daily` | Métricas diárias por entidade (UNIQUE: entity_type+entity_id+date) |
| `crm_metrics` | Funil CRM diário (leads→mql→sql→sales) |
| `insights` | Insights gerados pelo Claude |
| `reports` | Relatórios publicados |
| `activities` | Log de ações manuais |
| `alerts` | Alertas de KPI breach e saturação |

**Para criar as tabelas:** executar `backend/supabase-schema.sql` no SQL Editor do Supabase.

---

## Variáveis de ambiente (backend/.env)

```env
PORT=3001
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-...
API_URL_supabase=https://vebsfoygbyrfnvgbxbrx.supabase.co
service_role_supabase=eyJ...
META_APP_ID=...
META_APP_SECRET=...
META_ACCESS_TOKEN=...
RDSTATION_ACCESS_TOKEN=...
API_KEY=dae-secret-key-change-in-prod
USE_META_MOCK=true
```

**Mapeamento no env.ts:**
- `API_URL_supabase` → `env.SUPABASE_URL`
- `service_role_supabase` → `env.SUPABASE_SERVICE_ROLE_KEY`

---

## Todos os endpoints da API

Base URL dev: `http://localhost:3001/api`

```
GET  /health

# Clients
GET    /clients
POST   /clients
GET    /clients/:id
PUT    /clients/:id
DELETE /clients/:id
GET    /clients/:id/kpis
PUT    /clients/:id/kpis

# Campaigns / Ad Sets / Creatives
GET  /clients/:clientId/campaigns
POST /clients/:clientId/campaigns
GET  /campaigns/:id
GET  /campaigns/:id/ad-sets
GET  /ad-sets/:id/creatives
GET  /clients/:clientId/creatives
GET  /creatives/:id

# Metrics
GET  /clients/:id/metrics[?start&end]
GET  /clients/:id/metrics/timeseries[?start&end]
GET  /clients/:id/metrics/summary[?start&end]
GET  /clients/:id/metrics/top-creatives[?start&end&limit]
GET  /campaigns/:id/metrics[?start&end]
GET  /creatives/:id/metrics[?start&end]
GET  /creatives/:id/metrics/timeseries[?start&end]

# Insights (AI)
GET   /clients/:id/insights[?limit]
POST  /clients/:id/insights/generate  body: { start?, end?, report_type? }
GET   /insights/:id
PATCH /insights/:id/status            body: { status }

# Reports
GET  /clients/:id/reports
POST /clients/:id/reports/generate    body: { report_type? }
GET  /reports/:id

# Alerts
GET  /clients/:id/alerts[?resolved]
POST /alerts/:id/resolve
POST /clients/:id/alerts/check
GET  /alerts/summary

# Activities
GET  /clients/:id/activities[?limit]
POST /clients/:id/activities

# Funnel
GET  /clients/:id/funnel[?start&end]
GET  /clients/:id/funnel/by-campaign[?start&end]
GET  /clients/:id/funnel/by-creative[?start&end]

# Ingestion
POST /ingestion/:clientId/meta-ads/mock
GET  /ingestion/:clientId/status
```

---

## Scheduler (Cron Jobs)

Arquivo: `backend/src/scheduler/scheduler.ts`
Timezone: `America/Sao_Paulo`

| Horário | Job |
|---------|-----|
| Segunda 9h | `runReports('weekly_mon')` — relatório da semana passada |
| Quarta 9h | `runReports('weekly_wed')` — inteligência mid-week |
| Sexta 9h | `runReports('weekly_fri')` — relatório de atividades |
| Diário 8h | `runAlertChecks()` — verifica KPIs e saturação |

---

## IA — Geração de Insights

**Modelo:** `claude-sonnet-4-6` via `@anthropic-ai/sdk`

**Fluxo:**
1. Busca dados do cliente: KPIs, métricas (7-30 dias), top criativos, funil CRM, alertas ativos
2. Avalia cada KPI com `evaluateAllKpis()` → score e status (on_target / warning / breach)
3. Monta prompt contextual em markdown (`buildWeeklyReportPrompt`)
4. Chama Claude com system prompt de analista de mídia sênior
5. Pós-processa: extrai impact_level, category, summary
6. Salva no banco com `triggered_by`: manual | scheduled | alert

**Tipos de relatório:** `weekly_mon` | `weekly_wed` | `weekly_fri` | `manual`

---

## KPI Scoring

```typescript
// lower_is_better (CPL, CPC, CPM):
rawScore = target / actual   // > 1.0 = bom

// higher_is_better (CTR, ROAS, leads):
rawScore = actual / target   // > 1.0 = bom

// range (frequência 2.0-3.5):
rawScore = 1.0 se em [min, max], senão 0.5

// Status:
// on_target: rawScore >= 1.0
// warning:   0.8 <= rawScore < 1.0
// breach:    rawScore < 0.8

// Severity de alertas:
// critical: rawScore < 0.6
// warning:  rawScore < 0.8
```

---

## Padrões de código

### Backend
- Todos os repositórios são **async/await** (Supabase é assíncrono)
- Handlers de rota sempre `async (req, res, next)` com `try/catch → next(e)`
- Supabase: sempre verificar `if (error) throw error` após queries
- Para `maybeSingle()`: retorna `null` se não encontrado (sem erro)
- Para `single()`: lança erro se não encontrado — usar com cuidado
- Upsert com `onConflict: 'col1,col2'` para INSERT OR REPLACE

### Frontend
- TanStack Query para todos os dados do servidor (staleTime: 2min)
- Zustand para estado global do cliente selecionado e date range
- Axios com interceptor global de erros
- Formulários: controlados com useState simples (sem lib de forms)
- Formatação: sempre usar `formatters.ts` (fmtCurrency, fmtPct, etc.)

---

## Estado atual do projeto

- [x] Schema do banco criado (supabase-schema.sql)
- [x] Backend migrado de SQLite → Supabase (async)
- [x] Todos os módulos implementados (clients, campaigns, metrics, insights, alerts, funnel, reports, activities, ingestion)
- [x] Frontend com todas as páginas (Dashboard, Clients, Campaigns, Creatives, Funnel, Insights, Reports, Alerts, Activities)
- [x] Scheduler de relatórios automáticos
- [x] Mock data generator (90 dias de dados realistas)
- [ ] Build com erros de TypeScript (5 erros de casting pendentes)
- [ ] Schema do Supabase: rodar no dashboard (supabase-schema.sql)
- [ ] Deploy do backend no Railway
- [ ] Deploy do frontend na Vercel
- [ ] Integração real com Meta Ads API (atualmente mock)
- [ ] Integração real com RD Station
- [ ] Autenticação de usuários

---

## Erros de TypeScript pendentes (build)

```
alerts.repository.ts:84    — cast AggregatedMetrics as Record<string,number> → usar as unknown as Record<string,number>
campaigns.repository.ts:79 — cast Record<string,unknown> as AdSet → usar as unknown as AdSet
clients.repository.ts:15   — cast Record<string,unknown> as Client → usar as unknown as Client
insights.service.ts:165    — mesmo cast de AggregatedMetrics
metrics.routes.ts:39       — mesmo cast de AggregatedMetrics
```

**Fix:** Substituir `as Record<string, number>` por `as unknown as Record<string, number>` nos 5 locais.
