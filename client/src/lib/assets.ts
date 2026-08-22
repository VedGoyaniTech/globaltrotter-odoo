export const travelVisuals = {
  hero: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=2000&q=86',
  auth: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1800&q=86',
  coast:
    'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=1800&q=84',
  city: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=84',
  culture:
    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1600&q=84',
  mountain:
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=84',
  activity:
    'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1600&q=84',
  beach:
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=84',
  street:
    'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1600&q=84',
  alpine:
    'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1600&q=84',
} as const;

export const localVisuals = {
  coast: '/images/travel-coast.svg',
  city: '/images/travel-city.svg',
  mountain: '/images/travel-mountain.svg',
  journey: '/images/travel-journey.svg',
} as const;

const realFallbacks = [
  travelVisuals.city,
  travelVisuals.culture,
  travelVisuals.coast,
  travelVisuals.mountain,
  travelVisuals.street,
  travelVisuals.beach,
];

const localFallbacks = [localVisuals.city, localVisuals.mountain, localVisuals.coast];

export function travelFallback(index = 0) {
  return realFallbacks[Math.abs(index) % realFallbacks.length];
}

export function localFallback(index = 0) {
  return localFallbacks[Math.abs(index) % localFallbacks.length];
}

export function travelBackground(
  image: string,
  fallback: string,
  overlay = 'linear-gradient(180deg, rgba(8, 31, 31, 0.08), rgba(8, 31, 31, 0.82))',
) {
  return `${overlay}, url(${image}), url(${fallback})`;
}
