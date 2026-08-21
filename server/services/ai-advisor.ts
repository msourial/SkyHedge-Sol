import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CITY_INDEX, cityBySlug, windowNormalMm, upcomingWeeklyWindows } from "../../shared/cities";
import { strikeSetFor } from "./chain-pricing";

export const advisorSchema = z.object({
  city: z.string(),
  risk: z.enum(["excess-rain", "low-rain"]),
  thresholdMm: z.number().positive().max(500),
  protectedAmount: z.string().regex(/^\d+$/),
  reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type AdvisorPlan = z.infer<typeof advisorSchema>;

export type AdvisorResult = {
  response: string;
  source: "llm" | "rule";
  confidence: number;
  advisory: AdvisorPlan | null;
  chainLink: { slug: string; strikeMm: number; side: "call" | "put" } | null;
};

const CITY_CONTEXT = CITY_INDEX.map((c) => {
  const normals = Array.isArray(c.monthlyNormalsMm) ? c.monthlyNormalsMm.filter((n): n is number => n !== null) : [];
  const hint = normals.length ? `${Math.round((normals[0] + normals[1]) / 2)}mm/week` : "?";
  return `${c.name} — slug ${c.slug}, ${c.country}, weekly normal ≈ ${hint}`;
}).join("\n");

function nearestStrike(slug: string, thresholdMm: number, risk: "excess-rain" | "low-rain"): { slug: string; strikeMm: number; side: "call" | "put" } | null {
  const city = cityBySlug(slug);
  if (!city) return null;
  const [start, end] = upcomingWeeklyWindows(new Date(), 1)[0] ? [upcomingWeeklyWindows(new Date(), 1)[0].start, upcomingWeeklyWindows(new Date(), 1)[0].end] : [new Date(), new Date(Date.now() + 7 * 86_400_000)];
  const normal = windowNormalMm(city, start.getTime(), end.getTime());
  const strikes = strikeSetFor(normal);
  if (!strikes.length) return null;
  const side = risk === "excess-rain" ? "call" : "put";
  const pick = strikes.reduce((prev, curr) => (Math.abs(curr - thresholdMm) < Math.abs(prev - thresholdMm) ? curr : prev));
  return { slug, strikeMm: pick, side };
}

function makeRuleAdvisory(message: string): AdvisorResult {
  const text = message.toLowerCase();
  const city = CITY_INDEX.find((c) => text.includes(c.name.toLowerCase()) || text.includes(c.slug.replace("-", " ")));
  const risk: "excess-rain" | "low-rain" = /flood|heavy|excess|storm|monsoon|rain|satur|washout/i.test(text) && !/dry|drought|shortage|irrigat/i.test(text) ? "excess-rain" : "low-rain";
  const mmMatch = text.match(/(\d+)\s*mm/);
  const thresholdMm = mmMatch ? Math.max(1, Math.min(500, Number(mmMatch[1]))) : 25;
  const cleaned = text.replace(/,/g, "");
  const amountMatch = cleaned.match(/(\d+)\s*(k)?\s*(skyt)?/i);
  let rawAmount = amountMatch ? Number(amountMatch[1]) : 10_000;
  if (amountMatch?.[2]) rawAmount *= 1000;
  rawAmount = Math.min(Math.max(rawAmount, 1), 1_000_000);
  const protectedAmount = String(Math.round(rawAmount) * 1e6);
  const slug = city?.slug ?? "new-york";
  const advisory: AdvisorPlan = {
    city: slug,
    risk,
    thresholdMm,
    protectedAmount,
    reasoning: `Rule-based plan (no LLM key configured): matched "${city?.name ?? "a default city"}" with a ${risk === "excess-rain" ? "heavy-rain" : "dry-weather"} exposure at ${thresholdMm}mm for ${Number(protectedAmount) / 1e6} SKYT. Confirm on the city chain before signing — nothing is simulated.`,
    confidence: 0.55,
  };
  return {
    response: `Here's a structured plan: protect against ${risk === "excess-rain" ? "cumulative rainfall ≥" : "cumulative rainfall ≤"} ${thresholdMm}mm on the ${city?.name ?? "New York"} index for ${Number(protectedAmount) / 1e6} SKYT. This is a rule-based fallback — add ANTHROPIC_API_KEY for conversational reasoning.`,
    source: "rule",
    confidence: advisory.confidence,
    advisory,
    chainLink: nearestStrike(slug, thresholdMm, risk),
  };
}

async function makeLlmAdvisory(client: Anthropic, message: string): Promise<AdvisorResult> {
  const system = [
    "You are SkyHedge's weather-risk trading advisor. Users describe real-world exposures (farms, events, logistics, energy).",
    "Map each exposure to ONE city index contract and return ONLY valid JSON — no markdown, no prose outside the JSON.",
    "JSON shape: {\"city\":\"<slug>\",\"risk\":\"excess-rain\"|\"low-rain\",\"thresholdMm\":<number 1-500>,\"protectedAmount\":\"<SKYT raw units, 1e6 per SKYT>\",\"reasoning\":\"<max 90 words, specific to the user's exposure>\",\"confidence\":<0..1>}",
    `Available city indices:\n${CITY_CONTEXT}`,
    "excess-rain = cumulative rainfall ≥ threshold (buy the call). low-rain = cumulative rainfall ≤ threshold (buy the put).",
    "Pick a threshold near the city's weekly normal unless the user specifies one. protectedAmount: convert the user's budget to SKYT raw units (e.g. 500 SKYT → \"500000000\").",
    "SkyHedge never executes, signs, or simulates transactions — the plan is informational and always requires the user's explicit wallet approval.",
  ].join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 600,
    temperature: 0.3,
    system,
    messages: [{ role: "user", content: message }],
  });

  const raw = response.content.map((b) => ("text" in b ? b.text : "")).join("").trim();
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  const parsed = jsonStart >= 0 && jsonEnd > jsonStart ? JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) : null;
  const plan = parsed ? advisorSchema.safeParse(parsed) : null;
  if (!plan?.success) {
    const fallback = makeRuleAdvisory(message);
    return { ...fallback, response: `I couldn't structure that into a valid plan, so here's a conservative default: ${fallback.response}` };
  }

  const a = plan.data;
  const link = nearestStrike(a.city, a.thresholdMm, a.risk);
  const cityName = CITY_INDEX.find((c) => c.slug === a.city)?.name ?? a.city;
  const near = link ? `The nearest live contract on the ${cityName} chain is a ${link.side === "call" ? "call" : "put"} at ${link.strikeMm}mm.` : "Check the city chain for available strikes.";
  return {
    response: `Plan ready for ${cityName}: ${a.risk === "excess-rain" ? "protect against ≥" : "protect against ≤"} ${a.thresholdMm}mm for ${Number(a.protectedAmount) / 1e6} SKYT. ${near} Open the chain to buy — the transaction is built unsigned and signed by your wallet.`,
    source: "llm",
    confidence: a.confidence,
    advisory: a,
    chainLink: link,
  };
}

let client: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
  return client;
}

export async function advisorChat(message: string): Promise<AdvisorResult> {
  const trimmed = message.trim();
  if (!trimmed) return makeRuleAdvisory("no message");
  const c = getClient();
  if (!c) return makeRuleAdvisory(trimmed);
  try {
    return await makeLlmAdvisory(c, trimmed);
  } catch {
    return { ...makeRuleAdvisory(trimmed), response: "The LLM is unavailable right now — using the deterministic planner instead." };
  }
}