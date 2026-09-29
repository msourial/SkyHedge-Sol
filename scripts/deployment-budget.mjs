function solToLamports(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,9})?$/.test(text)) {
    throw new Error("Deployment funding values must be finite non-negative SOL amounts.");
  }
  const [whole, fractional = ""] = text.split(".");
  return BigInt(whole) * 1_000_000_000n + BigInt(fractional.padEnd(9, "0"));
}

function lamportsToSol(value) {
  const whole = value / 1_000_000_000n;
  const fractional = String(value % 1_000_000_000n).padStart(9, "0");
  return `${whole}.${fractional}`;
}

/** Buffer rent is an additional requirement only before the reusable buffer exists. */
export function minimumDeploymentBalance({ bufferRentSol, reserveSol, reusableBuffer }) {
  if (typeof reusableBuffer !== "boolean") throw new Error("Reusable-buffer state must be explicit.");
  const reserve = solToLamports(reserveSol);
  const rent = reusableBuffer ? 0n : solToLamports(bufferRentSol);
  return lamportsToSol(reserve + rent);
}
