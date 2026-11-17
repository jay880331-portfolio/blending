import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "mongodb";
import { PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE } from "@/domain/passport/ledger";
import type { BaristaShowroom } from "@/domain/showroom/types";
import {
  createBeanReservation,
  BeanReservationError,
} from "./beanReservationRepository";
import {
  BusinessVerificationConflictError,
  BusinessVerificationValidationError,
  decideStoreBusinessVerification,
  parseBusinessVerificationDecisionInput,
} from "./businessVerificationDecision";
import {
  inspectPassportPresentation,
  PassportError,
} from "./passportRepository";
import { sanitizeShowroom } from "./showroomRepository";

describe("business verification security, decision, and gates", () => {
  it("H1: sanitizeShowroom strips businessVerification by default and exposes only businessVerified", () => {
    const raw: BaristaShowroom = {
      id: "store-1",
      userId: "owner-1",
      storeName: "블렌딩 로스터리",
      bioMessage: "소개",
      businessVerification: {
        number: "2208162517",
        status: "VERIFIED",
        submittedAt: "2026-11-17T00:00:00.000Z",
      },
      createdAt: "2026-11-17T00:00:00.000Z",
      updatedAt: "2026-11-17T00:00:00.000Z",
    };

    const pub = sanitizeShowroom(raw);
    assert.equal(pub.businessVerified, true);
    assert.equal("businessVerification" in pub, false);

    const ownerView = sanitizeShowroom(raw, new Date(), {
      includeBusinessNumber: true,
    });
    assert.equal(ownerView.businessVerified, true);
    assert.equal(ownerView.businessVerification?.number, "2208162517");
  });

  it("H2: decision validates input and requires matching PENDING number/submittedAt (409 on mismatch)", async () => {
    assert.throws(
      () =>
        parseBusinessVerificationDecisionInput({
          decision: "reject",
          number: "220-81-62517",
          reason: "",
        }),
      BusinessVerificationValidationError,
    );

    const stores = [
      {
        id: "store-1",
        userId: "owner-1",
        storeName: "매장1",
        businessVerification: {
          number: "2208162517",
          status: "PENDING",
          submittedAt: "2026-11-17T01:00:00.000Z",
        },
      },
    ];
    const notifications: Array<Record<string, unknown>> = [];
    const fakeDb = {
      collection(name: string) {
        return {
          findOne: async (filter: Record<string, unknown>) =>
            name === "barista_showrooms"
              ? (stores.find((s) => s.id === filter.id) ?? null)
              : null,
          findOneAndUpdate: async (filter: Record<string, unknown>) => {
            if (name !== "barista_showrooms") return null;
            const match = stores.find(
              (s) =>
                s.id === filter.id &&
                s.businessVerification.status ===
                  filter["businessVerification.status"] &&
                s.businessVerification.number ===
                  filter["businessVerification.number"] &&
                (!filter["businessVerification.submittedAt"] ||
                  s.businessVerification.submittedAt ===
                    filter["businessVerification.submittedAt"]),
            );
            if (!match) return null;
            match.businessVerification.status = "VERIFIED";
            return match;
          },
          insertOne: async (doc: Record<string, unknown>) => {
            if (name === "member_notifications") notifications.push(doc);
            return { insertedId: doc.id };
          },
        };
      },
    } as unknown as Db;

    // Mismatched number -> 409 conflict
    await assert.rejects(
      () =>
        decideStoreBusinessVerification(
          {
            storeId: "store-1",
            adminId: "admin-1",
            input: parseBusinessVerificationDecisionInput({
              decision: "approve",
              number: "120-81-47521",
              submittedAt: "2026-11-17T01:00:00.000Z",
            }),
          },
          { db: fakeDb },
        ),
      BusinessVerificationConflictError,
    );

    // Matching number & submittedAt -> succeeds
    const res = await decideStoreBusinessVerification(
      {
        storeId: "store-1",
        adminId: "admin-1",
        input: parseBusinessVerificationDecisionInput({
          decision: "approve",
          number: "220-81-62517",
          submittedAt: "2026-11-17T01:00:00.000Z",
        }),
      },
      { db: fakeDb },
    );
    assert.equal(res.status, "VERIFIED");
    assert.equal(notifications.length, 1);
  });

  it("H3: separates auth failure from gate failure and uses shared verification message", async () => {
    const fakeDb = {
      collection(name: string) {
        return {
          findOne: async (filter: Record<string, unknown>) => {
            if (
              name === "barista_showrooms" &&
              filter.id === "store-unverified"
            ) {
              return {
                id: "store-unverified",
                userId: "owner-1",
                storeName: "미인증매장",
                businessVerification: {
                  number: "2208162517",
                  status: "PENDING",
                  submittedAt: "2026-11-17T00:00:00.000Z",
                },
              };
            }
            if (name === "users") {
              if (filter.id === "owner-1") {
                return {
                  id: "owner-1",
                  role: "barista",
                  accountStatus: "active",
                };
              }
              if (filter.id === "stranger-1") {
                return {
                  id: "stranger-1",
                  role: "barista",
                  accountStatus: "active",
                };
              }
            }
            return null;
          },
        };
      },
    } as unknown as Db;

    // Auth failure
    await assert.rejects(
      () =>
        inspectPassportPresentation("stranger-1", "store-unverified", "tok", {
          db: fakeDb,
          client: {} as never,
        }),
      (err: unknown) =>
        err instanceof PassportError &&
        err.status === 403 &&
        err.message === "이 매장의 여권 QR을 처리할 권한이 없습니다.",
    );

    // Gate failure on inspect
    await assert.rejects(
      () =>
        inspectPassportPresentation("owner-1", "store-unverified", "tok", {
          db: fakeDb,
          client: {} as never,
        }),
      (err: unknown) =>
        err instanceof PassportError &&
        err.status === 403 &&
        err.message === PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE,
    );

    // Gate failure on bean reservation
    await assert.rejects(
      () =>
        createBeanReservation(
          "customer-1",
          "store-unverified",
          { beanId: "bean-1" },
          { db: fakeDb, skipPush: true },
        ),
      (err: unknown) =>
        err instanceof BeanReservationError &&
        err.status === 403 &&
        err.message === PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE,
    );
  });
});
