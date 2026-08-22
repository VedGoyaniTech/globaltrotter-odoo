import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { TravelImage } from './TravelImage';

export interface DriftWallItem {
  image: string;
  title: string;
}

interface DriftWallProps {
  items: DriftWallItem[];
  columns?: number;
  tileWidth?: number;
  tileHeight?: number;
  gap?: number;
  speed?: number;
  className?: string;
}

interface ColumnMeta {
  copyHeight: number;
  copies: number;
}

const columnFactor = (index: number) => 0.76 + ((index * 0.6180339887 + 0.35) % 1) * 0.48;

export function DriftWall({
  items,
  columns = 5,
  tileWidth = 170,
  tileHeight = 116,
  gap = 14,
  speed = 26,
  className = '',
}: DriftWallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const offsetsRef = useRef<number[]>([]);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pointerDampedRef = useRef({ x: 0, y: 0 });
  const [containerHeight, setContainerHeight] = useState(700);
  const [activeId, setActiveId] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);

  const columnItems = useMemo(() => {
    const safeColumns = Math.max(1, Math.min(columns, items.length));
    const distributed = Array.from({ length: safeColumns }, () => [] as DriftWallItem[]);
    items.forEach((item, index) => distributed[index % safeColumns].push(item));
    return distributed;
  }, [columns, items]);

  const columnMeta = useMemo<ColumnMeta[]>(() => {
    const unit = tileHeight + gap;
    return columnItems.map((column) => {
      const copyHeight = Math.max(unit, column.length * unit);
      return {
        copyHeight,
        copies: Math.max(3, Math.ceil((containerHeight * 1.8) / copyHeight) + 1),
      };
    });
  }, [columnItems, containerHeight, gap, tileHeight]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReducedMotion(media.matches);
    syncPreference();
    media.addEventListener('change', syncPreference);
    return () => media.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height || 700);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const applyPlaneTransform = useCallback((x: number, y: number) => {
    if (!planeRef.current) return;
    planeRef.current.style.transform =
      `translate(-50%, -50%) scale(1.2) ` +
      `rotateX(${12 - y}deg) rotateY(${-12 + x}deg) translateZ(-90px)`;
  }, []);

  useEffect(() => {
    offsetsRef.current = columnMeta.map((meta, index) => meta.copyHeight * ((index * 0.29) % 1));
    if (reducedMotion) {
      applyPlaneTransform(0, 0);
      trackRefs.current.forEach((track, index) => {
        if (track)
          track.style.transform = `translate3d(0, ${-(offsetsRef.current[index] ?? 0)}px, 0)`;
      });
      return;
    }

    let frame = 0;
    let previousTime: number | null = null;
    const animate = (time: number) => {
      if (previousTime === null) previousTime = time;
      const delta = Math.min(0.05, Math.max(0, time - previousTime) / 1000);
      previousTime = time;

      const damping = 1 - Math.exp(-delta / 0.14);
      pointerDampedRef.current.x +=
        (pointerRef.current.x * 7 - pointerDampedRef.current.x) * damping;
      pointerDampedRef.current.y +=
        (pointerRef.current.y * 7 - pointerDampedRef.current.y) * damping;
      applyPlaneTransform(pointerDampedRef.current.x, pointerDampedRef.current.y);

      columnMeta.forEach((meta, index) => {
        const direction = index % 2 === 0 ? 1 : -1;
        const next =
          ((offsetsRef.current[index] ?? 0) + speed * columnFactor(index) * direction * delta) %
          meta.copyHeight;
        offsetsRef.current[index] = next < 0 ? next + meta.copyHeight : next;
        const track = trackRefs.current[index];
        if (track) track.style.transform = `translate3d(0, ${-offsetsRef.current[index]}px, 0)`;
      });
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [applyPlaneTransform, columnMeta, reducedMotion, speed]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerRef.current = {
      x: (event.clientX - rect.left) / rect.width - 0.5,
      y: (event.clientY - rect.top) / rect.height - 0.5,
    };
  };

  const variables = {
    '--drift-tile-width': `${tileWidth}px`,
    '--drift-tile-height': `${tileHeight}px`,
    '--drift-gap': `${gap}px`,
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`drift-wall ${className}`}
      style={variables}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        pointerRef.current = { x: 0, y: 0 };
        setActiveId('');
      }}
      aria-hidden="true"
    >
      <div className="drift-wall__plane" ref={planeRef}>
        {columnItems.map((column, columnIndex) => {
          const meta = columnMeta[columnIndex];
          return (
            <div className="drift-wall__column" key={`column-${columnIndex}`}>
              <div
                className="drift-wall__track"
                ref={(element) => {
                  trackRefs.current[columnIndex] = element;
                }}
              >
                {Array.from({ length: meta.copies }, (_, copyIndex) =>
                  column.map((item, itemIndex) => {
                    const id = `${columnIndex}-${copyIndex}-${itemIndex}`;
                    return (
                      <figure
                        className={`drift-wall__tile ${activeId === id ? 'drift-wall__tile--active' : ''}`}
                        key={id}
                        onPointerEnter={() => setActiveId(id)}
                      >
                        <TravelImage src={item.image} alt="" draggable={false} />
                        <figcaption>{item.title}</figcaption>
                      </figure>
                    );
                  }),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
