export const COMMUNITY_IMAGE_ATTACHMENT_LIMIT = 6;

export function mergeCommunityImageAttachments<T>(
  current: T[],
  selected: T[],
  limit = COMMUNITY_IMAGE_ATTACHMENT_LIMIT,
) {
  return [...current, ...selected].slice(0, limit);
}

export function remainingCommunityImageAttachmentCount(
  currentCount: number,
  limit = COMMUNITY_IMAGE_ATTACHMENT_LIMIT,
) {
  return Math.max(0, limit - currentCount);
}

export function buildCommunityImagePayload({
  uploadedImageUrls,
  existingImageUrls,
}: {
  uploadedImageUrls: string[];
  existingImageUrls: string[];
}) {
  const imageUrls = [...existingImageUrls, ...uploadedImageUrls].slice(
    0,
    COMMUNITY_IMAGE_ATTACHMENT_LIMIT,
  );

  return {
    coverUrl: imageUrls[0],
    imageUrl: imageUrls[0],
    imageUrls,
  };
}
