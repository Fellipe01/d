-- DAE Media Intelligence – PostgreSQL schema for Supabase
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- Clients
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  ad_account      TEXT,
  rdstation_token TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'churned')),
  payment_method  TEXT,
  objectives      TEXT DEFAULT '[]',          -- stored as JSON string
  monthly_budget  NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Client KPIs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_kpis (
  id           BIGSERIAL PRIMARY KEY,
  client_id    BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  kpi_name     TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  min_value    NUMERIC,
  max_value    NUMERIC,
  weight       NUMERIC NOT NULL DEFAULT 1.0,
  kpi_type     TEXT NOT NULL DEFAULT 'lower_is_better'
                 CHECK (kpi_type IN ('lower_is_better', 'higher_is_better', 'range')),
  UNIQUE (client_id, kpi_name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Campaigns
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id          BIGSERIAL PRIMARY KEY,
  client_id   BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  external_id TEXT,
  name        TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'meta'
                CHECK (platform IN ('meta', 'google', 'tiktok')),
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'paused', 'archived')),
  objective   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Ad Sets
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_sets (
  id           BIGSERIAL PRIMARY KEY,
  campaign_id  BIGINT NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  external_id  TEXT,
  name         TEXT NOT NULL,
  targeting    TEXT DEFAULT '{}',             -- stored as JSON string
  daily_budget NUMERIC,
  status       TEXT NOT NULL DEFAULT 'active'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Creatives
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creatives (
  id            BIGSERIAL PRIMARY KEY,
  ad_set_id     BIGINT NOT NULL REFERENCES ad_sets (id) ON DELETE CASCADE,
  external_id   TEXT,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'image'
                  CHECK (type IN ('image', 'video', 'carousel', 'story', 'reel')),
  thumbnail_url TEXT,
  headline      TEXT,
  body_text     TEXT,
  cta           TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Daily Metrics
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics_daily (
  id                BIGSERIAL PRIMARY KEY,
  entity_type       TEXT NOT NULL CHECK (entity_type IN ('campaign', 'ad_set', 'creative')),
  entity_id         BIGINT NOT NULL,
  date              DATE NOT NULL,
  spend             NUMERIC DEFAULT 0,
  impressions       BIGINT DEFAULT 0,
  reach             BIGINT DEFAULT 0,
  frequency         NUMERIC DEFAULT 0,
  clicks            BIGINT DEFAULT 0,
  ctr               NUMERIC DEFAULT 0,
  cpc               NUMERIC DEFAULT 0,
  cpm               NUMERIC DEFAULT 0,
  leads             BIGINT DEFAULT 0,
  cpl               NUMERIC DEFAULT 0,
  messages          BIGINT DEFAULT 0,
  cost_per_message  NUMERIC DEFAULT 0,
  followers         BIGINT DEFAULT 0,
  cost_per_follower NUMERIC DEFAULT 0,
  video_views       BIGINT DEFAULT 0,
  hook_rate         NUMERIC DEFAULT 0,
  ingested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CRM Metrics
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_metrics (
  id               BIGSERIAL PRIMARY KEY,
  creative_id      BIGINT REFERENCES creatives (id) ON DELETE SET NULL,
  campaign_id      BIGINT REFERENCES campaigns (id) ON DELETE CASCADE,
  client_id        BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  leads            BIGINT DEFAULT 0,
  mql              BIGINT DEFAULT 0,
  sql_count        BIGINT DEFAULT 0,
  sales            BIGINT DEFAULT 0,
  revenue          NUMERIC DEFAULT 0,
  cost_per_mql     NUMERIC DEFAULT 0,
  cost_per_sql     NUMERIC DEFAULT 0,
  cost_per_sale    NUMERIC DEFAULT 0,
  roas             NUMERIC DEFAULT 0,
  lead_to_mql_rate NUMERIC DEFAULT 0,
  mql_to_sql_rate  NUMERIC DEFAULT 0,
  sql_to_sale_rate NUMERIC DEFAULT 0,
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, campaign_id, date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Insights (AI-generated)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insights (
  id           BIGSERIAL PRIMARY KEY,
  client_id    BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  content      TEXT NOT NULL,
  summary      TEXT,
  impact_level TEXT NOT NULL DEFAULT 'medium'
                 CHECK (impact_level IN ('critical', 'high', 'medium', 'low')),
  category     TEXT NOT NULL DEFAULT 'performance'
                 CHECK (category IN ('performance', 'saturation', 'funnel', 'budget', 'creative', 'opportunity')),
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'archived', 'actioned')),
  triggered_by TEXT NOT NULL DEFAULT 'manual'
                 CHECK (triggered_by IN ('manual', 'scheduled', 'alert'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Reports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id           BIGSERIAL PRIMARY KEY,
  client_id    BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  report_type  TEXT NOT NULL
                 CHECK (report_type IN ('weekly_mon', 'weekly_wed', 'weekly_fri', 'manual')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  content      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Activities
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id            BIGSERIAL PRIMARY KEY,
  client_id     BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'budget_change', 'creative_pause', 'creative_launch', 'campaign_pause',
    'campaign_launch', 'kpi_update', 'note', 'meeting', 'optimization'
  )),
  description   TEXT NOT NULL,
  executed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_by   TEXT NOT NULL DEFAULT 'agency',
  campaign_id   BIGINT REFERENCES campaigns (id) ON DELETE SET NULL,
  creative_id   BIGINT REFERENCES creatives (id) ON DELETE SET NULL,
  metadata      TEXT DEFAULT '{}'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Alerts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id              BIGSERIAL PRIMARY KEY,
  client_id       BIGINT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL CHECK (alert_type IN (
    'kpi_breach', 'saturation', 'budget_pacing', 'funnel_drop',
    'ctr_drop', 'frequency_high', 'cpl_spike'
  )),
  severity        TEXT NOT NULL DEFAULT 'warning'
                    CHECK (severity IN ('critical', 'warning', 'info')),
  message         TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       BIGINT,
  kpi_name        TEXT,
  actual_value    NUMERIC,
  threshold_value NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_metrics_daily_entity ON metrics_daily (entity_type, entity_id, date);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date   ON metrics_daily (date);
CREATE INDEX IF NOT EXISTS idx_crm_metrics_client   ON crm_metrics (client_id, date);
CREATE INDEX IF NOT EXISTS idx_crm_metrics_campaign ON crm_metrics (campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_insights_client      ON insights (client_id, generated_at);
CREATE INDEX IF NOT EXISTS idx_alerts_client        ON alerts (client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_client    ON activities (client_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_client     ON campaigns (client_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security (RLS) — disabled by default for service-role access
-- Enable and configure if you need per-user isolation in the future.
-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- (add policies here as needed)
