"use client";

import { Mail, MapPin, X } from "lucide-react";
import Image from "next/image";
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type {
  CareerItem,
  MemberAccountInfo,
  MemberProfile,
  PortfolioItem,
} from "@/domain/member/types";
import { InstagramBrandIcon } from "@/ui/shared/SocialBrandIcons";
import { ProfileQrCode } from "./ProfileQrCode";
import { profileSocialHref } from "./profileSocial";
import { buildResumeData } from "./resumeData";

type ResumeDocumentProps = {
  profile: MemberProfile;
  account?: MemberAccountInfo;
  careers: CareerItem[];
  portfolios: PortfolioItem[];
  onClose: () => void;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
};

const ACCENT = "#0b0f1a";
const BODONI = "'Bodoni Moda', serif";

export function ResumeModal(props: ResumeDocumentProps) {
  const { onClose } = props;
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const inertSiblings = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== dialog,
      )
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    inertSiblings.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      inertSiblings.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mounted, onClose]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey
        ? document.activeElement === first
        : document.activeElement === last
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };

  if (!mounted) return null;
  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label={`${props.profile.name} 이력서`}
      onKeyDown={handleDialogKeyDown}
    >
      <ResumeDocument {...props} closeButtonRef={closeButtonRef} />
    </div>,
    document.body,
  );
}

export function ResumeDocument({
  profile,
  account,
  careers,
  portfolios,
  onClose,
  closeButtonRef,
}: ResumeDocumentProps) {
  const resume = buildResumeData({
    careers,
    portfolios,
    account: profile.isOwnProfile ? account : undefined,
    showPortfolios: profile.isOwnProfile || profile.isPortfolioPublic,
  });
  const workplaces =
    profile.workplaces.length > 0 ? profile.workplaces : [profile.workplace];
  const locations =
    profile.workplaceLocations
      ?.map((location) => location.displayName || location.address)
      .filter(Boolean) ?? [];
  const equipment = [
    ...(profile.baristaProfile?.espressoMachineBrands.filter(
      (brand) => brand !== "기타",
    ) ?? []),
    ...(profile.baristaProfile?.grinderBrands.filter(
      (brand) => brand !== "기타",
    ) ?? []),
    ...(profile.baristaProfile?.roasterBrands.filter(
      (brand) => brand !== "기타",
    ) ?? []),
    ...[
      profile.baristaProfile?.espressoMachineBrandOther,
      profile.baristaProfile?.grinderBrandOther,
      profile.baristaProfile?.roasterBrandOther,
    ].filter((value): value is string => Boolean(value)),
  ];
  const beans = [
    ...(profile.baristaProfile?.preferredBeans
      .split(",")
      .map((bean) => bean.trim())
      .filter(Boolean) ?? []),
    ...(profile.baristaProfile?.preferredBeanNotes.filter(Boolean) ?? []),
  ];
  const socialLinks = [
    ["Instagram", profile.socials.instagram, "instagram"],
    ["Threads", profile.socials.threads, "threads"],
    ["Website", profile.socials.website, "website"],
    ["Recipe", profile.socials.recipeUrl, "recipe"],
  ] as const;

  return (
    <div
      className="rsm-outer"
      style={
        {
          "--accent": ACCENT,
          background: "#eef1ec",
          minHeight: "100svh",
          display: "flex",
          justifyContent: "center",
          padding: "56px 24px",
          fontFamily: "'Pretendard', sans-serif",
          color: "#1a1d18",
        } as CSSProperties
      }
    >
      <style>{resumeDocumentCss}</style>
      <button
        ref={closeButtonRef}
        type="button"
        aria-label="이력서 닫기"
        onClick={onClose}
        className="rsm-close"
      >
        <X size={22} strokeWidth={2.2} />
      </button>
      <article
        className="rsm-card"
        style={{
          width: 1060,
          maxWidth: "100%",
          background: "#ffffff",
          boxShadow: "0 30px 70px -20px rgba(10,15,10,0.25)",
          border: "1px solid #e2e6df",
          overflow: "hidden",
        }}
      >
        <header
          className="riseA rsm-header"
          style={{
            position: "relative",
            background: "#f7f8fa",
            color: "#0b0f1a",
            padding: "32px 56px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 260,
              height: 260,
              borderRadius: "50%",
              border: "1px solid rgba(11,15,26,0.1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -90,
              right: 40,
              width: 180,
              height: 180,
              borderRadius: "50%",
              border: "1px solid rgba(11,15,26,0.06)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                fontFamily: BODONI,
                fontSize: 8,
                letterSpacing: 3,
                color: "var(--accent)",
                fontWeight: 600,
                marginBottom: 9,
              }}
            >
              BLENDING RESUME
            </div>
            <h1
              className="rsm-h1"
              style={{
                fontFamily: BODONI,
                fontSize: 44,
                lineHeight: 0.95,
                fontWeight: 500,
                letterSpacing: 1,
              }}
            >
              {profile.name}
            </h1>
          </div>
          <div
            style={{
              position: "relative",
              zIndex: 1,
              textAlign: "right",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 14,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                padding: 8,
                borderRadius: 4,
                border: "1px solid #e2e6df",
              }}
            >
              <ProfileQrCode profileId={profile.id} size={56} />
            </div>
          </div>
        </header>
        <div
          style={{
            height: 3,
            background:
              "linear-gradient(90deg, var(--accent), transparent 70%)",
          }}
        />
        <div
          className="rsm-content"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}
        >
          <aside
            className="rsm-sidebar"
            style={{
              background: "#f4f6f1",
              padding: "48px 36px",
            }}
          >
            <div
              className="riseA"
              style={{ textAlign: "center", marginBottom: 40 }}
            >
              {profile.avatarUrl ? (
                <div
                  style={{
                    position: "relative",
                    width: 148,
                    height: 148,
                    borderRadius: "50%",
                    margin: "0 auto 20px",
                    padding: 5,
                    background:
                      "linear-gradient(135deg, var(--accent), #0b0f1a33)",
                  }}
                >
                  <Image
                    src={profile.avatarUrl}
                    alt={`${profile.name} 프로필 이미지`}
                    width={138}
                    height={138}
                    unoptimized={profile.avatarUrl.startsWith("blob:")}
                    sizes="138px"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                      border: "3px solid #ffffff",
                    }}
                  />
                </div>
              ) : null}
              <div
                style={{
                  fontFamily: BODONI,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: 2,
                  color: "#0b0f1a",
                }}
              >
                {profile.name}
              </div>
            </div>
            <SidebarSection title="PROFILE">
              <InfoItem
                label="소속"
                value={workplaces.filter(Boolean).join(" · ")}
              />
              <InfoItem
                label="전문분야"
                value={profile.specialties.join(" · ")}
              />
              <InfoItem label="자기소개" value={profile.bio} italic />
            </SidebarSection>
            <SidebarSection title="CONTACT">
              {resume.contact.email ? (
                <ContactItem
                  icon={<Mail size={14} />}
                  value={resume.contact.email}
                />
              ) : null}
              {socialLinks.map(([label, value, kind]) =>
                value.trim() ? (
                  <ContactItem
                    key={label}
                    icon={
                      kind === "instagram" ? (
                        <InstagramBrandIcon className="h-3.5 w-3.5" />
                      ) : (
                        label
                      )
                    }
                    value={value}
                    href={profileSocialHref(value, kind)}
                  />
                ) : null,
              )}
              {locations.length > 0 ? (
                <ContactItem
                  icon={<MapPin size={14} />}
                  value={locations.join(" · ")}
                />
              ) : null}
            </SidebarSection>
            <SidebarSection title="COFFEE IDENTITY" last>
              {equipment.length > 0 ? (
                <ChipGroup label="PREFERRED EQUIPMENT" values={equipment} />
              ) : null}
              {beans.length > 0 ? (
                <ChipGroup label="BEANS & NUANCE" values={beans} filled />
              ) : null}
            </SidebarSection>
          </aside>
        </div>
        <footer
          style={{
            textAlign: "center",
            padding: 28,
            borderTop: "1px solid #e2e6df",
            background: "#f4f6f1",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 3,
              color: "#6b7566",
              fontWeight: 600,
            }}
          >
            CERTIFIED BY BLENDING PLATFORM
          </div>
        </footer>
      </article>
    </div>
  );
}

function SidebarSection({
  title,
  children,
  last = false,
}: {
  title: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <section style={{ marginBottom: last ? 0 : 36 }}>
      <h3
        className="rsm-side-h3"
        style={{
          fontFamily: BODONI,
          fontSize: 13,
          letterSpacing: 4,
          color: "var(--accent)",
          fontWeight: 600,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {title}
        <span style={{ flex: 1, height: 1, background: "#dde3d8" }} />
      </h3>
      <div style={{ display: "grid", gap: title === "CONTACT" ? 12 : 14 }}>
        {children}
      </div>
    </section>
  );
}

function InfoItem({
  label,
  value,
  italic = false,
}: {
  label: string;
  value: string;
  italic?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 1.5,
          color: "#7a8577",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "#1a1d18",
          fontStyle: italic ? "italic" : undefined,
        }}
      >
        {italic ? `"${value}"` : value}
      </div>
    </div>
  );
}

function ContactItem({
  icon,
  value,
  href,
}: {
  icon: ReactNode;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span style={{ color: "var(--accent)", width: 14, flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
    </>
  );
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "#1a1d18",
    textDecoration: "none",
  };
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={style}>
      {content}
    </a>
  ) : (
    <div style={style}>{content}</div>
  );
}

function ChipGroup({
  label,
  values,
  filled = false,
}: {
  label: string;
  values: string[];
  filled?: boolean;
}) {
  return (
    <div style={{ marginBottom: filled ? 0 : 18 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 1.5,
          color: "#7a8577",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
            style={{
              fontSize: 12,
              padding: "6px 12px",
              border: filled ? undefined : "1px solid var(--accent)",
              background: filled ? "var(--accent)" : undefined,
              color: filled ? "#ffffff" : "#0b0f1a",
              borderRadius: 20,
            }}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

const resumeDocumentCss = `
  @font-face {
    font-family: 'Bodoni Moda';
    src: url('/fonts/BodoniModa-Latin.woff2') format('woff2');
    font-style: normal;
    font-weight: 400 800;
    font-display: swap;
  }
  .rsm-outer, .rsm-outer * { box-sizing: border-box; }
  .rsm-outer * { margin: 0; padding: 0; }
  .rsm-outer { -webkit-text-size-adjust: 100%; }
  .rsm-outer img { max-width: 100%; }
  .rsm-outer canvas { display: block; }
  .rsm-outer h1, .rsm-outer h2, .rsm-outer h3, .rsm-outer h5,
  .rsm-outer p, .rsm-outer li, .rsm-outer div, .rsm-outer span {
    overflow-wrap: anywhere; word-break: keep-all;
  }
  @keyframes riseIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  .rsm-outer .riseA { animation: riseIn 0.7s cubic-bezier(.2,.7,.2,1) both; }
  .rsm-outer ::selection { background: #c3f53c; color: #0b0f1a; }
  .rsm-close {
    position: fixed; top: 16px; right: 16px; z-index: 60;
    width: 44px; height: 44px; border: 1px solid #e2e6df; border-radius: 50%;
    background: #ffffff; color: #0b0f1a; display: flex; align-items: center;
    justify-content: center; box-shadow: 0 8px 24px rgba(10,15,10,0.18); cursor: pointer;
  }
  .rsm-outer { padding: clamp(0px, 3vw, 56px) clamp(0px, 2.5vw, 24px) !important; }
  .rsm-header { padding: clamp(20px, 3.4vw, 32px) clamp(18px, 5vw, 56px) clamp(16px, 2.6vw, 24px) !important; }
  .rsm-sidebar, .rsm-main { padding: clamp(24px, 4.4vw, 48px) clamp(18px, 4.6vw, 52px) !important; }
  .rsm-h1 { font-size: clamp(30px, 8.6vw, 44px) !important; }
  .rsm-content { grid-template-columns: minmax(0, 1fr) !important; }
  @media (max-width: 900px) {
    .rsm-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
    .rsm-content { grid-template-columns: minmax(0, 1fr) !important; }
    .rsm-sidebar { border-right: none !important; border-bottom: 1px solid #e2e6df; }
    .rsm-card { max-width: 100% !important; box-shadow: none !important; border-left: none !important; border-right: none !important; border-bottom: none !important; }
    .rsm-outer { padding-bottom: 0 !important; min-height: 0 !important; }
    .rsm-close { top: calc(env(safe-area-inset-top, 0px) + 8px); right: calc(env(safe-area-inset-right, 0px) + 8px); }
  }
  @media (max-width: 520px) {
    .rsm-close { top: calc(env(safe-area-inset-top) + 8px); right: 8px; }
  }
  .rsm-header {
    padding-top: calc(clamp(20px, 3.4vw, 32px) + env(safe-area-inset-top, 0px)) !important;
    padding-left: calc(clamp(18px, 5vw, 56px) + env(safe-area-inset-left, 0px)) !important;
    padding-right: calc(clamp(18px, 5vw, 56px) + env(safe-area-inset-right, 0px)) !important;
  }
  @media (max-width: 900px) {
    .rsm-header { padding-top: calc(20px + max(44px, env(safe-area-inset-top, 0px))) !important; padding-right: calc(78px + env(safe-area-inset-right, 0px)) !important; }
    .rsm-sidebar, .rsm-main { padding-left: calc(clamp(18px, 4.6vw, 52px) + env(safe-area-inset-left, 0px)) !important; padding-right: calc(clamp(18px, 4.6vw, 52px) + env(safe-area-inset-right, 0px)) !important; }
    .rsm-outer footer { padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px)) !important; }
  }
  .rsm-sec-h2, .rsm-side-h3 { overflow-wrap: normal !important; word-break: keep-all !important; }
  .rsm-sec-h2 { align-items: flex-start !important; line-height: 1.35; }
  .rsm-sec-h2 > span:first-child { margin-top: 0.5em; flex: none; }
  @media (max-width: 640px) {
    .rsm-sec-h2 { font-size: 13px !important; letter-spacing: 0.22em !important; gap: 10px !important; }
    .rsm-side-h3 { font-size: 12px !important; letter-spacing: 0.2em !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    .rsm-outer .riseA { animation-duration: 50ms; }
  }
`;
