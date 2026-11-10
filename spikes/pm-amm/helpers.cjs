"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var pm_amm_helpers_exports = {};
__export(pm_amm_helpers_exports, {
  fetchMarkets: () => fetchMarkets,
  marketState: () => marketState,
  minOutput: () => minOutput,
  quoteSwap: () => quoteSwap
});
module.exports = __toCommonJS(pm_amm_helpers_exports);
var import_math = require("@pm-amm/sdk/math");
const FEE_BPS = 200;
const Z_CLAMP = 5.9;
const nowSecs = () => Math.floor(Date.now() / 1e3);
function marketState(m, now = nowSecs()) {
  const endTs = m.endTs.toNumber();
  const lZero = (0, import_math.i80f48ToNumber)(m.lZero);
  const secondsLeft = Math.max(endTs - now, 0);
  const lEff = lZero * Math.sqrt(Math.max(endTs - now, 1));
  const lLast = lZero * Math.sqrt(Math.max(endTs - m.lastAccrualTs.toNumber(), 1));
  const scale = lLast > 0 ? lEff / lLast : 0;
  const x = (0, import_math.i80f48ToNumber)(m.reserveYes) * scale;
  const y = (0, import_math.i80f48ToNumber)(m.reserveNo) * scale;
  const winner = m.winningSide === 1 ? "yes" : m.winningSide === 2 ? "no" : null;
  const price = winner ? winner === "yes" ? 1 : 0 : lEff > 0 ? (0, import_math.capitalPhi)((y - x) / lEff) : 0.5;
  return {
    x,
    y,
    lEff,
    price,
    secondsLeft,
    expired: secondsLeft === 0,
    resolved: m.resolved,
    winner
  };
}
const base = (u) => u * (0, import_math.capitalPhi)(u) + (0, import_math.phi)(u);
function solveU(f, target, increasing) {
  let lo = -40;
  let hi = 40;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (increasing ? v < target : v > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const xFromY = (y, L) => y - L * solveU(base, y / L, true);
const yFromX = (x, L) => {
  const u = solveU((v) => base(v) - v, x / L, false);
  return x + u * L;
};
function curveOut(s, dir, dIn) {
  const { x, y, lEff: L } = s;
  const clampZ = (z) => Math.max(-Z_CLAMP, Math.min(Z_CLAMP, z));
  switch (dir) {
    case "usdcToYes":
      return dIn + (x - xFromY(y + dIn, L));
    case "usdcToNo":
      return dIn + (y - yFromX(x + dIn, L));
    case "yesToUsdc":
      return y - L * base(clampZ((y - x - dIn) / L));
    case "noToUsdc": {
      const z = clampZ((y - x + dIn) / L);
      return x - L * (base(z) - z);
    }
    case "yesToNo":
      return y - yFromX(x + dIn, L);
    case "noToYes":
      return x - xFromY(y + dIn, L);
  }
}
function quoteSwap(m, direction, amountIn, now = nowSecs()) {
  const s = marketState(m, now);
  if (s.resolved || s.expired) throw new Error("market is resolved or expired: no swaps");
  const usdcIn = direction === "usdcToYes" || direction === "usdcToNo";
  const usdcOut = direction === "yesToUsdc" || direction === "noToUsdc";
  const feeIn = usdcIn ? Math.floor(amountIn * FEE_BPS / 1e4) : 0;
  const gross = Math.max(Math.floor(curveOut(s, direction, amountIn - feeIn)), 0);
  const feeOut = usdcOut ? Math.floor(gross * FEE_BPS / 1e4) : 0;
  const out = gross - feeOut;
  return { out, fee: feeIn + feeOut, avgPrice: amountIn > 0 ? out / amountIn : 0 };
}
function minOutput(q, slippageBps = 100) {
  return Math.floor(q.out * (1e4 - slippageBps) / 1e4);
}
async function fetchMarkets(client, pdas) {
  const ns = client.program.account;
  return ns.market.fetchMultiple(pdas);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  fetchMarkets,
  marketState,
  minOutput,
  quoteSwap
});
