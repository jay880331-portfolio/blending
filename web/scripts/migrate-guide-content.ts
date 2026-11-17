import { MongoClient, ServerApiVersion, type Document } from "mongodb";

type Seed = { id: string; publishedAt: string } & Record<string, unknown>;
type Existing = Partial<Record<"notices" | "faqs", Seed[]>>;
type Counts = { insert: number; update: number; unchanged: number };
type WriteCounts = {
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
};

const published = (date: string) =>
  new Date(`${date}T00:00:00.000Z`).toISOString();

export const guideContentSeeds: Required<Existing> = {
  notices: [
    [
      "platform-update",
      "신규 플랫폼 업데이트 안내",
      "새로운 파트너 라운지와 커뮤니티 탐색 기능이 추가되었습니다.",
      "2024-05-20",
    ],
    [
      "privacy-policy",
      "개인정보 처리방침 변경 공지",
      "서비스 운영 정책 변경에 따라 개인정보 처리방침 일부 항목이 개정되었습니다.",
      "2024-05-15",
    ],
    [
      "maintenance",
      "서버 점검에 따른 서비스 일시 중단 안내",
      "안정적인 서비스 제공을 위해 새벽 시간대 정기 점검이 진행됩니다.",
      "2024-05-10",
    ],
    [
      "welcome-point",
      "신규 가입자 웰컴 포인트 지급 이벤트",
      "신규 가입 회원에게 커뮤니티 활동에 사용할 수 있는 웰컴 포인트를 지급합니다.",
      "2024-05-01",
    ],
    [
      "support-hours",
      "고객센터 운영 시간 변경 안내",
      "카카오톡 채널 문의 응대 시간이 평일 오전 10시부터 오후 6시까지로 변경됩니다.",
      "2024-04-25",
    ],
  ].map(([id, title, body, date]) => ({
    id,
    title,
    body,
    status: "published",
    publishedAt: published(date),
  })),
  faqs: [
    [
      "profile",
      "guide",
      "데일리 노트를 작성할 때 매번 머신이나 그라인더 세팅을 다 입력해야 하나요?",
      "데일리 노트 작성 시 에스프레소 머신과 그라인더 등 기본 장비는 선택이며, 추출 시간, 추출량, 온도, 수율 등 그날의 세부 변숫값들을 직접 입력하여 기록하게 됩니다. 나만의 추출 레시피와 세팅 데이터를 꾸준히 기록하고 쌓아가는 용도로 활용해 보세요.",
    ],
    [
      "password",
      "guide",
      "피드에서 사진 밑에 뜨는 '오버레이 뱃지'는 어떤 정보인가요?",
      "데일리 노트 피드 사진 위에 보이는 핵심 세팅 요약 뱃지입니다. 최대 2개 선택 가능하며, 사진을 누르지 않아도 다른 바리스타가 어떤 추출 시간과 수율로 뽑았는지 피드 목록에서 직관적으로 확인할 수 있습니다.",
    ],
    [
      "resume",
      "guide",
      "제가 기록한 추출 레시피(데일리 노트)는 다른 사람들에게 모두 공개되나요?",
      "네, BLENDING은 전국의 바리스타들이 서로의 세팅과 노하우를 공유하고 소통하는 오픈 커뮤니티 플랫폼입니다. 작성하신 데일리 노트는 다른 유저들의 피드에 노출되어 함께 커피 이야기를 나누실 수 있습니다.",
    ],
    [
      "membership",
      "guide",
      "'리뷰관'에는 어떤 장비나 원두 리뷰를 등록할 수 있나요?",
      "현직 바리스타와 홈카페 유저들이 실제 매장이나 홈카페에서 사용하는 에스프레소 머신, 그라인더, 브루잉 용품, 그리고 원두까지 커피와 직결된 모든 장비와 재료를 대상으로 솔직한 리뷰를 남기고 찾아볼 수 있습니다.",
    ],
    [
      "people-profile-registration",
      "guide",
      "'인물사전'에 내 프로필을 등록하려면 어떻게 해야 하나요?",
      "[홈 > 프로필 수정(연필 아이콘)]에서 현재 근무 중인 매장, 총 경력, 수상 내역 등을 입력하여 나만의 커리어 포트폴리오로 활용하실 수 있습니다. 작성하신 데일리 노트와 리뷰 활동이 자연스럽게 나의 전문성을 보여주는 지표가 됩니다.",
    ],
    [
      "nearby-cafe-registration",
      "guide",
      "'내 주변' 지도에서 우리 카페나 매장이 검색되지 않아요.",
      "현재 지도 데이터베이스에 등록되지 않은 매장의 경우 별도의 반영이 필요합니다. 화면 하단의 [카카오톡 채널 문의]를 통해 매장 상호명과 위치를 보내주시면 빠르게 등록을 도와드립니다.",
    ],
    [
      "profile-edit",
      "account",
      "닉네임과 프로필 사진을 변경하고 싶어요.",
      "[홈 > 프로필 수정(연필 아이콘)]에서 언제든지 원하는 닉네임과 프로필 사진으로 변경하실 수 있습니다. 단, 닉네임은 중복될 수 없습니다.",
    ],
    [
      "account-deletion",
      "account",
      "앱 탈퇴는 어디서 하나요? 탈퇴하면 데이터는 어떻게 되나요?",
      "[마이페이지 > 내 정보 보기 > 회원 탈퇴]에서 진행하실 수 있습니다. 탈퇴 즉시 그동안 작성하신 데일리 노트, 리뷰, 프로필 등 모든 데이터는 영구적으로 삭제되며 복구할 수 없습니다.",
    ],
    [
      "notification-settings",
      "account",
      "알림(댓글, 좋아요 등)이 오지 않아요. 어디를 확인해야 하나요?",
      "스마트폰 기기 자체의 [설정 > 알림] 권한에서 BLENDING 앱 알림이 켜져 있는지 확인해 주시고, 앱 내 [마이페이지 > 알림 설정]에서도 세부 항목이 켜져 있는지 확인해 주세요.",
    ],
  ].map(([id, category, question, answer], sortOrder) => ({
    id,
    category,
    question,
    answer,
    sortOrder,
    status: "published",
    publishedAt: published("2024-05-01"),
  })),
};

function sameSeed(left: Seed, right: Seed) {
  return Object.entries(right).every(([key, value]) => left[key] === value);
}

export function planGuideContentMigration(existing: Existing) {
  return Object.fromEntries(
    (["notices", "faqs"] as const).map((kind) => {
      const current = new Map(
        (existing[kind] ?? []).map((item) => [item.id, item]),
      );
      const counts: Counts = { insert: 0, update: 0, unchanged: 0 };
      for (const seed of guideContentSeeds[kind]) {
        const item = current.get(seed.id);
        counts[
          item ? (sameSeed(item, seed) ? "unchanged" : "update") : "insert"
        ]++;
      }
      return [kind, counts];
    }),
  ) as Record<"notices" | "faqs", Counts>;
}

export function countMigrationWrites(
  plan: ReturnType<typeof planGuideContentMigration>,
): WriteCounts {
  return Object.values(plan).reduce(
    (counts, item) => ({
      matchedCount: counts.matchedCount + item.update,
      modifiedCount: counts.modifiedCount + item.update,
      upsertedCount: counts.upsertedCount + item.insert,
    }),
    { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 },
  );
}

async function run(apply: boolean) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is required.");
  const client = new MongoClient(uri, {
    appName: "blending-guide-content-migration",
    serverApi: ServerApiVersion.v1,
  });
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB ?? "blending");
    const session = client.startSession();
    try {
      let summary!: ReturnType<typeof planGuideContentMigration>;
      const writeResult: WriteCounts = {
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0,
      };
      const execute = async () => {
        const existing = Object.fromEntries(
          await Promise.all(
            (["notices", "faqs"] as const).map(async (kind) => [
              kind,
              await db
                .collection<Seed>(`content_${kind}`)
                .find(
                  { id: { $in: guideContentSeeds[kind].map(({ id }) => id) } },
                  {
                    session,
                    projection: {
                      _id: 0,
                      createdAt: 0,
                      updatedAt: 0,
                      createdBy: 0,
                      updatedBy: 0,
                    },
                  },
                )
                .toArray(),
            ]),
          ),
        ) as Required<Existing>;
        summary = planGuideContentMigration(existing);
        if (!apply) return;
        const now = new Date().toISOString();
        for (const kind of ["notices", "faqs"] as const) {
          const current = new Map(
            (existing[kind] ?? []).map((item) => [item.id, item]),
          );
          const writes = guideContentSeeds[kind]
            .filter(
              (seed) => !sameSeed(current.get(seed.id) ?? ({} as Seed), seed),
            )
            .map(
              (seed) =>
                ({
                  updateOne: {
                    filter: { id: seed.id },
                    update: {
                      $set: {
                        ...seed,
                        updatedAt: now,
                        updatedBy: "guide-content-migration",
                      },
                      $setOnInsert: {
                        createdAt: now,
                        createdBy: "guide-content-migration",
                      },
                    },
                    upsert: true,
                  },
                }) satisfies Document,
            );
          if (writes.length) {
            const result = await db
              .collection(`content_${kind}`)
              .bulkWrite(writes, { session });
            writeResult.matchedCount += result.matchedCount;
            writeResult.modifiedCount += result.modifiedCount;
            writeResult.upsertedCount += result.upsertedCount;
          }
        }
      };
      if (apply) await session.withTransaction(execute);
      else await execute();
      console.log(
        JSON.stringify(
          {
            mode: apply ? "apply" : "dry-run",
            ...summary,
            ...(apply ? writeResult : {}),
          },
          null,
          2,
        ),
      );
    } finally {
      await session.endSession();
    }
  } finally {
    await client.close();
  }
}

if (process.argv[1]?.endsWith("migrate-guide-content.ts")) {
  const apply = process.argv.includes("--apply");
  if (!apply && !process.argv.includes("--dry-run"))
    throw new Error("Use --dry-run or --apply.");
  void run(apply).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
