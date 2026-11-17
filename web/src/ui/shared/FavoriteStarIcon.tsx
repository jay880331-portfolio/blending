import { Star } from "lucide-react";

type FavoriteStarIconProps = {
  size?: number;
  strokeWidth?: number;
  filled?: boolean;
  className?: string;
};

export function FavoriteStarIcon({
  size = 24,
  strokeWidth = 2.2,
  filled = false,
  className,
}: FavoriteStarIconProps) {
  return (
    <Star
      aria-hidden="true"
      size={size}
      strokeWidth={strokeWidth}
      fill={filled ? "currentColor" : "none"}
      className={className}
    />
  );
}
