import { type ComponentPropsWithRef, forwardRef } from "react";
import { type ButtonVariant, getButtonClassName } from "./buttonClassName";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  pending?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      pending = false,
      type = "button",
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        {...props}
        disabled={disabled || pending}
        aria-busy={pending ? "true" : props["aria-busy"]}
        className={getButtonClassName(variant, className)}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
