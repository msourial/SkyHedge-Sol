/**
 * Marketing screenshot mode — hide chrome that should not appear in landing mockups.
 * Bake in only for local capture builds: EXPO_PUBLIC_MARKETING_SHOTS=1
 * Never ship a release with this set; default is off.
 */
export const MARKETING_SHOTS = process.env.EXPO_PUBLIC_MARKETING_SHOTS === "1";
