export function shouldForceRefreshMemberSnapshot(area: string, view: string[]) {
  return (
    area === "mypage" && (view[0] === "interests" || view[0] === "my-posts")
  );
}
