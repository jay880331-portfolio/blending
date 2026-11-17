const STATUS_LABELS: Record<string, string> = {
  active: "활성",
  suspended: "정지",
  deleted: "삭제",
  hidden: "숨김",
  published: "발행",
  draft: "초안",
  open: "접수",
  investigating: "조사 중",
  resolved: "완료",
  dismissed: "기각",
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  running: "실행 중",
  succeeded: "성공",
  failed: "실패",
};

const ROLE_LABELS: Record<string, string> = {
  barista: "바리스타",
  enthusiast: "애호가",
  partner: "파트너",
  admin: "관리자",
};

const SUMMARY_LABELS: Record<string, string> = {
  totalUsers: "전체 사용자",
  newUsers: "신규 사용자",
  recentlyActiveUsers: "최근 활동",
  activeContent: "활성 콘텐츠",
  newContent: "신규 콘텐츠",
  likes: "좋아요",
  openReports: "미처리 신고",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  community_event: "이벤트",
  community_review: "이벤트 후기",
  community_b_talk: "B-Talk",
  community_qa: "Q&A",
  partner_promotion: "파트너 홍보",
  partner_review: "파트너 리뷰",
  partner_banner: "파트너 배너",
  member_profile: "인물사전",
};

export function adminStatusLabel(value: string) {
  return STATUS_LABELS[value] ?? value;
}

export function adminRoleLabel(value: string) {
  return ROLE_LABELS[value] ?? value;
}

export function adminSummaryLabel(value: string) {
  return SUMMARY_LABELS[value] ?? value;
}

export function adminContentTypeLabel(value: string) {
  return CONTENT_TYPE_LABELS[value] ?? value;
}
