import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceRole) {
  console.error('[check] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const serviceClient = createClient(url, serviceRole, { auth: { persistSession: false } });
const anonClient = anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null;

async function probe(client, label) {
  const { count, error, status } = await client
    .from('admin_activity_logs')
    .select('*', { count: 'exact', head: true });
  return { label, ok: !error, status, count: count ?? null, code: error?.code ?? null, message: error?.message ?? null };
}

(async () => {
  const rows = [];
  rows.push(await probe(serviceClient, 'service_role'));
  if (anonClient) rows.push(await probe(anonClient, 'anon'));

  console.table(rows);
  if (rows[0]?.ok) {
    console.log('RLS bypass with service_role: YES (read succeeded).');
    process.exit(0);
  } else {
    console.log('RLS bypass with service_role: NO (unexpected).');
    process.exit(2);
  }
})();
