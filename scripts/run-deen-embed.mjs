/**
 * One-time embedding job for Deen RAG — parallel workers.
 * Run: node scripts/run-deen-embed.mjs [quran|hadith]
 */

const SUPABASE_URL = "https://hxauxozopvpzpdygoqwf.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU";
const BATCH_SIZE = 200;
const CONCURRENCY = 4; // parallel workers

async function runBatch(table, offset) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/deen-embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({ table, batch_size: BATCH_SIZE, offset }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

async function embedAll(table, totalRows) {
  console.log(`\n=== Embedding ${table} (~${totalRows} rows, ${CONCURRENCY} parallel workers) ===`);

  // Each worker calls deen-embed repeatedly until it gets done=true
  // The edge function always fetches the next unembedded rows — no offset needed
  let processed = 0;
  let done = false;

  async function worker(workerId) {
    while (!done) {
      try {
        const result = await runBatch(table, 0);
        const n = result.processed ?? 0;
        processed += n;
        if (n > 0) {
          process.stdout.write(`\r  [${table}] ~${processed}/${totalRows} embedded`);
        }
        if (result.done || n === 0) {
          done = true;
          break;
        }
      } catch (err) {
        console.error(`\n  Worker ${workerId} error: ${err.message}`);
        await new Promise(r => setTimeout(r, 2000));
      }
      await new Promise(r => setTimeout(r, 50));
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);
  console.log(`\n  ✓ ${table} done — ~${processed} rows embedded this run`);
}

async function main() {
  const target = process.argv[2]; // optional: "quran" or "hadith"
  console.log("Deen RAG parallel embedding job started...");

  if (!target || target === "quran") await embedAll("quran", 6236);
  if (!target || target === "hadith") await embedAll("hadith", 34157);

  console.log("\n✅ All done! Vector search is now fully active.");
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
