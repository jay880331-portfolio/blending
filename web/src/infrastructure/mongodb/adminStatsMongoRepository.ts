import type {
  AdminDashboardDto,
  DashboardRange,
} from "@blending/admin-contracts";
import type { DashboardRepository } from "@/application/admin/dashboardUseCase";
import type { Collection, Document, Filter } from "mongodb";
import { getMongoDb } from "./client";
const days: { [K in DashboardRange]: number } = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};
type Doc = Document;
export class AdminStatsMongoRepository implements DashboardRepository {
  async getDashboard(o: {
    range: DashboardRange;
    now: Date;
    timeZone: string;
  }): Promise<AdminDashboardDto> {
    const db = await getMongoDb();
    const n = days[o.range];
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: o.timeZone,
    }).format(o.now);
    const start = new Date(`${day}T00:00:00+09:00`);
    start.setUTCDate(start.getUTCDate() - (n - 1));
    const activeUser = {
      $or: [
        { accountStatus: { $exists: false } },
        { accountStatus: { $in: ["active", "ACTIVE"] } },
      ],
    };
    const activeContent = {
      $and: [
        {
          $or: [
            { moderationStatus: { $exists: false } },
            { moderationStatus: { $in: ["active", "published", "APPROVED"] } },
          ],
        },
        { $or: [{ visibility: { $exists: false } }, { visibility: "public" }] },
      ],
    };
    const users = db.collection<Doc>("users"),
      contents = db.collection<Doc>("search_documents");
    const [
      totalUsers,
      newUsers,
      recent,
      activeContentCount,
      newContent,
      likes,
      reports,
      roles,
      types,
      daily,
    ] = await Promise.all([
      users.countDocuments(activeUser),
      this.countDate(users, activeUser, "createdAt", start),
      this.countDate(users, activeUser, "updatedAt", start),
      contents.countDocuments(activeContent),
      this.countDate(contents, activeContent, "createdAt", start),
      this.countDate(db.collection("content_likes"), {}, "createdAt", start),
      db
        .collection("admin_reports")
        .countDocuments({ status: { $nin: ["resolved", "closed"] } }),
      users
        .aggregate([
          { $match: activeUser },
          {
            $group: { _id: { $ifNull: ["$role", "user"] }, count: { $sum: 1 } },
          },
        ])
        .toArray(),
      contents
        .aggregate([
          { $match: activeContent },
          {
            $group: {
              _id: { $ifNull: ["$sourceType", "unknown"] },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      this.daily(users, contents, start, n, activeUser, activeContent),
    ]);
    return {
      generatedAt: o.now.toISOString(),
      range: o.range,
      summary: {
        totalUsers,
        newUsers,
        recentlyActiveUsers: recent,
        activeContent: activeContentCount,
        newContent,
        likes,
        openReports: reports,
      },
      daily,
      usersByRole: roles.map((x) => ({ role: String(x._id), count: x.count })),
      contentByType: types.map((x) => ({
        type: String(x._id),
        count: x.count,
      })),
    };
  }
  private async countDate(
    collection: Collection<Doc>,
    match: Filter<Doc>,
    field: string,
    start: Date,
  ) {
    const rows = await collection
      .aggregate([
        { $match: match },
        {
          $addFields: {
            value: {
              $convert: {
                input: `$${field}`,
                to: "date",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        { $match: { value: { $gte: start } } },
        { $count: "count" },
      ])
      .toArray();
    return rows[0]?.count ?? 0;
  }
  private async daily(
    users: Collection<Doc>,
    contents: Collection<Doc>,
    start: Date,
    n: number,
    uf: Filter<Doc>,
    cf: Filter<Doc>,
  ) {
    const end = new Date(start.getTime() + n * 86400000);
    const [u, c] = await Promise.all([
      users
        .aggregate<{ _id: string; count: number }>([
          { $match: uf },
          {
            $addFields: {
              createdDate: {
                $convert: {
                  input: "$createdAt",
                  to: "date",
                  onError: null,
                  onNull: null,
                },
              },
            },
          },
          { $match: { createdDate: { $gte: start, $lt: end } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: "$createdDate",
                  format: "%Y-%m-%d",
                  timezone: "Asia/Seoul",
                },
              },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      contents
        .aggregate<{ _id: string; count: number }>([
          { $match: cf },
          {
            $addFields: {
              createdDate: {
                $convert: {
                  input: "$createdAt",
                  to: "date",
                  onError: null,
                  onNull: null,
                },
              },
            },
          },
          { $match: { createdDate: { $gte: start, $lt: end } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  date: "$createdDate",
                  format: "%Y-%m-%d",
                  timezone: "Asia/Seoul",
                },
              },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
    ]);
    const um = new Map<string, number>(
        u.map((x) => [String(x._id), Number(x.count)]),
      ),
      cm = new Map<string, number>(
        c.map((x) => [String(x._id), Number(x.count)]),
      );
    return Array.from({ length: n }, (_, i) => {
      const d = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
      }).format(new Date(start.getTime() + i * 86400000));
      return { date: d, users: um.get(d) || 0, content: cm.get(d) || 0 };
    });
  }
}
