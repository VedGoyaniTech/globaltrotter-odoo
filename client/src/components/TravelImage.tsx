import type { ImgHTMLAttributes, SyntheticEvent } from 'react';
import { localVisuals } from '../lib/assets';

interface TravelImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

export function TravelImage({
  fallback = localVisuals.coast,
  onError,
  ...props
}: TravelImageProps) {
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.src.endsWith(fallback)) return;
    image.src = fallback;
    image.dataset.fallback = 'true';
    onError?.(event);
  };

  return <img loading="lazy" decoding="async" {...props} onError={handleError} />;
}
