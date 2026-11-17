import type {
  GuideContentDto,
  GuideContentInput,
  GuideContentKind,
  GuideContentPage,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders } from "./adminApi";

const paths: Record<GuideContentKind, string> = {
  notice: "notices",
  faq: "faqs",
  policy: "policies",
};

function path(kind: GuideContentKind, id?: string) {
  const base = `/api/admin/${paths[kind]}`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

function mutationHeaders(method: string) {
  return adminHeaders(method, useAdminSessionStore.getState().csrfToken);
}

export async function fetchGuideContents(
  kind: GuideContentKind,
  query: string,
) {
  return (await adminApi.get<GuideContentPage>(`${path(kind)}?${query}`)).data;
}

export async function fetchGuideContent(kind: GuideContentKind, id: string) {
  return (await adminApi.get<GuideContentDto>(path(kind, id))).data;
}

export async function createGuideContent(
  kind: GuideContentKind,
  content: GuideContentInput,
) {
  return (
    await adminApi.post<GuideContentDto>(
      path(kind),
      { content },
      { headers: mutationHeaders("POST") },
    )
  ).data;
}

export async function updateGuideContent(
  kind: GuideContentKind,
  id: string,
  content: GuideContentInput,
  reason: string,
) {
  return (
    await adminApi.put<GuideContentDto>(
      path(kind, id),
      { content, reason },
      { headers: mutationHeaders("PUT") },
    )
  ).data;
}

export async function deleteGuideContent(
  kind: GuideContentKind,
  id: string,
  reason: string,
) {
  return (
    await adminApi.delete<GuideContentDto>(path(kind, id), {
      data: { reason },
      headers: mutationHeaders("DELETE"),
    })
  ).data;
}

export async function restoreGuideContent(
  kind: GuideContentKind,
  id: string,
  reason: string,
) {
  return (
    await adminApi.post<GuideContentDto>(
      `${path(kind, id)}/restore`,
      { reason },
      { headers: mutationHeaders("POST") },
    )
  ).data;
}
