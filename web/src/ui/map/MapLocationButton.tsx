import { LoaderCircle } from "lucide-react";

type MapLocationButtonProps = {
  activeProfile: boolean;
  loading: boolean;
  onClick: () => void;
};

export function MapLocationButton({
  activeProfile,
  loading,
  onClick,
}: MapLocationButtonProps) {
  return (
    <button
      type="button"
      aria-label="내 위치로 이동"
      aria-busy={loading}
      disabled={loading}
      onClick={onClick}
      className={`absolute right-5 z-30 flex h-12 w-12 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface)] shadow-[var(--shadow-modal)] transition active:scale-95 ${
        activeProfile
          ? "bottom-[calc(var(--app-bottom-nav-height)+140px)]"
          : "bottom-[calc(var(--app-bottom-nav-height)+16px)]"
      }`}
    >
      {loading ? (
        <LoaderCircle
          size={24}
          strokeWidth={2.4}
          className="animate-spin text-[var(--accent)]"
        />
      ) : (
        <LocationTargetIcon />
      )}
    </button>
  );
}

function LocationTargetIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--accent)]"
      aria-hidden="true"
    >
      <line x1="2" x2="5" y1="12" y2="12" />
      <line x1="19" x2="22" y1="12" y2="12" />
      <line x1="12" x2="12" y1="2" y2="5" />
      <line x1="12" x2="12" y1="19" y2="22" />
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}
