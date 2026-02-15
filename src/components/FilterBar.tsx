"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type PanelKey =
  | "all"
  | "product" // (미구현)
  | "type" // (미구현)
  | "taste"
  | "sweetness"
  | "fishy"
  | "artificial"
  | "bloating"
  | "water"
  | "milk";

export default function FilterBar({ tasteKeywords }: { tasteKeywords: TasteKeywordRow[] }) {
  const [open, setOpen] = useState(false);
  const [panelKey, setPanelKey] = useState<PanelKey>("all");
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

  // ✅ 각 버튼(패널)별 활성 여부
  const isPanelActive = (key: PanelKey) => {
    if (key === "taste") return sp.getAll("taste").length > 0;
    if (key === "sweetness") return sp.getAll("sweetness").length > 0;
    if (key === "fishy") return sp.getAll("fishy").length > 0;
    if (key === "artificial") return sp.getAll("artificial").length > 0;
    if (key === "bloating") return sp.getAll("bloating").length > 0;
    if (key === "water") return !!sp.get("water");
    if (key === "milk") return !!sp.get("milk");
    if (key === "all") return activeCount > 0;
    return false; // product / type (미구현)
  };

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

  const isSelectedMulti = (key: MultiKey, value: string) => sp.getAll(key).includes(value);
  const isSelectedSingle = (key: SingleKey, value: string) => sp.get(key) === value;

  const resetAll = () => {
    const next = new URLSearchParams(sp.toString());
    [...MULTI_KEYS, ...SINGLE_KEYS].forEach((k) => next.delete(k));
    router.push(`/?${next.toString()}`);
  };

  const openPanel = (k: PanelKey) => {
    setPanelKey(k);
    setOpen(true);
  };

  // ✅ 패널(선택 화면) 크기를 항목별로 조절
  const panelWidthClass = useMemo(() => {
    switch (panelKey) {
      case "taste":
      case "all":
        return "w-[min(860px,calc(100vw-2rem))]";
      case "sweetness":
      case "fishy":
      case "artificial":
      case "bloating":
        return "w-[min(560px,calc(100vw-2rem))]";
      case "water":
      case "milk":
        return "w-[min(420px,calc(100vw-2rem))]";
      case "product":
      case "type":
      default:
        return "w-[min(520px,calc(100vw-2rem))]";
    }
  }, [panelKey]);

  return (
    <>
      {/* ✅ 페이지 상단(카드 왼쪽)에 "고정" 배치: 스크롤 따라가지 않음 (fixed 제거) */}
      <aside className="w-[180px]">
        <div className="space-y-2">
          {/* 필터 설정 */}
          <button
            type="button"
            onClick={() => openPanel("all")}
            className={`flex h-11 w-full items-center justify-between rounded-2xl px-4 text-[14px] font-medium ring-1 transition ${
              isPanelActive("all")
                ? "bg-neutral-400 text-white ring-neutral-400"
                : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <span>필터 설정{activeCount ? ` (${activeCount})` : ""}</span>
            <IconChevron />
          </button>

          {/* 버튼들 (박스로 또 묶지 않음) */}
          <RowButton label="제품 설정" onClick={() => openPanel("product")} active={isPanelActive("product")} />
          <RowButton label="종류" onClick={() => openPanel("type")} active={isPanelActive("type")} />
          <RowButton label="맛 키워드" onClick={() => openPanel("taste")} active={isPanelActive("taste")} />
          <RowButton label="단맛" onClick={() => openPanel("sweetness")} active={isPanelActive("sweetness")} />
          <RowButton label="비린맛" onClick={() => openPanel("fishy")} active={isPanelActive("fishy")} />
          <RowButton label="인공감" onClick={() => openPanel("artificial")} active={isPanelActive("artificial")} />
          <RowButton label="더부룩함" onClick={() => openPanel("bloating")} active={isPanelActive("bloating")} />
          <RowButton label="물" onClick={() => openPanel("water")} active={isPanelActive("water")} />
          <RowButton label="우유" onClick={() => openPanel("milk")} active={isPanelActive("milk")} />
        </div>
      </aside>

      {/* 오픈 시 배경 */}
      {open && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" />}

      {/* ✅ 선택 화면: 항목별 자동 크기 + 최대 높이만 제한 */}
      {open && (
        <div
          ref={panelRef}
          className={[
            "fixed z-50 rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5",
            "left-1/2 top-24 -translate-x-1/2",
            panelWidthClass,
            "max-h-[70vh] overflow-auto scrollbar-stable",
          ].join(" ")}
        >
          {/* 상단 */}
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[16px] font-bold text-neutral-800">{panelTitle(panelKey)}</div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetAll}
                disabled={activeCount === 0}
                className="rounded-full bg-neutral-200 px-4 py-2 text-[12px] font-semibold text-neutral-700 disabled:opacity-50"
              >
                초기화
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-neutral-700 px-4 py-2 text-[12px] font-semibold text-white"
              >
                닫기
              </button>
            </div>
          </div>

          {/* 내용 */}
          {panelKey === "all" ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

              <Divider />

              <Section title="단맛">
                {SWEETNESS.map((v) => (
                  <Chip key={v} active={isSelectedMulti("sweetness", v)} onClick={() => toggleMulti("sweetness", v)}>
                    {v}
                  </Chip>
                ))}
              </Section>

              <Section title="비린맛">
                {PRESENCE.map((v) => (
                  <Chip key={v} active={isSelectedMulti("fishy", v)} onClick={() => toggleMulti("fishy", v)}>
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

              <Divider />

              <Section title="물">
                {RECO.map((v) => (
                  <Chip key={v} active={isSelectedSingle("water", v)} onClick={() => toggleSingle("water", v)}>
                    {v}
                  </Chip>
                ))}
              </Section>

              <Section title="우유">
                {RECO.map((v) => (
                  <Chip key={v} active={isSelectedSingle("milk", v)} onClick={() => toggleSingle("milk", v)}>
                    {v}
                  </Chip>
                ))}
              </Section>
            </div>
          ) : (
            <SinglePanel
              panelKey={panelKey}
              tasteKeywords={tasteKeywords}
              isSelectedMulti={isSelectedMulti}
              isSelectedSingle={isSelectedSingle}
              toggleMulti={toggleMulti}
              toggleSingle={toggleSingle}
            />
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- single panel renderer ---------------- */

function SinglePanel({
  panelKey,
  tasteKeywords,
  isSelectedMulti,
  isSelectedSingle,
  toggleMulti,
  toggleSingle,
}: {
  panelKey: PanelKey;
  tasteKeywords: TasteKeywordRow[];
  isSelectedMulti: (k: MultiKey, v: string) => boolean;
  isSelectedSingle: (k: SingleKey, v: string) => boolean;
  toggleMulti: (k: MultiKey, v: string) => void;
  toggleSingle: (k: SingleKey, v: string) => void;
}) {
  if (panelKey === "product" || panelKey === "type") {
    return <div className="rounded-2xl bg-neutral-50 p-5 text-[14px] text-neutral-600">아직 구현 전이에요.</div>;
  }

  if (panelKey === "taste") {
    return (
      <Section title="맛 키워드">
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
    );
  }

  if (panelKey === "sweetness") {
    return (
      <Section title="단맛">
        {SWEETNESS.map((v) => (
          <Chip key={v} active={isSelectedMulti("sweetness", v)} onClick={() => toggleMulti("sweetness", v)}>
            {v}
          </Chip>
        ))}
      </Section>
    );
  }

  if (panelKey === "fishy") {
    return (
      <Section title="비린맛">
        {PRESENCE.map((v) => (
          <Chip key={v} active={isSelectedMulti("fishy", v)} onClick={() => toggleMulti("fishy", v)}>
            {v}
          </Chip>
        ))}
      </Section>
    );
  }

  if (panelKey === "artificial") {
    return (
      <Section title="인공감">
        {PRESENCE.map((v) => (
          <Chip key={v} active={isSelectedMulti("artificial", v)} onClick={() => toggleMulti("artificial", v)}>
            {v}
          </Chip>
        ))}
      </Section>
    );
  }

  if (panelKey === "bloating") {
    return (
      <Section title="더부룩함">
        {PRESENCE.map((v) => (
          <Chip key={v} active={isSelectedMulti("bloating", v)} onClick={() => toggleMulti("bloating", v)}>
            {v}
          </Chip>
        ))}
      </Section>
    );
  }

  if (panelKey === "water") {
    return (
      <Section title="물">
        {RECO.map((v) => (
          <Chip key={v} active={isSelectedSingle("water", v)} onClick={() => toggleSingle("water", v)}>
            {v}
          </Chip>
        ))}
      </Section>
    );
  }

  // milk
  return (
    <Section title="우유">
      {RECO.map((v) => (
        <Chip key={v} active={isSelectedSingle("milk", v)} onClick={() => toggleSingle("milk", v)}>
          {v}
        </Chip>
      ))}
    </Section>
  );
}

function panelTitle(k: PanelKey) {
  switch (k) {
    case "all":
      return "필터 설정";
    case "product":
      return "제품 설정";
    case "type":
      return "종류";
    case "taste":
      return "맛 키워드";
    case "sweetness":
      return "단맛";
    case "fishy":
      return "비린맛";
    case "artificial":
      return "인공감";
    case "bloating":
      return "더부룩함";
    case "water":
      return "물";
    case "milk":
      return "우유";
  }
}

/* ---------------- components ---------------- */

function RowButton({
  label,
  onClick,
  active = false,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-full items-center justify-between rounded-2xl px-4 text-[14px] font-medium ring-1 transition
        ${
          active
            ? "bg-neutral-400 text-white ring-neutral-400"
            : "bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-50"
        }`}
    >
      <span>{label}</span>
      <IconChevron />
    </button>
  );
}

function IconChevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-neutral-400">
      <path
        fill="currentColor"
        d="M9.29 6.71a1 1 0 0 1 1.42 0l5 5a1 1 0 0 1 0 1.42l-5 5a1 1 0 1 1-1.42-1.42L13.59 12 9.29 7.71a1 1 0 0 1 0-1.42z"
      />
    </svg>
  );
}

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
      <div className="mb-2 text-[15px] font-semibold text-neutral-600">{title}</div>
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
        active ? "bg-neutral-700 text-white" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {iconUrl && <img src={iconUrl} alt="" width={26} height={26} style={{ display: "block" }} />}
      {children}
    </button>
  );
}
