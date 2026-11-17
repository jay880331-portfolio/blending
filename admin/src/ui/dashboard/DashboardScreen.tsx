"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  AdminDashboardDto,
  DashboardRange,
} from "../../adapters/http/dashboardApi";
import { fetchDashboard } from "../../adapters/http/dashboardApi";
import {
  adminContentTypeLabel,
  adminRoleLabel,
  adminSummaryLabel,
} from "../../domain/displayLabels";
export function DashboardScreen() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [data, setData] = useState<AdminDashboardDto>();
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      fetchDashboard(range)
        .then(setData)
        .catch((e) => setError(e.message)),
    [range],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (error)
    return (
      <div className="dashboard-state">
        <p>{error}</p>
        <button onClick={load}>다시 시도</button>
      </div>
    );
  if (!data) return <p className="dashboard-state">불러오는 중…</p>;
  const max = Math.max(
    1,
    ...data.daily.map((x) => Math.max(x.users, x.content)),
  );
  return (
    <main className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>운영 대시보드</h1>
        </div>
        <label className="range-select">
          <span>기간</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as DashboardRange)}
          >
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
            <option value="90d">최근 90일</option>
          </select>
        </label>
      </div>
      <section className="summary-grid" aria-label="요약 지표">
        {Object.entries(data.summary).map(([k, v]) => (
          <article className="summary-card" key={k}>
            <b>{adminSummaryLabel(k)}</b>
            <strong>{v.toLocaleString()}</strong>
          </article>
        ))}
      </section>
      <section className="dashboard-panel trend-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ACTIVITY</p>
            <h2>일별 추이</h2>
          </div>
          <div className="chart-legend" aria-label="차트 범례">
            <span>
              <i className="legend-dot users" /> 사용자
            </span>
            <span>
              <i className="legend-dot content-series" /> 콘텐츠
            </span>
          </div>
        </div>
        {data.daily.length ? (
          <svg
            className="trend-chart"
            viewBox="0 0 600 180"
            role="img"
            aria-label="사용자와 콘텐츠 일별 추이"
          >
            <line x1="0" y1="170" x2="600" y2="170" className="chart-axis" />
            <polyline
              fill="none"
              className="chart-line users"
              points={data.daily
                .map(
                  (x, i) =>
                    `${(i * 600) / Math.max(1, data.daily.length - 1)},${170 - (x.users * 160) / max}`,
                )
                .join(" ")}
            />
            <polyline
              fill="none"
              className="chart-line content"
              points={data.daily
                .map(
                  (x, i) =>
                    `${(i * 600) / Math.max(1, data.daily.length - 1)},${170 - (x.content * 160) / max}`,
                )
                .join(" ")}
            />
          </svg>
        ) : (
          <p className="empty-state">일별 데이터가 없습니다.</p>
        )}
      </section>
      <div className="dashboard-columns">
        <section className="dashboard-panel breakdown-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">USERS</p>
              <h2>사용자 분류</h2>
            </div>
          </div>
          <ul className="breakdown-list">
            {data.usersByRole.map((x) => (
              <li key={x.role}>
                <div className="breakdown-label">
                  <span>{adminRoleLabel(x.role)}</span>
                  <b>{x.count}</b>
                </div>
                <span className="breakdown-track">
                  <span
                    style={{
                      width: `${(x.count / Math.max(1, ...data.usersByRole.map((item) => item.count))) * 100}%`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="dashboard-panel breakdown-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CONTENT</p>
              <h2>콘텐츠 분류</h2>
            </div>
          </div>
          <ul className="breakdown-list">
            {data.contentByType.map((x) => (
              <li key={x.type}>
                <div className="breakdown-label">
                  <span>{adminContentTypeLabel(x.type)}</span>
                  <b>{x.count}</b>
                </div>
                <span className="breakdown-track content-track">
                  <span
                    style={{
                      width: `${(x.count / Math.max(1, ...data.contentByType.map((item) => item.count))) * 100}%`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <Link className="dashboard-action" href="/reports">
        미처리 신고 보기 <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
