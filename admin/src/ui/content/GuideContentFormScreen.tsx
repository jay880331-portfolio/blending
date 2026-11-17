"use client";

import type {
  FaqInput,
  GuideContentDto,
  GuideContentInput,
  GuideContentKind,
  NoticeInput,
  PolicyInput,
} from "@blending/admin-contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createGuideContent,
  deleteGuideContent,
  fetchGuideContent,
  restoreGuideContent,
  updateGuideContent,
} from "../../adapters/http/guideContentApi";
import { AsyncState } from "../shared/AsyncState";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { FormField } from "../shared/FormField";
import { FormSection } from "../shared/FormSection";
import { StatusBadge } from "../shared/StatusBadge";
import {
  GUIDE_CONTENT_LABELS,
  GuideContentNav,
  guideContentRoute,
} from "./GuideContentListScreen";
import styles from "./content.module.css";

type LifecycleAction = "delete" | "restore";

export function GuideContentFormScreen({
  kind,
  id,
}: {
  kind: GuideContentKind;
  id?: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState<GuideContentDto>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lifecyclePending, setLifecyclePending] = useState(false);
  const [action, setAction] = useState<LifecycleAction>();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!id) return;
    fetchGuideContent(kind, id)
      .then((next) => {
        setContent(next);
        setError("");
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, [id, kind]);

  const lifecycle = async () => {
    if (!id || !action || lifecyclePending) return;
    setLifecyclePending(true);
    setError("");
    try {
      const next =
        action === "delete"
          ? await deleteGuideContent(kind, id, reason)
          : await restoreGuideContent(kind, id, reason);
      setContent(next);
      setAction(undefined);
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "처리에 실패했습니다.");
      throw cause;
    } finally {
      setLifecyclePending(false);
    }
  };

  return (
    <main className={styles.formPage}>
      <header className={styles.pageHeader}>
        <div>
          <Link href={guideContentRoute(kind)}>
            {GUIDE_CONTENT_LABELS[kind]} 목록
          </Link>
          <h1>
            {GUIDE_CONTENT_LABELS[kind]} {id ? "상세·수정" : "생성"}
          </h1>
          {content && <StatusBadge status={content.status} />}
        </div>
        {content &&
          (content.deletedAt ? (
            <button
              type="button"
              disabled={saving || lifecyclePending}
              onClick={() => setAction("restore")}
            >
              복구
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || lifecyclePending}
              onClick={() => setAction("delete")}
            >
              삭제
            </button>
          ))}
      </header>
      <GuideContentNav kind={kind} />
      <AsyncState loading={Boolean(id) && !content && !error} error={error}>
        {!id || content ? (
          <form
            className={styles.contentForm}
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setError("");
              try {
                const values = Object.fromEntries(
                  new FormData(event.currentTarget),
                );
                const input = parseInput(kind, values);
                const saved = id
                  ? await updateGuideContent(
                      kind,
                      id,
                      input,
                      String(values.reason ?? "").trim(),
                    )
                  : await createGuideContent(kind, input);
                if (id) setContent(saved);
                else router.push(guideContentRoute(kind, `/${saved.id}`));
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "저장 실패");
              } finally {
                setSaving(false);
              }
            }}
          >
            <GuideFields kind={kind} content={content} />
            {id && (
              <FormSection title="변경 사유">
                <FormField label="수정 사유">
                  <textarea name="reason" required />
                </FormField>
              </FormSection>
            )}
            {error && <p role="alert">{error}</p>}
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={
                saving || lifecyclePending || Boolean(content?.deletedAt)
              }
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </form>
        ) : null}
      </AsyncState>
      {action && (
        <ConfirmDialog
          open
          title={`${GUIDE_CONTENT_LABELS[kind]} ${action === "delete" ? "삭제" : "복구"}`}
          confirmDisabled={!reason.trim()}
          onCancel={() => {
            setAction(undefined);
            setReason("");
          }}
          onConfirm={lifecycle}
        >
          <FormField label="처리 사유">
            <textarea
              value={reason}
              required
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </ConfirmDialog>
      )}
    </main>
  );
}

function GuideFields({
  kind,
  content,
}: {
  kind: GuideContentKind;
  content?: GuideContentDto;
}) {
  if (kind === "notice") {
    const data = content?.data as NoticeInput | undefined;
    return (
      <FormSection title="공지 내용">
        <TextField name="title" label="제목" value={data?.title} required />
        <AreaField name="body" label="본문" value={data?.body} required />
        <PublishField status={data?.status} />
        <TextField
          name="publishedAt"
          label="발행 시각"
          type="datetime-local"
          value={dateTimeValue(data?.publishedAt)}
        />
      </FormSection>
    );
  }
  if (kind === "faq") {
    const data = content?.data as FaqInput | undefined;
    return (
      <FormSection title="FAQ 내용">
        <FormField label="카테고리">
          <select name="category" defaultValue={data?.category ?? "guide"}>
            <option value="guide">이용 안내</option>
            <option value="account">계정</option>
          </select>
        </FormField>
        <TextField
          name="sortOrder"
          label="노출 순서"
          type="number"
          min="0"
          value={data?.sortOrder}
          required
        />
        <TextField
          name="question"
          label="질문"
          value={data?.question}
          required
        />
        <AreaField name="answer" label="답변" value={data?.answer} required />
        <PublishField status={data?.status} />
        <TextField
          name="publishedAt"
          label="발행 시각"
          type="datetime-local"
          value={dateTimeValue(data?.publishedAt)}
        />
      </FormSection>
    );
  }
  const data = content?.data as PolicyInput | undefined;
  return (
    <FormSection title="운영 정책 내용">
      <TextField
        name="slug"
        label="Slug"
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        value={data?.slug}
        required
      />
      <TextField name="title" label="제목" value={data?.title} required />
      <AreaField name="body" label="본문" value={data?.body} required />
      <TextField
        name="version"
        label="버전"
        type="number"
        min="1"
        value={data?.version}
        required
      />
      <TextField
        name="effectiveAt"
        label="시행 시각"
        type="datetime-local"
        value={dateTimeValue(data?.effectiveAt)}
        required
      />
      <PublishField status={data?.status} />
      <TextField
        name="publishedAt"
        label="발행 시각"
        type="datetime-local"
        value={dateTimeValue(data?.publishedAt)}
      />
    </FormSection>
  );
}

function PublishField({ status }: { status?: string }) {
  return (
    <FormField label="발행 상태">
      <select name="status" defaultValue={status ?? "draft"}>
        <option value="draft">초안</option>
        <option value="published">발행</option>
      </select>
    </FormField>
  );
}

function TextField({
  name,
  label,
  value,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
}) {
  return (
    <FormField label={label}>
      <input name={name} defaultValue={value ?? ""} {...props} />
    </FormField>
  );
}

function AreaField({
  name,
  label,
  value,
  required,
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <FormField label={label}>
      <textarea name={name} defaultValue={value} required={required} />
    </FormField>
  );
}

function parseInput(
  kind: GuideContentKind,
  values: Record<string, FormDataEntryValue>,
): GuideContentInput {
  const text = (name: string) => String(values[name] ?? "").trim();
  const status = text("status") as "draft" | "published";
  const publishedAt = text("publishedAt");
  if (status === "published" && !publishedAt)
    throw new Error("발행 시각을 입력해주세요.");
  const publish = publishedAt
    ? { publishedAt: new Date(publishedAt).toISOString() }
    : {};
  if (kind === "notice") {
    return {
      title: text("title"),
      body: text("body"),
      status,
      ...publish,
    } satisfies NoticeInput;
  }
  if (kind === "faq") {
    return {
      category: text("category") as FaqInput["category"],
      question: text("question"),
      answer: text("answer"),
      sortOrder: Number(text("sortOrder")),
      status,
      ...publish,
    } satisfies FaqInput;
  }
  return {
    slug: text("slug"),
    title: text("title"),
    body: text("body"),
    version: Number(text("version")),
    effectiveAt: new Date(text("effectiveAt")).toISOString(),
    status,
    ...publish,
  } satisfies PolicyInput;
}

function dateTimeValue(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}
