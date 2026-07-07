// Regression tests for model routing logic (models/selection.ts).
// Pure logic, no network/API calls — safe to run anytime, zero cost.
//
// Run with:  deno test supabase/functions/projects-generate/models/selection.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import { selectOptimalModel, isPremiumDesignRequest } from "./selection.ts";

Deno.test("selectOptimalModel: create mode always uses Pro tier", () => {
  const result = selectOptimalModel("anything at all", false, "create");
  assertEquals(result.tier, "pro");
});

Deno.test("selectOptimalModel: image input routes to vision flash", () => {
  const result = selectOptimalModel("check this screenshot", true, "agent");
  assertEquals(result.tier, "flash");
});

Deno.test("selectOptimalModel: simple color/text edit routes to flash", () => {
  const result = selectOptimalModel("change the button color to blue", false, "agent");
  assertEquals(result.tier, "flash");
});

Deno.test("selectOptimalModel: premium design request in agent mode routes to pro", () => {
  const result = selectOptimalModel(
    "redesign the homepage hero to feel more premium and elegant",
    false,
    "agent",
  );
  assertEquals(result.tier, "pro");
});

Deno.test("selectOptimalModel: complex feature build in plan mode routes to pro", () => {
  const result = selectOptimalModel(
    "build a new booking system with multi-step wizard validation",
    false,
    "plan",
  );
  assertEquals(result.tier, "pro");
});

Deno.test("selectOptimalModel: short agent follow-up fix routes to flash", () => {
  const result = selectOptimalModel("still broken, fix it", false, "agent");
  assertEquals(result.tier, "flash");
});

Deno.test("selectOptimalModel: default plan/chat fallback is flash", () => {
  const result = selectOptimalModel("what does this project do?", false, "chat");
  assertEquals(result.tier, "flash");
});

Deno.test("isPremiumDesignRequest: detects premium/redesign language", () => {
  assertEquals(isPremiumDesignRequest("make the landing page feel more luxury and elegant"), true);
});

Deno.test("isPremiumDesignRequest: does not flag unrelated prompts", () => {
  assertEquals(isPremiumDesignRequest("add a footer with social links"), false);
});
