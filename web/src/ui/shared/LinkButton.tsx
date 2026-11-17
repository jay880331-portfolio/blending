import Link from "next/link";
import { type ComponentPropsWithRef, forwardRef } from "react";
import { type ButtonVariant, getButtonClassName } from "./buttonClassName";

export type LinkButtonProps = Omit<
  ComponentPropsWithRef<typeof Link>,
  "key"
> & {
  variant?: ButtonVariant;
};

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(
    { variant = "primary", className, children, ...props },
    ref,
  ) {
    return (
      <Link
        ref={ref}
        className={getButtonClassName(variant, className)}
        {...props}
      >
        {children}
      </Link>
    );
  },
);

LinkButton.displayName = "LinkButton";

export type AnchorButtonProps = ComponentPropsWithRef<"a"> & {
  variant?: ButtonVariant;
};

export const AnchorButton = forwardRef<HTMLAnchorElement, AnchorButtonProps>(
  function AnchorButton(
    { variant = "primary", className, children, ...props },
    ref,
  ) {
    return (
      <a
        ref={ref}
        className={getButtonClassName(variant, className)}
        {...props}
      >
        {children}
      </a>
    );
  },
);

AnchorButton.displayName = "AnchorButton";
