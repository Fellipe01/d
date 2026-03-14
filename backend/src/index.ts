import { env } from './config/env';
import { startScheduler } from './scheduler/scheduler';
import app from './app';

// Start scheduler
startScheduler();

app.listen(Number(env.PORT), () => {
  console.log(`[DAE] Backend running on http://localhost:${env.PORT}`);
  console.log(`[DAE] Environment: ${env.NODE_ENV}`);
  console.log(`[DAE] Meta Mock: ${env.USE_META_MOCK}`);
  console.log(`[DAE] Database: Supabase (${env.SUPABASE_URL})`);
});
