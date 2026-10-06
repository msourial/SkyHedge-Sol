const pptxgen = require("pptxgenjs");
const path = require("node:path");

const deck = new pptxgen();
deck.layout = "LAYOUT_WIDE";
deck.author = "SkyHedge";
deck.subject = "CLOCK IN Solana Mobile submission";
deck.title = "SkyHedge — weather protection with verifiable evidence";
deck.lang = "en-US";

const C = {
  bg: "0B0D17",
  panel: "171C2A",
  panel2: "222A3C",
  white: "F4F5F8",
  muted: "A8B3C6",
  mint: "19E6A3",
  violet: "AF8BFF",
  amber: "F2C164",
  blue: "83CCED",
};
const SH = deck.ShapeType;
const font = "Arial";
const image = path.resolve(__dirname, "../docs/assets/clock-in-seeker-explore.png");
const output = path.resolve(__dirname, "../docs/clock-in-pitch.pptx");

function start(number, label) {
  const slide = deck.addSlide();
  slide.background = { color: C.bg };
  slide.addText(label.toUpperCase(), { x: 0.62, y: 0.35, w: 9.5, h: 0.25, fontFace: font, fontSize: 10, bold: true, charSpacing: 1.4, color: C.blue, margin: 0 });
  slide.addText(String(number).padStart(2, "0"), { x: 12.08, y: 0.36, w: 0.58, h: 0.25, fontFace: font, fontSize: 10, color: C.muted, align: "right", margin: 0 });
  return slide;
}

function text(slide, value, x, y, w, h, size = 16, color = C.white, bold = false) {
  slide.addText(value, { x, y, w, h, fontFace: font, fontSize: size, bold, color, margin: 0, breakLine: false, valign: "mid" });
}

function panel(slide, x, y, w, h, fill = C.panel) {
  slide.addShape(SH.roundRect, { x, y, w, h, rectRadius: 0.17, line: { color: fill }, fill: { color: fill } });
}

// 1 — One memorable product promise.
{
  const s = start(1, "Solana Mobile · CLOCK IN");
  text(s, "SKYHEDGE", 0.64, 1.03, 5.6, 0.6, 38, C.white, true);
  text(s, "Weather risk,\nwith a receipt.", 0.62, 1.93, 7.4, 1.72, 43, C.white, true);
  text(s, "NOAA evidence  →  clear protection terms  →  wallet approval  →  finalized Solana proof", 0.65, 4.37, 7.0, 1.05, 20, C.muted);
  panel(s, 8.77, 1.28, 3.70, 4.72, C.panel);
  s.addShape(SH.arc, { x: 9.45, y: 2.11, w: 2.38, h: 2.38, rotate: 35, adjustPoint: 0.35, line: { color: C.mint, width: 8 }, fill: { color: C.panel, transparency: 100 } });
  text(s, "NOAA", 9.61, 2.73, 2.03, 0.42, 24, C.white, true);
  text(s, "EVIDENCE FIRST", 9.31, 4.69, 2.6, 0.3, 12, C.mint, true);
  text(s, "Devnet pilot · SKYT has no real-world value", 0.65, 6.56, 9.7, 0.33, 13, C.amber);
}

// 2 — Product fit, framed around an everyday decision.
{
  const s = start(2, "The problem");
  text(s, "Weather loss is personal.\nThe evidence should be inspectable.", 0.63, 1.02, 11.7, 1.34, 34, C.white, true);
  const blocks = [
    ["01", "Name a place", "A farm, an event, or another rainfall-exposed plan."],
    ["02", "Understand the trigger", "Exact station, dates, units, fixed payout, and maximum test cost."],
    ["03", "Approve deliberately", "No invisible transaction: the wallet signs only after review."],
  ];
  blocks.forEach(([n, title, body], i) => {
    const y = 2.95 + i * 1.19;
    panel(s, 0.63, y, 11.75, 0.94);
    text(s, n, 0.89, y + 0.23, 0.7, 0.4, 21, C.mint, true);
    text(s, title, 1.72, y + 0.16, 3.24, 0.48, 20, C.white, true);
    text(s, body, 5.1, y + 0.14, 6.9, 0.53, 15, C.muted);
  });
}

// 3 — Real phone build, not a concept rendering.
{
  const s = start(3, "Native Android");
  text(s, "A phone-native decision flow", 0.63, 1.0, 7.5, 0.68, 34, C.white, true);
  text(s, "Choose a place → inspect rainfall evidence → review a SKYT test contract → approve in an MWA-compatible wallet.", 0.65, 1.96, 6.55, 1.18, 20, C.muted);
  panel(s, 0.64, 3.53, 6.55, 1.56);
  text(s, "Truthful by design", 0.91, 3.79, 5.8, 0.4, 20, C.mint, true);
  text(s, "Research-only markets stay blocked. Missing NOAA data is never filled with an estimate.", 0.91, 4.31, 5.75, 0.56, 16, C.white);
  text(s, "Captured on the Seeker from the production-API APK.", 0.66, 6.48, 6.7, 0.28, 12, C.muted);
  panel(s, 8.82, 0.89, 3.42, 6.07, C.panel2);
  s.addImage({ path: image, x: 9.24, y: 1.02, w: 2.58, h: 5.74 });
}

// 4 — Trust boundary; no oracle overclaim.
{
  const s = start(4, "Verification model");
  text(s, "The oracle attests.\nThe program enforces.", 0.62, 0.99, 8.6, 1.32, 36, C.white, true);
  const steps = [
    ["NOAA", "Final station observation\nfor the pinned window", C.blue],
    ["SkyHedge signer", "Authorized attestation\nwith source hash", C.violet],
    ["Solana program", "Checks signer and rules;\ncontrols claim transfer", C.mint],
  ];
  steps.forEach(([head, body, accent], i) => {
    const x = 0.65 + i * 4.18;
    panel(s, x, 3.08, 3.67, 2.08);
    s.addShape(SH.ellipse, { x: x + 0.27, y: 3.43, w: 0.24, h: 0.24, line: { color: accent }, fill: { color: accent } });
    text(s, head, x + 0.66, 3.32, 2.78, 0.5, 21, C.white, true);
    text(s, body, x + 0.29, 4.11, 3.09, 0.82, 16, C.muted);
  });
  text(s, "A hash is an audit link, not independent proof that NOAA was truthful. No live payout is claimed before the real observation and final-data period.", 0.67, 5.78, 11.8, 0.79, 15, C.amber);
}

// 5 — Honest release status and path forward.
{
  const s = start(5, "Pilot status and next proof");
  text(s, "One complete journey beats twelve promises.", 0.62, 1.0, 12.0, 0.75, 33, C.white, true);
  panel(s, 0.65, 2.12, 5.74, 3.64);
  text(s, "VERIFIED", 0.96, 2.45, 2.0, 0.35, 13, C.mint, true);
  text(s, "Native Android APK\nExecutable Devnet program + IDL\nNOAA station and pricing package\nFinalized chain-status reads", 0.96, 3.00, 4.87, 2.16, 19, C.white);
  panel(s, 6.75, 2.12, 5.74, 3.64);
  text(s, "REMAINING PILOT GATES", 7.06, 2.45, 4.8, 0.35, 13, C.amber, true);
  text(s, "Cancel expired empty Draft\nCreate, fund, and open a fresh market\nSign one non-admin mobile test purchase\nVerify the finalized position", 7.06, 3.00, 4.9, 2.16, 19, C.white);
  text(s, "Today: valueless Devnet SKYT. Later: regulated USD/USDC collateral, more locations, and operational oracle automation.", 0.65, 6.26, 11.75, 0.5, 16, C.muted);
}

deck.writeFile({ fileName: output });
