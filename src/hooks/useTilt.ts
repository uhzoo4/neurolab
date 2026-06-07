import { useEffect, useRef } from 'react';

interface UseTiltOptions {
  /** Maximum tilt angle in degrees. Default: 8 */
  maxTilt?: number;
  /** Perspective distance in px. Default: 1000 */
  perspective?: number;
  /** Z-axis lift on hover in px. Default: 8 */
  liftZ?: number;
  /** Duration of the return animation in ms. Default: 400 */
  resetDuration?: number;
}

export function useTilt<T extends HTMLElement = HTMLDivElement>(options: UseTiltOptions = {}) {
  const {
    maxTilt = 8,
    perspective = 1000,
    liftZ = 8,
    resetDuration = 400,
  } = options;

  const tiltRef = useRef<T>(null);

  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;

    function onMouseMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);

      el!.style.transition = '';
      el!.style.transform =
        `perspective(${perspective}px) rotateY(${dx * maxTilt}deg) rotateX(${-dy * maxTilt}deg) translateZ(${liftZ}px)`;
    }

    function onMouseLeave() {
      el!.style.transform =
        `perspective(${perspective}px) rotateY(0deg) rotateX(0deg) translateZ(0)`;
      el!.style.transition = `transform ${resetDuration}ms ease`;

      const timerId = setTimeout(() => {
        if (el) el.style.transition = '';
      }, resetDuration);

      // Store timer id for cleanup
      (el as unknown as Record<string, unknown>).__tiltTimer = timerId;
    }

    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);

    return () => {
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
      const timerId = (el as unknown as Record<string, unknown>).__tiltTimer as ReturnType<typeof setTimeout> | undefined;
      if (timerId) clearTimeout(timerId);
      el.style.transform = '';
      el.style.transition = '';
    };
  }, [maxTilt, perspective, liftZ, resetDuration]);

  return tiltRef;
}
