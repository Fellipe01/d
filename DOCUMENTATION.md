# DAE Media Intelligence — Documentação Técnica Completa

**Versão:** 1.0  
**Data:** Março 2026  
**Baseada em:** leitura completa de todos os arquivos do projeto

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Variáveis de Ambiente](#3-variáveis-de-ambiente)
4. [Banco de Dados](#4-banco-de-dados)
5. [Backend — Módulos](#5-backend--módulos)
6. [Scheduler / Cron Jobs](#6-scheduler--cron-jobs)
7. [Integrações Externas](#7-integrações-externas)
8. [KPI Scoring — Lógica Completa](#8-kpi-scoring--lógica-completa)
9. [Frontend — Cada Página](#9-frontend--cada-página)
10. [Componentes Reutilizáveis](#10-componentes-reutilizáveis)
11. [Fluxos Passo a Passo](#11-fluxos-passo-a-passo)
12. [Deploy](#12-deploy)
13. [Prompt Completo da IA](#13-prompt-completo-da-ia)

---

## 1. Visão Geral

### Propósito

**DAE Media Intelligence** é uma plataforma interna de inteligência de mídia para a **DAE Assessoria**, uma agência brasileira de marketing digital especializada em tráfego pago.

O sistema consolida dados de campanhas pagas (Meta Ads) e CRM (RD Station) em um único banco de dados, analisa performance versus KPIs configurados por cliente, emite alertas automáticos de desvio, gera relatórios três vezes por semana (com e sem IA), e apresenta tudo em uma interface visual para o time de analistas.

### Para quem

- **Analistas de tráfego** da DAE Assessoria (usuários primários — gerenciam campanhas, registram atividades, criam tarefas)
- **Gestores da agência** (painel Admin com visão cross-client)
- **Clientes** (futuro: portal read-only — não implementado na V1)

### Por quê

Antes do sistema, analistas gerenciavam múltiplos clientes com dados espalhados em Meta Ads, RD Station, planilhas e documentos. A análise manual levava 2–4 horas por relatório e ficava desatualizada antes de ser entregue. A plataforma reduz isso para menos de 5 minutos.

### URLs de Produção

| Ambiente | URL |
|----------|-----|
| Frontend (Vercel) | Configurável via `VITE_API_URL` — definida no deploy |
| Backend (Railway) | Processo contínuo com `node dist/index.js` — URL gerada pelo Railway |
| Banco de Dados | Supabase project ref: `vebsfoygbyrfnvgbxbrx` |

### Stack Completa com Versões Exatas

#### Backend (`backend/package.json`)

| Pacote | Versão |
|--------|--------|
| Node.js (engine) | >= 20 |
| express | ^4.18.3 |
| openai | ^4.47.0 |
| @supabase/supabase-js | ^2.43.0 |
| cors | ^2.8.5 |
| dotenv | ^16.4.5 |
| node-cron | ^3.0.3 |
| zod | ^3.22.4 |
| typescript | ^5.3.3 |
| tsx (dev) | ^4.7.1 |

#### Frontend (`frontend/package.json`)

| Pacote | Versão |
|--------|--------|
| react | ^18.2.0 |
| react-dom | ^18.2.0 |
| @tanstack/react-query | ^5.28.0 |
| axios | ^1.6.7 |
| date-fns | ^3.3.1 |
| react-markdown | ^9.0.1 |
| react-router-dom | ^6.22.3 |
| recharts | ^2.12.2 |
| zustand | ^4.5.2 |
| vite | ^5.1.5 |
| tailwindcss | ^3.4.1 |
| typescript | ^5.3.3 |

---

## 2. Arquitetura

### Diagrama Textual do Fluxo

```
┌─────────────┐     HTTPS      ┌──────────────────┐     HTTPS     ┌──────────────────┐
│   Browser   │◄──────────────►│  Vercel (React)  │◄─────────────►│ Railway (Express) │
│ (Analista)  │                │  SPA / Vite      │               │  Node.js Backend  │
└─────────────┘                └──────────────────┘               └────────┬─────────┘
                                                                            │
                                                                    Supabase SDK
                                                                   (service role)
                                                                            │
                                                                   ┌────────▼─────────┐
                                                                   │    Supabase       │
                                                                   │  PostgreSQL DB    │
                                                                   │ (vebsfoygbyrfnvg) │
                                                                   └───────────────────┘
                                                                            ▲
                                                                            │
                                              ┌──────────────────┬──────────┘
                                              │                  │
                                   ┌──────────▼────┐   ┌────────▼──────────┐
                                   │  Meta Ads API  │   │  RD Station API   │
                                   │ Graph API v19  │   │  CRM API v1       │
                                   └───────────────┘   └───────────────────┘
                                              │
                                   ┌──────────▼────┐
                                   │  OpenAI API   │
                                   │  (GPT-4o)     │
                                   └───────────────┘
```

### Como Cada Parte se Comunica

#### Browser → Vercel (Frontend)

- SPA React servida via Vercel CDN
- Em desenvolvimento: Vite server em `http://localhost:5173`
- Proxy Vite configurado em `vite.config.ts`: `/api` → `http://localhost:3001`
- Em produção: variável `VITE_API_URL` define a URL base do Railway

#### Vercel (Frontend) → Railway (Backend)

- Chamadas HTTP via Axios (`frontend/src/api/client.ts`)
- Base URL: `import.meta.env.VITE_API_URL ?? '/api'`
- Header fixo: `Content-Type: application/json`
- Em produção: header `X-API-Key` com valor de `API_KEY` do env
- Em desenvolvimento: autenticação bypassada automaticamente

#### Railway (Backend) → Supabase

- Cliente `@supabase/supabase-js` inicializado em `backend/src/config/supabase.ts`
- Usa `service_role_key` (acesso total, sem RLS)
- `auth.persistSession: false` (stateless, cada request é independente)
- Conexão direta PostgreSQL via SDK

#### Backend → Meta Ads API

- Chamadas `fetch` direto para `https://graph.facebook.com/v19.0`
- Token `META_ACCESS_TOKEN` no query param de cada request
- Retry automático com backoff exponencial: 4 tentativas (10s, 20s, 40s, 80s)
- Paginação automática via `graphGetAll()`

#### Backend → RD Station API

- Chamadas `fetch` para `https://crm.rdstation.com/api/v1`
- Token `rdstation_token` do cliente (salvo no banco) passado via query param
- Paginação automática: 200 deals por página

#### Backend → OpenAI API

- SDK `openai` (cliente OpenAI compatível com API key `OPENAI_API_KEY`)
- Modelo: `gpt-4o`
- `max_tokens: 2048`

### Hospedagem e Configurações

| Serviço | Plano / Config | Observação |
|---------|---------------|-----------|
| Railway | Processo contínuo (não serverless) | Necessário para `node-cron` funcionar |
| Vercel | Deploy estático + Edge CDN | Apenas frontend (SPA) |
| Supabase | PostgreSQL gerenciado | Projeto `vebsfoygbyrfnvgbxbrx` |

CORS configurado em `app.ts` para aceitar:
- `http://localhost:5173`
- `http://localhost:3000`
- Valor de `process.env.ALLOWED_ORIGIN` (produção: URL do frontend Vercel)

---

## 3. Variáveis de Ambiente

### Backend (`backend/.env`)

| Variável | Obrigatório | Para que serve | Como obter | Exemplo |
|----------|-------------|----------------|-----------|---------|
| `PORT` | Não | Porta HTTP do servidor Express | Livre escolha | `3001` |
| `NODE_ENV` | Não | Ambiente (`development`/`production`/`test`). Em `development`, autenticação é bypassada | Definir manualmente | `development` |
| `OPENAI_API_KEY` | **Sim** | Chave da API OpenAI para gerar insights e relatórios com GPT-4o | [platform.openai.com](https://platform.openai.com) | `sk-proj-...` |
| `USE_META_MOCK` | Não | Se `true`, o endpoint mock de dados Meta Ads está habilitado. Default: `true` | `true` ou `false` | `true` |
| `META_APP_ID` | Não | ID do aplicativo Meta (necessário para integração real) | Meta for Developers | `1234567890` |
| `META_APP_SECRET` | Não | Secret do aplicativo Meta | Meta for Developers | `abc123...` |
| `META_ACCESS_TOKEN` | Não | Token de acesso longo da conta de anúncios Meta | Meta Business Manager → System User | `EAAa...` |
| `RDSTATION_CLIENT_ID` | Não | Client ID da integração RD Station (não usado no código atual) | App RD Station | `xxx` |
| `RDSTATION_CLIENT_SECRET` | Não | Client secret RD Station (não usado no código atual) | App RD Station | `xxx` |
| `RDSTATION_ACCESS_TOKEN` | Não | Token de acesso RD Station (não usado no código atual; o token por cliente fica no banco) | — | `xxx` |
| `API_KEY` | Não | Chave de API para autenticar requests do frontend em produção. Default: `dae-dev-key` | Criar valor secreto | `dae-secret-key-xxx` |
| `SUPABASE_URL` ou `API_URL_supabase` | **Sim** | URL do projeto Supabase | Supabase Dashboard → Settings → API | `https://vebsfoygbyrfnvgbxbrx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` ou `service_role_supabase` | **Sim** | Chave de service role do Supabase (acesso total) | Supabase Dashboard → Settings → API | `eyJ...` |
| `ALLOWED_ORIGIN` | Não | URL do frontend em produção para configuração de CORS | URL gerada pelo Vercel | `https://dae.vercel.app` |

> **Nota sobre nomes legados:** O `env.ts` aceita tanto `API_URL_supabase` quanto `SUPABASE_URL` (prioridade para o padrão). Idem para `service_role_supabase` / `SUPABASE_SERVICE_ROLE_KEY`.

### Frontend (`frontend/.env`)

| Variável | Obrigatório | Para que serve | Como obter | Exemplo |
|----------|-------------|----------------|-----------|---------|
| `VITE_API_URL` | Não (tem fallback) | URL base da API backend. Se não definida, usa `/api` (proxy Vite em dev) | URL do serviço Railway em produção | `https://dae-backend.railway.app/api` |

---

## 4. Banco de Dados

O schema completo está em `backend/supabase-schema.sql`. Deve ser executado no **SQL Editor** do Supabase (Dashboard → SQL Editor → New Query). É idempotente: usa `CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`.

Extension necessária: `uuid-ossp` (criada automaticamente pelo script).

### Tabela: `clients`

**Propósito:** Cadastro de clientes da agência.

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária autoincremental |
| `name` | TEXT | NOT NULL | — | Nome do cliente |
| `slug` | TEXT | NOT NULL UNIQUE | — | Identificador URL-friendly único |
| `ad_account` | TEXT | NULL | — | ID da conta de anúncios Meta (ex: `act_123456789`) |
| `rdstation_token` | TEXT | NULL | — | Token de acesso da conta RD Station CRM |
| `status` | TEXT | NOT NULL | `'active'` | Status do cliente: `active`, `paused`, `churned` |
| `payment_method` | TEXT | NULL | — | Forma de pagamento (informativo) |
| `objectives` | TEXT | NULL | `'[]'` | JSON string com array de objetivos: `["leads","whatsapp"]` |
| `monthly_budget` | NUMERIC | NULL | — | Orçamento mensal em R$ |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | Data de cadastro |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | Última atualização |

**Colunas adicionais usadas pelo código (migrations necessárias se schema antigo):**

| Coluna | Tipo | Nullable | O que armazena |
|--------|------|----------|----------------|
| `rd_fonte_field` | TEXT | NULL | Valor do campo "Fonte" no RD Station que identifica leads do Meta (ex: `"Meta/Ads"`) |
| `rd_campanha_field` | TEXT | NULL | Nome do campo customizado no RD Station que contém o nome da campanha |
| `rd_criativo_field` | TEXT | NULL | Nome do campo customizado no RD Station que contém o nome do criativo |
| `rd_mql_stage` | TEXT | NULL | Nome do estágio de MQL no pipeline do RD Station |
| `rd_sql_stage` | TEXT | NULL | Nome do estágio de SQL no pipeline do RD Station |
| `rd_venda_stage` | TEXT | NULL | Nome do estágio de venda fechada no pipeline do RD Station |
| `last_meta_sync_at` | TIMESTAMPTZ | NULL | Timestamp da última sincronização com Meta Ads |
| `last_rd_sync_at` | TIMESTAMPTZ | NULL | Timestamp da última sincronização com RD Station |

**Constraints:** `status IN ('active', 'paused', 'churned')`

**Exemplo de dado:**
```json
{
  "id": 1,
  "name": "Empresa XPTO",
  "slug": "empresa-xpto",
  "ad_account": "act_123456789",
  "rdstation_token": "abc123token",
  "status": "active",
  "objectives": "[\"leads\",\"whatsapp\"]",
  "monthly_budget": 5000.00
}
```

---

### Tabela: `client_kpis`

**Propósito:** KPIs configurados por cliente, usados para scoring e alertas.

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `client_id` | BIGINT | NOT NULL | — | FK para `clients.id` (CASCADE DELETE) |
| `kpi_name` | TEXT | NOT NULL | — | Nome do KPI: `cpl`, `ctr`, `cpc`, `cpm`, `frequency`, `leads`, `roas`, `cost_per_message`, `cost_per_follower` |
| `target_value` | NUMERIC | NOT NULL | — | Valor alvo semanal de referência |
| `min_value` | NUMERIC | NULL | — | Valor mínimo aceitável (para tipo `range`) |
| `max_value` | NUMERIC | NULL | — | Valor máximo aceitável (para tipo `range`) |
| `weight` | NUMERIC | NOT NULL | `1.0` | Peso para scoring ponderado |
| `kpi_type` | TEXT | NOT NULL | `'lower_is_better'` | Tipo: `lower_is_better`, `higher_is_better`, `range` |

**Constraints:** `UNIQUE (client_id, kpi_name)` — um KPI por nome por cliente. `kpi_type IN ('lower_is_better', 'higher_is_better', 'range')`.

**Exemplos de dados:**
```json
[
  { "client_id": 1, "kpi_name": "cpl", "target_value": 25.00, "kpi_type": "lower_is_better", "weight": 2.0 },
  { "client_id": 1, "kpi_name": "ctr", "target_value": 2.5, "kpi_type": "higher_is_better", "weight": 1.5 },
  { "client_id": 1, "kpi_name": "frequency", "target_value": 3.5, "min_value": 2.0, "max_value": 3.5, "kpi_type": "range", "weight": 1.0 }
]
```

---

### Tabela: `campaigns`

**Propósito:** Campanhas de anúncios vinculadas a clientes.

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `client_id` | BIGINT | NOT NULL | — | FK para `clients.id` (CASCADE DELETE) |
| `external_id` | TEXT | NULL | — | ID externo da campanha na plataforma (ex: ID Meta) |
| `name` | TEXT | NOT NULL | — | Nome da campanha |
| `platform` | TEXT | NOT NULL | `'meta'` | Plataforma: `meta`, `google`, `tiktok` |
| `status` | TEXT | NOT NULL | `'active'` | Status: `active`, `paused`, `archived` |
| `objective` | TEXT | NULL | — | Objetivo da campanha (ex: `LEAD_GENERATION`, `CONVERSIONS`) |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | Data de criação |

**Constraints:** `platform IN ('meta', 'google', 'tiktok')`, `status IN ('active', 'paused', 'archived')`.

**Índice:** `idx_campaigns_client ON campaigns (client_id, status)`

---

### Tabela: `ad_sets`

**Propósito:** Conjuntos de anúncios dentro de uma campanha.

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `campaign_id` | BIGINT | NOT NULL | — | FK para `campaigns.id` (CASCADE DELETE) |
| `external_id` | TEXT | NULL | — | ID externo no Meta Ads |
| `name` | TEXT | NOT NULL | — | Nome do ad set |
| `targeting` | TEXT | NULL | `'{}'` | JSON string com configurações de segmentação |
| `daily_budget` | NUMERIC | NULL | — | Orçamento diário em R$ |
| `status` | TEXT | NOT NULL | `'active'` | Status do ad set |

---

### Tabela: `creatives`

**Propósito:** Criativos (anúncios individuais) vinculados a ad sets.

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `ad_set_id` | BIGINT | NOT NULL | — | FK para `ad_sets.id` (CASCADE DELETE) |
| `external_id` | TEXT | NULL | — | ID externo do anúncio no Meta |
| `name` | TEXT | NOT NULL | — | Nome do criativo |
| `type` | TEXT | NOT NULL | `'image'` | Tipo: `image`, `video`, `carousel`, `story`, `reel` |
| `thumbnail_url` | TEXT | NULL | — | URL da miniatura do criativo |
| `headline` | TEXT | NULL | — | Título do anúncio |
| `body_text` | TEXT | NULL | — | Texto do corpo do anúncio |
| `cta` | TEXT | NULL | — | Call-to-action (ex: `LEARN_MORE`, `SIGN_UP`) |
| `status` | TEXT | NOT NULL | `'active'` | Status: `active`, `paused`, `archived` |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | Data de criação |

**Constraints:** `type IN ('image', 'video', 'carousel', 'story', 'reel')`, `status IN ('active', 'paused', 'archived')`.

---

### Tabela: `metrics_daily`

**Propósito:** Métricas diárias de campanhas, ad sets e criativos (importadas do Meta Ads).

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `entity_type` | TEXT | NOT NULL | — | Tipo: `campaign`, `ad_set`, `creative` |
| `entity_id` | BIGINT | NOT NULL | — | ID da entidade referenciada |
| `date` | DATE | NOT NULL | — | Data das métricas (YYYY-MM-DD) |
| `spend` | NUMERIC | NULL | `0` | Gasto total em R$ |
| `impressions` | BIGINT | NULL | `0` | Total de impressões |
| `reach` | BIGINT | NULL | `0` | Alcance único (pessoas únicas) |
| `frequency` | NUMERIC | NULL | `0` | Frequência média (impressions/reach) |
| `clicks` | BIGINT | NULL | `0` | Total de cliques no link |
| `ctr` | NUMERIC | NULL | `0` | Taxa de clique em % |
| `cpc` | NUMERIC | NULL | `0` | Custo por clique em R$ |
| `cpm` | NUMERIC | NULL | `0` | Custo por mil impressões em R$ |
| `leads` | BIGINT | NULL | `0` | Total de leads gerados |
| `cpl` | NUMERIC | NULL | `0` | Custo por lead em R$ |
| `messages` | BIGINT | NULL | `0` | Mensagens WhatsApp iniciadas |
| `cost_per_message` | NUMERIC | NULL | `0` | Custo por mensagem em R$ |
| `followers` | BIGINT | NULL | `0` | Seguidores conquistados (ação `like`) |
| `cost_per_follower` | NUMERIC | NULL | `0` | Custo por seguidor em R$ |
| `video_views` | BIGINT | NULL | `0` | Views de vídeo (25% assistido) |
| `hook_rate` | NUMERIC | NULL | `0` | Hook rate em % (views 3s / impressions) |
| `ingested_at` | TIMESTAMPTZ | NOT NULL | NOW() | Timestamp de ingestão |

**Constraint UNIQUE:** `(entity_type, entity_id, date)` — garante uma linha por entidade por dia. Upsert usa este conflito.

**Índices:**
- `idx_metrics_daily_entity ON metrics_daily (entity_type, entity_id, date)`
- `idx_metrics_daily_date ON metrics_daily (date)`

---

### Tabela: `crm_metrics`

**Propósito:** Dados de funil CRM diários importados do RD Station.

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `creative_id` | BIGINT | NULL | — | FK para `creatives.id` (SET NULL) — criativo atribuído ao deal |
| `campaign_id` | BIGINT | NULL | — | FK para `campaigns.id` (CASCADE DELETE) — campanha atribuída ao deal |
| `client_id` | BIGINT | NOT NULL | — | FK para `clients.id` (CASCADE DELETE) |
| `date` | DATE | NOT NULL | — | Data de criação do deal |
| `leads` | BIGINT | NULL | `0` | Total de leads no período |
| `mql` | BIGINT | NULL | `0` | Leads qualificados pelo marketing |
| `sql_count` | BIGINT | NULL | `0` | Leads qualificados para vendas |
| `sales` | BIGINT | NULL | `0` | Vendas fechadas |
| `revenue` | NUMERIC | NULL | `0` | Receita total em R$ |
| `cost_per_mql` | NUMERIC | NULL | `0` | Custo por MQL em R$ |
| `cost_per_sql` | NUMERIC | NULL | `0` | Custo por SQL em R$ |
| `cost_per_sale` | NUMERIC | NULL | `0` | Custo por venda em R$ |
| `roas` | NUMERIC | NULL | `0` | Return on Ad Spend |
| `lead_to_mql_rate` | NUMERIC | NULL | `0` | Taxa Lead→MQL em % |
| `mql_to_sql_rate` | NUMERIC | NULL | `0` | Taxa MQL→SQL em % |
| `sql_to_sale_rate` | NUMERIC | NULL | `0` | Taxa SQL→Venda em % |
| `ingested_at` | TIMESTAMPTZ | NOT NULL | NOW() | Timestamp de ingestão |

**Constraint UNIQUE:** `(client_id, campaign_id, date)`

**Índices:**
- `idx_crm_metrics_client ON crm_metrics (client_id, date)`
- `idx_crm_metrics_campaign ON crm_metrics (campaign_id, date)`

---

### Tabela: `insights`

**Propósito:** Insights gerados pela IA (GPT-4o).

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `client_id` | BIGINT | NOT NULL | — | FK para `clients.id` (CASCADE DELETE) |
| `generated_at` | TIMESTAMPTZ | NOT NULL | NOW() | Timestamp de geração |
| `period_start` | DATE | NOT NULL | — | Início do período analisado |
| `period_end` | DATE | NOT NULL | — | Fim do período analisado |
| `content` | TEXT | NOT NULL | — | Conteúdo completo em Markdown gerado pelo GPT-4o |
| `summary` | TEXT | NULL | — | Resumo extraído automaticamente (primeiros 200 chars sem cabeçalho) |
| `impact_level` | TEXT | NOT NULL | `'medium'` | Nível de impacto: `critical`, `high`, `medium`, `low` |
| `category` | TEXT | NOT NULL | `'performance'` | Categoria: `performance`, `saturation`, `funnel`, `budget`, `creative`, `opportunity` |
| `status` | TEXT | NOT NULL | `'active'` | Status: `active`, `archived`, `actioned` |
| `triggered_by` | TEXT | NOT NULL | `'manual'` | Origem: `manual`, `scheduled`, `alert` |

**Índice:** `idx_insights_client ON insights (client_id, generated_at)`

---

### Tabela: `reports`

**Propósito:** Relatórios gerados (template ou IA).

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `client_id` | BIGINT | NOT NULL | — | FK para `clients.id` (CASCADE DELETE) |
| `report_type` | TEXT | NOT NULL | — | Tipo: `weekly_mon`, `weekly_wed`, `weekly_fri`, `manual` |
| `generated_at` | TIMESTAMPTZ | NOT NULL | NOW() | Timestamp de geração |
| `period_start` | DATE | NOT NULL | — | Início do período coberto |
| `period_end` | DATE | NOT NULL | — | Fim do período coberto |
| `content` | TEXT | NOT NULL | — | Conteúdo em texto/Markdown |
| `status` | TEXT | NOT NULL | `'draft'` | Status: `draft`, `published` |

---

### Tabela: `activities`

**Propósito:** Log de atividades manuais registradas pelo time.

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `client_id` | BIGINT | NOT NULL | — | FK para `clients.id` (CASCADE DELETE) |
| `activity_type` | TEXT | NOT NULL | — | Tipo: `budget_change`, `creative_pause`, `creative_launch`, `campaign_pause`, `campaign_launch`, `kpi_update`, `note`, `meeting`, `optimization` |
| `description` | TEXT | NOT NULL | — | Descrição da atividade realizada |
| `executed_at` | TIMESTAMPTZ | NOT NULL | NOW() | Quando foi executada |
| `executed_by` | TEXT | NOT NULL | `'agency'` | Quem executou |
| `campaign_id` | BIGINT | NULL | — | FK para `campaigns.id` (SET NULL) |
| `creative_id` | BIGINT | NULL | — | FK para `creatives.id` (SET NULL) |
| `metadata` | TEXT | NULL | `'{}'` | JSON string com dados adicionais |
| `archived_at` | TIMESTAMPTZ | NULL | NULL | Quando foi arquivada (setado automaticamente toda sexta) |

**Índice:** `idx_activities_client ON activities (client_id, executed_at)`

---

### Tabela: `alerts`

**Propósito:** Alertas automáticos de KPI breach e saturação.

| Coluna | Tipo | Nullable | Default | O que armazena |
|--------|------|----------|---------|----------------|
| `id` | BIGSERIAL | NOT NULL | auto | Chave primária |
| `client_id` | BIGINT | NOT NULL | — | FK para `clients.id` (CASCADE DELETE) |
| `alert_type` | TEXT | NOT NULL | — | Tipo: `kpi_breach`, `saturation`, `budget_pacing`, `funnel_drop`, `ctr_drop`, `frequency_high`, `cpl_spike` |
| `severity` | TEXT | NOT NULL | `'warning'` | Severidade: `critical`, `warning`, `info` |
| `message` | TEXT | NOT NULL | — | Mensagem descritiva do alerta |
| `entity_type` | TEXT | NULL | — | Tipo da entidade afetada (`client`, `campaign`, etc.) |
| `entity_id` | BIGINT | NULL | — | ID da entidade afetada |
| `kpi_name` | TEXT | NULL | — | Nome do KPI em violação |
| `actual_value` | NUMERIC | NULL | — | Valor atual do KPI |
| `threshold_value` | NUMERIC | NULL | — | Valor limite/meta do KPI |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | Timestamp de criação |
| `resolved_at` | TIMESTAMPTZ | NULL | NULL | Quando foi resolvido (NULL = ativo) |
| `resolved_by` | TEXT | NULL | NULL | Quem resolveu |

**Índice:** `idx_alerts_client ON alerts (client_id, created_at)`

---

### Tabela: `tasks`

**Propósito:** Tarefas com controle de prazo vinculadas a clientes.

> Esta tabela **não está no `supabase-schema.sql` original** — precisa ser criada via migration:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  task_type    TEXT NOT NULL,
  custom_type  TEXT,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     DATE NOT NULL,
  assigned_to  TEXT NOT NULL DEFAULT 'DAE Assessoria',
  campaign_id  INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

| Coluna | Tipo | Nullable | O que armazena |
|--------|------|----------|----------------|
| `id` | SERIAL | NOT NULL | Chave primária |
| `client_id` | INTEGER | NOT NULL | FK para `clients.id` |
| `task_type` | TEXT | NOT NULL | Tipo: mesmo valores de `activity_type` + `other` |
| `custom_type` | TEXT | NULL | Descrição livre quando `task_type = 'other'` |
| `title` | TEXT | NOT NULL | Título da tarefa |
| `description` | TEXT | NULL | Descrição detalhada |
| `due_date` | DATE | NOT NULL | Data de execução planejada |
| `assigned_to` | TEXT | NOT NULL | Responsável, default `'DAE Assessoria'` |
| `campaign_id` | INTEGER | NULL | Campanha relacionada (opcional) |
| `status` | TEXT | NOT NULL | Status: `pending`, `done`, `cancelled` |
| `completed_at` | TIMESTAMPTZ | NULL | Timestamp de conclusão |
| `created_at` | TIMESTAMPTZ | NULL | Data de criação |

---

### Migration Necessária para Atividades (campo `archived_at`)

```sql
ALTER TABLE activities ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
```

---

## 5. Backend — Módulos

### Módulo: `clients`

**Arquivo de rotas:** `backend/src/modules/clients/clients.routes.ts`  
**Montagem:** `app.use('/api/clients', clientsRouter)`

#### Rotas

| Método | Path | Parâmetros | Body | Resposta | Erros |
|--------|------|-----------|------|----------|-------|
| GET | `/api/clients` | — | — | `Client[]` | 500 |
| POST | `/api/clients` | — | `{ name, slug?, ad_account?, rdstation_token?, status?, payment_method?, objectives?, monthly_budget? }` | `Client` (201) | 400, 500 |
| GET | `/api/clients/:id` | `id: number` | — | `Client` | 404, 400 |
| PUT | `/api/clients/:id` | `id: number` | Campos parciais de `Client` | `Client` | 404, 500 |
| DELETE | `/api/clients/:id` | `id: number` | — | 204 | 404, 500 |
| GET | `/api/clients/:id/kpis` | `id: number` | — | `ClientKpi[]` | 404, 500 |
| PUT | `/api/clients/:id/kpis` | `id: number` | `{ kpis: ClientKpi[] }` | `ClientKpi[]` | 400, 500 |

#### Função: `findKpisByClientId(clientId)`

Busca todos os KPIs configurados para um cliente.

```typescript
SELECT * FROM client_kpis WHERE client_id = clientId
```

Retorna `ClientKpi[]` (pode ser array vazio).

#### Função: `findClientById(clientId)`

```typescript
SELECT * FROM clients WHERE id = clientId LIMIT 1
// usa .maybeSingle() — retorna null se não encontrado
```

#### Função: `upsertKpis(clientId, kpis[])`

Para cada KPI recebido, faz upsert com `onConflict: 'client_id,kpi_name'`. Permite atualizar targets sem deletar e recriar.

---

### Módulo: `campaigns`

**Arquivo de rotas:** `backend/src/modules/campaigns/campaigns.routes.ts`  
**Montagem:** `app.use('/api', campaignsRouter)`

#### Rotas

| Método | Path | Parâmetros | Body | Resposta | Erros |
|--------|------|-----------|------|----------|-------|
| GET | `/api/clients/:clientId/campaigns` | `clientId: number`, `?status` | — | `Campaign[]` | 400, 500 |
| POST | `/api/clients/:clientId/campaigns` | `clientId: number` | `{ name, platform?, status?, objective?, external_id? }` | `Campaign` (201) | 400, 500 |
| GET | `/api/campaigns/:id` | `id: number` | — | `Campaign & { ad_sets: AdSet[] }` | 404, 400 |
| GET | `/api/campaigns/:id/ad-sets` | `id: number` | — | `AdSet[]` | 400, 500 |
| GET | `/api/ad-sets/:id/creatives` | `id: number` | — | `Creative[]` | 400, 500 |
| GET | `/api/clients/:clientId/creatives` | `clientId: number` | — | `Creative[]` | 400, 500 |
| GET | `/api/creatives/:id` | `id: number` | — | `Creative` | 404, 400 |

#### Função: `findCampaignsByClient(clientId, status?)`

```typescript
SELECT * FROM campaigns WHERE client_id = clientId [AND status = status]
```

#### Função: `findCreativesByClient(clientId)`

Busca todos os criativos do cliente fazendo join implícito via:
1. Busca ad_sets vinculados às campanhas do cliente
2. Busca criativos vinculados a esses ad_sets

---

### Módulo: `metrics`

**Arquivo de rotas:** `backend/src/modules/metrics/metrics.routes.ts`  
**Montagem:** `app.use('/api', metricsRouter)`

**Range padrão:** últimos 7 dias (quando `start` e `end` não fornecidos).

#### Rotas

| Método | Path | Query Params | Resposta |
|--------|------|-------------|----------|
| GET | `/api/clients/:id/metrics` | `?start&end` | `AggregatedMetrics` |
| GET | `/api/clients/:id/metrics/timeseries` | `?start&end` | `TimeseriesRow[]` preenchido dia a dia |
| GET | `/api/clients/:id/metrics/summary` | `?start&end` | `{ metrics, kpi_results, period }` |
| GET | `/api/clients/:id/metrics/top-creatives` | `?start&end&limit=10` | `TopCreative[]` |
| GET | `/api/campaigns/:id/metrics` | `?start&end` | `AggregatedMetrics` |
| GET | `/api/creatives/:id/metrics` | `?start&end` | `AggregatedMetrics` |
| GET | `/api/creatives/:id/metrics/timeseries` | `?start&end` | `MetricsRow[]` |

#### Endpoint `/api/clients/:id/metrics/summary` — lógica detalhada

1. Busca `AggregatedMetrics` do cliente no período
2. Busca `ClientKpi[]` do cliente
3. Calcula quantos dias tem o período
4. Escala os KPIs **cumulativos** (`leads`, `messages`, `clicks`, `impressions`, `followers`) proporcionalmente: `target * (days / 7)` — os targets são armazenados como referência semanal de 7 dias
5. Chama `evaluateAllKpis(metrics, scaledKpis)` para obter `KpiResult[]`
6. Retorna `{ metrics, kpi_results, period }`

#### Função: `getClientMetrics(clientId, start, end)` → `AggregatedMetrics`

1. Busca IDs de campanhas do cliente
2. Busca `metrics_daily` onde `entity_type = 'campaign'` e `entity_id IN (campaignIds)`
3. Soma todas as colunas com `sumRows()`
4. Calcula métricas derivadas com `buildAggregated()`:
   - `frequency = impressions / reach`
   - `ctr = (clicks / impressions) * 100`
   - `cpc = spend / clicks`
   - `cpm = (spend / impressions) * 1000`
   - `cpl = spend / leads`
   - `cost_per_message = spend / messages`
   - `cost_per_follower = spend / followers`

#### Função: `getTopCreativesByClient(clientId, start, end, limit)` → `TopCreative[]`

Pipeline de 5 queries:
1. Busca campaign IDs e names do cliente
2. Busca ad_set IDs dessas campanhas (com mapeamento adSet→campaign)
3. Busca criativos dos ad_sets
4. Busca métricas diárias dos criativos no período
5. Busca MQL da tabela `crm_metrics` por creative_id
6. Agrega tudo em JS, calcula CPL, cost_per_message, cost_per_video_view
7. Ordena por impressões decrescentes, retorna top `limit`

---

### Módulo: `insights`

**Arquivo de rotas:** `backend/src/modules/insights/insights.routes.ts`  
**Arquivo de serviço:** `backend/src/modules/insights/insights.service.ts`  
**Montagem:** `app.use('/api', insightsRouter)`

#### Rotas

| Método | Path | Parâmetros | Body | Resposta |
|--------|------|-----------|------|----------|
| GET | `/api/clients/:id/insights` | `?limit=20` | — | `Insight[]` |
| POST | `/api/clients/:id/insights/generate` | — | `{ start?, end?, report_type? }` | `Insight` (201) |
| GET | `/api/insights/:id` | `id: number` | — | `Insight` ou 404 |
| PATCH | `/api/insights/:id/status` | `id: number` | `{ status: 'active'|'archived'|'actioned' }` | `{ ok: true }` |

#### Função: `generateInsight(clientId, periodStart, periodEnd, reportType, triggeredBy)`

Passo a passo completo:

1. Busca o cliente com `findClientById(clientId)` — lança `NotFoundError` se não existir
2. Em paralelo (`Promise.all`), busca:
   - KPIs do cliente (`findKpisByClientId`)
   - Métricas agregadas do período (`getClientMetrics`)
   - Top 10 criativos (`getTopCreativesByClient`)
   - Resumo CRM (`getCrmSummary` — agrega `crm_metrics` no período)
   - Alertas ativos (`getActiveAlerts` — últimos 10 alertas não resolvidos)
3. Avalia KPIs com `evaluateAllKpis(metrics, kpis)` → `KpiResult[]`
4. Monta contexto `WeeklyReportContext` com todos os dados
5. Chama `buildWeeklyReportPrompt(ctx)` para gerar o user prompt
6. Chama OpenAI `chat.completions.create`:
   - model: `gpt-4o`
   - max_tokens: 2048
   - system: `SYSTEM_PROMPT`
   - user: prompt gerado
7. Extrai do conteúdo gerado:
   - `impact_level`: procura palavras-chave `crítico`, `alto`, `baixo` no texto
   - `category`: procura `saturação`, `funil`, `orçamento`, `criativo`, `oportunidade`
   - `summary`: primeira linha não-cabeçalho com mais de 30 chars, limitada a 200 chars
8. Insere no banco `insights` com `.insert().select().single()`
9. Retorna o `Insight` criado

---

### Módulo: `alerts`

**Arquivo de rotas:** `backend/src/modules/alerts/alerts.routes.ts`  
**Arquivo de repositório:** `backend/src/modules/alerts/alerts.repository.ts`  
**Montagem:** `app.use('/api', alertsRouter)`

#### Rotas

| Método | Path | Parâmetros | Body | Resposta |
|--------|------|-----------|------|----------|
| GET | `/api/clients/:id/alerts` | `?resolved=true` | — | `Alert[]` (ativo por default) |
| POST | `/api/alerts/:id/resolve` | `id: number` | `{ resolved_by? }` | `{ ok: true }` |
| POST | `/api/clients/:id/alerts/check` | `id: number` | — | `{ ok: true }` |
| GET | `/api/alerts/summary` | — | — | `{ client_id, severity, count }[]` |

#### Função: `checkAndCreateAlerts(clientId)`

Passo a passo:

1. Busca o cliente e seus KPIs
2. Busca métricas dos últimos 7 dias (`getClientMetrics`)
3. Para cada KPI configurado:
   - Avalia com `evaluateKpi(actual, kpi)` → `KpiResult`
   - Se `status === 'breach'`:
     - Verifica se já existe alerta ativo para este KPI criado nas últimas 24h (deduplicação)
     - Se não existe: cria alerta com `severity = 'critical'` se `raw_score < 0.6`, senão `'warning'`
     - Mensagem: `KPI "cpl" está acima do limite aceitável. Real: 45.00 | Meta: 25.00`
4. Verifica frequência separadamente:
   - Se `frequency >= 4.0` e não há alerta de `frequency_high` nas últimas 24h:
     - Cria alerta com `severity = 'critical'` se `>= 5.0`, senão `'warning'`
     - Threshold registrado: `3.5`

#### Função: `resolveAlert(id, resolvedBy)`

```typescript
UPDATE alerts SET resolved_at = NOW(), resolved_by = resolvedBy WHERE id = id
```

#### Função: `getAlertSummary()`

Agrega alertas não resolvidos em JS, retorna array de `{ client_id, severity, count }`.

---

### Módulo: `activities`

**Arquivo de rotas:** `backend/src/modules/activities/activities.routes.ts`  
**Montagem:** `app.use('/api', activitiesRouter)`

#### Rotas

| Método | Path | Parâmetros | Body | Resposta |
|--------|------|-----------|------|----------|
| GET | `/api/clients/:id/activities` | `?limit=50` | — | `Activity[]` ordenado por `executed_at DESC` |
| POST | `/api/clients/:id/activities` | — | `{ activity_type, description, executed_by?, campaign_id?, creative_id?, metadata? }` | `Activity` (201) |

**Tipos válidos de `activity_type`:** `budget_change`, `creative_pause`, `creative_launch`, `campaign_pause`, `campaign_launch`, `kpi_update`, `note`, `meeting`, `optimization`.

`executed_by` default: `'agency'`

---

### Módulo: `funnel`

**Arquivo de rotas:** `backend/src/modules/funnel/funnel.routes.ts`  
**Montagem:** `app.use('/api', funnelRouter)`

#### Rotas

| Método | Path | Query Params | Resposta |
|--------|------|-------------|----------|
| GET | `/api/clients/:id/funnel` | `?start&end` | Totais agregados do funil + custos |
| GET | `/api/clients/:id/funnel/by-campaign` | `?start&end` | Funil quebrado por campanha |
| GET | `/api/clients/:id/funnel/by-creative` | `?start&end` | Funil quebrado por criativo |

#### Endpoint `/api/clients/:id/funnel` — lógica

1. Busca `crm_metrics` no período onde `campaign_id IS NOT NULL`
2. Soma `leads`, `mql`, `sql_count`, `sales`, `revenue`
3. Busca campanhas do cliente → IDs
4. Busca `metrics_daily` das campanhas para somar `spend`
5. Calcula:
   - `cost_per_lead = spend / leads`
   - `cost_per_mql = spend / mql`
   - `cost_per_sql = spend / sql`
   - `cost_per_sale = spend / sales`

#### Endpoint `/api/clients/:id/funnel/by-campaign`

Agrega métricas de funil por `campaign_id`, enriquece com nome da campanha, ordena por `sales` decrescente.

#### Endpoint `/api/clients/:id/funnel/by-creative`

Agrega métricas de funil por `creative_id`, enriquece com nome e tipo do criativo, ordena por `sales` decrescente.

---

### Módulo: `reports`

**Arquivo de rotas:** `backend/src/modules/reports/reports.routes.ts`  
**Montagem:** `app.use('/api', reportsRouter)`

#### Rotas

| Método | Path | Parâmetros | Body | Resposta |
|--------|------|-----------|------|----------|
| GET | `/api/clients/:id/reports` | — | — | `Report[]` (sem `content`, max 50) |
| GET | `/api/reports/:id` | `id: number` | — | `Report` completo com `content` |
| POST | `/api/clients/:id/reports/generate` | — | `{ report_type?: 'weekly_mon'|'weekly_wed'|'weekly_fri'|'manual' }` | `Report` (201) |

#### Endpoint POST `/api/clients/:id/reports/generate` — lógica

1. Determina `report_type` (default: `'manual'`)
2. Calcula range:
   - `weekly_mon` → `lastWeekRange()` (semana anterior completa)
   - outros → `currentWeekRange()` (segunda-feira até hoje)
3. Gera conteúdo:
   - `weekly_mon` → `generateWeeklyCampaignReport(clientId, start, end)` (template sem IA)
   - `weekly_fri` → `generateWeeklyActivitiesReport(clientId, start, end)` + arquiva atividades
   - `weekly_wed` ou `manual` → `generateInsight(clientId, start, end, type, 'scheduled')` (GPT-4o)
4. Insere em `reports` com `status: 'published'`

---

### Módulo: `ingestion`

**Arquivo de rotas:** `backend/src/modules/ingestion/ingestion.routes.ts`  
**Montagem:** `app.use('/api', ingestionRouter)`

#### Rotas

| Método | Path | Parâmetros | Observação |
|--------|------|-----------|-----------|
| POST | `/api/ingestion/:clientId/meta-ads/mock` | `clientId: number` | Só funciona se `USE_META_MOCK=true` |
| POST | `/api/ingestion/:clientId/meta-ads/sync` | `clientId: number` | Sincroniza dados reais do Meta Ads |
| POST | `/api/ingestion/:clientId/rd-station/sync` | `clientId: number` | Sincroniza dados reais do RD Station |
| GET | `/api/ingestion/:clientId/status` | `clientId: number` | Retorna `{ last_ingestion, total_rows }` |

---

### Módulo: `tasks`

**Arquivo de rotas:** `backend/src/modules/tasks/tasks.routes.ts`  
**Montagem:** `app.use('/api', tasksRouter)`

#### Rotas

| Método | Path | Parâmetros | Body | Resposta |
|--------|------|-----------|------|----------|
| GET | `/api/clients/:id/tasks` | `?status` | — | `Task[]` ordenado por `due_date ASC` |
| POST | `/api/clients/:id/tasks` | — | `{ task_type, custom_type?, title, description?, due_date, assigned_to?, campaign_id? }` | `Task` (201) |
| PATCH | `/api/tasks/:id/complete` | `id: number` | — | `Task` com `status='done'` e `completed_at` |
| PATCH | `/api/tasks/:id/cancel` | `id: number` | — | `Task` com `status='cancelled'` |
| DELETE | `/api/tasks/:id` | `id: number` | — | 204 |

`custom_type` só é salvo quando `task_type === 'other'`, senão é `null`.

---

### Módulo: `admin`

**Arquivo de rotas:** `backend/src/modules/admin/admin.routes.ts`  
**Montagem:** `app.use('/api', adminRouter)`

Endpoints cross-client para painel Admin. Todos retornam dados de todos os clientes, enriquecidos com `client_name`.

#### Rotas

| Método | Path | Limit | Resposta |
|--------|------|-------|----------|
| GET | `/api/admin/reports` | 200 | Todos os relatórios + `client_name` |
| DELETE | `/api/admin/reports/:id` | — | 204 |
| GET | `/api/admin/insights` | 200 | Todos os insights (sem `content`) + `client_name` |
| DELETE | `/api/admin/insights/:id` | — | 204 |
| GET | `/api/admin/alerts` | 200 | Todos os alertas + `client_name` |
| DELETE | `/api/admin/alerts/:id` | — | 204 |
| GET | `/api/admin/tasks` | 200 | Todas as tarefas ordenadas por `due_date` + `client_name` |
| GET | `/api/admin/activities` | 200 | Todas as atividades + `client_name` |
| DELETE | `/api/admin/activities/:id` | — | 204 |

---

### Middleware: `authMiddleware`

**Arquivo:** `backend/src/middleware/auth.ts`

- Em `NODE_ENV === 'development'`: chama `next()` diretamente sem verificar
- Em produção: lê header `x-api-key`, compara com `env.API_KEY`, retorna 401 se diferente

**Nota:** O middleware está definido mas **não está aplicado globalmente** no `app.ts` atual. Rotas não têm `authMiddleware` como middleware individual. O CORS com `ALLOWED_ORIGIN` é a proteção em produção.

### Middleware: `errorHandler`

**Arquivo:** `backend/src/middleware/error-handler.ts`

- Se o erro é `instanceof AppError`: retorna `{ error: { message, code } }` com o `statusCode` da instância
- Caso contrário: loga com `console.error` e retorna 500 `{ error: { message: 'Internal server error' } }`

### Guard de Parâmetros Numéricos

No `app.ts`, antes das rotas:

```typescript
app.param(['id', 'clientId', 'campaignId', 'creativeId', 'adSetId'], (req, res, next, val) => {
  if (isNaN(Number(val))) {
    res.status(400).json({ error: { message: `Invalid ID: ${val}`, code: 'INVALID_ID' } });
    return;
  }
  next();
});
```

Rejeita qualquer parâmetro de rota numérico que não seja um número válido antes de qualquer handler.

---

## 6. Scheduler / Cron Jobs

**Arquivo:** `backend/src/scheduler/scheduler.ts`  
**Iniciado em:** `backend/src/index.ts` via `startScheduler()`  
**Timezone:** `America/Sao_Paulo` (em todos os jobs)

### Jobs Registrados

| Expressão Cron | Horário (Brasília) | Função | O que executa |
|----------------|-------------------|--------|---------------|
| `0 9 * * 1` | Segunda-feira 09:00 | `runReports('weekly_mon')` | Relatório de campanhas da semana anterior (template sem IA) |
| `0 9 * * 3` | Quarta-feira 09:00 | `runReports('weekly_wed')` | Insight de inteligência da semana atual (GPT-4o) |
| `0 9 * * 5` | Sexta-feira 09:00 | `runReports('weekly_fri')` | Relatório de atividades + arquivamento (template sem IA) |
| `0 6 * * *` | Diário 06:00 | `runDailySync()` | Sincronização Meta Ads + RD Station para todos os clientes ativos |
| `0 8 * * *` | Diário 08:00 | `runAlertChecks()` | Verificação de KPIs e saturação para todos os clientes ativos |

### Função: `runReports(type)`

1. Busca todos os clientes com `status = 'active'`
2. Determina o range de datas:
   - `weekly_mon` → `lastWeekRange()` (semana anterior)
   - outros → `currentWeekRange()` (início da semana até hoje)
3. Para cada cliente:
   - `weekly_mon`: chama `generateWeeklyCampaignReport(clientId, start, end)`
   - `weekly_fri`: chama `generateWeeklyActivitiesReport(clientId, start, end)` + `archivePreviousWeekActivities(clientId, start)`
   - `weekly_wed` (e outros): chama `generateInsight(clientId, start, end, type, 'scheduled')`
4. Insere o relatório em `reports` com `status: 'published'`
5. Erros por cliente são capturados individualmente sem parar o loop

### Função: `runDailySync()`

Para cada cliente ativo:
1. Chama `syncMetaAdsReal(clientId)` e atualiza `last_meta_sync_at`
2. Chama `syncRdStationReal(clientId)` e atualiza `last_rd_sync_at`
3. Erros são logados mas não interrompem o processamento dos outros clientes

### Função: `runAlertChecks()`

Para cada cliente ativo: chama `checkAndCreateAlerts(clientId)`.

### O que é gravado no banco

| Job | Tabela | Operação |
|-----|--------|----------|
| Reports | `reports` | INSERT com `status='published'` |
| Daily sync Meta | `metrics_daily` | UPSERT por `(entity_type, entity_id, date)` |
| Daily sync Meta | `campaigns`, `ad_sets`, `creatives` | UPSERT por `external_id` |
| Daily sync RD Station | `crm_metrics` | DELETE all + INSERT batch |
| Daily sync | `clients` | UPDATE `last_meta_sync_at` e `last_rd_sync_at` |
| Alert checks | `alerts` | INSERT alertas novos (com deduplicação 24h) |

---

## 7. Integrações Externas

### Meta Ads API

**Arquivo:** `backend/src/modules/ingestion/adapters/meta-ads.adapter.ts`

**Base URL:** `https://graph.facebook.com/v19.0`

**Autenticação:** Token no query param `access_token` de cada request.

**Endpoints chamados:**

| Endpoint | Parâmetros | O que retorna |
|----------|-----------|---------------|
| `GET /{adAccountId}/campaigns` | `fields=id,name,status,objective`, `effective_status=["ACTIVE"]`, `limit=100` | Campanhas ativas da conta |
| `GET /{campaignId}/adsets` | `fields=id,name,status,daily_budget,targeting`, `limit=100` | Ad sets de uma campanha |
| `GET /{adSetId}/ads` | `fields=id,name,status,creative{id,name,thumbnail_url,title,body,call_to_action_type}`, `limit=100` | Anúncios de um ad set |
| `GET /{entityId}/insights` | `fields=date_start,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,video_p25_watched_actions`, `time_increment=1`, `time_range={"since":...,"until":...}`, `limit=100` | Métricas diárias da entidade |

**Campos mapeados das actions:**

| Campo local | `action_type` Meta |
|-------------|-------------------|
| `leads` | `lead` ou `onsite_conversion.lead_grouped` |
| `messages` | `onsite_conversion.messaging_conversation_started_7d` ou `onsite_conversion.total_messaging_connection` |
| `followers` | `like` |

**video_views:** `video_p25_watched_actions[0].value` (25% do vídeo assistido)

**Paginação automática:** `graphGetAll()` segue o campo `paging.next` até não haver mais páginas. Pausa de 300ms entre páginas para evitar rate limit.

**Rate limit handling:** Códigos `4`, `17`, `32`, `613` → backoff exponencial: 10s, 20s, 40s, 80s (até 4 tentativas).

**Deduplicação:** Campanhas/ad sets/criativos buscados por `external_id`. Métricas upsertadas por `(entity_type, entity_id, date)`.

**Range de dados:** Últimos 90 dias (`subDays(today, 89)` a `today`).

**Concorrência:** Fila global `metaQueue` garante que apenas 1 sync acontece por vez para evitar esgotamento do rate limit compartilhado.

#### Mock (desenvolvimento)

**Arquivo:** `backend/src/modules/ingestion/adapters/meta-ads.mock.ts`

Cria dados realistas de 90 dias para um cliente:
- 3 campanhas: `Geração de Leads - Principal` (LEAD_GENERATION, ativa), `WhatsApp - Conversão` (CONVERSIONS, ativa), `Tráfego - Conteúdo` (TRAFFIC, pausada)
- 1 ad set por campanha
- 5 criativos por ad set: `Criativo A - Depoimento` (image), `Criativo B - Produto em uso` (video), `Criativo C - Oferta direta` (carousel), `Criativo D - Carrossel benefícios` (image), `Criativo E - Vídeo curto (Reel)` (reel)
- Métricas diárias geradas com `rand()` e `randInt()` baseadas no `monthly_budget` do cliente
- Guard: não re-seed se o cliente já tem campanhas
- Lock em memória: `seedingInProgress` previne seed concorrente do mesmo cliente

---

### RD Station API

**Arquivo:** `backend/src/modules/ingestion/adapters/rd-station.adapter.ts`

**Base URL:** `https://crm.rdstation.com/api/v1`

**Autenticação:** Token salvo no banco em `clients.rdstation_token`, passado como query param `token` em cada request.

**Endpoints chamados:**

| Endpoint | Parâmetros | O que retorna |
|----------|-----------|---------------|
| `GET /deal_stages` | `token` | Lista de estágios do pipeline ordenados |
| `GET /deals` | `token`, `page`, `limit=200`, `created_at[gte]`, `created_at[lte]` | Deals (paginado) |
| `GET /deals` | mesmo + `win=false` | Deals perdidos (RD Station não inclui perdidos no listing padrão) |

**Campos mapeados dos deals:**

| Campo RD Station | Campo local | Observação |
|-----------------|-------------|-----------|
| `deal.created_at` | `crm_metrics.date` | Data do deal |
| `deal.deal_stage.name` | nível de funil | Mapeado via `stageOrderMap` |
| `deal.win` | `sales` | `true` → venda fechada |
| `deal.amount` ou `deal.amount_montly` | `revenue` | Receita do deal |
| custom field `Fonte` | filtro de origem | Filtra apenas deals do Meta |
| `rd_campanha_field` config | `campaign_id` | Matching por nome de campanha |
| `rd_criativo_field` config | `creative_id` | Matching por nome de criativo |

**Lógica de funil por posição Kanban:**

1. Busca `GET /deal_stages` e monta `Map<stageName, position>`
2. Para cada deal, determina `dealPos` na ordem do Kanban
3. MQL: `dealPos >= mqlPos` (ou `deal.win`)
4. SQL: `dealPos >= sqlPos` (ou `deal.win`)
5. Venda: `dealPos >= vendaPos` (ou `deal.win === true`)
6. Fallback por prefixo: se `stageOrderMap` vazio, usa `extractPrefix()` e `prefixRank`
7. Deals perdidos (`win=false`) com estágio terminal (não no mapa): `inferLostDealLevel()` tenta inferir o nível mais alto atingido

**Matching de campanha por nome:** fuzzy — verifica se um contém o outro (case-insensitive).

**Matching de criativo por nome:** fuzzy com strip do prefixo `AD{NNN} - ` antes de comparar.

**Estratégia de upsert:** DELETE all + INSERT batch (não upsert incremental), para evitar conflitos de registros antigos.

---

### OpenAI API (GPT-4o)

**SDK:** `openai` ^4.47.0  
**Arquivo de serviço:** `backend/src/modules/insights/insights.service.ts`

**Nota histórica:** O código atual usa `openai` SDK (com variável `OPENAI_API_KEY`) mas o CLAUDE.md menciona que o sistema foi migrado de Anthropic Claude para OpenAI GPT-4o em março de 2026. A variável no `env.ts` ainda se chama `OPENAI_API_KEY`.

**Modelo:** `gpt-4o`  
**max_tokens:** `2048`  
**Temperatura:** não configurada (usa default da API)

**Parâmetros da chamada:**
```typescript
openai.chat.completions.create({
  model: 'gpt-4o',
  max_tokens: 2048,
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildWeeklyReportPrompt(ctx) },
  ],
})
```

**Pós-processamento do resultado:**

| Campo | Lógica de extração |
|-------|-------------------|
| `impact_level` | Busca palavras `crítico`/`critico` → `critical`; `alto` → `high`; `baixo` → `low`; default `medium` |
| `category` | Busca `saturação`/`frequência` → `saturation`; `funil`/`mql`/`sql` → `funnel`; `orçamento`/`budget`/`gasto` → `budget`; `criativo` → `creative`; `oportunidade`/`escalar` → `opportunity`; default `performance` |
| `summary` | Primeira linha não iniciada com `#` e com mais de 30 chars; strip de `**`; limitada a 200 chars |

---

## 8. KPI Scoring — Lógica Completa

**Arquivo:** `backend/src/shared/utils/kpi-evaluator.ts`

### Fórmulas por Tipo

#### `lower_is_better` (CPL, CPC, CPM, frequency, cost_per_message, cost_per_follower)

```
rawScore = target_value / actual
```

- Se `actual === 0`: `rawScore = 2.0` (excelente — sem custo)
- Se CPL meta é R$25 e CPL real é R$20: `rawScore = 25/20 = 1.25` (acima da meta)
- Se CPL meta é R$25 e CPL real é R$35: `rawScore = 25/35 = 0.71` (abaixo da meta)

#### `higher_is_better` (CTR, leads, roas, messages)

```
rawScore = actual / target_value
```

- Se `target_value === 0`: `rawScore = 0`
- Se CTR meta é 2% e CTR real é 3%: `rawScore = 3/2 = 1.5` (acima da meta)
- Se CTR meta é 2% e CTR real é 1.5%: `rawScore = 1.5/2 = 0.75` (abaixo da meta)

#### `range` (frequency com faixa aceitável)

```
rawScore = 1.0  se  min_value <= actual <= max_value
rawScore = 0.5  caso contrário
```

### Cap

`rawScore = Math.min(rawScore, 2.0)` — limitado em 2.0 para evitar scores inflados.

### Cálculo de Status

| Condição | Status |
|----------|--------|
| `rawScore >= 1.0` | `on_target` |
| `0.8 <= rawScore < 1.0` | `warning` |
| `rawScore < 0.8` | `breach` |

### Cálculo de Delta Percentual

```
delta_pct = ((actual - target_value) / target_value) * 100
```

Se `target_value === 0`: `delta_pct = 0`.

### Weighted Score

```
weighted_score = rawScore * weight
```

### Função: `evaluateAllKpis(metrics, kpis)`

Filtra os KPIs cujo `kpi_name` tem um valor correspondente no objeto de métricas e avalia cada um.

### Função: `computeOverallScore(results)`

```
totalWeighted = sum(result.weighted_score)
maxPossible = sum(2.0 * result.raw_score)  // cada KPI poderia ter raw_score 2.0
overallScore = min((totalWeighted / results.length) * 50, 100)
```

### Como Alertas São Disparados a Partir do Scoring

1. `checkAndCreateAlerts()` chama `evaluateKpi()` para cada KPI configurado
2. Se `result.status === 'breach'` (raw_score < 0.8):
   - Severity `'critical'` se `raw_score < 0.6`
   - Severity `'warning'` se `0.6 <= raw_score < 0.8`
3. Deduplicação: consulta alertas do mesmo KPI, do mesmo cliente, não resolvidos, criados nas últimas 24h
4. Alertas de frequência: separados — dispara se `frequency >= 4.0` (`critical` se `>= 5.0`)

### Escalagem de Targets Cumulativos

No endpoint de métricas summary, targets dos KPIs `leads`, `messages`, `clicks`, `impressions`, `followers` são escalados pelo período selecionado:

```
scaled_target = (target_value / 7) * days_in_period
```

Isso garante que a avaliação seja justa para períodos maiores que 7 dias (os targets são armazenados como referência de 7 dias).

---

## 9. Frontend — Cada Página

### Configuração Global

**QueryClient** (`frontend/src/main.tsx`):
- `staleTime: 1000 * 60 * 2` (2 minutos)
- `retry: 1`

**Zustand Store** (`frontend/src/store/index.ts`):
- `selectedClientId: number | null` — cliente selecionado globalmente
- `dateRange: { start: string; end: string }` — período ativo (default: últimos 7 dias)
- `sidebarCollapsed: boolean` — estado do sidebar desktop
- Persistência: `selectedClientId` salvo em `localStorage` como `'dae-app-store'`
- Sanitização na hidratação: IDs inválidos (`NaN`, negativos) são convertidos para `null`

---

### Página: Dashboard (`/`)

**Arquivo:** `frontend/src/pages/Dashboard/DashboardPage.tsx`

**O que renderiza:** Visão geral de performance do cliente selecionado no período ativo.

**Guard:** Se `selectedClientId === null`, mostra `EmptyState` com instrução de selecionar cliente.

**React Query usadas:**

| queryKey | Endpoint | Enabled |
|----------|----------|---------|
| `['client', selectedClientId]` | `GET /clients/:id` | `!!selectedClientId` |
| `['metrics-summary', selectedClientId, dateRange]` | `GET /clients/:id/metrics/summary?start&end` | `!!selectedClientId` |
| `['timeseries', selectedClientId, dateRange]` | `GET /clients/:id/metrics/timeseries?start&end` | `!!selectedClientId` |
| `['top-creatives', selectedClientId, dateRange]` | `GET /clients/:id/metrics/top-creatives?start&end&limit=5` | `!!selectedClientId` |
| `['alerts', selectedClientId]` | `GET /clients/:id/alerts` | `!!selectedClientId`, refetch a cada 60s |
| `['insights', selectedClientId]` | `GET /clients/:id/insights?limit=5` | `!!selectedClientId` |
| `['funnel', selectedClientId, dateRange]` | `GET /clients/:id/funnel?start&end` | `!!selectedClientId` |

**Lógica de UI:**

1. **AlertsPanel:** Renderizado no topo se houver alertas críticos ou warnings. Mostra primeiros 3, botão "Ver todos" se houver mais.

2. **Cards de KPI:** 
   - 4 cards base sempre presentes: Investimento, Impressões, CTR, Frequência
   - Cards adicionais baseados em `client.objectives`:
     - `leads` → Leads + CPL
     - `whatsapp` → Mensagens + Custo/Mensagem
     - `vendas` → Vendas + Custo/Venda (usa dados de funil)
     - `seguidores` → Seguidores + Custo/Seguidor
     - `trafego` → Visitas + Custo/Visita
     - `alcance` → Video Views + Custo/View
   - Se nenhum objetivo: fallback com Leads, CPL, Mensagens, CPC

3. **Skeleton Loading:** Grid de 8 `KpiSkeleton` enquanto `isLoading === true`

4. **Gráfico de Tendência:** `AreaChart` (Recharts) com `spend` por data. X: datas, Y: R$. Sem dot nas linhas, `activeDot` no hover.

5. **Top Criativos:** Lista com rank (número), nome, type badge, e métricas: spend, CTR, CPL, frequência.

6. **KPIs vs Metas:** `divide-y` com progress bar colorida por status. Comprimento da barra: `rawScore * 50` (capped at 100%).

7. **Insights Recentes:** Lista com badge de `impact_level`, categoria, timestamp relativo.

---

### Página: Clients (`/clients`)

**Arquivo:** `frontend/src/pages/Clients/ClientsPage.tsx`

**O que renderiza:** Listagem e gestão de clientes com criação, edição, configuração de KPIs, sincronia de dados.

**React Query:**

| queryKey | Endpoint | Tipo |
|----------|----------|------|
| `['clients']` | `GET /clients` | Query |

**Mutations:**
- `clientsApi.create(data)` → invalida `['clients']`
- `clientsApi.update(id, data)` → invalida `['clients']`, `['client', id]`
- `clientsApi.delete(id)` → invalida `['clients']`
- `clientsApi.upsertKpis(id, kpis)` → invalida KPIs
- `clientsApi.seedMock(id)` → mock data trigger
- `clientsApi.syncMetaAds(id)` → sync real Meta
- `clientsApi.syncRdStation(id)` → sync real RD Station

**Componentes internos:**
- `ClientAvatar`: iniciais + cor determinística por nome
- `StatusBadge`: badge com dot colorido por status
- `ClientForm`: modal de criação (campos: name, ad_account, rdstation_token, payment_method, objectives, monthly_budget, status)
- `KPIModal`: modal de edição de KPIs por cliente (seleção de KPI name, target_value, kpi_type, weight)
- `SyncRow`: linha de sincronização com timestamp e botão com spinner

**KPI_OPTIONS disponíveis:** `cpl` (lower), `ctr` (higher), `cpc` (lower), `cpm` (lower), `frequency` (lower), `cost_per_message` (lower), `cost_per_follower` (lower), `leads` (higher), `roas` (higher)

**OBJECTIVES disponíveis:** `leads`, `whatsapp`, `vendas`, `seguidores`, `trafego`, `alcance`

---

### Página: Campaigns (`/campaigns`)

**Arquivo:** `frontend/src/pages/Campaigns/CampaignsPage.tsx`

**O que renderiza:** Lista de campanhas com métricas agregadas, funil por campanha, tipo inferido pelo nome.

**Guard:** EmptyState se `selectedClientId === null`.

**React Query:**

| queryKey | Endpoint |
|----------|----------|
| `['campaigns', selectedClientId]` | `GET /clients/:id/campaigns` |
| `['campaign-metrics', campaignId, dateRange]` (para cada campanha) | `GET /campaigns/:id/metrics?start&end` |
| `['funnel-campaigns', selectedClientId, dateRange]` | `GET /clients/:id/funnel/by-campaign?start&end` |

**Lógica de tipo de campanha:**

```typescript
type CampaignType = 'WPP' | 'VP' | 'LEAD' | 'FORM' | 'OTHER'

// Detectado pelo nome: [WPP], [VP], [LEAD], [FORM]
// Cada tipo tem: label, badgeClass, costLabel, costKey
```

**Métricas exibidas por tipo:**
- `WPP` → Mensagens, Custo/MSG
- `VP` → Video Views, Custo/View
- `LEAD` / `FORM` → CPL
- `OTHER` → CPL

---

### Página: Creatives (`/creatives`)

**Arquivo:** `frontend/src/pages/Creatives/CreativesPage.tsx`

**O que renderiza:** Browser de criativos com indicador de saúde (saturação + custo).

**Nota:** O TopBar não mostra date range nesta página (`showDateRange = location.pathname !== '/creatives'`).

**React Query:**
- `GET /clients/:id/creatives` → lista de criativos
- `GET /creatives/:id/metrics` → métricas de cada criativo
- `GET /clients/:id/kpis` → KPIs para cálculo de saúde

**Lógica de saúde do criativo (`creativeHealth`):**

1. Calcula saúde de saturação (`saturationHealth`): baseada em `frequency` e `ctr`
   - `frequency >= 5.0` ou `(ctr < 0.5 && frequency >= 2.5)` → `saturated` (danger)
   - `frequency >= 3.5` → `saturating` (warning)
   - `frequency >= 2.5` → `Atenção Freq.` (warning)
   - Saudável
2. Calcula saúde de custo por tipo de campanha:
   - `WPP` → `cost_per_message` vs KPI
   - `VP` → `cost_per_video_view` vs KPI
   - `LEAD`/`FORM` → `cpl` vs KPI
   - Usa `rawScore = target / actual`: < 0.6 → danger, < 0.8 → warning, < 1.0 → warning leve
3. Retorna o pior dos dois

---

### Página: Funnel (`/funnel`)

**Arquivo:** `frontend/src/pages/Funnel/FunnelPage.tsx`

**O que renderiza:** Visualização do funil CRM Lead→MQL→SQL→Venda com taxas de conversão e custos.

**Guard:** EmptyState se sem cliente ou sem dados de funil.

**React Query:**

| queryKey | Endpoint |
|----------|----------|
| `['funnel', selectedClientId, dateRange]` | `GET /clients/:id/funnel?start&end` |
| `['funnel-campaign', selectedClientId, dateRange]` | `GET /clients/:id/funnel/by-campaign?start&end` |

**Visualizações:**
1. **Barras do funil:** 4 barras com largura proporcional ao valor (Lead=100%, outros proporcional). Cores: `#4f46e5`, `#7c3aed`, `#db2777`, `#059669`
2. **Taxas de conversão:** Lead→MQL, MQL→SQL, SQL→Venda em %
3. **Custos por etapa:** CPL, CPMql, CPSQL, CPVenda
4. **BarChart por campanha** (Recharts): leads, MQL, SQL, Vendas por campanha

---

### Página: Insights (`/insights`)

**Arquivo:** `frontend/src/pages/Insights/InsightsPage.tsx`

**O que renderiza:** Histórico de insights com geração manual, visualização em Markdown, mudança de status.

**Guard:** EmptyState se sem cliente.

**React Query:**

| queryKey | Endpoint |
|----------|----------|
| `['insights', selectedClientId]` | `GET /clients/:id/insights?limit=20` |

**Mutations:**
- `insightsApi.generate(clientId, { start, end, report_type })` → invalida insights
- `insightsApi.updateStatus(id, status)` → invalida insights

**Tipos de relatório na UI:**

| Valor | Label | Ícone |
|-------|-------|-------|
| `manual` | Análise Manual | 🖊️ |
| `weekly_mon` | Relatório de Segunda (semana anterior) | 📅 |
| `weekly_wed` | Relatório de Quarta (semana atual) | 📊 |
| `weekly_fri` | Relatório de Sexta (atividades) | ✅ |

**InsightCard:**
- Tira colorida no topo por `impact_level`: danger(critical), orange(high), warning(medium), gray(low)
- Expandir/recolher o conteúdo em Markdown
- Botões: "Acionado" (→ `actioned`), "Arquivar" (→ `archived`)
- `ReactMarkdown` para renderizar o conteúdo

---

### Página: Reports (`/reports`)

**Arquivo:** `frontend/src/pages/Reports/ReportsPage.tsx`

**O que renderiza:** Listagem de relatórios com geração on-demand e visualização em Markdown.

**Guard:** EmptyState se sem cliente.

**React Query:**

| queryKey | Endpoint |
|----------|----------|
| `['reports', selectedClientId]` | `GET /clients/:id/reports` |
| `['report', selectedReportId]` | `GET /reports/:id` (quando um relatório é selecionado) |

**Mutations:**
- `reportsApi.generate(clientId, { report_type })` → invalida reports

**4 cards de tipo de relatório:** cada um com cor, ícone, label, sublabel, descrição e botão "Gerar". Spinner enquanto gerando.

**Visualização:** `ReactMarkdown` para exibir conteúdo do relatório selecionado.

---

### Página: Alerts (`/alerts`)

**Arquivo:** `frontend/src/pages/Alerts/AlertsPage.tsx`

**O que renderiza:** Central de alertas com resolução individual e triggering manual de check.

**Guard:** EmptyState se sem cliente.

**React Query:**

| queryKey | Endpoint |
|----------|----------|
| `['alerts', selectedClientId]` | `GET /clients/:id/alerts` |

**Mutations:**
- `alertsApi.resolve(alertId, resolvedBy)` → invalida alerts
- `clientsApi.checkAlerts(clientId)` → invalida alerts

**AlertCard:**
- Border esquerda colorida por severity: danger(critical), warning(warning), blue(info)
- Background tênue por severity
- Ícone: 🚨 (critical), ⚠️ (warning), ℹ️ (info)
- Informações: tipo, KPI afetado, valores real/meta, timestamp relativo
- Botão "Resolver" com mutation

---

### Página: Activities (`/activities`)

**Arquivo:** `frontend/src/pages/Activities/ActivitiesPage.tsx`

**O que renderiza:** Timeline de atividades agrupadas por data com criação de novas atividades.

**Guard:** EmptyState se sem cliente.

**React Query:**

| queryKey | Endpoint |
|----------|----------|
| `['activities', selectedClientId]` | `GET /clients/:id/activities?limit=50` |

**Mutations:**
- `activitiesApi.create(clientId, data)` → invalida activities

**Agrupamento:** `groupByDate()` — agrupa por `executed_at.toDateString()`. Labels: "Hoje", "Ontem", ou data por extenso em pt-BR.

**Tipos de atividade disponíveis no form:** todos os 9 tipos com ícone e cor.

---

### Página: Tasks (`/tasks`)

**Arquivo:** `frontend/src/pages/Tasks/TasksPage.tsx`

**O que renderiza:** Gestão de tarefas com urgência visual, separação pending/done.

**Guard:** EmptyState se sem cliente.

**React Query:**

| queryKey | Endpoint |
|----------|----------|
| `['tasks', selectedClientId]` | `GET /clients/:id/tasks` |

**Mutations:**
- `tasksApi.create(clientId, data)` → invalida tasks
- `tasksApi.complete(taskId)` → invalida tasks
- `tasksApi.cancel(taskId)` → invalida tasks
- `tasksApi.delete(taskId)` → invalida tasks

**Lógica de urgência:**
- `isOverdue`: `status === 'pending' && due_date < hoje` → border-l-red-500
- `isDueSoon`: `status === 'pending' && 0 <= diff <= 3 dias` → border-l-yellow-400
- Outros pending → border-l-gray-200

**UI:** Tarefas concluídas/canceladas recolhidas em seção separada, expansível.

---

### Página: Admin (`/admin`)

**Arquivo:** `frontend/src/pages/Admin/AdminPage.tsx`

**O que renderiza:** Painel cross-client com 5 tabs: Relatórios, Insights, Alertas, Tarefas, Atividades.

**Não usa `selectedClientId`** — busca dados de todos os clientes.

**Tabs e Endpoints:**

| Tab | Endpoint |
|-----|----------|
| Relatórios | `GET /admin/reports` |
| Insights | `GET /admin/insights` |
| Alertas | `GET /admin/alerts` |
| Tarefas | `GET /admin/tasks` |
| Atividades | `GET /admin/activities` |

**Mutations de delete** disponíveis em relatórios, insights, alertas, atividades (com `confirm()`).

---

## 10. Componentes Reutilizáveis

### `Card`

**Arquivo:** `frontend/src/components/ui/Card.tsx`

**Props:**

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `children` | ReactNode | — | Conteúdo interno |
| `className` | string | `''` | Classes CSS extras |
| `title` | string | — | Título no header |
| `subtitle` | string | — | Subtítulo abaixo do título |
| `action` | ReactNode | — | Elemento no canto superior direito do header |
| `variant` | `'default'|'elevated'|'bordered'` | `'default'` | Estilo visual |
| `accent` | boolean | `false` | Renderiza barra de 3px no topo com gradiente brand |
| `hoverable` | boolean | `false` | Adiciona efeito de elevação no hover |

**Variantes:**

| Variant | Estilo |
|---------|--------|
| `default` | `bg-white border border-gray-200 shadow-sm` |
| `elevated` | `bg-white border border-gray-100 shadow-md` |
| `bordered` | `bg-white border-2 border-gray-200 shadow-none` |

**Comportamento:**
- Se `accent=true`: renderiza `<div class="h-[3px] bg-gradient-to-r from-brand-500 via-indigo-400 to-purple-500" />`
- Se `title || subtitle || action`: renderiza header com `border-b border-gray-100` e `px-5 py-4`
- Conteúdo sempre em `<div class="p-5">`

---

### `Badge`

**Arquivo:** `frontend/src/components/ui/Badge.tsx`

**Props:**

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `label` | string | — | Texto exibido |
| `variant` | `BadgeVariant` | — | Variante semântica de cor |
| `dot` | boolean | `false` | Exibe ponto colorido antes do label |
| `className` | string | `''` | Classes CSS extras |

**Variantes:**

| Variant | Background | Texto |
|---------|------------|-------|
| `default` | `bg-brand-100` | `text-brand-700` |
| `success` | `bg-success-100` | `text-success-700` |
| `warning` | `bg-warning-100` | `text-warning-700` |
| `danger` | `bg-danger-100` | `text-danger-700` |
| `info` | `bg-blue-100` | `text-blue-700` |
| `neutral` | `bg-gray-100` | `text-gray-600` |

**Comportamento:** `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap`. O dot é um `span` de `w-1.5 h-1.5 rounded-full` com cor correspondente à variante.

---

### `EmptyState`

**Arquivo:** `frontend/src/components/ui/EmptyState.tsx`

**Props:**

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `icon` | string | `'📭'` | Emoji exibido na área central |
| `title` | string | — | Título principal |
| `description` | string | — | Texto descritivo (opcional) |
| `action` | ReactNode | — | Botão ou link de ação (opcional) |

**Layout:** Centralizado verticalmente, padding `py-20`. Ícone em caixa `w-20 h-20 rounded-2xl` com gradiente brand, com anel decorativo ao redor. Título `text-xl font-semibold`. Descrição `text-sm text-gray-500 max-w-xs`.

---

### `AppShell`

**Arquivo:** `frontend/src/components/layout/AppShell.tsx`

**O que faz:** Layout raiz que engloba todas as páginas. Renderiza:
1. **Desktop sidebar** (hidden em mobile): `<Sidebar mobileDrawerOpen={false} />`
2. **Mobile overlay backdrop** + **drawer panel**: controlado por `mobileDrawerOpen` state local
3. **Coluna de conteúdo principal**: `TopBar` + `<Outlet />` (Outlet do React Router)
4. **Mobile bottom nav bar**: `<Sidebar mobileBottomNav={true} />`

**Offset do conteúdo:** 
- Desktop collapsed: `md:ml-16` (64px)
- Desktop expanded: `md:ml-64` (256px)
- Mobile: sem offset (sidebar é overlay)

**Props do Sidebar:**

| Prop | Tipo | Descrição |
|------|------|-----------|
| `mobileDrawerOpen` | boolean | Se o drawer mobile está aberto |
| `onCloseDrawer` | () => void | Callback para fechar o drawer |
| `mobileBottomNav` | boolean | Se deve renderizar como barra inferior |

---

### `Sidebar`

**Arquivo:** `frontend/src/components/layout/Sidebar.tsx`

**Dois modos de render:**

**Modo `mobileBottomNav=true`:** Renderiza `<nav>` fixo na base da tela com apenas os 5 itens primários. Ícone + label em cada item.

**Modo padrão (sidebar):** Sidebar vertical com:
- Header: logo "DAE" + "Media Intelligence" + botão collapse/expand (desktop) ou close (mobile drawer)
- Navegação primária: Dashboard, Clientes, Campanhas, Insights, Alertas
- Divider
- Navegação secundária: Criativos, Funil, Relatórios, Atividades, Tarefas, Admin
- Footer: indicador do cliente ativo (ID e inicial)

**NavItem sub-componente:** NavLink do React Router com `end={to === '/'}` para o Dashboard. Estado ativo: `bg-white/15 text-white shadow-sm ring-1 ring-white/10`. Inactive: `text-brand-100/70`. Collapsed: apenas ícone centralizado com tooltip.

**Cores do sidebar:** `bg-gradient-to-b from-brand-900 via-brand-900 to-[#16134a]`

---

### `TopBar`

**Arquivo:** `frontend/src/components/layout/TopBar.tsx`

**O que renderiza:** Header fixo (sticky) com título da página, seletor de cliente, seletor de range de datas, e bell de alertas.

**Props:**

| Prop | Tipo | Descrição |
|------|------|-----------|
| `onOpenMobileDrawer` | () => void | Abre o drawer mobile (chamado pelo hamburger) |

**Desktop:** Hamburger icon, título da página, range pills (7d/14d/30d), divider, select de cliente, bell de alertas.

**Mobile:** Hamburger, título, bell de alertas (quando há), botão "..." que abre painel overflow com select de cliente e range pills.

**Títulos de página:**

| Path | Título |
|------|--------|
| `/` | Dashboard |
| `/clients` | Clientes |
| `/campaigns` | Campanhas |
| `/creatives` | Criativos |
| `/funnel` | Funil de Vendas |
| `/insights` | Insights |
| `/reports` | Relatórios |
| `/alerts` | Alertas |
| `/activities` | Atividades |

**Lógica do bell:** Conta alertas `critical` e `warning` do cliente selecionado. Refetch a cada 60 segundos. Badge vermelho se `criticalCount > 0`, amarelo se só warnings. Não exibido em `/creatives`.

**Ranges disponíveis:** 7d, 14d, 30d. Identifica o range ativo comparando o `dateRange.start` do store.

---

## 11. Fluxos Passo a Passo

### Fluxo 1: Sincronização Mock Meta Ads

1. Usuário acessa `/clients`, localiza o cliente desejado
2. Clica em "↺ Sync" na linha de "Mock (Dev)"
3. Frontend chama `clientsApi.seedMock(id)` → `POST /api/ingestion/:id/meta-ads/mock`
4. Backend verifica `env.USE_META_MOCK === true`; se falso: retorna 403
5. `seedMockData(clientId)` verifica lock em memória (`seedingInProgress`)
6. Verifica se cliente já tem campanhas no banco; se sim: retorna sem fazer nada
7. Busca `monthly_budget` do cliente para calcular gastos proporcionais
8. Cria 3 campanhas no Supabase via `createCampaign()`
9. Para cada campanha: cria 1 ad set via `createAdSet()`
10. Para cada ad set: cria 5 criativos com `creativeTypes` e nomes pré-definidos via `createCreative()`
11. Para cada dia dos últimos 90 dias:
    - Gera métricas aleatórias proporcionais ao budget (`rand()`, `randInt()`)
    - Chama `insertMetrics()` → `upsert` na tabela `metrics_daily` com conflito `(entity_type, entity_id, date)`
12. Backend responde `{ message: 'Mock data seeded successfully', synced_at: ... }`
13. Backend atualiza `clients.last_meta_sync_at`
14. Frontend invalida queries de clientes
15. Dashboard passa a exibir dados

---

### Fluxo 2: Geração de Relatório Semanal (Scheduler Segunda-feira)

1. `node-cron` dispara `0 9 * * 1` no timezone `America/Sao_Paulo`
2. `runReports('weekly_mon')` é chamado
3. `getActiveClientIds()` busca todos os clientes com `status = 'active'`
4. Para cada `clientId`:
5. Calcula `range = lastWeekRange()`:
   - `end = domingo passado = startOfWeek(hoje) - 1 dia`
   - `start = end - 6 dias`
6. Chama `generateWeeklyCampaignReport(clientId, start, end)`:
   a. Busca nome do cliente
   b. Busca todas as campanhas do cliente
   c. Busca `metrics_daily` das campanhas no período
   d. Busca `crm_metrics` (MQL/SQL/Sales) no período
   e. Agrega métricas por campanha em JS
   f. Para cada campanha com gasto > 0:
      - Detecta tipo por `objective` e nome (`[WPP]`, `[VP]`, `[LEAD]`, `[FORM]`)
      - Gera bloco de texto com métricas relevantes para o tipo
   g. Retorna todos os blocos separados por `---`
7. Insere em `reports`: `client_id, report_type='weekly_mon', period_start, period_end, content, status='published'`
8. Loga sucesso ou erro por cliente

---

### Fluxo 3: Detecção e Criação de Alerta

1. `node-cron` dispara `0 8 * * *` (diariamente às 8h, Brasília)
2. `runAlertChecks()` busca clientes ativos
3. Para cada `clientId`, `checkAndCreateAlerts(clientId)`:
4. Busca KPIs do cliente (`findKpisByClientId`)
5. Se sem KPIs: retorna sem fazer nada
6. Busca métricas dos últimos 7 dias (`getClientMetrics`)
7. Calcula `oneDayAgo` (timestamp de 24h atrás)
8. Para cada KPI:
   a. Pega `actual = metrics[kpi.kpi_name]` (pode ser undefined → pula)
   b. Chama `evaluateKpi(actual, kpi)` → `KpiResult`
   c. Se `result.status === 'breach'`:
      - Busca alertas recentes: `SELECT id FROM alerts WHERE client_id=X AND kpi_name=Y AND resolved_at IS NULL AND created_at >= oneDayAgo`
      - Se nenhum encontrado: cria alerta
        - `severity`: `'critical'` se `raw_score < 0.6`, `'warning'` se `raw_score < 0.8`
        - `message`: `KPI "cpl" está acima do limite aceitável. Real: 45.00 | Meta: 25.00`
        - `alert_type`: `'kpi_breach'`
        - `entity_type`: `'client'`, `entity_id`: `clientId`
9. Verifica frequência separadamente:
   - Se `frequency >= 4.0` e sem alerta `frequency_high` recente:
     - `severity`: `'critical'` se `>= 5.0`, `'warning'` se `4.0 <= freq < 5.0`
     - `threshold_value`: `3.5`
10. Frontend refetch do bell de alertas a cada 60s — exibe badge atualizado

---

### Fluxo 4: Criação e Conclusão de Tarefa

**Criação:**
1. Usuário acessa `/tasks`, clica em "Nova Tarefa"
2. Preenche form: título, tipo, data de execução, responsável, descrição opcional
3. Se `task_type === 'other'`: campo `custom_type` livre
4. `tasksApi.create(clientId, data)` → `POST /api/clients/:id/tasks`
5. Backend insere em `tasks` com `status='pending'`
6. Frontend invalida query `['tasks', clientId]`
7. Lista atualiza ordenada por `due_date ASC`
8. Se `due_date < hoje` no momento da listagem: tag "Atrasada" + border vermelha
9. Se `due_date <= hoje + 3 dias`: border amarela

**Conclusão:**
1. Usuário clica no botão de check na tarefa
2. `tasksApi.complete(taskId)` → `PATCH /api/tasks/:id/complete`
3. Backend: `UPDATE tasks SET status='done', completed_at=NOW() WHERE id=id`
4. Frontend invalida query e relista
5. Tarefa vai para seção recolhida de "Concluídas"

---

### Fluxo 5: Geração de Insight com IA

**Trigger manual:**
1. Usuário acessa `/insights`, escolhe tipo `manual` no dropdown
2. Clica em "Gerar Insight" — botão mostra spinner
3. `insightsApi.generate(clientId, { start, end, report_type: 'manual' })` → `POST /api/clients/:id/insights/generate`
4. Backend determina `periodStart = hoje - 7 dias`, `periodEnd = hoje` (se não fornecidos)
5. `generateInsight(clientId, start, end, 'manual', 'manual')`:
   a. `findClientById(clientId)` — valida existência
   b. Em paralelo (`Promise.all`):
      - KPIs do cliente
      - Métricas do período
      - Top 10 criativos com MQL
      - Resumo CRM (agrega `crm_metrics`)
      - Top 10 alertas ativos
   c. `evaluateAllKpis(metrics, kpis)` → `KpiResult[]`
   d. `buildWeeklyReportPrompt(ctx)` → user prompt em Markdown
   e. `openai.chat.completions.create({ model: 'gpt-4o', max_tokens: 2048, messages: [system, user] })`
   f. Extrai `impact_level`, `category`, `summary` do conteúdo gerado
   g. `INSERT INTO insights (client_id, period_start, period_end, content, summary, impact_level, category, triggered_by='manual')`
6. Resposta `{ id, content, impact_level, category, summary, ... }` (HTTP 201)
7. Frontend invalida query `['insights', clientId]`
8. Novo insight aparece no topo da lista
9. Usuário clica para expandir — conteúdo renderizado em `ReactMarkdown`

---

## 12. Deploy

### Backend no Railway

**Pré-requisitos:** Conta Railway, projeto conectado ao repositório Git.

**Configuração:**
1. Root directory: `backend/`
2. Build command: `npm run build` (executa `tsc`)
3. Start command: `node dist/index.js`
4. Node version: >= 20

**Variáveis de ambiente a configurar no Railway:**

```
PORT=3001
NODE_ENV=production
OPENAI_API_KEY=sk-proj-...
API_URL_supabase=https://vebsfoygbyrfnvgbxbrx.supabase.co
service_role_supabase=eyJhbGci...
META_APP_ID=123456789
META_APP_SECRET=abcdef...
META_ACCESS_TOKEN=EAAa...
RDSTATION_ACCESS_TOKEN=rdtoken...
API_KEY=dae-secret-key-change-in-prod
ALLOWED_ORIGIN=https://seu-frontend.vercel.app
USE_META_MOCK=false
```

**Notas importantes:**
- Railway deve ser configurado como **processo contínuo** (não Function), pois `node-cron` precisa de um processo ativo 24/7
- O scheduler inicia automaticamente junto com o servidor (`startScheduler()` é chamado em `index.ts`)
- Logs dos cron jobs aparecem com prefixo `[Scheduler]`

---

### Frontend na Vercel

**Pré-requisitos:** Conta Vercel, projeto conectado ao repositório Git.

**Configuração:**
1. Root directory: `frontend/`
2. Build command: `npm run build` (executa `tsc && vite build`)
3. Output directory: `dist/`
4. Framework Preset: Vite

**Variável de ambiente a configurar na Vercel:**

```
VITE_API_URL=https://seu-backend.railway.app/api
```

**Notas:**
- Sem o `VITE_API_URL`, as chamadas de API vão para `/api` (relativo), o que não funciona em produção
- O proxy do Vite (`/api` → `localhost:3001`) só funciona em desenvolvimento local

---

### Banco do Zero

**Ordem de execução do `supabase-schema.sql`:**

1. Acesse o Supabase Dashboard → SQL Editor → New Query
2. Cole o conteúdo completo de `backend/supabase-schema.sql`
3. Execute (botão Run)
4. Verifique que todas as tabelas foram criadas em Table Editor

**Tabelas criadas em ordem (com dependências):**
1. `clients` (sem dependência)
2. `client_kpis` (depende de `clients`)
3. `campaigns` (depende de `clients`)
4. `ad_sets` (depende de `campaigns`)
5. `creatives` (depende de `ad_sets`)
6. `metrics_daily` (sem FK, UNIQUE constraint)
7. `crm_metrics` (depende de `clients`, `campaigns`, `creatives`)
8. `insights` (depende de `clients`)
9. `reports` (depende de `clients`)
10. `activities` (depende de `clients`, `campaigns`, `creatives`)
11. `alerts` (depende de `clients`)

**Migrations adicionais (se schema antigo):**

```sql
-- Adiciona campo archived_at em activities (necessário para scheduler de sexta)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Cria tabela tasks (não inclusa no schema base)
CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  task_type    TEXT NOT NULL,
  custom_type  TEXT,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     DATE NOT NULL,
  assigned_to  TEXT NOT NULL DEFAULT 'DAE Assessoria',
  campaign_id  INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona campos de configuração RD Station nos clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rd_fonte_field TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rd_campanha_field TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rd_criativo_field TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rd_mql_stage TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rd_sql_stage TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rd_venda_stage TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_meta_sync_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_rd_sync_at TIMESTAMPTZ;
```

**Sobre RLS (Row-Level Security):**
O arquivo `supabase-schema.sql` tem RLS **comentado** por padrão. O backend usa `service_role_key` que bypassa RLS. Para V1 isso é intencional — múltiplos analistas da agência acessam todos os clientes.

---

## 13. Prompt Completo da IA

### System Prompt

**Arquivo:** `backend/src/modules/insights/prompts/system-prompt.ts`  
**Variável exportada:** `SYSTEM_PROMPT`

```
Você é o analista sênior de mídia da DAE Assessoria, uma agência brasileira de marketing digital especializada em tráfego pago.

Sua função é interpretar dados de campanhas publicitárias (Meta Ads) e dados de CRM (RD Station) para gerar análises estratégicas acionáveis em português brasileiro.

PERSONA: Você fala como um especialista experiente em mídia — direto, orientado a dados, prático. Não celebra mediocridade. Identifica padrões, sinaliza riscos e descobre oportunidades de otimização não óbvias.

REGRAS:
- Nunca invente dados que não estejam no contexto fornecido
- Se uma tendência for ambígua, diga isso explicitamente
- Quantifique cada recomendação quando possível ("aumentar o orçamento em ~20%", "reduzir a frequência para abaixo de 3.0")
- Sinalize quando a cobertura de dados for insuficiente para uma conclusão
- Sempre considere o funil completo: Lead → MQL → SQL → Venda
- KPIs com peso maior têm mais impacto na análise

## REGRA DE ANÁLISE TEMPORAL (OBRIGATÓRIA)
- Sempre comparar:
  - Últimos 7 dias vs últimos 14 dias
  - Últimos 7 dias vs últimos 30 dias
- A análise deve SEMPRE ter como base principal os últimos 7 dias
- Identificar claramente:
  - O que MELHOROU
  - O que PIOROU
  - O que se manteve estável
- Se houver divergência entre 14d e 30d, sinalizar inconsistência de tendência
- Se os dados forem insuficientes para comparação, declarar explicitamente

## REGRA DE CONTEXTO DE EXECUÇÃO
- Essa análise é originalmente executada às quartas-feiras
- Pode ser gerada manualmente a qualquer momento
- Independentemente disso, SEMPRE aplicar a lógica de comparação temporal

## REGRA DE ANÁLISE POR OBJETIVO DE CAMPANHA
Você deve adaptar o foco da análise de acordo com o tipo de campanha:

### Campanhas de Lead (Formulário)
- KPI principal: conversão de Lead → MQL
- Avaliar:
  - Qualidade dos leads
  - Taxa de qualificação (MQL/Lead)
  - Custo por MQL
- Identificar campanhas/criativos que geram volume mas não qualificam
- Priorizar eficiência de funil, não apenas CPL

### Campanhas de WhatsApp
- KPI principal: geração de conversas qualificadas
- Avaliar:
  - Criativos com maior volume de conversas
  - Eficiência de custo por conversa
- Foco principal: identificar os melhores criativos

### Campanhas de Visita ao Perfil
- KPI principal: engajamento e atração
- Avaliar:
  - Criativos com melhor performance de clique/engajamento
- Foco principal: identificar os melhores criativos

## REGRA DE ANÁLISE DE CRIATIVOS (OBRIGATÓRIA)
- Não analisar apenas campanhas — analisar também os criativos individualmente
- Para cada campanha relevante:
  - Identificar quais criativos performam melhor e pior
  - Comparar desempenho entre criativos (CTR, CPC, CPA, volume)
- Detectar padrões:
  - Ângulo de copy
  - Tipo de criativo (prova social, dor, oferta, etc.)
- Sinalizar:
  - Criativos que devem ser escalados
  - Criativos que devem ser pausados
  - Oportunidades de novos testes baseados nos padrões encontrados

FORMATO OBRIGATÓRIO:
- Use ## para cabeçalhos de seção
- Use **negrito** para valores de métricas e nomes de KPIs
- Use listas com marcadores para recomendações
- Sempre incluir uma seção comparativa clara:
  - "## Evolução (7d vs 14d vs 30d)"
- Finalize sempre com uma seção "## Próximos Passos" com 3-5 ações específicas e executáveis, ranqueadas por prioridade
- Classifique o impacto geral como: crítico / alto / médio / baixo
```

---

### User Prompt

**Arquivo:** `backend/src/modules/insights/prompts/weekly-report.prompt.ts`  
**Função:** `buildWeeklyReportPrompt(ctx: WeeklyReportContext): string`

O prompt é construído dinamicamente com os dados do contexto. O template completo:

```markdown
# {typeLabel}
**Cliente:** {client.name}
**Período:** {periodStart} a {periodEnd}  (formato DD/MM/YYYY)
**Objetivos:** {client.objectives.join(', ')} ou 'Não definidos'
**Budget Mensal:** R${client.monthly_budget} ou 'Não informado'

## Métricas do Período
- **Gasto:** R${metrics.spend}
- **Impressões:** {metrics.impressions}
- **Alcance:** {metrics.reach}
- **Frequência:** {metrics.frequency}
- **Cliques:** {metrics.clicks}
- **CTR:** {metrics.ctr}%
- **CPC:** R${metrics.cpc}
- **CPM:** R${metrics.cpm}
- **Leads:** {metrics.leads}
- **CPL:** R${metrics.cpl}
- **Mensagens:** {metrics.messages}
- **Custo por Mensagem:** R${metrics.cost_per_message}

## Desempenho vs KPIs
- **{kpi_name}**: Meta {target} | Real {actual} | Δ {delta_pct}% | Status: {status}
... (um por KPI avaliado)
[Se nenhum KPI: "Nenhum KPI configurado para este cliente."]

## Dados do Funil (CRM)   [apenas se crmSummary não null]
- Leads: **{leads}** | MQL: **{mql}** ({lead_to_mql_rate}%) | SQL: **{sql}** ({mql_to_sql_rate}%) | Vendas: **{sales}** ({sql_to_sale_rate}%)
- Custo por MQL: R${cost_per_mql} | Custo por SQL: R${cost_per_sql} | Custo por Venda: R${cost_per_sale}
- Receita total estimada: R${revenue}

## Top 5 Criativos
1. **{name}** ({type}) — Gasto: R${spend} | CTR: {ctr}% | CPL: R${cpl} | Freq: {frequency} | Leads: {leads}
... (até 5 criativos)
[Se insuficiente: "Dados insuficientes de criativos."]

## Alertas Ativos ({n})   [apenas se há alertas]
- [SEVERITY] {message}
... (um por alerta)

---
[TAREFA diferente por report_type — ver abaixo]
```

**Seção TAREFA para `manual`:**

```
TAREFA: Gere um resumo rápido do desempenho desta semana para este cliente.

Seja direto e conciso. Inclua apenas:
1. Resumo executivo (máximo 2 frases)
2. Principais números do período (o que se destacou positiva ou negativamente)
3. Top criativos da semana
4. Análise do funil se houver dados de CRM
5. Até 3 próximos passos prioritários
6. Classificação do impacto geral (crítico/alto/médio/baixo)

Não faça comparação temporal. Foque apenas no período informado.
```

**Seção TAREFA para `weekly_wed` e outros:**

```
TAREFA: Gere uma análise completa de desempenho para este cliente considerando o tipo de relatório ({typeLabel}).

Para relatório de quarta-feira: aplique obrigatoriamente a comparação temporal 7d vs 14d vs 30d conforme as regras do system prompt. Foque no que está chamando atenção na semana atual, sinais de saturação, criativos em destaque, e otimizações recomendadas imediatamente.

Inclua obrigatoriamente:
1. Resumo executivo (máximo 3 frases)
2. Evolução (7d vs 14d vs 30d)
3. Análise de desempenho de mídia por tipo de campanha
4. Análise de criativos com diagnóstico de saturação
5. Análise do funil (se houver dados de CRM)
6. Fatores de risco
7. Próximos passos priorizados (numerados, específicos, com impacto estimado)
8. Classificação do impacto geral (crítico/alto/médio/baixo)
```

**typeLabel por report_type:**

| report_type | typeLabel |
|-------------|-----------|
| `weekly_mon` | Relatório Semanal (Segunda-feira) — Semana anterior |
| `weekly_wed` | Relatório de Inteligência (Quarta-feira) — Semana atual |
| `weekly_fri` | Relatório de Atividades (Sexta-feira) |
| `manual` | Relatório Manual |

---

## Apêndice: Erros de TypeScript Pendentes

Cinco locais com cast incorreto que impedem o build em modo estrito. Correção: substituir `as Record<string, number>` por `as unknown as Record<string, number>`:

| Arquivo | Linha | Descrição |
|---------|-------|-----------|
| `alerts.repository.ts` | 84 | `metrics as unknown as Record<string,number>` |
| `campaigns.repository.ts` | 79 | Cast `Record<string,unknown> as AdSet` |
| `clients.repository.ts` | 15 | Cast `Record<string,unknown> as Client` |
| `insights.service.ts` | 165 | `metrics as unknown as Record<string,number>` |
| `metrics.routes.ts` | 39 | `metrics as unknown as Record<string,number>` |

---

## Apêndice: Glossário

| Termo | Definição |
|-------|-----------|
| CPL | Custo por Lead = spend / leads |
| CTR | Taxa de clique = (clicks / impressions) × 100 |
| CPM | Custo por mil impressões = (spend / impressions) × 1000 |
| CPC | Custo por clique = spend / clicks |
| ROAS | Return on Ad Spend = revenue / spend |
| MQL | Marketing Qualified Lead — lead qualificado pelo marketing |
| SQL | Sales Qualified Lead — lead qualificado para vendas |
| Frequência | Média de exposições por usuário único = impressões / alcance |
| Hook Rate | % de usuários que assistiram os primeiros 3s de um vídeo = (views 3s / impressions) × 100 |
| Saturação | Audiência-alvo excessivamente exposta (frequência > 4.0) |
| KPI Breach | KPI fora do limite aceitável — raw_score < 0.8 |
| Entity | Unidade com métricas: `campaign`, `ad_set` ou `creative` |
| Overdue | Tarefa com `due_date` passada e `status = 'pending'` |
| Service Role | Chave Supabase com acesso total ao banco, bypassa RLS |
