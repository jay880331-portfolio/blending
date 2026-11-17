"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  FileText,
  Flag,
  Gauge,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { adminNavigation, isActiveAdminRoute } from "../../domain/navigation";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { Breadcrumbs } from "./Breadcrumbs";

const navIcons: Record<
  string,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  "/dashboard": LayoutDashboard,
  "/users": Users,
  "/content": FileText,
  "/reports": Flag,
  "/statistics": ChartColumn,
  "/audit-logs": ScrollText,
  "/operations/search-index": Search,
  "/operations/business-verifications": ShieldCheck,
  "/settings": Settings,
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  const s = useAdminSessionStore();
  const current = adminNavigation.find((n) => isActiveAdminRoute(p, n.href));
  const title = current?.label ?? "Dashboard";
  return (
    <div className="admin-shell">
      <aside>
        <Link className="logo" href="/dashboard">
          BLENDING
          <span className="logo-badge">ADMIN</span>
        </Link>
        <nav aria-label="관리자 메뉴">
          {adminNavigation.map((n) => {
            const active = isActiveAdminRoute(p, n.href);
            const Icon = navIcons[n.href] ?? Gauge;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "active" : ""}
                href={n.href}
                key={n.href}
              >
                <Icon size={17} strokeWidth={1.8} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <section className="admin-main">
        <header>
          <span className="header-title">{title}</span>
          <span className="header-user">
            <span aria-hidden className="header-avatar">
              {s.user?.name?.slice(0, 1) ?? "·"}
            </span>
            <span className="header-name">{s.user?.name}</span>
            <button onClick={() => void s.logout()} type="button">
              <LogOut size={14} strokeWidth={1.8} />
              로그아웃
            </button>
          </span>
        </header>
        <div className="content">
          <Breadcrumbs label={title} />
          {children}
        </div>
      </section>
    </div>
  );
}
