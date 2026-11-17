"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { DonutMetricView } from "@/lib/dashboard";

interface DitherDonutChartProps {
  title: string;
  subtitle: string;
  metric: DonutMetricView;
  loading?: boolean;
  icon: ReactNode;
}

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function hash(x: number, y: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (normalized.length !== 6) return `rgba(51, 185, 120, ${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawRoundedWedge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  aStart: number,
  aEnd: number,
  cr: number
): void {
  const sweep = aEnd - aStart;
  if (sweep <= 0.001) return;
  const maxCr = Math.min(cr, (rOut - rIn) / 2, (sweep * rIn) / 2);
  const crIn = maxCr;
  const crOut = maxCr;

  const aStartIn = aStart + crIn / rIn;
  const aEndIn = aEnd - crIn / rIn;
  const aStartOut = aStart + crOut / rOut;
  const aEndOut = aEnd - crOut / rOut;

  ctx.moveTo(cx + rIn * Math.cos(aStartIn), cy + rIn * Math.sin(aStartIn));
  ctx.arc(cx, cy, rIn, aStartIn, aEndIn);
  ctx.arcTo(
    cx + rIn * Math.cos(aEnd),
    cy + rIn * Math.sin(aEnd),
    cx + rOut * Math.cos(aEnd),
    cy + rOut * Math.sin(aEnd),
    crIn
  );
  ctx.arcTo(
    cx + rOut * Math.cos(aEnd),
    cy + rOut * Math.sin(aEnd),
    cx + rOut * Math.cos(aEndOut),
    cy + rOut * Math.sin(aEndOut),
    crOut
  );
  ctx.arc(cx, cy, rOut, aEndOut, aStartOut, true);
  ctx.arcTo(
    cx + rOut * Math.cos(aStart),
    cy + rOut * Math.sin(aStart),
    cx + rIn * Math.cos(aStart),
    cy + rIn * Math.sin(aStart),
    crOut
  );
  ctx.arcTo(
    cx + rIn * Math.cos(aStart),
    cy + rIn * Math.sin(aStart),
    cx + rIn * Math.cos(aStartIn),
    cy + rIn * Math.sin(aStartIn),
    crIn
  );
}

export function DitherDonutChart({
  title,
  subtitle,
  metric,
  loading = false,
  icon,
}: DitherDonutChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rectRef = useRef({ width: 170, height: 170 });
  const isVisibleRef = useRef(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);

  const shares = useMemo(() => {
    const sum = metric.segments.reduce((acc, s) => acc + s.value, 0);
    if (sum <= 0) return [];
    return metric.segments.map((s) => s.value / sum);
  }, [metric.segments]);

  const timeRef = useRef(0);
  const requestRef = useRef<number | null>(null);
  const morphStartRef = useRef(0);
  const fromSharesRef = useRef<number[]>([]);
  const targetSharesRef = useRef<number[]>([]);
  const dispSharesRef = useRef<number[]>([]);

  useEffect(() => {
    hoverRef.current = hoverIndex;
  }, [hoverIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    const updateSize = () => {
      const box = canvas.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      rectRef.current = { width: box.width, height: box.height };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        isVisibleRef.current = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [metric.available, metric.segments.length]);

  useEffect(() => {
    if (shares.length === 0) {
      dispSharesRef.current = [];
      fromSharesRef.current = [];
      targetSharesRef.current = [];
      return;
    }
    if (dispSharesRef.current.length !== shares.length) {
      dispSharesRef.current = [...shares];
      fromSharesRef.current = [...shares];
      targetSharesRef.current = [...shares];
    } else {
      fromSharesRef.current = [...dispSharesRef.current];
      targetSharesRef.current = [...shares];
      morphStartRef.current = performance.now();
    }
  }, [shares]);

  useEffect(() => {
    if (!metric.available || metric.segments.length === 0) return;

    const draw = () => {
      if (!isVisibleRef.current) {
        requestRef.current = requestAnimationFrame(draw);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width: logW, height: logH } = rectRef.current;
      if (logW === 0 || logH === 0) {
        requestRef.current = requestAnimationFrame(draw);
        return;
      }

      timeRef.current += reducedMotion ? 0 : 0.02;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const logicalSize = 200;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale((logW * dpr) / logicalSize, (logH * dpr) / logicalSize);

      let t = 1;
      if (!reducedMotion && morphStartRef.current > 0) {
        t = Math.min(1, (performance.now() - morphStartRef.current) / 500);
      }

      const e = 1 - Math.pow(2, -10 * t);
      for (let i = 0; i < targetSharesRef.current.length; i++) {
        const fromVal = fromSharesRef.current[i] ?? targetSharesRef.current[i];
        dispSharesRef.current[i] =
          fromVal + (targetSharesRef.current[i] - fromVal) * e;
      }

      let startAngle = -Math.PI / 2;
      const gap = dispSharesRef.current.length > 1 ? 0.07 : 0;
      const currentHover = hoverRef.current;

      for (let i = 0; i < dispSharesRef.current.length; i++) {
        const share = dispSharesRef.current[i];
        if (!share || share <= 0) continue;

        const sweep = share * Math.PI * 2;
        const aStart = startAngle + gap / 2;
        let aEnd = startAngle + sweep - gap / 2;
        if (aEnd < aStart) aEnd = aStart;

        const segColor = metric.segments[i]?.color ?? "#33B978";

        ctx.save();
        const isHovered = currentHover === i;
        const isAnyHovered = currentHover !== null;

        if (isHovered) {
          const mid = (aStart + aEnd) / 2;
          ctx.translate(Math.cos(mid) * 6, Math.sin(mid) * 6);
        }

        ctx.beginPath();
        drawRoundedWedge(ctx, 100, 100, 55, 86, aStart, aEnd, 6);
        ctx.clip();

        ctx.globalAlpha = isHovered ? 1.0 : isAnyHovered ? 0.24 : 0.78;
        ctx.fillStyle = segColor;

        if (isHovered) {
          ctx.shadowColor = hexToRgba(segColor, 0.5);
          ctx.shadowBlur = 5;
        }

        const cell = 4.6;
        const t2 = timeRef.current;
        for (let x = 14; x <= 186; x += cell) {
          for (let y = 14; y <= 186; y += cell) {
            const dx = x - 100;
            const dy = y - 100;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 55 - cell || dist > 86 + cell) continue;

            const a = Math.atan2(dy, dx);
            let normalizedA = a - aStart;
            while (normalizedA < 0) normalizedA += Math.PI * 2;
            while (normalizedA >= Math.PI * 2) normalizedA -= Math.PI * 2;
            if (normalizedA > aEnd - aStart) continue;

            const fullness = smoothstep(0.62, 1.0, (dist - 55) / (86 - 55));
            const waveRaw = reducedMotion
              ? 0
              : Math.sin(dist * 0.1 - t2) +
                Math.sin(a * 3 + t2 * 1.5) +
                Math.sin(dx * 0.05 + dy * 0.05 + t2 * 2);
            const wave = smoothstep(-1.5, 1.5, waveRaw);
            const jitter = hash(x, y);

            const size =
              cell *
              ((isHovered ? 0.46 : 0.34) + 0.36 * fullness + 0.26 * wave) *
              (0.78 + 0.42 * jitter);

            ctx.fillRect(x - size / 2, y - size / 2, size, size);
          }
        }

        ctx.restore();
        startAngle += sweep;
      }

      ctx.restore();
      if (!reducedMotion || t < 1) {
        requestRef.current = requestAnimationFrame(draw);
      }
    };

    requestRef.current = requestAnimationFrame(draw);
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [metric.available, metric.segments, reducedMotion]);

  const hasData = metric.available && metric.segments.length > 0 && metric.total > 0;

  return (
    <GlassSurface intensity="subtle" className="dash-chart-card">
      <div className="dash-chart-header">
        <div className="dash-chart-title-wrap">
          <div className="dash-chart-icon" aria-hidden="true">
            {icon}
          </div>
          <div>
            <h3 className="dash-chart-title">{title}</h3>
            <p className="dash-chart-subtitle">{subtitle}</p>
          </div>
        </div>
        <div className="dash-chart-total">
          {loading ? (
            <span className="dash-kpi-loading">...</span>
          ) : metric.available ? (
            <>
              <strong className="tabular-nums">
                {metric.total.toLocaleString("pt-BR")}
              </strong>
              <span>{metric.unitLabel}</span>
            </>
          ) : (
            <span className="dash-badge-muted">Indisponível</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="dash-chart-empty" role="status">
          <p className="field-hint">Carregando gráfico...</p>
        </div>
      ) : !hasData ? (
        <div className="dash-chart-empty" role="status">
          <p className="field-hint">
            {metric.unavailableReason ||
              "Sem dados registrados para este indicador no período."}
          </p>
        </div>
      ) : (
        <div className="dash-chart-body">
          <div className="dash-donut-wrap">
            <canvas
              ref={canvasRef}
              className="dash-donut-canvas"
              aria-label={`Gráfico de rosca: ${title}, total ${metric.total.toLocaleString("pt-BR")} ${metric.unitLabel}`}
            />
          </div>

          <ul className="dash-legend" aria-label={`Detalhamento de ${title}`}>
            {metric.segments.map((seg, idx) => {
              const pct =
                metric.total > 0
                  ? Math.round((seg.value / metric.total) * 100)
                  : 0;
              const isHovered = hoverIndex === idx;
              return (
                <li key={seg.label}>
                  <button
                    type="button"
                    className={`dash-legend-item${isHovered ? " is-active" : ""}`}
                    onMouseEnter={() => setHoverIndex(idx)}
                    onMouseLeave={() => setHoverIndex(null)}
                    onFocus={() => setHoverIndex(idx)}
                    onBlur={() => setHoverIndex(null)}
                  >
                    <span className="dash-legend-label-wrap">
                      <span
                        className="dash-legend-dot"
                        style={{ backgroundColor: seg.color }}
                        aria-hidden="true"
                      />
                      <span className="dash-legend-label">{seg.label}</span>
                    </span>
                    <span className="dash-legend-values">
                      <strong className="tabular-nums">
                        {seg.value.toLocaleString("pt-BR")}
                      </strong>
                      <span className="dash-legend-pct tabular-nums">
                        {pct}%
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </GlassSurface>
  );
}
