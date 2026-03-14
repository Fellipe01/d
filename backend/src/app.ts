import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler';
import clientsRouter from './modules/clients/clients.routes';
import campaignsRouter from './modules/campaigns/campaigns.routes';
import metricsRouter from './modules/metrics/metrics.routes';
import ingestionRouter from './modules/ingestion/ingestion.routes';
import insightsRouter from './modules/insights/insights.routes';
import alertsRouter from './modules/alerts/alerts.routes';
import activitiesRouter from './modules/activities/activities.routes';
import funnelRouter from './modules/funnel/funnel.routes';
import reportsRouter from './modules/reports/reports.routes';

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

// Health
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Guard: reject requests with NaN numeric route params before hitting the DB
app.param(['id', 'clientId', 'campaignId', 'creativeId', 'adSetId'], (req, res, next, val) => {
  if (isNaN(Number(val))) {
    res.status(400).json({ error: { message: `Invalid ID: ${val}`, code: 'INVALID_ID' } });
    return;
  }
  next();
});

// Routes
app.use('/api', clientsRouter);
app.use('/api', campaignsRouter);
app.use('/api', metricsRouter);
app.use('/api', ingestionRouter);
app.use('/api', insightsRouter);
app.use('/api', alertsRouter);
app.use('/api', activitiesRouter);
app.use('/api', funnelRouter);
app.use('/api', reportsRouter);

app.use(errorHandler);

export default app;
