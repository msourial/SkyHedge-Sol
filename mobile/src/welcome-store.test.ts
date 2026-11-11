import assert from "node:assert/strict";
import { test } from "node:test";
import { createWelcomeStore, WELCOME_SEEN_KEY } from "./welcome-state.ts";
import { WELCOME_SLOGAN, WELCOME_AUDIENCE, WELCOME_STEPS, WELCOME_WALLET, WELCOME_CTA, WELCOME_ABOUT } from "../../shared/ui-copy.ts";
test("welcome starts unseen and marks seen independently of wallet", async () => {
  const values = new Map<string, string>([["wallet", "saved-session"]]);
  const store = createWelcomeStore({ getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } });
  assert.equal(await store.shouldShow(), true);
  await store.markSeen();
  assert.equal(values.get(WELCOME_SEEN_KEY), "true");
  assert.equal(await store.shouldShow(), false);
  assert.equal(values.get("wallet"), "saved-session");
  await store.markSeen();
  assert.equal(await store.shouldShow(), false);
});
test("storage failure still permits welcome and entry", async () => {
  const store = createWelcomeStore({ getItem: async () => { throw Error("locked"); }, setItem: async () => { throw Error("locked"); } });
  assert.equal(await store.shouldShow(), true);
  await assert.doesNotReject(store.markSeen());
});
test("welcome contains required product copy without numeric claims", () => {
  assert.equal(WELCOME_SLOGAN, "Rain on your plans? Get paid.");
  const text = [WELCOME_SLOGAN, WELCOME_AUDIENCE, ...WELCOME_STEPS.flatMap(step => [step.title, step.body]), WELCOME_WALLET, WELCOME_CTA, WELCOME_ABOUT].join(" ");
  for (const word of ["farmers", "event organizers", "street vendors", "aviation", "small businesses", "rain", "snow", "wind", "heat", "cold", "NOAA", "Solana", "Seeker", "mobile wallet", "upfront", "collect"]) assert.ok(text.includes(word), word);
  assert.doesNotMatch(text, /insur|wed[d]ing|\d|%|SKYT|\bmm\b/i);
});
