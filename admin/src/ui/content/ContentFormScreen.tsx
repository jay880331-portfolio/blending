"use client";

import type {
  AdminContentInput,
  AdminContentKind,
} from "@blending/admin-contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createContent,
  fetchContent,
  updateContent,
} from "../../adapters/http/contentApi";
import { AsyncState } from "../shared/AsyncState";
import { AdminImageUpload } from "../shared/AdminImageUpload";
import { FormField } from "../shared/FormField";
import { FormSection } from "../shared/FormSection";
import { CONTENT_KIND_LABELS, parseContentForm } from "./contentForm";
import { mergeUploadedUrls } from "./contentUpload";
import styles from "./content.module.css";

export function ContentFormScreen({
  kind,
  id,
}: {
  kind: AdminContentKind;
  id?: string;
}) {
  const router = useRouter();
  const [content, setContent] =
    useState<Awaited<ReturnType<typeof fetchContent>>>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchContent(kind, id)
      .then((next) => {
        setContent(next);
        setError("");
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "조회 실패"),
      );
  }, [id, kind]);

  const initial = content?.kind === kind ? content.data : undefined;
  return (
    <main className={styles.formPage}>
      <header className={styles.pageHeader}>
        <div>
          <Link href={id ? `/content/${kind}/${id}` : `/content/${kind}`}>
            돌아가기
          </Link>
          <h1>
            {CONTENT_KIND_LABELS[kind]} {id ? "수정" : "생성"}
          </h1>
        </div>
      </header>
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
                const input = parseContentForm(kind, values);
                const saved = id
                  ? await updateContent(
                      kind,
                      id,
                      input,
                      String(values.reason ?? "").trim(),
                    )
                  : await createContent(input);
                router.push(`/content/${kind}/${saved.id}`);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "저장 실패");
              } finally {
                setSaving(false);
              }
            }}
          >
            <KindFields kind={kind} data={initial} />
            {id && (
              <FormSection title="수정 사유">
                <AreaField name="reason" label="변경 사유" required />
              </FormSection>
            )}
            {error && <p role="alert">{error}</p>}
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={saving}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </form>
        ) : null}
      </AsyncState>
    </main>
  );
}

function KindFields({
  kind,
  data,
}: {
  kind: AdminContentKind;
  data?: AdminContentInput;
}) {
  switch (kind) {
    case "community_event":
      return <EventFields data={data?.kind === kind ? data : undefined} />;
    case "community_review":
      return (
        <CommunityReviewFields data={data?.kind === kind ? data : undefined} />
      );
    case "community_b_talk":
      return <BTalkFields data={data?.kind === kind ? data : undefined} />;
    case "community_qa":
      return <QaFields data={data?.kind === kind ? data : undefined} />;
    case "partner_promotion":
      return <PromotionFields data={data?.kind === kind ? data : undefined} />;
    case "partner_review":
      return (
        <PartnerReviewFields data={data?.kind === kind ? data : undefined} />
      );
    case "partner_banner":
      return <BannerFields data={data?.kind === kind ? data : undefined} />;
  }
}

type ContentOf<K extends AdminContentKind> = Extract<
  AdminContentInput,
  { kind: K }
>;

function EventFields({ data }: { data?: ContentOf<"community_event"> }) {
  return (
    <>
      <FormSection title="이벤트 기본 정보">
        <TextField name="title" label="제목" value={data?.title} required />
        <FormField label="분류">
          <select name="category" defaultValue={data?.category ?? "official"}>
            <option value="official">공식</option>
            <option value="seminar">세미나</option>
            <option value="meetup">모임</option>
          </select>
        </FormField>
        <TextField
          name="location"
          label="장소"
          value={data?.location}
          required
        />
        <TextField name="address" label="주소" value={data?.address} required />
      </FormSection>
      <FormSection title="일정">
        <TextField
          name="startsAt"
          label="시작 시각"
          type="datetime-local"
          value={dateTimeValue(data?.startsAt)}
          required
        />
        <TextField
          name="endsAt"
          label="종료 시각"
          type="datetime-local"
          value={dateTimeValue(data?.endsAt)}
        />
        <TextField
          name="applyUrl"
          label="신청 URL"
          type="url"
          value={data?.applyUrl}
        />
      </FormSection>
      <FormSection title="이미지와 설명">
        <ImageField
          name="imageUrl"
          label="이미지 URL"
          type="url"
          value={data?.imageUrl}
          required
        />
        <TextField
          name="posterUrl"
          label="포스터 URL"
          type="url"
          value={data?.posterUrl}
          required
        />
        <AreaField
          name="description"
          label="설명"
          value={data?.description}
          required
        />
      </FormSection>
    </>
  );
}

function CommunityReviewFields({
  data,
}: {
  data?: ContentOf<"community_review">;
}) {
  return (
    <>
      <FormSection title="이벤트 후기 기본 정보">
        <OwnedFields data={data} />
        <TextField
          name="eventId"
          label="이벤트 ID"
          value={data?.eventId}
          required
        />
        <TextField name="title" label="제목" value={data?.title} required />
        <FormField label="분류">
          <select name="category" defaultValue={data?.category ?? "official"}>
            <option value="official">공식</option>
            <option value="seminar">세미나</option>
            <option value="meetup">모임</option>
          </select>
        </FormField>
        <AuthorFields data={data} />
      </FormSection>
      <FormSection title="후기 내용">
        <AreaField name="body" label="본문" value={data?.body} required />
        <ImageAreaField
          name="imageUrls"
          label="이미지 URL (줄바꿈 구분)"
          value={listValue(data?.imageUrls)}
        />
        <TextField
          name="keywords"
          label="키워드 (쉼표 구분)"
          value={data?.keywords.join(", ")}
        />
      </FormSection>
    </>
  );
}

function BTalkFields({ data }: { data?: ContentOf<"community_b_talk"> }) {
  return (
    <>
      <FormSection title="B-Talk 기본 정보">
        <OwnedFields data={data} />
        <TextField name="title" label="제목" value={data?.title} required />
        <FormField label="로스팅">
          <select name="roast" defaultValue={data?.roast ?? "medium"}>
            <option value="light">라이트</option>
            <option value="medium">미디엄</option>
            <option value="dark">다크</option>
          </select>
        </FormField>
        <AuthorFields data={data} />
        <TextField
          name="coverUrl"
          label="커버 URL"
          type="url"
          value={data?.coverUrl}
        />
      </FormSection>
      <FormSection title="원두">
        <TextField
          name="beanOrigin"
          label="원산지"
          value={data?.bean.origin}
          required
        />
        <TextField
          name="beanProcess"
          label="가공 방식"
          value={data?.bean.process}
          required
        />
        <TextField
          name="beanRoastPoint"
          label="배전 포인트"
          value={data?.bean.roastPoint}
          required
        />
      </FormSection>
      <FormSection title="추출">
        <TextField
          name="extractionDosing"
          label="도징"
          value={data?.extraction.dosing}
          required
        />
        <TextField
          name="extractionYield"
          label="추출량"
          value={data?.extraction.yield}
          required
        />
        <TextField
          name="extractionTime"
          label="시간"
          value={data?.extraction.time}
          required
        />
        <TextField
          name="extractionTemp"
          label="온도"
          value={data?.extraction.temp}
          required
        />
      </FormSection>
      <FormSection title="콘텐츠">
        <ImageAreaField
          name="processImages"
          label="과정 이미지 URL (줄바꿈 구분)"
          value={listValue(data?.processImages)}
        />
        <AreaField name="note" label="노트" value={data?.note} required />
      </FormSection>
    </>
  );
}

function QaFields({ data }: { data?: ContentOf<"community_qa"> }) {
  return (
    <>
      <FormSection title="Q&A 기본 정보">
        <OwnedFields data={data} />
        <TextField name="title" label="제목" value={data?.title} required />
        <TextField
          name="authorName"
          label="작성자명"
          value={data?.authorName}
          required
        />
        <TextField
          name="authorAvatarUrl"
          label="작성자 이미지 URL"
          type="url"
          value={data?.authorAvatarUrl}
        />
      </FormSection>
      <FormSection title="질문 내용">
        <AreaField name="body" label="본문" value={data?.body} required />
        <ImageAreaField
          name="imageUrls"
          label="이미지 URL (줄바꿈 구분)"
          value={listValue(data?.imageUrls)}
        />
      </FormSection>
    </>
  );
}

function PromotionFields({ data }: { data?: ContentOf<"partner_promotion"> }) {
  return (
    <>
      <FormSection title="파트너 홍보 기본 정보">
        <OwnedFields data={data} />
        <TextField name="title" label="제목" value={data?.title} required />
        <PartnerCategory value={data?.category} />
        <TextField
          name="companyName"
          label="회사명"
          value={data?.companyName}
          required
        />
        <TextField
          name="authorName"
          label="작성자명"
          value={data?.authorName}
          required
        />
        <TextField
          name="authorAvatarUrl"
          label="작성자 이미지 URL"
          type="url"
          value={data?.authorAvatarUrl}
        />
      </FormSection>
      <FormSection title="제품 사양">
        <TextField
          name="specCompanyName"
          label="제조사"
          value={data?.specs.companyName}
          required
        />
        <TextField
          name="specProductName"
          label="제품명"
          value={data?.specs.productName}
          required
        />
        <TextField
          name="specCategoryLabel"
          label="분류명"
          value={data?.specs.categoryLabel}
          required
        />
      </FormSection>
      <FormSection title="홍보 내용">
        <TextField name="summary" label="요약" value={data?.summary} required />
        <AreaField
          name="description"
          label="설명"
          value={data?.description}
          required
        />
        <TextField
          name="thumbnailUrl"
          label="썸네일 URL"
          type="url"
          value={data?.thumbnailUrl}
          required
        />
        <ImageAreaField
          name="imageUrls"
          label="이미지 URL (줄바꿈 구분)"
          value={listValue(data?.imageUrls)}
        />
        <AreaField
          name="brochureUrls"
          label="브로슈어 URL (줄바꿈 구분)"
          value={listValue(data?.brochureUrls)}
        />
        <AreaField
          name="attachments"
          label="첨부파일 (URL | 파일명 | 크기(bytes) | MIME, 줄바꿈 구분)"
          value={attachmentValue(data?.attachments)}
        />
        <TextField
          name="tags"
          label="태그 (쉼표 구분)"
          value={data?.tags.join(", ")}
        />
        <TextField
          name="externalUrl"
          label="외부 URL"
          type="url"
          value={data?.externalUrl}
        />
      </FormSection>
    </>
  );
}

function PartnerReviewFields({ data }: { data?: ContentOf<"partner_review"> }) {
  return (
    <>
      <FormSection title="파트너 리뷰 기본 정보">
        <OwnedFields data={data} />
        <TextField
          name="promotionId"
          label="홍보글 ID"
          value={data?.promotionId}
          required
        />
        <TextField
          name="productName"
          label="제품명"
          value={data?.productName}
          required
        />
        <PartnerCategory value={data?.category} />
        <TextField name="brand" label="브랜드" value={data?.brand} required />
        <TextField
          name="modelName"
          label="모델명"
          value={data?.modelName}
          required
        />
        <TextField
          name="features"
          label="특징"
          value={data?.features}
          required
        />
      </FormSection>
      <FormSection title="리뷰어">
        <TextField
          name="reviewerName"
          label="리뷰어명"
          value={data?.reviewerName}
          required
        />
        <TextField
          name="reviewerAvatarUrl"
          label="리뷰어 이미지 URL"
          type="url"
          value={data?.reviewerAvatarUrl}
        />
        <TextField
          name="reviewerResumeUrl"
          label="이력 URL"
          type="url"
          value={data?.reviewerResumeUrl}
        />
      </FormSection>
      <FormSection title="리뷰 내용">
        <TextField name="summary" label="요약" value={data?.summary} required />
        <AreaField name="body" label="본문" value={data?.body} required />
        <ImageAreaField
          name="imageUrls"
          label="이미지 URL (줄바꿈 구분)"
          value={listValue(data?.imageUrls)}
        />
        <AreaField
          name="attachments"
          label="첨부파일 (URL | 파일명 | 크기(bytes) | MIME, 줄바꿈 구분)"
          value={attachmentValue(data?.attachments)}
        />
        <TextField
          name="tags"
          label="태그 (쉼표 구분)"
          value={data?.tags.join(", ")}
        />
        <AreaField
          name="majorPros"
          label="주요 장점 (줄바꿈 구분)"
          value={listValue(data?.majorPros)}
        />
        <AreaField
          name="baristaTip"
          label="바리스타 팁"
          value={data?.baristaTip}
          required
        />
        <TextField
          name="relatedUrl"
          label="관련 URL"
          type="url"
          value={data?.relatedUrl}
        />
      </FormSection>
    </>
  );
}

function BannerFields({ data }: { data?: ContentOf<"partner_banner"> }) {
  return (
    <FormSection title="배너 정보">
      <TextField name="title" label="제목" value={data?.title} required />
      <TextField name="subtitle" label="부제" value={data?.subtitle} required />
      <ImageField
        name="imageUrl"
        label="이미지 URL"
        type="url"
        value={data?.imageUrl}
        required
      />
      <TextField
        name="href"
        label="연결 URL"
        type="url"
        value={data?.href}
        required
      />
      <TextField
        name="sortOrder"
        label="노출 순서"
        type="number"
        value={String(data?.sortOrder ?? 0)}
        required
      />
      <TextField
        name="activeFrom"
        label="노출 시작"
        type="datetime-local"
        value={dateTimeValue(data?.activeFrom)}
        required
      />
      <TextField
        name="activeTo"
        label="노출 종료"
        type="datetime-local"
        value={dateTimeValue(data?.activeTo)}
        required
      />
    </FormSection>
  );
}

function OwnedFields({ data }: { data?: { ownerId: string } }) {
  return (
    <TextField
      name="ownerId"
      label="소유자 ID"
      value={data?.ownerId}
      required
    />
  );
}

function AuthorFields({
  data,
}: {
  data?: {
    authorName: string;
    authorHandle?: string | null;
    authorAvatarUrl?: string | null;
  };
}) {
  return (
    <>
      <TextField
        name="authorName"
        label="작성자명"
        value={data?.authorName}
        required
      />
      <TextField
        name="authorHandle"
        label="작성자 핸들"
        value={data?.authorHandle}
      />
      <TextField
        name="authorAvatarUrl"
        label="작성자 이미지 URL"
        type="url"
        value={data?.authorAvatarUrl}
      />
    </>
  );
}

function PartnerCategory({ value }: { value?: string }) {
  return (
    <FormField label="제품 분류">
      <select name="category" defaultValue={value ?? "espresso-machine"}>
        <option value="espresso-machine">에스프레소 머신</option>
        <option value="grinder">그라인더</option>
        <option value="ice-equipment">제빙 장비</option>
        <option value="brewing-roaster">브루잉·로스터</option>
        <option value="ingredient">원재료</option>
        <option value="supplies">소모품</option>
      </select>
    </FormField>
  );
}

function TextField({
  name,
  label,
  value,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  value?: string | null;
  type?: React.HTMLInputTypeAttribute;
  required?: boolean;
}) {
  return (
    <FormField label={label}>
      <input
        name={name}
        type={type}
        defaultValue={value ?? undefined}
        required={required}
      />
    </FormField>
  );
}

function AreaField({
  name,
  label,
  value,
  required = false,
}: {
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
}) {
  return (
    <FormField label={label}>
      <textarea
        name={name}
        defaultValue={value ?? undefined}
        required={required}
        rows={5}
      />
    </FormField>
  );
}

function ImageField(props: Parameters<typeof TextField>[0]) {
  return (
    <>
      <TextField {...props} />
      <AdminImageUpload
        onUploaded={(urls) => updateImageField(props.name, urls, false)}
      />
    </>
  );
}

function ImageAreaField(props: Parameters<typeof AreaField>[0]) {
  return (
    <>
      <AreaField {...props} />
      <AdminImageUpload
        multiple
        onUploaded={(urls) => updateImageField(props.name, urls, true)}
      />
    </>
  );
}

function updateImageField(name: string, uploaded: string[], multiple: boolean) {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`,
  );
  if (field) field.value = mergeUploadedUrls(field.value, uploaded, multiple);
}

function listValue(values?: string[]) {
  return values?.join("\n");
}

function attachmentValue(
  values?:
    | { url: string; name: string; size: number; contentType: string }[]
    | null,
) {
  return values
    ?.map(
      (item) =>
        `${item.url} | ${item.name} | ${item.size} | ${item.contentType}`,
    )
    .join("\n");
}

function dateTimeValue(value?: string | null) {
  return value?.slice(0, 16);
}
