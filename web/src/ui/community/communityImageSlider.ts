export const COMMUNITY_IMAGE_SLIDE_LIMIT = 6;

export function visibleCommunityImages(
  images: string[],
  maxImages = COMMUNITY_IMAGE_SLIDE_LIMIT,
) {
  return images.slice(0, maxImages);
}

export function getNearestCommunityImageSlideIndex(
  scrollLeft: number,
  slideOffsets: number[],
) {
  if (slideOffsets.length === 0) return 0;

  return slideOffsets.reduce((nearestIndex, offset, index) => {
    const nearestOffset = slideOffsets[nearestIndex] ?? 0;
    return Math.abs(offset - scrollLeft) < Math.abs(nearestOffset - scrollLeft)
      ? index
      : nearestIndex;
  }, 0);
}
