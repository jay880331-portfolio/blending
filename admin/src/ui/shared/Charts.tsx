import { buildLinePoints, normalizeBars } from "../../domain/chartGeometry";
export function LineChart({
  values,
  width = 100,
  height = 40,
  ariaLabel = "선형 차트",
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  ariaLabel?: string;
}) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
      <title>{ariaLabel}</title>
      <path
        d={`M ${buildLinePoints(values, width, height).join(" L ")}`}
        fill="none"
        stroke="currentColor"
      />
    </svg>
  );
}
export function BarChart({
  values,
  ariaLabel = "막대 차트",
}: {
  values: readonly number[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{ display: "flex", alignItems: "end", height: 100 }}
    >
      {normalizeBars(values).map((v, i) => (
        <span
          key={i}
          style={{
            display: "block",
            height: `${v * 100}%`,
            width: `${100 / Math.max(values.length, 1)}%`,
          }}
        />
      ))}
    </div>
  );
}
