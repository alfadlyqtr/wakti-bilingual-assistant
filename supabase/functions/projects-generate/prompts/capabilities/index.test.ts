// Regression tests for capability detection (prompts/capabilities/index.ts).
// Pure logic, no network/API calls — safe to run anytime, zero cost.
//
// Run with:  deno test supabase/functions/projects-generate/prompts/capabilities/index.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";
import { detectCapabilities, assembleCapabilityDocs, getCapabilityDoc, listCapabilityNames } from "./index.ts";

Deno.test("detectCapabilities: shop request detects ecommerce", () => {
  const result = detectCapabilities("I want to build an online shop to sell products with a cart and checkout");
  assert(result.includes("ecommerce"));
});

Deno.test("detectCapabilities: booking request detects booking", () => {
  const result = detectCapabilities("build a booking site for my barber shop, clients book appointments");
  assert(result.includes("booking"));
});

Deno.test("detectCapabilities: dark mode request detects multi_file_features", () => {
  const result = detectCapabilities("add a dark mode toggle to the site");
  assert(result.includes("multi_file_features"));
});

Deno.test("detectCapabilities: game request excludes ecommerce/booking/forms (mutual exclusion rule)", () => {
  const result = detectCapabilities("build a 2D platformer game with levels, enemies, and a score system, plus a contact form and a shop for skins with booking a coach");
  assert(result.includes("phaser_game"));
  assertEquals(result.includes("ecommerce"), false);
  assertEquals(result.includes("booking"), false);
  assertEquals(result.includes("forms"), false);
});

Deno.test("assembleCapabilityDocs: returns non-empty text when a capability matches", () => {
  const { names, text } = assembleCapabilityDocs("build a blog with articles and posts");
  assert(names.includes("blog"));
  assert(text.length > 0);
});

Deno.test("assembleCapabilityDocs: returns empty text when nothing matches", () => {
  const { names, text } = assembleCapabilityDocs("zzqx nonsense words that match nothing 12345");
  assertEquals(names.length, 0);
  assertEquals(text, "");
});

Deno.test("getCapabilityDoc: known capability returns a non-empty doc string", () => {
  const doc = getCapabilityDoc("ecommerce");
  assert(typeof doc === "string" && doc.length > 0);
});

Deno.test("getCapabilityDoc: unknown capability name returns null", () => {
  const doc = getCapabilityDoc("not_a_real_capability");
  assertEquals(doc, null);
});

Deno.test("listCapabilityNames: every listed name resolves to a real, non-empty doc", () => {
  for (const name of listCapabilityNames()) {
    const doc = getCapabilityDoc(name);
    assert(typeof doc === "string" && doc.length > 0, `Missing doc for capability: ${name}`);
  }
});
