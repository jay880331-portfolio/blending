import type {
  AdminContentInput,
  AdminContentKind,
} from "@blending/admin-contracts";

export const CONTENT_KIND_LABELS: Record<AdminContentKind, string> = {
  community_event: "이벤트",
  community_review: "이벤트 후기",
  community_b_talk: "B-Talk",
  community_qa: "Q&A",
  partner_promotion: "파트너 홍보",
  partner_review: "파트너 리뷰",
  partner_banner: "파트너 배너",
};

export function parseContentForm(
  kind: AdminContentKind,
  values: Record<string, FormDataEntryValue>,
): AdminContentInput {
  const value = (name: string) => String(values[name] ?? "").trim();
  const clearable = (name: string) => {
    const result = value(name);
    return result || null;
  };
  const lines = (name: string) =>
    value(name)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  const commaList = (name: string) =>
    value(name)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const attachments = () => {
    const items = lines("attachments").map((item) => {
      const [url, name, size, contentType] = item
        .split("|")
        .map((part) => part.trim());
      return { url, name, size: Number(size), contentType };
    });
    return { attachments: items.length ? items : null };
  };

  switch (kind) {
    case "community_event":
      return {
        kind,
        title: value("title"),
        category: value("category") as "official" | "seminar" | "meetup",
        startsAt: value("startsAt"),
        endsAt: clearable("endsAt"),
        location: value("location"),
        address: value("address"),
        imageUrl: value("imageUrl"),
        posterUrl: value("posterUrl"),
        description: value("description"),
        applyUrl: clearable("applyUrl"),
      };
    case "community_review":
      return {
        kind,
        ownerId: value("ownerId"),
        eventId: value("eventId"),
        title: value("title"),
        category: value("category") as "official" | "seminar" | "meetup",
        authorName: value("authorName"),
        authorHandle: clearable("authorHandle"),
        authorAvatarUrl: clearable("authorAvatarUrl"),
        body: value("body"),
        imageUrls: lines("imageUrls"),
        keywords: commaList("keywords"),
      };
    case "community_b_talk":
      return {
        kind,
        ownerId: value("ownerId"),
        title: value("title"),
        roast: value("roast") as "light" | "medium" | "dark",
        authorName: value("authorName"),
        authorHandle: clearable("authorHandle"),
        authorAvatarUrl: clearable("authorAvatarUrl"),
        coverUrl: clearable("coverUrl"),
        processImages: lines("processImages"),
        bean: {
          origin: value("beanOrigin"),
          process: value("beanProcess"),
          roastPoint: value("beanRoastPoint"),
        },
        extraction: {
          dosing: value("extractionDosing"),
          yield: value("extractionYield"),
          time: value("extractionTime"),
          temp: value("extractionTemp"),
        },
        note: value("note"),
      };
    case "community_qa":
      return {
        kind,
        ownerId: value("ownerId"),
        title: value("title"),
        authorName: value("authorName"),
        authorAvatarUrl: clearable("authorAvatarUrl"),
        body: value("body"),
        imageUrls: lines("imageUrls"),
      };
    case "partner_promotion":
      return {
        kind,
        ownerId: value("ownerId"),
        title: value("title"),
        category: value("category") as Extract<
          AdminContentInput,
          { kind: "partner_promotion" }
        >["category"],
        companyName: value("companyName"),
        authorName: value("authorName"),
        authorAvatarUrl: clearable("authorAvatarUrl"),
        summary: value("summary"),
        description: value("description"),
        thumbnailUrl: value("thumbnailUrl"),
        imageUrls: lines("imageUrls"),
        ...attachments(),
        brochureUrls: lines("brochureUrls"),
        tags: commaList("tags"),
        externalUrl: clearable("externalUrl"),
        specs: {
          companyName: value("specCompanyName"),
          productName: value("specProductName"),
          categoryLabel: value("specCategoryLabel"),
        },
      };
    case "partner_review":
      return {
        kind,
        ownerId: value("ownerId"),
        promotionId: value("promotionId"),
        productName: value("productName"),
        category: value("category") as Extract<
          AdminContentInput,
          { kind: "partner_review" }
        >["category"],
        brand: value("brand"),
        modelName: value("modelName"),
        features: value("features"),
        reviewerName: value("reviewerName"),
        reviewerAvatarUrl: clearable("reviewerAvatarUrl"),
        reviewerResumeUrl: clearable("reviewerResumeUrl"),
        summary: value("summary"),
        body: value("body"),
        imageUrls: lines("imageUrls"),
        ...attachments(),
        tags: commaList("tags"),
        majorPros: lines("majorPros"),
        baristaTip: value("baristaTip"),
        relatedUrl: clearable("relatedUrl"),
      };
    case "partner_banner":
      return {
        kind,
        title: value("title"),
        subtitle: value("subtitle"),
        imageUrl: value("imageUrl"),
        href: value("href"),
        sortOrder: Number(value("sortOrder")),
        activeFrom: new Date(value("activeFrom")).toISOString(),
        activeTo: new Date(value("activeTo")).toISOString(),
      };
  }
}
