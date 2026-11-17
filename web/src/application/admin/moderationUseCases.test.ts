import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClientSession } from "mongodb";
import type { AdminUnitOfWork } from "./adminUnitOfWork";
import {
  createReport,
  createReportAndBlock,
  publicComment,
  resolveReport,
  softDeleteComment,
} from "./moderationUseCases";
import { runAuditedMutation } from "./auditedMutation";

const input = {
  targetType: "user" as const,
  targetId: "target",
  reason: "abuse" as const,
  detail: "신고 사유를 확인할 수 있도록 충분히 자세하게 작성한 내용입니다.",
};

test("allows only one open report per reporter and target", async () => {
  const reports: unknown[] = [];
  const repository = {
    findForDecision: async () => ({ id: "r1", targetType: "user" }),
    countToday: async () => reports.length,
    findOpen: async () => reports[0] ?? null,
    targetExists: async () => true,
    resolveTargetUserId: async () => "target",
    create: async (value: unknown) => (reports.push(value), value),
  };
  await createReport(repository, "user-1", input);
  await assert.rejects(
    () => createReport(repository, "user-1", input),
    /이미 접수/,
  );
});

test("masks deleted replies in public payloads", () => {
  const result = publicComment({
    id: "c1",
    body: "visible",
    authorName: "A",
    replies: [
      {
        id: "r1",
        body: "secret",
        authorName: "B",
        ownerId: "u2",
        isDeleted: true,
      },
    ],
  });
  const reply = (result.replies as Record<string, unknown>[])[0];
  assert.equal(reply.body, "삭제된 댓글입니다.");
  assert.equal(reply.authorName, "알 수 없음");
  assert.equal(reply.ownerId, undefined);
});

test("validates actions against the report target before mutation", async () => {
  let mutated = false;
  const repository = {
    findForDecision: async () => ({ id: "r1", targetType: "message" }),
    resolvePending: async () => ((mutated = true), { id: "r1" }),
  };
  await assert.rejects(
    () =>
      resolveReport(
        repository,
        { id: "admin" },
        "r1",
        { status: "resolved", resolution: "done", contentAction: "delete" },
        {} as never,
      ),
    /콘텐츠 조치/,
  );
  assert.equal(mutated, false);
});

test("rejects unknown sanction types before mutation", async () => {
  let mutated = false;
  const repository = {
    findForDecision: async () => ({ id: "r1", targetType: "user" }),
    resolvePending: async () => ((mutated = true), { id: "r1" }),
  };
  await assert.rejects(
    () =>
      resolveReport(
        repository,
        { id: "admin" },
        "r1",
        {
          status: "resolved",
          resolution: "done",
          sanction: { type: "root" as never, reason: "bad" },
        },
        {} as never,
      ),
    /제재 유형/,
  );
  assert.equal(mutated, false);
});

test("rejects an eleventh daily report", async () => {
  const repository = {
    countToday: async () => 10,
    findOpen: async () => null,
    targetExists: async () => true,
    resolveTargetUserId: async () => "target",
    create: async (value: unknown) => value,
  };
  await assert.rejects(
    () => createReport(repository, "user-1", input),
    /하루 10건/,
  );
});

test("rejects a message report from a non-participant", async () => {
  let created = false;
  await assert.rejects(
    () =>
      createReport(
        {
          countToday: async () => 0,
          findOpen: async () => null,
          targetExists: async () => true,
          resolveTargetUserId: async () => null,
          create: async () => {
            created = true;
          },
        },
        "outsider",
        { ...input, targetType: "message" },
      ),
    /대화에 참여한 사용자/,
  );
  assert.equal(created, false);
});

test("report and block persist only for the resolved report author", async () => {
  const created: Record<string, unknown>[] = [];
  const blocks: Array<[string, string]> = [];
  const repository = {
    countToday: async () => 0,
    findOpen: async () => null,
    targetExists: async () => true,
    resolveTargetUserId: async () => "author-1",
    create: async (value: Record<string, unknown>) => (
      created.push(value),
      value
    ),
    createBlock: async (blockerId: string, blockedId: string) => {
      blocks.push([blockerId, blockedId]);
    },
  };
  await createReportAndBlock(
    repository,
    "reporter-1",
    { ...input, targetType: "content", blockUserId: "author-1" },
    {} as never,
  );
  assert.equal(created[0]?.targetUserId, "author-1");
  assert.deepEqual(blocks, [["reporter-1", "author-1"]]);
  await assert.rejects(
    () =>
      createReportAndBlock(
        repository,
        "reporter-1",
        { ...input, targetType: "content", blockUserId: "tampered-user" },
        {} as never,
      ),
    /일치하지 않습니다/,
  );
  assert.deepEqual(blocks, [["reporter-1", "author-1"]]);
});

test("keeps comment source fields when soft deleting", () => {
  const comment = { body: "원문", ownerId: "u1", author: "작성자" };
  const deleted = softDeleteComment(comment, "admin", "욕설");
  assert.equal(deleted.body, comment.body);
  assert.equal(deleted.ownerId, comment.ownerId);
  assert.equal(deleted.isDeleted, true);
});

test("resolves a pending report only once", async () => {
  let pending = true;
  const repository = {
    findForDecision: async () => ({ id: "r1", targetType: "user" }),
    resolvePending: async () =>
      pending ? ((pending = false), { id: "r1" }) : null,
    applyContentAction: async () => {},
    createSanction: async () => {},
    updateUserStatus: async () => {},
  };
  await resolveReport(
    repository,
    { id: "admin" },
    "r1",
    { status: "dismissed", resolution: "확인 완료" },
    {} as never,
  );
  await assert.rejects(
    () =>
      resolveReport(
        repository,
        { id: "admin" },
        "r1",
        { status: "dismissed", resolution: "확인 완료" },
        {} as never,
      ),
    /이미 처리/,
  );
});

test("a lost comment CAS does not append a duplicate audit", async () => {
  let audits = 0;
  const unitOfWork: AdminUnitOfWork = {
    run: async <T>(work: (session: ClientSession) => Promise<T>) =>
      work({} as ClientSession),
  };
  const audit = {
    action: "content.delete" as const,
    resourceType: "comment",
    resourceId: "c1",
    actorId: "admin",
    actorName: "Admin",
    changedFields: ["isDeleted"],
    requestId: "r",
    ip: "127.0.0.1",
    userAgent: "test",
  };
  const repository = {
    append: async () => {
      audits += 1;
    },
    list: async () => ({
      items: [],
      pagination: { page: 1, pageSize: 20 as const, total: 0, totalPages: 0 },
    }),
    findById: async () => null,
  };
  await runAuditedMutation(
    unitOfWork,
    repository,
    audit,
    async () => true,
    Boolean,
  );
  await runAuditedMutation(
    unitOfWork,
    repository,
    audit,
    async () => false,
    Boolean,
  );
  assert.equal(audits, 1);
});
