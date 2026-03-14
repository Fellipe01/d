CREATE TABLE IF NOT EXISTS clients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  ad_account      TEXT,
  rdstation_token TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','churned')),
  payment_method  TEXT,
  objectives      TEXT DEFAULT '[]',
  monthly_budget  REAL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_kpis (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kpi_name     TEXT NOT NULL,
  target_value REAL NOT NULL,
  min_value    REAL,
  max_value    REAL,
  weight       REAL NOT NULL DEFAULT 1.0,
  kpi_type     TEXT NOT NULL DEFAULT 'lower_is_better' CHECK(kpi_type IN ('lower_is_better','higher_is_better','range')),
  UNIQUE(client_id, kpi_name)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  external_id TEXT,
  name        TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'meta' CHECK(platform IN ('meta','google','tiktok')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','archived')),
  objective   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ad_sets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  external_id TEXT,
  name        TEXT NOT NULL,
  targeting   TEXT DEFAULT '{}',
  daily_budget REAL,
  status      TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS creatives (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_set_id     INTEGER NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
  external_id   TEXT,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'image' CHECK(type IN ('image','video','carousel','story','reel')),
  thumbnail_url TEXT,
  headline      TEXT,
  body_text     TEXT,
  cta           TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metrics_daily (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type       TEXT NOT NULL CHECK(entity_type IN ('campaign','ad_set','creative')),
  entity_id         INTEGER NOT NULL,
  date              TEXT NOT NULL,
  spend             REAL DEFAULT 0,
  impressions       INTEGER DEFAULT 0,
  reach             INTEGER DEFAULT 0,
  frequency         REAL DEFAULT 0,
  clicks            INTEGER DEFAULT 0,
  ctr               REAL DEFAULT 0,
  cpc               REAL DEFAULT 0,
  cpm               REAL DEFAULT 0,
  leads             INTEGER DEFAULT 0,
  cpl               REAL DEFAULT 0,
  messages          INTEGER DEFAULT 0,
  cost_per_message  REAL DEFAULT 0,
  followers         INTEGER DEFAULT 0,
  cost_per_follower REAL DEFAULT 0,
  video_views       INTEGER DEFAULT 0,
  hook_rate         REAL DEFAULT 0,
  ingested_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id, date)
);

CREATE TABLE IF NOT EXISTS crm_metrics (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  creative_id      INTEGER REFERENCES creatives(id) ON DELETE SET NULL,
  campaign_id      INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id        INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date             TEXT NOT NULL,
  leads            INTEGER DEFAULT 0,
  mql              INTEGER DEFAULT 0,
  sql_count        INTEGER DEFAULT 0,
  sales            INTEGER DEFAULT 0,
  revenue          REAL DEFAULT 0,
  cost_per_mql     REAL DEFAULT 0,
  cost_per_sql     REAL DEFAULT 0,
  cost_per_sale    REAL DEFAULT 0,
  roas             REAL DEFAULT 0,
  lead_to_mql_rate REAL DEFAULT 0,
  mql_to_sql_rate  REAL DEFAULT 0,
  sql_to_sale_rate REAL DEFAULT 0,
  ingested_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS insights (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  content      TEXT NOT NULL,
  summary      TEXT,
  impact_level TEXT NOT NULL DEFAULT 'medium' CHECK(impact_level IN ('critical','high','medium','low')),
  category     TEXT NOT NULL DEFAULT 'performance' CHECK(category IN ('performance','saturation','funnel','budget','creative','opportunity')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','actioned')),
  triggered_by TEXT NOT NULL DEFAULT 'manual' CHECK(triggered_by IN ('manual','scheduled','alert'))
);

CREATE TABLE IF NOT EXISTS reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_type  TEXT NOT NULL CHECK(report_type IN ('weekly_mon','weekly_wed','weekly_fri','manual')),
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  content      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published'))
);

CREATE TABLE IF NOT EXISTS activities (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK(activity_type IN (
    'budget_change','creative_pause','creative_launch','campaign_pause',
    'campaign_launch','kpi_update','note','meeting','optimization'
  )),
  description   TEXT NOT NULL,
  executed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  executed_by   TEXT NOT NULL DEFAULT 'agency',
  campaign_id   INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  creative_id   INTEGER REFERENCES creatives(id) ON DELETE SET NULL,
  metadata      TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL CHECK(alert_type IN (
    'kpi_breach','saturation','budget_pacing','funnel_drop',
    'ctr_drop','frequency_high','cpl_spike'
  )),
  severity        TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('critical','warning','info')),
  message         TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       INTEGER,
  kpi_name        TEXT,
  actual_value    REAL,
  threshold_value REAL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at     TEXT,
  resolved_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_entity ON metrics_daily(entity_type, entity_id, date);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON metrics_daily(date);
CREATE INDEX IF NOT EXISTS idx_crm_metrics_client ON crm_metrics(client_id, date);
CREATE INDEX IF NOT EXISTS idx_crm_metrics_campaign ON crm_metrics(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_insights_client ON insights(client_id, generated_at);
CREATE INDEX IF NOT EXISTS idx_alerts_client ON alerts(client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_client ON activities(client_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_client ON campaigns(client_id, status);
