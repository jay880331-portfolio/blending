export function buildLinePoints(
  values: readonly number[],
  width: number,
  height: number,
) {
  if (!values.length) return [] as string[];
  const min = Math.min(...values),
    max = Math.max(...values);
  return values.map(
    (v, i) =>
      `${values.length === 1 ? 0 : (i * width) / (values.length - 1)},${max === min ? height / 2 : height - ((v - min) / (max - min)) * height}`,
  );
}
export function normalizeBars(values: readonly number[]) {
  const max = Math.max(0, ...values);
  return max === 0
    ? values.map(() => 0)
    : values.map((v) => Math.max(0, v) / max);
}
