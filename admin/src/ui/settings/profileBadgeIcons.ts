import type { ProfileBadgeIcon } from "@blending/admin-contracts";
import {
  Award,
  BadgeCheck,
  Briefcase,
  Coffee,
  Crown,
  Shield,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";

export const PROFILE_BADGE_ICON_COMPONENTS: Record<
  ProfileBadgeIcon,
  LucideIcon
> = {
  crown: Crown,
  coffee: Coffee,
  award: Award,
  star: Star,
  shield: Shield,
  briefcase: Briefcase,
  sparkles: Sparkles,
  "badge-check": BadgeCheck,
};
