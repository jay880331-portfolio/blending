export type ButtonVariant = "primary" | "secondary" | "ghost" | "base";

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: "ds-btn ds-btn-primary",
  secondary: "ds-btn ds-btn-secondary",
  ghost: "ds-btn ds-btn-ghost",
  base: "ds-btn",
};

export function getButtonClassName(
  variant: ButtonVariant = "primary",
  className?: string,
): string {
  const base = VARIANT_CLASS_NAMES[variant] ?? VARIANT_CLASS_NAMES.primary;
  return className ? `${base} ${className}` : base;
}
