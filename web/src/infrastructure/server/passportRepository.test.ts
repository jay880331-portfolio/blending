import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient, type Db } from "mongodb";
import { ensurePassportIndexes } from "@/infrastructure/mongodb/passportIndexes";
import {
  confirmPassportPresentation,
  createPassportPresentation,
  createVerifiedStoreReview,
  getPassportSummary,
  inspectPassportPresentation,
  PassportError,
  type PassportPresentationDoc,
  type PassportStampDoc,
  type PointLedgerDoc,
} from "./passportRepository";

// 독립된 로컬 replica set 전용. 운영 DB에는 접속하지 않는다.
const uri = process.env.COUPON_TEST_MONGODB_URI;

describe(
  "커피 여권 스탬프·포인트·교환·리뷰 MongoDB 트랜잭션",
  { skip: !uri },
  () => {
    let client: MongoClient;
    let db: Db;
    const resources = () => ({ db, client });

    before(async () => {
      assert.match(uri!, /^mongodb:\/\/(127\.0\.0\.1|localhost):/);
      client = await MongoClient.connect(uri!);
      db = client.db(`passport_tx_test_${process.pid}_${Date.now()}`);
      await ensurePassportIndexes(db);
    });

    after(async () => {
      await db?.dropDatabase();
      await client?.close();
    });

    beforeEach(async () => {
      await Promise.all(
        [
          "users",
          "barista_showrooms",
          "coupon_store_staff",
          "menus",
          "passport_presentations",
          "passport_stamps",
          "point_ledger",
          "point_redemptions",
          "store_reviews",
        ].map((name) => db.collection(name).deleteMany({})),
      );

      await db.collection("users").insertMany([
        {
          id: "owner-1",
          name: "사장1",
          role: "barista",
          accountStatus: "active",
        },
        {
          id: "owner-2",
          name: "사장2",
          role: "barista",
          accountStatus: "active",
        },
        {
          id: "staff-1",
          name: "직원1",
          role: "barista",
          accountStatus: "active",
        },
        {
          id: "customer-1",
          name: "고객1",
          role: "enthusiast",
          accountStatus: "active",
        },
      ]);

      await db.collection("barista_showrooms").insertMany([
        {
          id: "store-1",
          userId: "owner-1",
          storeName: "성수 블렌딩",
          bioMessage: "소개",
          businessVerification: {
            number: "2208162517",
            status: "VERIFIED",
            submittedAt: "2026-11-17T00:00:00.000Z",
          },
          createdAt: "2026-11-17T00:00:00.000Z",
          updatedAt: "2026-11-17T00:00:00.000Z",
        },
        {
          id: "store-2",
          userId: "owner-2",
          storeName: "연남 로스터스",
          bioMessage: "소개",
          businessVerification: {
            number: "1208147521",
            status: "VERIFIED",
            submittedAt: "2026-11-17T00:00:00.000Z",
          },
          createdAt: "2026-11-17T00:00:00.000Z",
          updatedAt: "2026-11-17T00:00:00.000Z",
        },
      ]);

      await db.collection("coupon_store_staff").insertOne({
        storeId: "store-1",
        userId: "staff-1",
        grantedBy: "owner-1",
        active: true,
      });

      await db.collection("menus").insertOne({
        id: "menu-1",
        baristaId: "owner-1",
        showroomId: "store-1",
        name: "아메리카노",
        price: 4500,
        tastingNotes: [],
        imageUrl: "",
        exchangePoints: 300,
        createdAt: "2026-11-17T00:00:00.000Z",
        updatedAt: "2026-11-17T00:00:00.000Z",
      });
    });

    it("allows only 1 of 2 concurrent stamp confirmations and leaves same-day retry rejected without consuming a new QR", async () => {
      const pres1 = await createPassportPresentation(
        "customer-1",
        { purpose: "STAMP" },
        resources(),
      );

      const results = await Promise.allSettled([
        confirmPassportPresentation(
          "staff-1",
          "store-1",
          pres1.token,
          resources(),
        ),
        confirmPassportPresentation(
          "staff-1",
          "store-1",
          pres1.token,
          resources(),
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      assert.ok(fulfilled.length >= 1);

      const stamps = await db
        .collection("passport_stamps")
        .find({ userId: "customer-1", storeId: "store-1" })
        .toArray();
      assert.equal(stamps.length, 1);

      const ledgers = await db
        .collection("point_ledger")
        .find({ userId: "customer-1", type: "STAMP" })
        .toArray();
      assert.equal(ledgers.length, 1);
      assert.equal(ledgers[0]?.amount, 100);

      // Same day with a new QR -> 409, and QR stays OPEN
      const pres2 = await createPassportPresentation(
        "customer-1",
        { purpose: "STAMP" },
        resources(),
      );
      await assert.rejects(
        () =>
          confirmPassportPresentation(
            "staff-1",
            "store-1",
            pres2.token,
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 409,
      );
      const pres2Doc = await db
        .collection<PassportPresentationDoc>("passport_presentations")
        .findOne({ _id: pres2.presentationId });
      assert.equal(pres2Doc?.status, "OPEN");
    });

    it("allows stamping on a different KST date and rejects self-stamping", async () => {
      await db.collection<PassportStampDoc>("passport_stamps").insertOne({
        _id: "stamp-yesterday",
        userId: "customer-1",
        storeId: "store-1",
        kstDate: "2020-01-01",
        processedBy: "staff-1",
        createdAt: "2020-01-01T00:00:00.000Z",
      });

      const pres = await createPassportPresentation(
        "customer-1",
        { purpose: "STAMP" },
        resources(),
      );
      const res = await confirmPassportPresentation(
        "staff-1",
        "store-1",
        pres.token,
        resources(),
      );
      assert.equal(res.purpose, "STAMP");
      assert.equal(res.points, 100);

      // Self-stamping by owner-1
      const ownerPres = await createPassportPresentation(
        "owner-1",
        { purpose: "STAMP" },
        resources(),
      );
      await assert.rejects(
        () =>
          confirmPassportPresentation(
            "owner-1",
            "store-1",
            ownerPres.token,
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 403,
      );
    });

    it("rejects forged, expired, wrong-store, and unstamped-store QR presentations", async () => {
      // Forged token
      await assert.rejects(
        () =>
          confirmPassportPresentation(
            "staff-1",
            "store-1",
            "z".repeat(43),
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 404,
      );

      // Expired token
      const pres = await createPassportPresentation(
        "customer-1",
        { purpose: "STAMP" },
        resources(),
      );
      await db
        .collection<PassportPresentationDoc>("passport_presentations")
        .updateOne(
          { _id: pres.presentationId },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );
      await assert.rejects(
        () =>
          inspectPassportPresentation(
            "staff-1",
            "store-1",
            pres.token,
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 409,
      );

      // Unstamped store redeem creation rejected
      await assert.rejects(
        () =>
          createPassportPresentation(
            "customer-1",
            { purpose: "REDEEM", storeId: "store-1", menuId: "menu-1" },
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 403,
      );

      // Wrong store redeem scan rejected
      await db.collection<PassportStampDoc>("passport_stamps").insertOne({
        _id: "stamp-1",
        userId: "customer-1",
        storeId: "store-1",
        kstDate: "2026-11-17",
        processedBy: "staff-1",
        createdAt: "2026-11-17T00:00:00.000Z",
      });
      await db.collection<PointLedgerDoc>("point_ledger").insertOne({
        _id: "ledger-1",
        userId: "customer-1",
        type: "STAMP",
        amount: 500,
        remaining: 500,
        storeId: "store-1",
        refId: "stamp-1",
        createdAt: "2026-11-17T00:00:00.000Z",
        expiresAt: "2027-11-17T00:00:00.000Z",
      });
      const redeemPres = await createPassportPresentation(
        "customer-1",
        { purpose: "REDEEM", storeId: "store-1", menuId: "menu-1" },
        resources(),
      );
      await assert.rejects(
        () =>
          confirmPassportPresentation(
            "owner-2",
            "store-2",
            redeemPres.token,
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 403,
      );
    });

    it("redeems points FIFO excluding expired entries, and rejects when menu points change or balance is insufficient", async () => {
      await db.collection<PassportStampDoc>("passport_stamps").insertOne({
        _id: "stamp-1",
        userId: "customer-1",
        storeId: "store-1",
        kstDate: "2026-11-17",
        processedBy: "staff-1",
        createdAt: "2026-11-17T00:00:00.000Z",
      });
      await db.collection<PointLedgerDoc>("point_ledger").insertMany([
        {
          _id: "expired-entry",
          userId: "customer-1",
          type: "STAMP",
          amount: 500,
          remaining: 500,
          storeId: "store-1",
          refId: "s-exp",
          createdAt: "2025-01-01T00:00:00.000Z",
          expiresAt: "2026-01-01T00:00:00.000Z",
        },
        {
          _id: "soon-entry",
          userId: "customer-1",
          type: "STAMP",
          amount: 200,
          remaining: 200,
          storeId: "store-1",
          refId: "s-soon",
          createdAt: "2026-10-01T00:00:00.000Z",
          expiresAt: "2027-10-01T00:00:00.000Z",
        },
        {
          _id: "later-entry",
          userId: "customer-1",
          type: "REVIEW",
          amount: 200,
          remaining: 200,
          storeId: "store-1",
          refId: "r-later",
          createdAt: "2026-11-01T00:00:00.000Z",
          expiresAt: "2027-11-01T00:00:00.000Z",
        },
      ]);

      const pres = await createPassportPresentation(
        "customer-1",
        { purpose: "REDEEM", storeId: "store-1", menuId: "menu-1" },
        resources(),
      );

      // If menu points changed after QR created -> 409
      await db
        .collection("menus")
        .updateOne({ id: "menu-1" }, { $set: { exchangePoints: 400 } });
      await assert.rejects(
        () =>
          confirmPassportPresentation(
            "staff-1",
            "store-1",
            pres.token,
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 409,
      );

      // Restore menu points to 300 and confirm
      await db
        .collection("menus")
        .updateOne({ id: "menu-1" }, { $set: { exchangePoints: 300 } });
      const redeemed = await confirmPassportPresentation(
        "staff-1",
        "store-1",
        pres.token,
        resources(),
      );
      assert.equal(redeemed.purpose, "REDEEM");
      assert.equal(redeemed.points, 300);

      const soonDoc = await db
        .collection<PointLedgerDoc>("point_ledger")
        .findOne({ _id: "soon-entry" });
      const laterDoc = await db
        .collection<PointLedgerDoc>("point_ledger")
        .findOne({ _id: "later-entry" });
      assert.equal(soonDoc?.remaining, 0);
      assert.equal(laterDoc?.remaining, 100);

      const summary = await getPassportSummary("customer-1", resources());
      assert.equal(summary.balance, 100);

      // Remaining 100 < 300 -> cannot create another redeem QR
      await assert.rejects(
        () =>
          createPassportPresentation(
            "customer-1",
            { purpose: "REDEEM", storeId: "store-1", menuId: "menu-1" },
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 400,
      );
    });

    it("awards +50P once per stamp for verified reviews", async () => {
      await db.collection<PassportStampDoc>("passport_stamps").insertOne({
        _id: "stamp-rev-1",
        userId: "customer-1",
        storeId: "store-1",
        kstDate: "2026-11-17",
        processedBy: "staff-1",
        createdAt: "2026-11-17T00:00:00.000Z",
      });

      const review = await createVerifiedStoreReview(
        {
          userId: "customer-1",
          storeId: "store-1",
          body: "산미가 깔끔하고 에스프레소가 훌륭했습니다.",
        },
        resources(),
      );
      assert.equal(review.pointsEarned, 50);

      // Duplicate review for the same stamp -> 409
      await assert.rejects(
        () =>
          createVerifiedStoreReview(
            {
              userId: "customer-1",
              storeId: "store-1",
              body: "두 번째 리뷰 시도는 거절되어야 합니다.",
            },
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 409,
      );

      const summary = await getPassportSummary("customer-1", resources());
      assert.equal(summary.balance, 50);
    });

    it("rolls back stamp and keeps QR OPEN when point_ledger insert fails", async () => {
      const pres = await createPassportPresentation(
        "customer-1",
        { purpose: "STAMP" },
        resources(),
      );

      const wrappedDb = new Proxy(db, {
        get(target, prop) {
          if (prop === "collection") {
            return (name: string) => {
              const col = target.collection(name);
              if (name !== "point_ledger") return col;
              return new Proxy(col, {
                get(cTarget, cProp) {
                  if (cProp === "insertOne") {
                    return async () => {
                      throw new Error("forced ledger insert failure");
                    };
                  }
                  const val = Reflect.get(cTarget, cProp);
                  return typeof val === "function" ? val.bind(cTarget) : val;
                },
              });
            };
          }
          const val = Reflect.get(target, prop);
          return typeof val === "function" ? val.bind(target) : val;
        },
      }) as unknown as Db;

      await assert.rejects(
        () =>
          confirmPassportPresentation("staff-1", "store-1", pres.token, {
            db: wrappedDb,
            client,
          }),
        /forced ledger insert failure/,
      );

      const stamps = await db
        .collection("passport_stamps")
        .countDocuments({ userId: "customer-1" });
      assert.equal(stamps, 0);

      const presDoc = await db
        .collection<PassportPresentationDoc>("passport_presentations")
        .findOne({ _id: pres.presentationId });
      assert.equal(presDoc?.status, "OPEN");
    });

    it("rolls back remaining balances and keeps QR OPEN when point_redemptions insert fails", async () => {
      await db.collection<PassportStampDoc>("passport_stamps").insertOne({
        _id: "stamp-rb-1",
        userId: "customer-1",
        storeId: "store-1",
        kstDate: "2026-11-17",
        processedBy: "staff-1",
        createdAt: "2026-11-17T00:00:00.000Z",
      });
      await db.collection<PointLedgerDoc>("point_ledger").insertMany([
        {
          _id: "soon-rb",
          userId: "customer-1",
          type: "STAMP",
          amount: 200,
          remaining: 200,
          storeId: "store-1",
          refId: "s-soon-rb",
          createdAt: "2026-10-01T00:00:00.000Z",
          expiresAt: "2027-10-01T00:00:00.000Z",
        },
        {
          _id: "later-rb",
          userId: "customer-1",
          type: "REVIEW",
          amount: 200,
          remaining: 200,
          storeId: "store-1",
          refId: "r-later-rb",
          createdAt: "2026-11-01T00:00:00.000Z",
          expiresAt: "2027-11-01T00:00:00.000Z",
        },
      ]);

      const pres = await createPassportPresentation(
        "customer-1",
        { purpose: "REDEEM", storeId: "store-1", menuId: "menu-1" },
        resources(),
      );

      const wrappedDb = new Proxy(db, {
        get(target, prop) {
          if (prop === "collection") {
            return (name: string) => {
              const col = target.collection(name);
              if (name !== "point_redemptions") return col;
              return new Proxy(col, {
                get(cTarget, cProp) {
                  if (cProp === "insertOne") {
                    return async () => {
                      throw new Error("forced redemption insert failure");
                    };
                  }
                  const val = Reflect.get(cTarget, cProp);
                  return typeof val === "function" ? val.bind(cTarget) : val;
                },
              });
            };
          }
          const val = Reflect.get(target, prop);
          return typeof val === "function" ? val.bind(target) : val;
        },
      }) as unknown as Db;

      await assert.rejects(
        () =>
          confirmPassportPresentation("staff-1", "store-1", pres.token, {
            db: wrappedDb,
            client,
          }),
        /forced redemption insert failure/,
      );

      const soonDoc = await db
        .collection<PointLedgerDoc>("point_ledger")
        .findOne({ _id: "soon-rb" });
      const laterDoc = await db
        .collection<PointLedgerDoc>("point_ledger")
        .findOne({ _id: "later-rb" });
      assert.equal(soonDoc?.remaining, 200);
      assert.equal(laterDoc?.remaining, 200);

      const redemptions = await db
        .collection("point_redemptions")
        .countDocuments({ userId: "customer-1" });
      assert.equal(redemptions, 0);

      const presDoc = await db
        .collection<PassportPresentationDoc>("passport_presentations")
        .findOne({ _id: pres.presentationId });
      assert.equal(presDoc?.status, "OPEN");
    });

    it("rejects expired QR, missing-stamp redeem, and insufficient balance in confirmPassportPresentation", async () => {
      // 1) Expired QR on confirm
      const expiredPres = await createPassportPresentation(
        "customer-1",
        { purpose: "STAMP" },
        resources(),
      );
      await db
        .collection<PassportPresentationDoc>("passport_presentations")
        .updateOne(
          { _id: expiredPres.presentationId },
          { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );
      await assert.rejects(
        () =>
          confirmPassportPresentation(
            "staff-1",
            "store-1",
            expiredPres.token,
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 409,
      );

      // 2) Missing stamp on confirm (stamp deleted after QR created)
      await db.collection<PassportStampDoc>("passport_stamps").insertOne({
        _id: "stamp-confirm-check",
        userId: "customer-1",
        storeId: "store-1",
        kstDate: "2026-11-17",
        processedBy: "staff-1",
        createdAt: "2026-11-17T00:00:00.000Z",
      });
      await db.collection<PointLedgerDoc>("point_ledger").insertOne({
        _id: "ledger-confirm-check",
        userId: "customer-1",
        type: "STAMP",
        amount: 500,
        remaining: 500,
        storeId: "store-1",
        refId: "stamp-confirm-check",
        createdAt: "2026-11-17T00:00:00.000Z",
        expiresAt: "2027-11-17T00:00:00.000Z",
      });
      const redeemPres = await createPassportPresentation(
        "customer-1",
        { purpose: "REDEEM", storeId: "store-1", menuId: "menu-1" },
        resources(),
      );
      await db
        .collection<PassportStampDoc>("passport_stamps")
        .deleteOne({ _id: "stamp-confirm-check" });
      await assert.rejects(
        () =>
          confirmPassportPresentation(
            "staff-1",
            "store-1",
            redeemPres.token,
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 403,
      );

      // 3) Insufficient balance on confirm (restore stamp, deplete ledger after QR created)
      await db.collection<PassportStampDoc>("passport_stamps").insertOne({
        _id: "stamp-confirm-check-2",
        userId: "customer-1",
        storeId: "store-1",
        kstDate: "2026-11-17",
        processedBy: "staff-1",
        createdAt: "2026-11-17T00:00:00.000Z",
      });
      await db
        .collection<PointLedgerDoc>("point_ledger")
        .updateOne(
          { _id: "ledger-confirm-check" },
          { $set: { remaining: 100 } },
        );
      await assert.rejects(
        () =>
          confirmPassportPresentation(
            "staff-1",
            "store-1",
            redeemPres.token,
            resources(),
          ),
        (err: unknown) => err instanceof PassportError && err.status === 409,
      );
    });
  },
);
