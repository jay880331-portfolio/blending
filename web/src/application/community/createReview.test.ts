import assert from "node:assert/strict";
import test from "node:test";
import {
  createReview,
  ReviewForbiddenError,
  ReviewValidationError,
  type CreateReviewInput,
  type CreateReviewPorts,
} from "./createReview";
import type { EventReview } from "@/domain/community/types";
import { PROHIBITED_PUBLIC_CONTENT } from "@/domain/community/publicContentPolicy";

function createMockPorts(overrides: Partial<CreateReviewPorts> = {}): {
  ports: CreateReviewPorts;
  calls: string[];
  savedDoc: EventReview | null;
  savedOwnerId: string | null;
  indexedDoc: EventReview | null;
} {
  const calls: string[] = [];
  let savedDoc: EventReview | null = null;
  let savedOwnerId: string | null = null;
  let indexedDoc: EventReview | null = null;

  const ports: CreateReviewPorts = {
    assertCanWrite: async (userId: string) => {
      calls.push(`assertCanWrite:${userId}`);
    },
    reviewRepository: {
      save: async (review: EventReview, ownerId: string) => {
        calls.push(`save:${review.id}:${ownerId}`);
        savedDoc = review;
        savedOwnerId = ownerId;
        return { ...review };
      },
    },
    indexReview: async (review: EventReview) => {
      calls.push(`index:${review.id}`);
      indexedDoc = review;
    },
    createId: (prefix: string) => `${prefix}-fixed-id`,
    nowIso: () => "2026-09-05T00:00:00.000Z",
    ...overrides,
  };

  return {
    ports,
    calls,
    get savedDoc() {
      return savedDoc;
    },
    get savedOwnerId() {
      return savedOwnerId;
    },
    get indexedDoc() {
      return indexedDoc;
    },
  };
}

test("작성 제한 실패 시 loadInput, save, index를 호출하지 않고 ReviewForbiddenError를 던진다", async () => {
  let loadInputCalled = false;
  let saveCalled = false;
  let indexCalled = false;

  const ports: CreateReviewPorts = {
    assertCanWrite: async () => {
      throw new Error("콘텐츠 작성 제한 중입니다.");
    },
    reviewRepository: {
      save: async (r) => {
        saveCalled = true;
        return r;
      },
    },
    indexReview: async () => {
      indexCalled = true;
    },
    createId: () => "id",
    nowIso: () => "2026-09-05T00:00:00.000Z",
  };

  await assert.rejects(
    () =>
      createReview(
        { id: "user-1", handle: "user" },
        async () => {
          loadInputCalled = true;
          return { title: "제목", body: "내용" };
        },
        ports,
      ),
    (err: unknown) => {
      assert.ok(err instanceof ReviewForbiddenError);
      assert.equal(err.message, "콘텐츠 작성 제한 중입니다.");
      assert.equal(err.status, 403);
      return true;
    },
  );

  assert.equal(loadInputCalled, false);
  assert.equal(saveCalled, false);
  assert.equal(indexCalled, false);
});

test("작성 제한 실패 시 빈 에러 메시지를 보존한다", async () => {
  const ports: CreateReviewPorts = {
    assertCanWrite: async () => {
      throw new Error("");
    },
    reviewRepository: {
      save: async (r) => r,
    },
    indexReview: async () => {},
    createId: () => "id",
    nowIso: () => "2026-09-05T00:00:00.000Z",
  };

  await assert.rejects(
    () =>
      createReview(
        { id: "user-1" },
        async () => ({ title: "제목", body: "내용" }),
        ports,
      ),
    (err: unknown) => {
      assert.ok(err instanceof ReviewForbiddenError);
      assert.equal(err.message, "");
      assert.equal(err.status, 403);
      return true;
    },
  );
});

test("작성 제한 실패 시 non-Error 객체가 throw되면 기본 메시지를 사용한다", async () => {
  const ports: CreateReviewPorts = {
    assertCanWrite: async () => {
      throw "non-error-failure";
    },
    reviewRepository: {
      save: async (r) => r,
    },
    indexReview: async () => {},
    createId: () => "id",
    nowIso: () => "2026-09-05T00:00:00.000Z",
  };

  await assert.rejects(
    () =>
      createReview(
        { id: "user-1" },
        async () => ({ title: "제목", body: "내용" }),
        ports,
      ),
    (err: unknown) => {
      assert.ok(err instanceof ReviewForbiddenError);
      assert.equal(err.message, "작성할 수 없습니다.");
      assert.equal(err.status, 403);
      return true;
    },
  );
});

test("제목이나 내용이 공백이거나 없으면 400 ReviewValidationError를 던진다", async () => {
  const { ports } = createMockPorts();

  const invalidInputs: CreateReviewInput[] = [
    { title: "", body: "내용" },
    { title: "   ", body: "내용" },
    { title: "제목", body: "" },
    { title: "제목", body: "   " },
    { title: undefined, body: "내용" },
    { title: "제목", body: undefined },
  ];

  for (const input of invalidInputs) {
    await assert.rejects(
      () =>
        createReview(
          { id: "user-1", handle: "user" },
          async () => input,
          ports,
        ),
      (err: unknown) => {
        assert.ok(err instanceof ReviewValidationError);
        assert.equal(err.message, "제목과 내용을 입력해주세요.");
        assert.equal(err.status, 400);
        return true;
      },
    );
  }
});

test("제목, 내용 또는 정리된 키워드에 금칙어가 포함되면 400과 금칙어 코드를 던진다", async () => {
  const { ports } = createMockPorts();

  const prohibitedInputs: CreateReviewInput[] = [
    { title: "죽여버려 커피", body: "일반 내용" },
    { title: "일반 제목", body: "조건만남 구해요" },
    { title: "일반 제목", body: "일반 내용", keywords: ["마약판매", "원두"] },
  ];

  for (const input of prohibitedInputs) {
    await assert.rejects(
      () =>
        createReview(
          { id: "user-1", handle: "user" },
          async () => input,
          ports,
        ),
      (err: unknown) => {
        assert.ok(err instanceof ReviewValidationError);
        assert.equal(err.message, PROHIBITED_PUBLIC_CONTENT.message);
        assert.equal(err.code, PROHIBITED_PUBLIC_CONTENT.code);
        assert.equal(err.status, 400);
        return true;
      },
    );
  }
});

test("카테고리가 잘못되었을 때 400 ReviewValidationError를 던진다", async () => {
  const { ports } = createMockPorts();

  await assert.rejects(
    () =>
      createReview(
        { id: "user-1", handle: "user" },
        async () => ({ title: "제목", body: "내용", category: "invalid-cat" }),
        ports,
      ),
    (err: unknown) => {
      assert.ok(err instanceof ReviewValidationError);
      assert.equal(err.message, "후기 카테고리를 확인해주세요.");
      assert.equal(err.status, 400);
      return true;
    },
  );
});

test("허용 카테고리는 통과하고, 카테고리가 falsy이면 meetup이 기본값이다", async () => {
  const allowed = ["official", "seminar", "meetup"] as const;

  for (const cat of allowed) {
    const { ports } = createMockPorts();
    const result = await createReview(
      { id: "user-1", handle: "user" },
      async () => ({ title: "제목", body: "내용", category: cat }),
      ports,
    );
    assert.equal(result.category, cat);
  }

  const falsyCategories = [undefined, "", null as unknown as undefined];
  for (const cat of falsyCategories) {
    const { ports } = createMockPorts();
    const result = await createReview(
      { id: "user-1", handle: "user" },
      async () => ({ title: "제목", body: "내용", category: cat }),
      ports,
    );
    assert.equal(result.category, "meetup");
  }
});

test("author 우선순위(user.handle ?? authorName / authorHandle ?? user.handle)와 fallback 및 위조 ownerId 무시를 검증한다", async () => {
  // 케이스 1: user.handle이 있고 body에도 다른 값이 있는 경우
  {
    const mock = createMockPorts();
    const result = await createReview(
      { id: "user-1", handle: "userHandle" },
      async () => ({
        title: "제목",
        body: "내용",
        authorName: "customName",
        authorHandle: "customHandle",
        ownerId: "forged-user-id", // 위조 ownerId
      }),
      mock.ports,
    );

    // author.name: user.handle ?? authorName => userHandle
    assert.equal(result.author.name, "userHandle");
    // author.handle: authorHandle ?? user.handle => customHandle
    assert.equal(result.author.handle, "customHandle");
    // 위조 ownerId 무시되고 user.id가 repository에 전달됨
    assert.equal(mock.savedOwnerId, "user-1");
  }

  // 케이스 2: user.handle이 없고 body.authorName만 있는 경우
  {
    const mock = createMockPorts();
    const result = await createReview(
      { id: "user-2", handle: null },
      async () => ({
        title: "제목",
        body: "내용",
        authorName: "  바리스타김  ",
      }),
      mock.ports,
    );

    assert.equal(result.author.name, "바리스타김");
    assert.equal(result.author.handle, "anonymous");
  }

  // 케이스 3: 아무 작성자 정보도 없는 경우 기본 fallback
  {
    const mock = createMockPorts();
    const result = await createReview(
      { id: "user-3" },
      async () => ({
        title: "제목",
        body: "내용",
        authorName: "   ",
        authorHandle: "   ",
      }),
      mock.ports,
    );

    assert.equal(result.author.name, "익명");
    assert.equal(result.author.handle, "anonymous");
  }
});

test("배열(imageUrls, keywords)의 공백을 trim하고 빈 문자열을 제거한다", async () => {
  const mock = createMockPorts();
  const result = await createReview(
    { id: "user-1", handle: "user" },
    async () => ({
      title: "제목",
      body: "내용",
      imageUrls: [
        " https://img.com/1.jpg ",
        "",
        "   ",
        "https://img.com/2.jpg ",
      ],
      keywords: [" 원두 ", "", " 에티오피아 "],
    }),
    mock.ports,
  );

  assert.deepEqual(result.imageUrls, [
    "https://img.com/1.jpg",
    "https://img.com/2.jpg",
  ]);
  assert.deepEqual(result.keywords, ["원두", "에티오피아"]);
});

test("성공 시 호출 순서(assertCanWrite -> loadInput -> save -> index), 정확한 문서 구성, response(isOwner:true)를 검증한다", async () => {
  const order: string[] = [];
  const ports: CreateReviewPorts = {
    assertCanWrite: async (userId) => {
      order.push(`assertCanWrite:${userId}`);
    },
    reviewRepository: {
      save: async (review, ownerId) => {
        order.push(`save:${review.id}:${ownerId}`);
        return { ...review };
      },
    },
    indexReview: async (review) => {
      order.push(`index:${review.id}`);
    },
    createId: (prefix) => `${prefix}-1234`,
    nowIso: () => "2026-09-05T12:00:00.000Z",
  };

  const result = await createReview(
    { id: "real-user-id", handle: "coffee-lover" },
    async () => {
      order.push("loadInput");
      return {
        eventId: "event-42",
        title: "  훌륭한 세미나였습니다  ",
        category: "seminar",
        body: "  매우 유익한 시간이었습니다.  ",
        imageUrls: ["https://example.com/photo.png"],
        keywords: ["세미나", "추출"],
      };
    },
    ports,
  );

  // 순서 검증
  assert.deepEqual(order, [
    "assertCanWrite:real-user-id",
    "loadInput",
    "save:review-1234:real-user-id",
    "index:review-1234",
  ]);

  // 문서 필드 검증
  assert.equal(result.id, "review-1234");
  assert.equal(result.eventId, "event-42");
  assert.equal(result.title, "훌륭한 세미나였습니다");
  assert.equal(result.category, "seminar");
  assert.deepEqual(result.author, {
    name: "coffee-lover",
    handle: "coffee-lover",
  });
  assert.equal(result.createdAt, "2026-09-05T12:00:00.000Z");
  assert.deepEqual(result.imageUrls, ["https://example.com/photo.png"]);
  assert.deepEqual(result.keywords, ["세미나", "추출"]);
  assert.equal(result.likes, 0);
  assert.equal(result.body, "매우 유익한 시간이었습니다.");
  assert.equal(result.isOwner, true);
});

test("저장 실패 시 색인 함수가 호출되지 않고 에러가 전파된다", async () => {
  let indexCalled = false;
  const dbError = new Error("Mongo connection timeout");

  const ports: CreateReviewPorts = {
    assertCanWrite: async () => {},
    reviewRepository: {
      save: async () => {
        throw dbError;
      },
    },
    indexReview: async () => {
      indexCalled = true;
    },
    createId: () => "review-1",
    nowIso: () => "2026-09-05T00:00:00.000Z",
  };

  await assert.rejects(
    () =>
      createReview(
        { id: "user-1" },
        async () => ({ title: "제목", body: "내용" }),
        ports,
      ),
    (err: unknown) => {
      assert.equal(err, dbError);
      return true;
    },
  );

  assert.equal(indexCalled, false);
});

test("색인 실패 시 에러가 전파되고, 이미 저장된 결과는 취소되지 않는다", async () => {
  let saved = false;
  const indexError = new Error("ElasticSearch offline");

  const ports: CreateReviewPorts = {
    assertCanWrite: async () => {},
    reviewRepository: {
      save: async (r) => {
        saved = true;
        return r;
      },
    },
    indexReview: async () => {
      throw indexError;
    },
    createId: () => "review-1",
    nowIso: () => "2026-09-05T00:00:00.000Z",
  };

  await assert.rejects(
    () =>
      createReview(
        { id: "user-1" },
        async () => ({ title: "제목", body: "내용" }),
        ports,
      ),
    (err: unknown) => {
      assert.equal(err, indexError);
      return true;
    },
  );

  assert.equal(saved, true);
});
