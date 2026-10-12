export function liquidGlassRecipe(apiLevel: number, reducedMotion: boolean) {
  return {
    usesNativeBlur: apiLevel >= 31,
    animateAmbient: !reducedMotion,
  };
}
