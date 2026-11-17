import type {
  AdminContentDto,
  AdminContentInput,
  AdminContentKind,
  AdminContentPage,
  AdminContentReactionDto,
  AdminPage,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders, adminMultipartHeaders } from "./adminApi";

function mutationHeaders(method: string) {
  return adminHeaders(method, useAdminSessionStore.getState().csrfToken);
}

function contentPath(kind: AdminContentKind, id: string) {
  return `/api/admin/content/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
}

export async function fetchContents(query: string) {
  return (await adminApi.get<AdminContentPage>(`/api/admin/content?${query}`))
    .data;
}

export async function fetchContent(kind: AdminContentKind, id: string) {
  return (await adminApi.get<AdminContentDto>(contentPath(kind, id))).data;
}

export async function createContent(input: AdminContentInput) {
  return (
    await adminApi.post<AdminContentDto>(
      "/api/admin/content",
      { content: input },
      {
        headers: mutationHeaders("POST"),
      },
    )
  ).data;
}

export async function updateContent(
  kind: AdminContentKind,
  id: string,
  input: AdminContentInput,
  reason: string,
) {
  return (
    await adminApi.put<AdminContentDto>(
      contentPath(kind, id),
      { content: input, reason },
      { headers: mutationHeaders("PUT") },
    )
  ).data;
}

export async function hideContent(
  kind: AdminContentKind,
  id: string,
  reason: string,
) {
  return (
    await adminApi.patch<AdminContentDto>(
      `${contentPath(kind, id)}/visibility`,
      { reason },
      { headers: mutationHeaders("PATCH") },
    )
  ).data;
}

export async function deleteContent(
  kind: AdminContentKind,
  id: string,
  reason: string,
) {
  return (
    await adminApi.delete<AdminContentDto>(contentPath(kind, id), {
      data: { reason },
      headers: mutationHeaders("DELETE"),
    })
  ).data;
}

export async function restoreContent(
  kind: AdminContentKind,
  id: string,
  reason: string,
) {
  return (
    await adminApi.post<AdminContentDto>(
      `${contentPath(kind, id)}/restore`,
      { reason },
      { headers: mutationHeaders("POST") },
    )
  ).data;
}

export async function fetchContentReactions(
  kind: AdminContentKind,
  id: string,
  page = 1,
) {
  return (
    await adminApi.get<AdminPage<AdminContentReactionDto>>(
      `${contentPath(kind, id)}/reactions?page=${page}&pageSize=20`,
    )
  ).data;
}

export async function deleteContentReaction(
  kind: AdminContentKind,
  id: string,
  reactionId: string,
  reason: string,
) {
  await adminApi.delete(`${contentPath(kind, id)}/reactions`, {
    data: { reactionId, reason },
    headers: mutationHeaders("DELETE"),
  });
}

export async function uploadContentImages(files: File[]) {
  const body = new FormData();
  body.set("kind", "image");
  files.forEach((file) => body.append("files", file));
  const response = await adminApi.post<{ files: { url: string }[] }>(
    "/api/admin/uploads",
    body,
    {
      headers: adminMultipartHeaders(useAdminSessionStore.getState().csrfToken),
    },
  );
  return response.data.files.map(({ url }) => url);
}
