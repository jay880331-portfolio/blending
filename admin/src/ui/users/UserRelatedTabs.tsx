"use client";

import type {
  AdminProfileBadgeDto,
  AdminUserBadgeDto,
  AdminUserCareerDto,
  AdminUserPortfolioDto,
  AdminUserProfileDto,
  AdminUserRelatedKind,
  AdminUserRelatedPage,
} from "@blending/admin-contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  assignUserBadge,
  fetchProfileBadges,
  fetchUserBadges,
  unassignUserBadge,
} from "../../adapters/http/profileBadgeApi";
import {
  deleteUserCareer,
  deleteUserPortfolio,
  fetchRelatedMessage,
  fetchUserCareers,
  fetchUserPortfolios,
  fetchUserProfile,
  fetchUserRelated,
  mutateUserRelated,
  saveUserCareer,
  saveUserPortfolio,
  updateUserProfile,
} from "../../adapters/http/usersApi";
import { clampRelatedPage } from "../../domain/relatedPagination";
import {
  auditLogDetailHref,
  parseUserRelatedQuery,
  updateUserRelatedQuery,
  type UserRelatedTab,
} from "../../domain/userRelatedQuery";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { AsyncState } from "../shared/AsyncState";
import { AdminBadgePill } from "../settings/AdminBadgePreview";
import styles from "../settings/profileBadges.module.css";
import userStyles from "./users.module.css";
import { UserCareerForm } from "./UserCareerForm";
import { UserPortfolioForm } from "./UserPortfolioForm";
import { UserProfileForm } from "./UserProfileForm";

const TABS: [UserRelatedTab, string][] = [
  ["profile", "계정·프로필"],
  ["careers", "경력"],
  ["badges", "뱃지"],
  ["portfolios", "포트폴리오"],
  ["activity", "활동"],
  ["favorites", "즐겨찾기"],
  ["recipes", "레시피"],
  ["notifications", "알림"],
  ["messages", "대화"],
  ["settings", "알림 설정"],
  ["auth", "인증"],
];

export function UserRelatedTabs({ userId }: { userId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const { tab, page } = parseUserRelatedQuery(query);
  const navigate = useCallback(
    (nextTab: UserRelatedTab, nextPage = 1) => {
      const next = updateUserRelatedQuery(query, {
        tab: nextTab,
        page: nextPage,
      });
      router.push(
        `/users/${encodeURIComponent(userId)}${next ? `?${next}` : ""}`,
      );
    },
    [query, router, userId],
  );
  const changePage = useCallback(
    (nextPage: number) => navigate(tab, nextPage),
    [navigate, tab],
  );
  return (
    <section className={userStyles.related}>
      <h2 className={userStyles.relatedTitle}>관련 데이터</h2>
      <nav className={userStyles.tabs} aria-label="사용자 관련 데이터">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-current={tab === value ? "page" : undefined}
            onClick={() => navigate(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "profile" ? (
        <ProfilePanel userId={userId} />
      ) : tab === "careers" ? (
        <CareerPanel userId={userId} />
      ) : tab === "badges" ? (
        <BadgePanel userId={userId} />
      ) : tab === "portfolios" ? (
        <PortfolioPanel userId={userId} />
      ) : (
        <RelatedPanel
          key={tab}
          userId={userId}
          kind={tab}
          page={page}
          onPageChange={changePage}
        />
      )}
    </section>
  );
}

function ProfilePanel({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<AdminUserProfileDto>();
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setProfile(await fetchUserProfile(userId));
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [userId]);
  useEffect(() => {
    void fetchUserProfile(userId)
      .then((value) => {
        setProfile(value);
        setError("");
      })
      .catch((cause) => setError(errorMessage(cause)));
  }, [userId]);
  return (
    <AsyncState loading={!profile && !error} error={error}>
      {profile ? (
        <UserProfileForm
          profile={profile}
          onSave={async (input) => {
            try {
              await updateUserProfile(userId, input);
              await load();
            } catch (cause) {
              setError(errorMessage(cause));
            }
          }}
        />
      ) : null}
    </AsyncState>
  );
}

function BadgePanel({ userId }: { userId: string }) {
  const [catalog, setCatalog] = useState<AdminProfileBadgeDto[]>([]);
  const [assigned, setAssigned] = useState<AdminUserBadgeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [nextCatalog, nextAssigned] = await Promise.all([
        fetchProfileBadges(),
        fetchUserBadges(userId),
      ]);
      setCatalog(nextCatalog);
      setAssigned(nextAssigned);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void Promise.all([fetchProfileBadges(), fetchUserBadges(userId)])
      .then(([nextCatalog, nextAssigned]) => {
        setCatalog(nextCatalog);
        setAssigned(nextAssigned);
        setError("");
      })
      .catch((cause) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [userId]);
  const assignedIds = new Set(assigned.map((badge) => badge.id));
  const available = catalog.filter((badge) => !assignedIds.has(badge.id));
  return (
    <AsyncState loading={loading} error={error}>
      <section>
        <p>
          부여하면 프로필 사진과 인물사전에 빨간 알약으로 붙습니다. 종류는{" "}
          <Link href="/settings/profile-badges">설정 · 프로필 뱃지</Link>
          에서 만듭니다.
        </p>
        {assigned.length === 0 ? <p>부여된 뱃지가 없습니다.</p> : null}
        <ul className={styles.assigned}>
          {assigned.map((badge) => {
            return (
              <li key={badge.assignmentId}>
                <AdminBadgePill name={badge.name} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const reason = window.prompt("해제 사유를 입력해주세요.");
                    if (!reason) return;
                    setBusy(true);
                    try {
                      await unassignUserBadge(userId, badge.id, reason);
                      await load();
                    } catch (cause) {
                      setError(errorMessage(cause));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  해제
                </button>
              </li>
            );
          })}
        </ul>
        {available.length === 0 ? (
          catalog.length === 0 ? (
            <p>등록된 뱃지 종류가 없습니다.</p>
          ) : (
            <p>부여할 수 있는 뱃지가 없습니다.</p>
          )
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const value = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              const badgeId = String(value.badgeId ?? "");
              const reason = String(value.reason ?? "");
              setBusy(true);
              try {
                await assignUserBadge(userId, badgeId, reason);
                event.currentTarget.reset();
                await load();
              } catch (cause) {
                setError(errorMessage(cause));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              뱃지
              <select name="badgeId" required defaultValue="">
                <option value="" disabled>
                  선택
                </option>
                {available.map((badge) => (
                  <option key={badge.id} value={badge.id}>
                    {badge.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              사유
              <input name="reason" required />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "부여 중…" : "부여"}
            </button>
          </form>
        )}
      </section>
    </AsyncState>
  );
}

function CareerPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<AdminUserCareerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const load = useCallback(async () => {
    try {
      setItems(await fetchUserCareers(userId));
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void fetchUserCareers(userId)
      .then((value) => {
        setItems(value);
        setError("");
      })
      .catch((cause) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [userId]);
  return (
    <AsyncState loading={loading} error={error}>
      <section>
        <UserCareerForm
          onSave={async (input) => {
            try {
              await saveUserCareer(userId, input, true);
              await load();
            } catch (cause) {
              setError(errorMessage(cause));
            }
          }}
        />
        {items.map((item) => (
          <article key={item.id}>
            <h3>{item.title}</h3>
            <p>
              {item.year} · {item.organization}
            </p>
            <UserCareerForm
              career={item}
              onSave={async (input) => {
                try {
                  await saveUserCareer(userId, input, false);
                  await load();
                } catch (cause) {
                  setError(errorMessage(cause));
                }
              }}
            />
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={async () => {
                const reason = window.prompt("삭제 사유를 입력해주세요.");
                if (reason) {
                  setBusyId(item.id);
                  try {
                    await deleteUserCareer(userId, item.id, reason);
                    await load();
                  } catch (cause) {
                    setError(errorMessage(cause));
                  } finally {
                    setBusyId(undefined);
                  }
                }
              }}
            >
              삭제
            </button>
          </article>
        ))}
      </section>
    </AsyncState>
  );
}

function PortfolioPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<AdminUserPortfolioDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const load = useCallback(async () => {
    try {
      setItems(await fetchUserPortfolios(userId));
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void fetchUserPortfolios(userId)
      .then((value) => {
        setItems(value);
        setError("");
      })
      .catch((cause) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [userId]);
  return (
    <AsyncState loading={loading} error={error}>
      <section>
        <UserPortfolioForm
          onSave={async (input) => {
            try {
              await saveUserPortfolio(userId, input, true);
              await load();
            } catch (cause) {
              setError(errorMessage(cause));
            }
          }}
        />
        {items.map((item) => (
          <article key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <UserPortfolioForm
              portfolio={item}
              onSave={async (input) => {
                try {
                  await saveUserPortfolio(userId, input, false);
                  await load();
                } catch (cause) {
                  setError(errorMessage(cause));
                }
              }}
            />
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={async () => {
                const reason = window.prompt("삭제 사유를 입력해주세요.");
                if (reason) {
                  setBusyId(item.id);
                  try {
                    await deleteUserPortfolio(userId, item.id, reason);
                    await load();
                  } catch (cause) {
                    setError(errorMessage(cause));
                  } finally {
                    setBusyId(undefined);
                  }
                }
              }}
            >
              삭제
            </button>
          </article>
        ))}
      </section>
    </AsyncState>
  );
}

function RelatedPanel({
  userId,
  kind,
  page,
  onPageChange,
}: {
  userId: string;
  kind: AdminUserRelatedKind;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const [result, setResult] = useState<AdminUserRelatedPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const [messageId, setMessageId] = useState<string>();
  const [message, setMessage] = useState<{ body?: string; auditId: string }>();
  const load = useCallback(async () => {
    try {
      const value = await fetchUserRelated(userId, kind, page);
      const validPage = clampRelatedPage(page, value.pagination.totalPages);
      if (validPage !== page) {
        onPageChange(validPage);
        return;
      }
      setResult(value);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [userId, kind, page, onPageChange]);
  useEffect(() => {
    void fetchUserRelated(userId, kind, page)
      .then((value) => {
        const validPage = clampRelatedPage(page, value.pagination.totalPages);
        if (validPage !== page) {
          onPageChange(validPage);
          return;
        }
        setResult(value);
        setError("");
      })
      .catch((cause) => setError(errorMessage(cause)))
      .finally(() => setLoading(false));
  }, [userId, kind, page, onPageChange]);

  const runAction = async (itemId: string, action: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(itemId);
    setError("");
    try {
      await action();
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <AsyncState loading={loading} error={error}>
      <section>
        {result?.auditId && (
          <Link href={auditLogDetailHref(result.auditId)}>
            민감 조회 감사 로그
          </Link>
        )}
        {!result?.items.length ? <p>데이터가 없습니다.</p> : null}
        <ul>
          {result?.items.map((item) => (
            <li key={item.id}>
              <strong>
                {item.title ??
                  item.name ??
                  item.key ??
                  item.method ??
                  item.counterpartId ??
                  item.id}
              </strong>
              <span> {item.createdAt ?? item.updatedAt ?? item.status}</span>
              {item.itemType === "chat-room" && (
                <span>
                  차단 {item.blocked ? "예" : "아니요"} · 음소거{" "}
                  {item.muted ? "예" : "아니요"}
                </span>
              )}
              {kind === "messages" && item.itemType === "message" && (
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => setMessageId(item.id)}
                >
                  본문 보기
                </button>
              )}
              {kind === "settings" && (
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={async () => {
                    const reason = window.prompt("변경 사유를 입력해주세요.");
                    if (reason) {
                      await runAction(item.id, () =>
                        mutateUserRelated(userId, kind, item.id, {
                          enabled: !item.enabled,
                          reason,
                        }),
                      );
                    }
                  }}
                >
                  {item.enabled ? "끄기" : "켜기"}
                </button>
              )}
              {kind === "auth" &&
                item.itemType === "push-token" &&
                item.status !== "revoked" && (
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={async () => {
                      const reason = window.prompt("폐기 사유를 입력해주세요.");
                      if (reason) {
                        await runAction(item.id, () =>
                          mutateUserRelated(userId, kind, item.id, {
                            action: "revoke",
                            reason,
                          }),
                        );
                      }
                    }}
                  >
                    토큰 폐기
                  </button>
                )}
              {!["settings", "auth"].includes(kind) &&
                item.itemType !== "chat-room" && (
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={async () => {
                      const reason = window.prompt(
                        item.deletedAt ? "복구 사유" : "삭제 사유",
                      );
                      if (reason) {
                        await runAction(item.id, () =>
                          mutateUserRelated(userId, kind, item.id, {
                            action: item.deletedAt ? "restore" : "soft-delete",
                            reason,
                          }),
                        );
                      }
                    }}
                  >
                    {item.deletedAt
                      ? "복구"
                      : kind === "notifications"
                        ? "영구 정리"
                        : "삭제"}
                  </button>
                )}
            </li>
          ))}
        </ul>
        {result && result.pagination.totalPages > 1 && (
          <nav aria-label="관련 데이터 페이지">
            <button
              type="button"
              disabled={page <= 1 || loading || Boolean(busyId)}
              onClick={() => {
                setLoading(true);
                onPageChange(page - 1);
              }}
            >
              이전
            </button>
            <span>
              {page} / {result.pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={
                page >= result.pagination.totalPages ||
                loading ||
                Boolean(busyId)
              }
              onClick={() => {
                setLoading(true);
                onPageChange(page + 1);
              }}
            >
              다음
            </button>
          </nav>
        )}
        <ConfirmDialog
          open={Boolean(messageId)}
          title="민감한 메시지 본문 조회"
          onCancel={() => setMessageId(undefined)}
          onConfirm={async () => {
            if (!messageId) return;
            try {
              const response = await fetchRelatedMessage(userId, messageId);
              setMessage({
                body: response.item.body,
                auditId: response.auditId,
              });
            } catch (cause) {
              setError(errorMessage(cause));
            } finally {
              setMessageId(undefined);
            }
          }}
        >
          조회 사실이 감사 로그에 기록됩니다.
        </ConfirmDialog>
        {message && (
          <aside>
            <p>{message.body}</p>
            <Link href={auditLogDetailHref(message.auditId)}>
              감사 로그 보기
            </Link>
          </aside>
        )}
      </section>
    </AsyncState>
  );
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "요청에 실패했습니다.";
}
