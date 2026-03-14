// Legacy compatibility shim — SQLite replaced by Supabase (PostgreSQL).
// Repositories and routes have been migrated to use the supabase client directly.
export { supabase as default } from './supabase';

// Stub kept so any remaining import of getDb compiles without error.
// New code must NOT call this — use the supabase client from ./supabase instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): never {
  throw new Error(
    'getDb() is no longer supported. Import the supabase client from config/supabase instead.'
  );
}
