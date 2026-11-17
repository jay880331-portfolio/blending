import { type ComponentPropsWithRef, forwardRef } from "react";

export type InputVariant = "standard" | "partner";

function getControlClassName(
  variant: InputVariant = "standard",
  className?: string,
): string {
  const base = variant === "partner" ? "partner-input" : "ds-input";
  return className ? `${base} ${className}` : base;
}

export type InputProps = ComponentPropsWithRef<"input"> & {
  variant?: InputVariant;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = "standard", className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={getControlClassName(variant, className)}
      {...props}
    />
  );
});

Input.displayName = "Input";

export type TextareaProps = ComponentPropsWithRef<"textarea"> & {
  variant?: InputVariant;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ variant = "standard", className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={getControlClassName(variant, className)}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export type SelectProps = ComponentPropsWithRef<"select"> & {
  variant?: InputVariant;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ variant = "standard", className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={getControlClassName(variant, className)}
        {...props}
      />
    );
  },
);

Select.displayName = "Select";
