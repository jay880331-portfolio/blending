export const APP_POPUP_PLACEMENTS = [
  "map",
  "community",
  "home",
  "partner",
  "mypage",
] as const;

export type AppPopupPlacement = (typeof APP_POPUP_PLACEMENTS)[number];

export type AdminAppPopupInput = {
  adminTitle: string;
  imageUrl: string;
  imageAlt: string;
  href: string | null;
  placements: AppPopupPlacement[];
  priority: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
};

export type AdminAppPopupDto = AdminAppPopupInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type AppPopupDto = Pick<
  AdminAppPopupDto,
  "id" | "imageUrl" | "imageAlt" | "href"
>;

export type AdminAppPopupEnabledInput = { enabled: boolean };
