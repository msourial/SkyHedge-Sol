/** 24px line glyphs. Stroke only, currentColor. No filled kit icons. */
export const lineGlyphs = {
  rain: ["M12 4.2c2.6 3 4.8 5.8 4.8 8.5a4.8 4.8 0 0 1-9.6 0c0-2.7 2.2-5.5 4.8-8.5z"],
  snow: ["M12 4.5v15", "M6.2 8l11.6 8", "M17.8 8L6.2 16"],
  wind: ["M5 8.5h8.5a2.2 2.2 0 1 0-2-2.2", "M5 13h11a2.2 2.2 0 1 1-2 2.2", "M5 17.5h6.5"],
  heat: ["M10 4.5h4v8.2a3.4 3.4 0 1 1-4 0V4.5z"],
  cold: ["M10 4.5h4v8.2a3.4 3.4 0 1 1-4 0V4.5z", "M9.2 15.2h5.6"],
  markets: ["M6 17V11", "M12 17V6", "M18 17V9"],
  protect: ["M4 12h16", "M12 7v10"],
  wallet: ["M5 8.5h14v9H5z", "M14 13h3.2"],
  chevron: ["M9 6.5l6 5.5-6 5.5"],
} as const;
