import { useMemo } from 'react';

interface LossGraphProps {
  history: number[];
}

export function LossGraph({ history }: LossGraphProps) {
  const viewW = 600;
  const viewH = 260;
  const padTop = 30;
  const padRight = 20;
  const padBottom = 30;
  const padLeft = 55;

  const plotW = viewW - padLeft - padRight;
  const plotH = viewH - padTop - padBottom;

  const { points, gradientPoints, min, max, current } = useMemo(() => {
    if (history.length === 0) {
      return { points: '', gradientPoints: '', min: 0, max: 1, current: null };
    }

    let lo = history[0];
    let hi = history[0];
    for (let i = 1; i < history.length; i++) {
      if (history[i] < lo) lo = history[i];
      if (history[i] > hi) hi = history[i];
    }

    // Add 5% padding to range so the line doesn't clip edges
    const range = hi - lo || 1;
    const yMin = lo - range * 0.05;
    const yMax = hi + range * 0.05;

    const n = history.length;
    const pts: string[] = [];
    const gradPts: string[] = [];

    for (let i = 0; i < n; i++) {
      const x = padLeft + (i / Math.max(1, n - 1)) * plotW;
      const y = padTop + plotH - ((history[i] - yMin) / (yMax - yMin)) * plotH;
      pts.push(`${x},${y}`);
      gradPts.push(`${x},${y}`);
    }

    // Close the gradient fill area along the bottom
    const lastX = padLeft + plotW;
    const firstX = padLeft;
    gradPts.push(`${lastX},${padTop + plotH}`);
    gradPts.push(`${firstX},${padTop + plotH}`);

    return {
      points: pts.join(' '),
      gradientPoints: gradPts.join(' '),
      min: lo,
      max: hi,
      current: history[history.length - 1],
    };
  }, [history]);

  // Y-axis tick marks
  const yTicks = useMemo(() => {
    const tickCount = 5;
    const ticks: { y: number; label: string }[] = [];
    const range = max - min || 1;
    const yMin = min - range * 0.05;
    const yMax = max + range * 0.05;

    for (let i = 0; i < tickCount; i++) {
      const frac = i / (tickCount - 1);
      const val = yMax - frac * (yMax - yMin);
      const y = padTop + frac * plotH;
      ticks.push({ y, label: val < 0.001 ? val.toExponential(1) : val.toFixed(3) });
    }
    return ticks;
  }, [min, max]);

  if (history.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <rect width={viewW} height={viewH} rx="8" fill="#0d1117" />
        <text
          x={viewW / 2}
          y={viewH / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#4b5563"
          fontSize="14"
          fontFamily="Inter, sans-serif"
        >
          Waiting for training data…
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        {/* Line glow gradient */}
        <linearGradient id="loss-line-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>

        {/* Area fill gradient */}
        <linearGradient id="loss-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(88,166,255,0.25)" />
          <stop offset="100%" stopColor="rgba(88,166,255,0)" />
        </linearGradient>

        {/* Glow filter */}
        <filter id="loss-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width={viewW} height={viewH} rx="8" fill="#0d1117" />

      {/* Grid lines */}
      {yTicks.map((tick, i) => (
        <g key={`tick-${i}`}>
          <line
            x1={padLeft}
            y1={tick.y}
            x2={padLeft + plotW}
            y2={tick.y}
            stroke="#1e293b"
            strokeWidth="1"
          />
          <text
            x={padLeft - 8}
            y={tick.y}
            textAnchor="end"
            dominantBaseline="central"
            fill="#4b5563"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            {tick.label}
          </text>
        </g>
      ))}

      {/* Axis labels */}
      <text
        x={padLeft + plotW / 2}
        y={viewH - 4}
        textAnchor="middle"
        fill="#4b5563"
        fontSize="10"
        fontFamily="Inter, sans-serif"
      >
        Step
      </text>

      {/* Area fill under curve */}
      <polygon
        points={gradientPoints}
        fill="url(#loss-area-grad)"
      />

      {/* Loss line */}
      <polyline
        points={points}
        fill="none"
        stroke="url(#loss-line-grad)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter="url(#loss-glow)"
      />

      {/* Current loss readout — top-right corner */}
      {current !== null && (
        <g>
          <text
            x={viewW - padRight}
            y={padTop - 10}
            textAnchor="end"
            fill="#8b949e"
            fontSize="10"
            fontFamily="Inter, sans-serif"
          >
            Loss
          </text>
          <text
            x={viewW - padRight}
            y={padTop + 6}
            textAnchor="end"
            fill="#22d3ee"
            fontSize="16"
            fontWeight="600"
            fontFamily="ui-monospace, monospace"
            filter="url(#loss-glow)"
          >
            {current < 0.0001 ? current.toExponential(3) : current.toFixed(6)}
          </text>
        </g>
      )}
    </svg>
  );
}
