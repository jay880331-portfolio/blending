"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Package, Plus, Trash2 } from "lucide-react";
import {
  BREW_GUIDE_TITLE_MAX_LENGTH,
  type BrewGuide,
} from "@/domain/brewGuide/brewGuide";
import {
  BEAN_GRIND_LABELS,
  BEAN_GRIND_OPTIONS,
  BEAN_NOTES_MAX_LENGTH,
  type BeanGrindOption,
  type BeanKind,
  type ShowroomBean,
} from "@/domain/showroom/bean";
import {
  createStoreBeanApi,
  deleteStoreBeanApi,
  fetchStoreBeans,
  updateStoreBeanApi,
} from "@/adapters/http/beanApi";
import {
  createBrewGuideApi,
  fetchStoreBrewGuides,
  updateBrewGuideApi,
} from "@/adapters/http/brewGuideApi";
import {
  BrewGuideFormFields,
  buildBrewGuideRecipesFromDraft,
  createInitialBrewGuideDraft,
  type BrewGuideRecipeDraft,
} from "@/ui/brewGuide/BrewGuideFormFields";
import { BottomSheet } from "@/ui/shared/BottomSheet";
import { Chip } from "@/ui/shared/Chip";

export function BeanManagerPanel({ storeId }: { storeId: string }) {
  const [beans, setBeans] = useState<ShowroomBean[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<BeanKind>("bean");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [unit, setUnit] = useState("200g");
  const [price, setPrice] = useState("");
  const [grindOptions, setGrindOptions] = useState<BeanGrindOption[]>([
    "whole",
    "drip",
  ]);
  const [saving, setSaving] = useState(false);
  const [guidesByBeanId, setGuidesByBeanId] = useState<
    Record<string, BrewGuide>
  >({});
  const [guideTargetBean, setGuideTargetBean] = useState<ShowroomBean | null>(
    null,
  );
  const [guideTitle, setGuideTitle] = useState("");
  const [guideDraft, setGuideDraft] = useState<BrewGuideRecipeDraft>(() =>
    createInitialBrewGuideDraft(),
  );
  const [guideSaving, setGuideSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchStoreBeans(storeId, true),
      fetchStoreBrewGuides(storeId).catch(() => [] as BrewGuide[]),
    ])
      .then(([list, guides]) => {
        if (cancelled) return;
        setBeans(list);
        const map: Record<string, BrewGuide> = {};
        for (const guide of guides) {
          if (guide.beanId && !map[guide.beanId]) {
            map[guide.beanId] = guide;
          }
        }
        setGuidesByBeanId(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const openGuideSheet = (bean: ShowroomBean) => {
    const existing = guidesByBeanId[bean.id];
    setGuideTargetBean(bean);
    setGuideTitle(existing?.title ?? bean.name);
    setGuideDraft(
      createInitialBrewGuideDraft(
        existing
          ? { filter: existing.filter, espresso: existing.espresso }
          : undefined,
      ),
    );
  };

  const handleSaveGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guideTargetBean || guideSaving) return;
    setGuideSaving(true);
    try {
      const recipes = buildBrewGuideRecipesFromDraft(guideDraft);
      const existing = guidesByBeanId[guideTargetBean.id];
      const saved = existing
        ? await updateBrewGuideApi(existing.id, {
            beanId: guideTargetBean.id,
            title: guideTitle,
            ...recipes,
          })
        : await createBrewGuideApi({
            storeId,
            beanId: guideTargetBean.id,
            title: guideTitle,
            ...recipes,
          });
      setGuidesByBeanId((prev) => ({ ...prev, [guideTargetBean.id]: saved }));
      setGuideTargetBean(null);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "브루 가이드 저장에 실패했습니다.",
      );
    } finally {
      setGuideSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const created = await createStoreBeanApi(storeId, {
        kind,
        name,
        notes,
        unit,
        price: parseInt(price, 10) || 0,
        grindOptions: kind === "bean" ? grindOptions : [],
      });
      setBeans((prev) => [created, ...prev]);
      setShowForm(false);
      setName("");
      setNotes("");
      setPrice("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "상품 등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (bean: ShowroomBean) => {
    try {
      const updated = await updateStoreBeanApi(storeId, bean.id, {
        active: !bean.active,
      });
      setBeans((prev) =>
        prev.map((item) => (item.id === bean.id ? updated : item)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "상태 변경에 실패했습니다.");
    }
  };

  const handleDelete = async (beanId: string) => {
    if (!confirm("이 상품을 삭제하시겠습니까?")) return;
    try {
      await deleteStoreBeanApi(storeId, beanId);
      setBeans((prev) => prev.filter((item) => item.id !== beanId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  return (
    <section className="mt-8 px-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[16px] font-bold text-[var(--fg-strong)]">
          <Package size={18} />
          원두·드립백 상품 관리
        </h3>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)] transition active:scale-95"
        >
          <Plus size={15} /> 상품 추가
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-4"
        >
          <div className="flex gap-2">
            <Chip
              selected={kind === "bean"}
              onClick={() => {
                setKind("bean");
                if (unit === "10개입") setUnit("200g");
              }}
            >
              원두
            </Chip>
            <Chip
              selected={kind === "dripbag"}
              onClick={() => {
                setKind("dripbag");
                if (unit === "200g") setUnit("10개입");
              }}
            >
              드립백
            </Chip>
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="상품명 (예: 에티오피아 예가체프)"
            required
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--fg)]"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="단위 (예: 200g)"
              required
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--fg)]"
            />
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="가격 (원)"
              required
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--fg)]"
            />
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={BEAN_NOTES_MAX_LENGTH}
            rows={2}
            placeholder="테이스팅 노트/설명 (선택, 최대 200자)"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--fg)]"
          />

          {kind === "bean" ? (
            <div className="flex flex-wrap gap-1.5">
              {BEAN_GRIND_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  selected={grindOptions.includes(opt.value)}
                  onClick={() =>
                    setGrindOptions((prev) =>
                      prev.includes(opt.value)
                        ? prev.filter((v) => v !== opt.value)
                        : [...prev, opt.value],
                    )
                  }
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] text-[var(--fg-muted)]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)] disabled:opacity-50"
            >
              {saving ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      ) : null}

      {beans.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[13px] text-[var(--fg-muted)]">
          등록된 원두·드립백 상품이 없습니다.
        </div>
      ) : (
        <div className="space-y-2.5">
          {beans.map((bean) => (
            <div
              key={bean.id}
              className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-[var(--fg-strong)]">
                  [{bean.kind === "bean" ? "원두" : "드립백"}] {bean.name} ·{" "}
                  {bean.unit}
                </p>
                <p className="mt-0.5 text-[13px] font-bold tabular-nums text-[var(--fg)]">
                  {bean.price.toLocaleString("ko-KR")}원
                </p>
                {bean.kind === "bean" && bean.grindOptions.length > 0 ? (
                  <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
                    {bean.grindOptions
                      .map((g) => BEAN_GRIND_LABELS[g])
                      .join(" · ")}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Chip
                    selected={bean.active}
                    onClick={() => void handleToggleActive(bean)}
                  >
                    {bean.active ? "예약 판매 중" : "판매 중지"}
                  </Chip>
                  <button
                    type="button"
                    onClick={() => openGuideSheet(bean)}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--fg)]"
                  >
                    <BookOpen size={12} />
                    {guidesByBeanId[bean.id]
                      ? "브루 가이드 수정"
                      : "브루 가이드"}
                  </button>
                  {guidesByBeanId[bean.id] ? (
                    <Link
                      href={`/brew-guide/${guidesByBeanId[bean.id].id}`}
                      className="text-[11px] font-bold text-[var(--fg-muted)] underline"
                    >
                      카드 보기
                    </Link>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                aria-label="상품 삭제"
                onClick={() => void handleDelete(bean.id)}
                className="p-2 text-[var(--fg-subtle)] hover:text-[var(--danger)]"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {guideTargetBean ? (
        <BottomSheet zIndexClass="z-50" scrollable>
          <form onSubmit={handleSaveGuide} className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[16px] font-bold text-[var(--fg-strong)]">
                {guidesByBeanId[guideTargetBean.id]
                  ? "브루 가이드 수정"
                  : "브루 가이드 등록"}
              </h4>
              <button
                type="button"
                onClick={() => setGuideTargetBean(null)}
                className="text-[13px] text-[var(--fg-muted)]"
              >
                닫기
              </button>
            </div>
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--fg-muted)]">
                원두명(제목)
              </span>
              <input
                type="text"
                required
                maxLength={BREW_GUIDE_TITLE_MAX_LENGTH}
                value={guideTitle}
                onChange={(e) => setGuideTitle(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <BrewGuideFormFields draft={guideDraft} onChange={setGuideDraft} />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGuideTargetBean(null)}
                className="rounded-[var(--radius-md)] px-4 py-2 text-[13px] text-[var(--fg-muted)]"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={guideSaving}
                className="rounded-[var(--radius-md)] bg-[var(--fg)] px-4 py-2 text-[13px] font-bold text-[var(--surface)] disabled:opacity-50"
              >
                {guideSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </BottomSheet>
      ) : null}
    </section>
  );
}
