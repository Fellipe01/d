# PRD — DAE Media Intelligence
**Versão:** 1.0 (V1 Finalizada)
**Data:** Março 2026
**Responsável:** DAE Assessoria

---

## 1. Visão do Produto

### Problema
Agências de tráfego pago gerenciam múltiplos clientes com dados espalhados em Meta Ads, Google Ads, CRM (RD Station), planilhas e documentos. A análise manual é lenta, propensa a erros e não escala. Relatórios demoram horas para preparar e ficam desatualizados antes de serem entregues.

### Solução
DAE Media Intelligence é uma plataforma centralizada que:
1. **Consolida** dados de campanhas pagas (Meta Ads) e CRM (RD Station) em um único banco de dados
2. **Analisa** automaticamente performance vs. KPIs definidos por cliente
3. **Alerta** proativamente quando métricas entram em zona de risco
4. **Gera relatórios** automaticamente três vezes por semana (segunda, quarta, sexta) com IA (OpenAI) ou template
5. **Apresenta** tudo em uma interface visual clara para o time de analistas
6. **Registra** atividades e tarefas do time com controle de prazo

### Usuários
- **Analistas de tráfego** da DAE Assessoria (usuários primários)
- **Gestores da agência** (painel Admin com visão cross-client)
- **Clientes** (futuro: portal de acesso read-only)

---

## 2. Objetivos e Métricas de Sucesso

| Objetivo | Métrica | Meta |
|----------|---------|------|
| Reduzir tempo de produção de relatórios | Horas/relatório | < 5 min (vs. 2-4h manual) |
| Aumentar cobertura de monitoramento | % clientes monitorados diariamente | 100% |
| Detectar problemas mais rápido | Tempo médio de detecção de KPI breach | < 24h |
| Melhorar qualidade de insights | NPS do time com os relatórios | > 8/10 |

---

## 3. Funcionalidades

### 3.1 Gestão de Clientes
**Status:** ✅ Implementado

- Cadastro de clientes com nome, status, conta de anúncios, token CRM
- Status: `active` | `paused` | `churned`
- Objetivos do cliente (lista de strings)
- Budget mensal em R$
- KPIs customizados por cliente
- Configuração de estágios do funil CRM (MQL, SQL, Venda) por nome e prefixo

**KPIs configuráveis por cliente:**
- Nome do KPI (ex: `cpl`, `ctr`, `leads`, `frequency`)
- Valor alvo (`target_value`)
- Faixa aceitável (`min_value`, `max_value`) para KPIs do tipo range
- Tipo: `lower_is_better` | `higher_is_better` | `range`
- Peso para scoring ponderado

### 3.2 Campanhas, Ad Sets e Criativos
**Status:** ✅ Implementado

- Estrutura hierárquica: Cliente → Campanha → Ad Set → Criativo
- Suporte a plataformas: Meta Ads (ativo), Google Ads e TikTok (schema pronto, não integrado)
- Criativos por tipo: image | video | carousel | story | reel
- Agrupamento de campanhas por objetivo: leads / whatsapp / traffic / other

### 3.3 Ingestão de Dados
**Status:** ✅ Integração real com Meta Ads e RD Station ativa

**Meta Ads:**
- Ingestão via Meta Ads API (Graph API)
- Métricas diárias por campanha, ad set e criativo
- Deduplicação por UPSERT

**RD Station CRM:**
- Integração via RD Station CRM API v1
- Ingestão de deals (incluindo deals perdidos com `win=false`)
- Mapeamento de estágio → nível de funil por posição (stageOrderMap) ou prefixo
- Campo configurável `rd_fonte_field` para filtrar deals por origem (Meta/Ads)
- Todos os deals do funil filtrados por `campaign_id IS NOT NULL` (apenas Meta-atribuídos)

**Métricas suportadas:**
| Métrica | Descrição |
|---------|-----------|
| `spend` | Gasto total |
| `impressions` | Impressões |
| `reach` | Alcance único |
| `frequency` | Impressões/Alcance |
| `clicks` | Cliques no link |
| `ctr` | Taxa de clique (%) |
| `cpc` | Custo por clique |
| `cpm` | Custo por mil impressões |
| `leads` | Leads gerados |
| `cpl` | Custo por lead |
| `messages` | Mensagens iniciadas |
| `cost_per_message` | Custo por mensagem |
| `followers` | Seguidores conquistados |
| `cost_per_follower` | Custo por seguidor |
| `video_views` | Visualizações de vídeo |
| `hook_rate` | Taxa de retenção inicial (%) |

### 3.4 Alertas Automáticos
**Status:** ✅ Implementado

Verificação diária (8h, Sao Paulo) de todos os clientes ativos.

**Tipos de alerta:**
| Tipo | Trigger | Severidade |
|------|---------|------------|
| `kpi_breach` | KPI fora do intervalo aceitável | critical (score < 0.6) ou warning |
| `frequency_high` | Frequência ≥ 4.0 | warning; ≥ 5.0 → critical |

**Deduplicação:** no máximo 1 alerta ativo por KPI por cliente por dia.
**Resolução:** manual pelo analista via interface ou API.

### 3.5 Geração de Relatórios e Insights
**Status:** ✅ Implementado

**Modelo de IA:** OpenAI GPT-4o (`gpt-4o`)

**Quatro tipos de relatório:**

| Tipo | Agenda | Geração | Foco |
|------|--------|---------|------|
| `weekly_mon` | Segunda 9h | Template (sem IA) | Performance de campanhas da semana anterior por tipo |
| `weekly_wed` | Quarta 9h | IA (GPT-4o) | Análise completa com comparação 7d/14d/30d |
| `weekly_fri` | Sexta 9h | Template (sem IA) | Lista de atividades da semana + arquivamento |
| `manual` | On-demand | IA (GPT-4o) | Análise rápida, semana atual, sem comparação temporal |

**Relatório de segunda (template):**
- Agrupa campanhas por objetivo: Leads ([FORMS]/[WPP]), WhatsApp, Tráfego/VP
- Extrai tag `[TAG]` do nome da campanha para nomear grupos
- Mostra métricas relevantes por tipo (CPL/CPMQL para leads, mensagens/custo para WPP, clicks/seguidores para VP)

**Relatório de quarta (IA):**
- System prompt com regras de análise temporal obrigatórias
- Seção `## Evolução (7d vs 14d vs 30d)` obrigatória
- Análise por objetivo de campanha, criativos, funil CRM
- Classificação automática: impact_level, category, summary

**Relatório de sexta (template):**
- Lista atividades não-arquivadas da semana agrupadas por tipo
- Após gerar: arquiva atividades de semanas anteriores (`archived_at`)

**Relatório manual (IA):**
- Análise concisa, semana atual, sem comparação temporal
- Máximo 3 próximos passos

### 3.6 Dashboard e Visualizações
**Status:** ✅ Implementado

**Dashboard principal:**
- Cards de métricas: Spend, Impressões, Leads, CPL, CTR, Frequência, Mensagens, CPC
- Gráfico de tendência de spend (AreaChart, 7-30 dias)
- Tabela de KPIs com status visual (on_target / warning / breach)
- Top 5 criativos com performance comparativa
- Insights recentes (últimos gerados)
- Alertas ativos (banners critical + warning)

**Páginas do sistema:**
- `/` — Dashboard principal do cliente selecionado
- `/clients` — Gestão completa de clientes e KPIs
- `/campaigns` — Lista de campanhas com métricas
- `/creatives` — Browser de criativos com performance
- `/funnel` — Funil CRM (Lead→MQL→SQL→Venda) com breakdown por campanha/criativo
- `/insights` — Histórico e geração manual de insights
- `/reports` — Lista e visualização de relatórios
- `/alerts` — Central de alertas com resolução
- `/activities` — Timeline de atividades manuais
- `/tasks` — Gestão de tarefas com controle de prazo
- `/admin` — Painel administrativo cross-client

### 3.7 Funil CRM
**Status:** ✅ Implementado

Rastreamento do funil completo de conversão com dados do RD Station:

```
Leads → MQL → SQL → Venda
```

- Filtro: apenas deals atribuídos a campanhas Meta (`campaign_id IS NOT NULL`)
- Deals perdidos (`win=false`) contabilizados normalmente por estágio atingido
- Taxa de conversão entre estágios
- Custo por MQL, custo por SQL, custo por Venda
- ROAS
- Quebra por campanha e por criativo

### 3.8 Log de Atividades
**Status:** ✅ Implementado

Tipos de atividade registráveis:
- `budget_change` — Alteração de orçamento
- `creative_pause` / `creative_launch` — Pausar/lançar criativo
- `campaign_pause` / `campaign_launch` — Pausar/lançar campanha
- `kpi_update` — Atualização de metas de KPI
- `note` — Anotação livre
- `meeting` — Reunião com cliente
- `optimization` — Otimização realizada

Atividades arquivadas automaticamente toda sexta após geração do relatório semanal.

### 3.9 Tarefas
**Status:** ✅ Implementado

Sistema de gestão de tarefas por cliente com controle de prazo:

- **Tipos:** todos os tipos de atividade + `other` com campo `custom_type` livre
- **Campos:** título, tipo, data de execução (`due_date`), responsável (`assigned_to`)
- **Status:** `pending` | `done` | `cancelled`
- **Overdue:** tag automática quando `due_date < hoje && status === 'pending'`
- Tarefas concluídas/canceladas agrupadas e recolhidas na interface

### 3.10 Painel Admin
**Status:** ✅ Implementado

Visão cross-client para gestores da agência, sem necessidade de selecionar cliente:

- **Relatórios** — todos os relatórios de todos os clientes com preview expansível
- **Insights** — todos os insights com impact_level e categoria
- **Alertas** — todos os alertas com severity e status
- **Tarefas** — todas as tarefas pendentes com tag de atraso
- **Atividades** — todas as atividades com status de arquivamento
- Ação de delete com confirmação em todas as entidades

---

## 4. Arquitetura Técnica

### 4.1 Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + TypeScript + Vite | React 18, Vite 5 |
| Estilização | Tailwind CSS | v3 |
| Estado server | TanStack Query | v5 |
| Estado client | Zustand | v4 |
| Gráficos | Recharts | v2 |
| Backend | Node.js + Express + TypeScript | Express 4 |
| Database | PostgreSQL via Supabase | — |
| ORM/Client | @supabase/supabase-js | v2 |
| IA | OpenAI SDK (GPT-4o) | openai ^4.47.0 |
| Scheduler | node-cron | v3 |
| Validação | Zod | v3 |

### 4.2 Fluxo de Dados

```
[Meta Ads API]   ──→ [Ingestion Module] ──→ [metrics_daily]
[RD Station API] ──→ [Ingestion Module] ──→ [crm_metrics]
                                                  │
[node-cron]    ──→ [Scheduler] ─────────→ [Reports/Insights Service]
[API request]  ──→ [Reports Route] ─────→ [Reports/Insights Service]
                                                  │
                          ┌───────────────────────┤
                          │                       │
                  [Template Report]        [OpenAI GPT-4o]
                  (Mon/Fri - sem IA)       (Wed/Manual)
                          │                       │
                          └──────────┬────────────┘
                                     │
                              [reports/insights table]
                                     │
                           [Frontend → Dashboard/Reports]
```

### 4.3 Módulos do Backend

```
backend/src/modules/
├── clients/       — CRUD + KPIs + configuração de funil/fonte CRM
├── campaigns/     — Campanhas, ad sets, criativos
├── metrics/       — Métricas diárias e timeseries
├── insights/      — Geração de insights com OpenAI GPT-4o
├── alerts/        — Alertas automáticos de KPI breach
├── activities/    — Log de atividades manuais (com archived_at)
├── funnel/        — Funil CRM (deal-level)
├── reports/       — Relatórios gerados (template + IA)
│   ├── weekly-campaign-report.ts   — Segunda: template por tipo de campanha
│   └── weekly-activities-report.ts — Sexta: template de atividades + arquivamento
├── tasks/         — Tarefas com due_date e status
├── admin/         — Endpoints cross-client para painel Admin
└── ingestion/     — Adapters Meta Ads e RD Station
```

### 4.4 Scheduler (Cron Jobs)

Arquivo: `backend/src/scheduler/scheduler.ts`
Timezone: `America/Sao_Paulo`

| Horário | Job | Tipo |
|---------|-----|------|
| Segunda 9h | `generateWeeklyCampaignReport` | Template (sem IA) |
| Quarta 9h | `generateInsight` (weekly_wed) | OpenAI GPT-4o |
| Sexta 9h | `generateWeeklyActivitiesReport` + `archivePreviousWeekActivities` | Template (sem IA) |
| Diário 8h | `runAlertChecks()` | — |

### 4.5 Autenticação e Segurança

**Atual:**
- Middleware de API Key (`X-API-Key` header)
- Dev: bypass automático
- CORS restrito a origens configuradas + `ALLOWED_ORIGIN` env var
- Service role key do Supabase (acesso total ao banco)

**Pendente:**
- Autenticação de usuários (Supabase Auth ou JWT)
- RLS (Row-Level Security) por cliente
- Portal read-only para clientes finais

---

## 5. Deploy

### Backend → Railway ✅ Live
- Root: `backend/`
- Build: `npm run build`
- Start: `node dist/index.js`
- Cron jobs rodam como processo contínuo no Railway

**Variáveis de ambiente Railway:**
```
PORT=3001
NODE_ENV=production
OPENAI_API_KEY=sk-...
API_URL_supabase=https://...supabase.co
service_role_supabase=eyJ...
META_APP_ID=...
META_APP_SECRET=...
META_ACCESS_TOKEN=...
RDSTATION_ACCESS_TOKEN=...
API_KEY=dae-secret-key-change-in-prod
ALLOWED_ORIGIN=https://seu-frontend.vercel.app
```

### Frontend → Vercel ✅ Live
- Root: `frontend/`
- Build: `npm run build`
- Output: `dist/`
- Variável: `VITE_API_URL` apontando para URL do Railway

---

## 6. Schema do Banco (Supabase)

Arquivo: `backend/supabase-schema.sql`

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `clients` | Clientes da agência |
| `client_kpis` | KPIs por cliente |
| `campaigns` | Campanhas (platform: meta/google/tiktok) |
| `ad_sets` | Conjuntos de anúncios |
| `creatives` | Criativos |
| `metrics_daily` | Métricas diárias por entidade |
| `crm_metrics` | Funil CRM diário (leads→mql→sql→sales) |
| `insights` | Insights gerados pela IA |
| `reports` | Relatórios publicados |
| `activities` | Log de atividades manuais (+ `archived_at TIMESTAMPTZ`) |
| `alerts` | Alertas de KPI breach |
| `tasks` | Tarefas com due_date, status, assigned_to |

### Migrations necessárias (se schema antigo)
```sql
ALTER TABLE activities ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  custom_type TEXT,
  due_date    DATE NOT NULL,
  assigned_to TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Roadmap

### V1 ✅ Concluída — Março 2026
- [x] CRUD de clientes e KPIs
- [x] Estrutura de campanhas/ad sets/criativos
- [x] Integração real Meta Ads API
- [x] Integração real RD Station CRM (deals, funil, deals perdidos)
- [x] Alertas automáticos de KPI
- [x] Relatórios automáticos: segunda (template), quarta (IA), sexta (template+arquivo)
- [x] Relatório manual on-demand (IA, resumido)
- [x] Dashboard com visualizações
- [x] Funil CRM com breakdown por campanha/criativo
- [x] Log de atividades com arquivamento automático
- [x] Módulo de Tarefas com controle de prazo e tag de atraso
- [x] Painel Admin cross-client
- [x] Deploy Railway + Vercel

### V1.1 (próximas semanas)
- [ ] Autenticação de usuários (Supabase Auth)
- [ ] Notificações via WhatsApp/email quando relatório gerado
- [ ] Export de relatórios em PDF

### V1.2 (próximo mês)
- [ ] Portal read-only para clientes
- [ ] RLS (Row-Level Security) no Supabase por cliente
- [ ] Métricas de funil no Dashboard principal

### V2.0 (futuro)
- [ ] Google Ads integration
- [ ] TikTok Ads integration
- [ ] Análise preditiva (forecast de KPIs)
- [ ] Custom report builder
- [ ] Multi-tenancy (agência → clientes com permissões)
- [ ] Benchmarking entre clientes/indústria

---

## 8. Dependências Externas

| Serviço | Uso | Status |
|---------|-----|--------|
| OpenAI API | Geração de insights (GPT-4o) | ✅ Ativo |
| Supabase | PostgreSQL + hosting | ✅ Ativo |
| Meta Ads API | Ingestão de métricas de campanhas | ✅ Integrado |
| RD Station CRM | Dados de funil/CRM | ✅ Integrado |
| Railway | Hosting do backend | ✅ Live |
| Vercel | Hosting do frontend | ✅ Live |

---

## 9. Decisões de Design

### Por que Supabase e não SQLite?
O sistema precisa ser acessível de múltiplos deployments (Railway + localmente em dev). SQLite é um arquivo local — não funciona em ambiente cloud escalável. Supabase oferece PostgreSQL gerenciado com SDK simples.

### Por que Railway e não Vercel para o backend?
O backend usa `node-cron` para disparar relatórios automáticos em horários fixos. Vercel é serverless — processos morrem após cada request. Railway suporta processos contínuos (long-running server), necessário para o scheduler funcionar.

### Por que OpenAI GPT-4o e não Claude?
Migrado de Anthropic Claude Sonnet 4.6 para OpenAI GPT-4o em março de 2026 por questão de disponibilidade de créditos. GPT-4o oferece qualidade equivalente para análise de marketing digital em português.

### Por que relatórios segunda e sexta são templates (sem IA)?
Segunda: dados de campanhas são objetivos e estruturados — template com agrupamento por objetivo gera relatório mais consistente e previsível do que IA. Sexta: o relatório de atividades é um log factual do que foi feito, não uma análise — template é mais apropriado e rápido.

### Por que TanStack Query e não SWR ou fetch manual?
Cache automático, deduplicação de requests, staleTime configurável, e integração nativa com React 18 concurrent features. Reduz boilerplate significativamente vs. useEffect + useState manual.

---

## 10. Glossário

| Termo | Definição |
|-------|-----------|
| CPL | Custo por Lead (spend / leads) |
| CTR | Taxa de clique (clicks / impressions × 100) |
| CPM | Custo por mil impressões (spend / impressions × 1000) |
| CPC | Custo por clique (spend / clicks) |
| ROAS | Return on Ad Spend (revenue / spend) |
| MQL | Marketing Qualified Lead — lead qualificado pelo marketing |
| SQL | Sales Qualified Lead — lead qualificado para vendas |
| Frequência | Média de vezes que um usuário único viu o anúncio (impressões / alcance) |
| Hook Rate | % de usuários que assistiram os primeiros 3s de um vídeo |
| Saturação | Quando a audiência-alvo já foi excessivamente exposta ao anúncio (freq. > 4.0) |
| KPI Breach | Quando um KPI ultrapassa o limite aceitável definido para o cliente |
| Entity | Unidade que tem métricas: campaign, ad_set ou creative |
| Overdue | Tarefa com due_date passada e status pending |
