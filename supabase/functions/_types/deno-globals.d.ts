// Minimal ambient declaration for Deno globals used by Supabase Edge Functions
// Extend as needed if more Deno APIs are used.
declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};
