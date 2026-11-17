import { type ComponentPropsWithRef, forwardRef, type ReactNode } from "react";

export type FieldLabelVariant = "standard" | "profile";

export type FieldLabelProps = ComponentPropsWithRef<"span"> & {
  variant?: FieldLabelVariant;
  caps?: boolean;
};

export const FieldLabel = forwardRef<HTMLSpanElement, FieldLabelProps>(
  function FieldLabel(
    { variant = "standard", caps = false, className, children, ...props },
    ref,
  ) {
    const baseClass =
      variant === "profile"
        ? "text-[13px] font-bold text-[var(--fg)]"
        : caps
          ? "ds-label-caps"
          : "ds-label";
    return (
      <span
        ref={ref}
        className={className ? `${baseClass} ${className}` : baseClass}
        {...props}
      >
        {children}
      </span>
    );
  },
);

FieldLabel.displayName = "FieldLabel";

export type PartnerFieldProps = ComponentPropsWithRef<"label"> & {
  label: string;
  hint?: string;
  children: ReactNode;
};

export const PartnerField = forwardRef<HTMLLabelElement, PartnerFieldProps>(
  function PartnerField({ label, hint, children, className, ...props }, ref) {
    const labelClassName = className ? `block ${className}` : "block";
    return (
      <label ref={ref} className={labelClassName} {...props}>
        <span className="mb-2 flex items-center justify-between gap-3 text-[12px] font-bold text-[var(--fg-muted)]">
          <span>{label}</span>
          {hint ? (
            <span className="font-medium text-[var(--fg-subtle)]">{hint}</span>
          ) : null}
        </span>
        {children}
      </label>
    );
  },
);

PartnerField.displayName = "PartnerField";
