import type { SVGProps } from "react";

type BrandIconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function InstagramBrandIcon({
  title = "Instagram",
  ...props
}: BrandIconProps) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} {...props}>
      <defs>
        <radialGradient id="instagram-brand-fill" cx="30%" cy="107%" r="120%">
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="25%" stopColor="#FA7E1E" />
          <stop offset="50%" stopColor="#D62976" />
          <stop offset="75%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#instagram-brand-fill)" />
      <rect
        x="8.5"
        y="8.5"
        width="15"
        height="15"
        rx="5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
      />
      <circle
        cx="16"
        cy="16"
        r="4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
      />
      <circle cx="21.25" cy="10.85" r="1.45" fill="#fff" />
    </svg>
  );
}

export function ThreadsBrandIcon({
  title = "Threads",
  ...props
}: BrandIconProps) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} {...props}>
      <rect width="32" height="32" rx="8" fill="#000" />
      <path
        d="M14.11 13.77c-.3-.2-1.31-.9-1.31-.9.85-1.22 1.97-1.69 3.52-1.69 1.1 0 2.03.37 2.69 1.07.67.7 1.04 1.7 1.13 2.97.37.16.71.34 1.02.55 1.25.84 1.94 2.1 1.94 3.53 0 3.06-2.5 5.72-7.04 5.72-3.89 0-7.94-2.27-7.94-9.01 0-6.71 3.92-9 7.93-9 1.85 0 6.2.27 7.83 5.67l-1.53.4c-1.27-3.84-3.91-4.45-6.34-4.45-4.01 0-6.28 2.44-6.28 7.64 0 4.66 2.54 7.13 6.33 7.13 3.12 0 5.45-1.62 5.45-4 0-1.62-1.36-2.39-1.43-2.39-.27 1.39-.98 3.72-4.1 3.72-1.82 0-3.39-1.26-3.39-2.9 0-2.36 2.23-3.21 3.99-3.21.66 0 1.46.05 1.87.13 0-.72-.61-1.95-2.14-1.95-1.41 0-1.76.46-2.21.98Zm2.69 2.45c-2.3 0-2.59.98-2.59 1.59 0 .99 1.17 1.31 1.8 1.31 1.15 0 2.33-.32 2.51-2.73a6.98 6.98 0 0 0-1.72-.18Z"
        fill="#fff"
      />
    </svg>
  );
}

export function YoutubeBrandIcon({
  title = "YouTube",
  ...props
}: BrandIconProps) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} {...props}>
      <rect width="32" height="32" rx="8" fill="#FF0000" />
      <path d="M13.4 10.8v10.4l8.4-5.2-8.4-5.2Z" fill="#fff" />
    </svg>
  );
}
