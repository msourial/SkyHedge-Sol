/** Words stay in Inter. Numerals and units (SKYT, mm) stay in mono. */
export function MixedCopy({ text }: { text: string }) {
  const parts = text.split(/(\d[\d.,]*×?%?|\b(?:SKYT|mm)\b)/g);
  return <>{parts.map((part, index) => {
    if (!part) return null;
    if (/^\d/.test(part)) return <span key={index} className="t-data">{part}</span>;
    if (part === "SKYT" || part === "mm") return <span key={index} className="t-figure-minor">{part}</span>;
    return <span key={index}>{part}</span>;
  })}</>;
}

/** "24.00 SKYT" renders as a large 24 and a quiet ".00 SKYT", with no gap before the decimal. */
export function QuoteAmount({ amount, unit = "SKYT", slicker = false, hero = false }: { amount: string; unit?: string; slicker?: boolean; hero?: boolean }) {
  const match = /^(\d+)(\.\d+)?$/.exec(amount.trim());
  const whole = match?.[1] ?? amount;
  const decimal = match?.[2] ?? "";
  const minor = `${decimal}${unit ? ` ${unit}` : ""}`;
  return <span className={hero ? "quote-amount quote-amount--hero" : "quote-amount"}>
    <span className={slicker ? "quote-amount__whole quote-amount__whole--slicker" : "quote-amount__whole"}>{whole}</span>
    {minor ? <span className="t-figure-minor">{minor}</span> : null}
  </span>;
}
