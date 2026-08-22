export const travelVisuals = {
  coast: '/images/travel-coast.svg',
  city: '/images/travel-city.svg',
  mountain: '/images/travel-mountain.svg',
  journey: '/images/travel-journey.svg',
} as const;

const fallbackVisuals = [travelVisuals.coast, travelVisuals.city, travelVisuals.mountain];

export function travelFallback(index = 0) {
  return fallbackVisuals[Math.abs(index) % fallbackVisuals.length];
}
