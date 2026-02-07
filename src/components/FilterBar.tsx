"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TasteKeywordRow = {
  id: string;
  label: string;
  icon_url: string | null;
  sort_order: number | null;
};

const SWEETNESS = ["약함", "약간 약함", "보통", "약간 강함", "강함"] as const;
const PRESENCE = ["없음", "거의 없음", "보통", "약간 있음", "있음"] as const;
const RECO = ["추천", "비추천"] as const;

const MULTI_KEYS = ["taste", "sweetness", "fishy", "artificial", "bloating"] as const;
const SINGLE_KEYS = ["water", "milk"] as const;

type MultiKey = (typeof MULTI_KEYS)[number];
type SingleKey = (typeof SINGLE_KEYS)[number];

export default function FilterBar({ tasteKeywords }: { tasteKeywords: TasteKeywordRow[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeCount = useMemo(() => {
    const multiCount = MULTI_KEYS.reduce((acc, k) => acc + sp.getAll(k).length, 0);
    const singleCount = SINGLE_KEYS.reduce((acc, k) => acc + (sp.get(k) ? 1 : 0), 0);
    return multiCount + singleCount;
  }, [sp]);

  const toggleMulti = (key: MultiKey, value: string) => {
    const next = new URLSearchParams(sp.toString());
    const current = next.getAll(key);

    next.delete(key);
    if (current.includes(value)) {
      current.filter((v) => v !== value).forEach((v) => next.append(key, v));
    } else {
      [...current, value].forEach((v) => next.append(key, v));
    }

    router.push(`/?${next.toString()}`);
  };

  const toggleSingle = (key: SingleKey, value: string) => {
    const next = new URLSearchParams(sp.toString());
    const current = next.get(key);

    if (current === value) next.delete(key);
    else next.set(key, value);

    router.push(`/?${next.toString()}`);
  };

  const isSelectedMulti = (key: MultiKey, value: string) =>
    sp.getAll(key).includes(value);
  const isSelectedSingle = (key: SingleKey, value: string) =>
    sp.get(key) === value;

  const resetAll = () => {
    const next = new URLSearchParams(sp.toString());
    [...MULTI_KEYS, ...SINGLE_KEYS].forEach((k) => next.delete(k));
    router.push(`/?${next.toString()}`);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-12 min-w-[72px] whitespace-nowrap rounded-full bg-neutral-500 text-[16px] font-medium text-white"
      >
        필터{activeCount ? ` (${activeCount})` : ""}
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />}

      {open && (
        <div
          ref={panelRef}
          className="fixed right-1/2 top-1/2 z-50 w-[min(1100px,94vw)] -translate-y-1/2 translate-x-1/2 rounded-3xl bg-white p-8 shadow-xl"
        >
          {/* 상단 버튼 */}
          <div className="mb-4 flex items-center justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetAll}
                disabled={activeCount === 0}
                className="rounded-full bg-neutral-500 px-4 py-2 text-[12px] font-medium text-white"
              >
                초기화
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-neutral-500 px-4 py-2 text-[12px] font-medium text-white"
              >
                닫기
              </button>
            </div>
          </div>

          {/* 필터 영역 */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* 🔝 맛 키워드 */}
            <Section title="맛 키워드" className="md:col-span-2">
              {tasteKeywords.map((k) => (
                <Chip
                  key={k.id}
                  active={isSelectedMulti("taste", k.id)}
                  onClick={() => toggleMulti("taste", k.id)}
                  iconUrl={k.icon_url}
                >
                  {k.label}
                </Chip>
              ))}
            </Section>

            {/* ───────── divider 1 */}
            <Divider />

            {/* 🎯 맛 성향 */}
            <Section title="단맛">
              {SWEETNESS.map((v) => (
                <Chip
                  key={v}
                  active={isSelectedMulti("sweetness", v)}
                  onClick={() => toggleMulti("sweetness", v)}
                >
                  {v}
                </Chip>
              ))}
            </Section>

            <Section title="비린맛">
              {PRESENCE.map((v) => (
                <Chip
                  key={v}
                  active={isSelectedMulti("fishy", v)}
                  onClick={() => toggleMulti("fishy", v)}
                >
                  {v}
                </Chip>
              ))}
            </Section>

            <Section title="인공감">
              {PRESENCE.map((v) => (
                <Chip
                  key={v}
                  active={isSelectedMulti("artificial", v)}
                  onClick={() => toggleMulti("artificial", v)}
                >
                  {v}
                </Chip>
              ))}
            </Section>

            <Section title="더부룩함">
              {PRESENCE.map((v) => (
                <Chip
                  key={v}
                  active={isSelectedMulti("bloating", v)}
                  onClick={() => toggleMulti("bloating", v)}
                >
                  {v}
                </Chip>
              ))}
            </Section>

            {/* ───────── divider 2 */}
            <Divider />

            {/* 🥤 섭취 */}
            <Section title="물">
              {RECO.map((v) => (
                <Chip
                  key={v}
                  active={isSelectedSingle("water", v)}
                  onClick={() => toggleSingle("water", v)}
                >
                  {v}
                </Chip>
              ))}
            </Section>

            <Section title="우유">
              {RECO.map((v) => (
                <Chip
                  key={v}
                  active={isSelectedSingle("milk", v)}
                  onClick={() => toggleSingle("milk", v)}
                >
                  {v}
                </Chip>
              ))}
            </Section>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- components ---------------- */

function Divider() {
  return (
    <div className="md:col-span-2 my-2">
      <div className="h-px w-full bg-neutral-200" />
    </div>
  );
}

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 text-[15px] font-semibold text-neutral-600">
        {title}
      </div>
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  iconUrl,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  iconUrl?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-medium ${
        active ? "bg-neutral-400 text-white" : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {iconUrl && (
        <img
          src={iconUrl}
          alt=""
          width={26}
          height={26}
          style={{ display: "block" }}
        />
      )}
      {children}
    </button>
  );
}
