# PRD — DAE Media Intelligence
**Versão:** 1.0
**Data:** Março 2026
**Responsável:** DAE Assessoria

---

## 1. Visão do Produto

### Problema
Agências de tráfego pago gerenciam múltiplos clientes com dados espalhados em Meta Ads, Google Ads, CRM (RD Station), planilhas e documentos. A análise manual é lenta, propensa a erros e não escala. Relatórios demoram horas para preparar e ficam desatualizados antes de serem entregues.

### Solução
DAE Media Intelligence é uma plataforma centralizada que:
1. **Consolida** dados de campanhas pagas e CRM em um único banco de dados
2. **Analisa** automaticamente performance vs. KPIs definidos por cliente
3. **Alerta** proativamente quando métricas entram em zona de risco
4. **Gera relatórios** com IA (Claude) três vezes por semana automaticamente
5. **Apresenta** tudo em uma interface visual clara para o time de analistas

### Usuários
- **Analistas de tráfego** da DAE Assessoria (usuários primários)
- **Gestores da agência** (visualização executiva)
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

### 3.3 Ingestão de Métricas
**Status:** ✅ Mock implementado | ⏳ Integração real pendente

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

Armazenamento diário por entidade (campanha / ad set / criativo) com deduplicação por UPSERT.

**Mock Data Generator:**
- 3 campanhas × 2 ad sets × 2-3 criativos por cliente
- 90 dias de histórico diário com padrões realistas:
  - CTR declinante após dia 40-80 (simulando saturação)
  - Frequência crescendo de 0.5 → 6.0 ao longo do tempo
  - Dados CRM correlacionados (leads, MQL, SQL, vendas)

### 3.4 Alertas Automáticos
**Status:** ✅ Implementado

Verificação diária (8h, Sao Paulo) de todos os clientes ativos.

**Tipos de alerta:**
| Tipo | Trigger | Severidade |
|------|---------|------------|
| `kpi_breach` | KPI fora do intervalo aceitável | critical (score < 0.6) ou warning |
| `frequency_high` | Frequência ≥ 4.0 | warning; ≥ 5.0 → critical |
| `saturation` | (planejado) | — |
| `budget_pacing` | (planejado) | — |
| `funnel_drop` | (planejado) | — |
| `ctr_drop` | (planejado) | — |
| `cpl_spike` | (planejado) | — |

**Deduplicação:** no máximo 1 alerta ativo por KPI por cliente por dia.

**Resolução:** manual pelo analista via interface ou API.

### 3.5 Geração de Insights com IA
**Status:** ✅ Implementado

**Modelo:** Claude Sonnet 4.6 (`claude-sonnet-4-6`)

**Tipos de relatório:**

| Tipo | Agenda | Período analisado | Foco |
|------|--------|-------------------|------|
| `weekly_mon` | Segunda 9h | Semana anterior | Revisão completa |
| `weekly_wed` | Quarta 9h | Semana atual | Inteligência mid-week |
| `weekly_fri` | Sexta 9h | Semana atual | Atividades e impacto |
| `manual` | On-demand | Customizável | Análise ad-hoc |

**Contexto enviado para o Claude:**
- Dados do cliente (objetivos, budget)
- Métricas do período (8 KPIs principais)
- Avaliação de cada KPI vs. meta (score, delta%)
- Top 5 criativos por spend (com CTR, CPL, frequência)
- Dados do funil CRM (se disponível)
- Alertas ativos

**Output:**
- Markdown estruturado com análise completa
- Seção obrigatória: `## Próximos Passos` com 3-5 ações priorizadas
- Classificação automática: impact_level (critical/high/medium/low) e category
- Summary de até 200 caracteres para listagem

**Persona do sistema:**
Analista sênior de mídia da DAE Assessoria, especialista em tráfego pago, foco em dados, tom direto e prático, idioma português brasileiro.

### 3.6 Dashboard e Visualizações
**Status:** ✅ Implementado

**Dashboard principal:**
- Cards de métricas: Spend, Impressões, Leads, CPL, CTR, Frequência, Mensagens, CPC
- Gráfico de tendência de spend (AreaChart, 7-30 dias)
- Tabela de KPIs com status visual (on_target / warning / breach)
- Top 5 criativos com performance comparativa
- Insights recentes (últimos gerados)
- Alertas ativos (banners critical + warning)

**Outras páginas:**
- `/clients` — Gestão completa de clientes
- `/campaigns` — Lista de campanhas do cliente selecionado
- `/creatives` — Browser de criativos com métricas
- `/funnel` — Funil CRM visualizado
- `/insights` — Histórico e geração de insights
- `/reports` — Lista e visualização de relatórios
- `/alerts` — Central de alertas com resolução
- `/activities` — Timeline de atividades manuais

### 3.7 Funil CRM
**Status:** ✅ Implementado

Rastreamento do funil completo de conversão:

```
Leads → MQL → SQL → Venda
```

Métricas calculadas:
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
| IA | Anthropic SDK (Claude) | claude-sonnet-4-6 |
| Scheduler | node-cron | v3 |
| Validação | Zod | v3 |

### 4.2 Fluxo de Dados

```
[Meta Ads API] ──→ [Ingestion Module] ──→ [metrics_daily]
[RD Station]   ──→ [Ingestion Module] ──→ [crm_metrics]
                                                │
[node-cron]    ──→ [Scheduler] ─────────→ [Insights Service]
[API request]  ──→ [Insights Route] ────→ [Insights Service]
                                                │
                                    [Anthropic Claude API]
                                                │
                                          [insights table]
                                                │
                                     [Frontend → Dashboard]
```

### 4.3 Autenticação e Segurança

**Atual:**
- Middleware de API Key (`X-API-Key` header)
- Dev: bypass automático
- CORS restrito a `localhost:5173` e `localhost:3000`
- Service role key do Supabase (acesso total ao banco)

**Pendente:**
- Autenticação de usuários (Supabase Auth ou JWT)
- RLS (Row-Level Security) por cliente
- Portal read-only para clientes finais

---

## 5. Deploy

### Backend → Railway
- Root: `backend/`
- Build: `npm run build`
- Start: `node dist/index.js`
- Requer: todas as variáveis de ambiente do `.env`
- Cron jobs rodam como processo contínuo no Railway

### Frontend → Vercel
- Root: `frontend/`
- Build: `npm run build`
- Output: `dist/`
- Variável de ambiente: `VITE_API_URL` apontando para URL do Railway

---

## 6. Roadmap

### v1.0 (MVP atual — implementado)
- [x] CRUD de clientes e KPIs
- [x] Estrutura de campanhas/ad sets/criativos
- [x] Ingestão de métricas (mock)
- [x] Alertas automáticos de KPI
- [x] Geração de insights com Claude AI
- [x] Relatórios semanais automáticos
- [x] Dashboard com visualizações
- [x] Funil CRM
- [x] Log de atividades

### v1.1 (próximas semanas)
- [ ] Rodar schema no Supabase e fazer deploy (Railway + Vercel)
- [ ] Corrigir 5 erros de TypeScript no build
- [ ] Integração real com Meta Ads API (substituir mock)
- [ ] Integração real com RD Station

### v1.2 (próximo mês)
- [ ] Autenticação de usuários
- [ ] Portal read-only para clientes
- [ ] Notificações via email/Slack
- [ ] Export de relatórios em PDF

### v2.0 (futuro)
- [ ] Google Ads integration
- [ ] TikTok Ads integration
- [ ] Análise preditiva (forecast de KPIs)
- [ ] Custom report builder
- [ ] Multi-tenancy (agência → clientes com permissões)
- [ ] Benchmarking entre clientes/indústria

---

## 7. Dependências Externas

| Serviço | Uso | Status |
|---------|-----|--------|
| Anthropic API | Geração de insights (Claude Sonnet 4.6) | ✅ Ativo |
| Supabase | PostgreSQL + hosting | ✅ Ativo (schema pendente) |
| Meta Ads API | Ingestão de métricas | ⏳ Mock (integração real pendente) |
| RD Station API | Dados de CRM/funil | ⏳ Mock (integração real pendente) |
| Railway | Hosting do backend | ⏳ Pendente deploy |
| Vercel | Hosting do frontend | ⏳ Pendente deploy |

---

## 8. Decisões de Design

### Por que Supabase e não SQLite?
O sistema precisa ser acessível de múltiplos deployments (Railway + localmente em dev). SQLite é um arquivo local — não funciona em ambiente cloud escalável. Supabase oferece PostgreSQL gerenciado com SDK simples.

### Por que Railway e não Vercel para o backend?
O backend usa `node-cron` para disparar relatórios automáticos em horários fixos. Vercel é serverless — processos morrem após cada request. Railway suporta processos contínuos (long-running server), necessário para o scheduler funcionar. Vercel seria viável apenas no plano Pro (~$20/mês) usando Vercel Cron Jobs com refatoração do scheduler.

### Por que Claude Sonnet 4.6?
Equilíbrio ideal entre qualidade de análise e custo. O modelo é capaz de interpretar contexto complexo de marketing digital em português, gerar insights acionáveis e seguir instruções estruturadas de formato.

### Por que TanStack Query e não SWR ou fetch manual?
Cache automático, deduplicação de requests, staleTime configurável, e integração nativa com React 18 concurrent features. Reduz boilerplate significativamente vs. useEffect + useState manual.

---

## 9. Glossário

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
