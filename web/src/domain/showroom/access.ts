export function canWriteShowroom(role: string | undefined) {
  return role === "barista" || role === "admin";
}

export function showroomWriteForbiddenMessage() {
  return "바리스타만 쇼룸을 등록·관리할 수 있습니다.";
}

export function showroomLoginRequiredMessage() {
  return "로그인이 필요합니다.";
}
