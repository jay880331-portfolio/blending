import {
  normalizeDailyNoteTechnicals,
  normalizeFeaturedTechnicalKeys,
  validateDailyNoteInput,
  type DailyNoteInput,
} from "@/domain/daily-note/dailyNote";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/domain/community/publicContentPolicy";

export function validateDailyNoteCreateRequest(
  body: DailyNoteInput,
  imageOwnerId: string,
) {
  const imageUrls = normalizeDailyNoteImageUrls(body.imageUrls);
  const validationError = validateDailyNoteInput(
    { ...body, imageUrls },
    imageOwnerId,
  );
  if (validationError) return validationError;
  const technicals = normalizeDailyNoteTechnicals(body.technicals);
  const featuredTechnicalKeys = normalizeFeaturedTechnicalKeys(
    body.featuredTechnicalKeys,
  );
  if (!technicals || !featuredTechnicalKeys) return "기술값을 확인해주세요.";
  const note = typeof body.note === "string" ? body.note.trim() : undefined;
  if (
    prohibitedPublicContent(
      note,
      technicals.beanName,
      technicals.machine,
      technicals.grinder,
    )
  )
    return PROHIBITED_PUBLIC_CONTENT.message;
  return { imageUrls, technicals, featuredTechnicalKeys, note };
}

function normalizeDailyNoteImageUrls(value: unknown) {
  return Array.isArray(value) && value.every((url) => typeof url === "string")
    ? value.map((url) => url.trim()).filter(Boolean)
    : [];
}
