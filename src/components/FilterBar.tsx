"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

  // ✅ "열려있는 패널의 키" (버튼 회색 유지 기준)
  const [openKey, setOpenKey] = useState<PanelKey | null>(null);

  // ✅ hover 닫기 딜레이 (버튼 → 패널 이동 시 깜빡임 방지)
  const closeTimerRef = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const closePanel = () => {
    cancelClose();
    setOpen(false);
    setOpenKey(null);
  };

  const scheduleClose = (ms = 150) => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      closePanel();
    }, ms);
  };

  // ✅ hover/click한 필터 버튼 기준으로 패널을 띄울 좌표
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const router = useRouter();
  const sp = useSearchParams();

  // ✅ 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ✅ 패널이 화면 밖으로 나가면 자동 보정
  useLayoutEffect(() => {
    if (!open || !pos) return;
    const el = panelRef.current;
    if (!el) return;

    const margin = 12;
    const rect = el.getBoundingClientRect();

    let left = pos.left;
    let top = pos.top;

    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    top = Math.max(margin, top);

    if (left !== pos.left || top !== pos.top) setPos({ left, top });
  }, [open, pos, panelKey]);

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

  // ✅ 버튼 회색 유지 기준: "그 패널이 열려있는가?"
  const isFocused = (key: PanelKey) => openKey === key;

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

  // ✅ hover/click 시 오른쪽에 패널 오픈
  const openPanel = (k: PanelKey, e?: React.MouseEvent<HTMLElement>) => {
    cancelClose();
    setPanelKey(k);
    setOpenKey(k); // ✅ "이 패널이 열려있다"를 즉시 기록

    if (e?.currentTarget) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const margin = 12;

      setPos({
        left: r.right + margin,
        top: r.top,
      });
    } else {
      setPos({ left: Math.max(12, window.innerWidth / 2 - 260), top: 96 });
    }

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
        return "w-[min(450px,calc(100vw-2rem))]";
      case "water":
      case "milk":
        return "w-[min(200px,calc(100vw-2rem))]";
      case "product":
      case "type":
      default:
        return "w-[min(520px,calc(100vw-2rem))]";
    }
  }, [panelKey]);

  return (
    <>
      {/* ✅ 좌측 필터바 */}
      <aside className="w-[180px]">
        <div className="space-y-2">
          {/* 필터 설정 */}
          <button
            type="button"
            onClick={(e) => openPanel("all", e)}
            onMouseEnter={(e) => openPanel("all", e)}
            onMouseLeave={() => scheduleClose(150)}
            className={`flex h-11 w-full items-center justify-between rounded-2xl px-4 text-[14px] font-medium ${
              isPanelActive("all")
                ? "bg-neutral-200 text-neutral-700"
                : `text-neutral-700 ring-neutral-200 ${isFocused("all") ? "bg-neutral-200" : "bg-white hover:bg-neutral-200"}`
            }`}
          >
            <span>필터 설정{activeCount ? ` (${activeCount})` : ""}</span>
            <IconChevron />
          </button>

          <RowButton
            label="제품 설정"
            onClick={(e) => openPanel("product", e)}
            onMouseEnter={(e) => openPanel("product", e)}
            onMouseLeave={() => scheduleClose(150)}
            active={isPanelActive("product")}
            focused={isFocused("product")}
          />
          <RowButton
            label="종류"
            onClick={(e) => openPanel("type", e)}
            onMouseEnter={(e) => openPanel("type", e)}
            onMouseLeave={() => scheduleClose(150)}
            active={isPanelActive("type")}
            focused={isFocused("type")}
          />
          <RowButton
            label="맛 키워드"
            onClick={(e) => openPanel("taste", e)}
            onMouseEnter={(e) => openPanel("taste", e)}
            onMouseLeave={() => scheduleClose(150)}
            active={isPanelActive("taste")}
            focused={isFocused("taste")}
          />
          <RowButton
            label="단맛"
            onClick={(e) => openPanel("sweetness", e)}
            onMouseEnter={(e) => openPanel("sweetness", e)}
            onMouseLeave={() => scheduleClose(150)}
            active={isPanelActive("sweetness")}
            focused={isFocused("sweetness")}
          />
          <RowButton
            label="비린맛"
            onClick={(e) => openPanel("fishy", e)}
            onMouseEnter={(e) => openPanel("fishy", e)}
            onMouseLeave={() => scheduleClose(150)}
            active={isPanelActive("fishy")}
            focused={isFocused("fishy")}
          />
          <RowButton
            label="인공감"
            onClick={(e) => openPanel("artificial", e)}
            onMouseEnter={(e) => openPanel("artificial", e)}
            onMouseLeave={() => scheduleClose(150)}
            active={isPanelActive("artificial")}
            focused={isFocused("artificial")}
          />
          <RowButton
            label="더부룩함"
            onClick={(e) => openPanel("bloating", e)}
            onMouseEnter={(e) => openPanel("bloating", e)}
            onMouseLeave={() => scheduleClose(150)}
            active={isPanelActive("bloating")}
            focused={isFocused("bloating")}
          />
          <RowButton
            label="물"
            onClick={(e) => openPanel("water", e)}
            onMouseEnter={(e) => openPanel("water", e)}
            onMouseLeave={() => scheduleClose(150)}
            active={isPanelActive("water")}
            focused={isFocused("water")}
          />
          <RowButton
            label="우유"
            onClick={(e) => openPanel("milk", e)}
            onMouseEnter={(e) => openPanel("milk", e)}
            onMouseLeave={() => scheduleClose(150)}
            active={isPanelActive("milk")}
            focused={isFocused("milk")}
          />
        </div>
      </aside>

      {/* ✅ 선택 화면: 버튼 오른쪽에 위치 + hover 유지 */}
      {open && (
        <div
          ref={panelRef}
          onMouseEnter={cancelClose}
          onMouseLeave={() => scheduleClose(150)}
          style={pos ? { left: pos.left, top: pos.top } : undefined}
          className={[
            "fixed z-50 rounded-2xl bg-white px-4 py-3 shadow-2xl ring-1 ring-black/5",
            panelWidthClass,
            "max-h-[70vh] overflow-auto scrollbar-stable",
          ].join(" ")}
        >
          {panelKey === "all" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <Chip key={v} active={isSelectedMulti("bloating", v)} onClick={() => toggleMulti("bloating", v)}>
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
    return <div className="rounded-2xl bg-neutral-50 p-4 text-[14px] text-neutral-600">아직 구현 전이에요.</div>;
  }

  if (panelKey === "taste") {
    return (
      <div className="flex flex-wrap gap-3">
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
      </div>
    );
  }

  if (panelKey === "sweetness") {
    return (
      <div className="flex flex-wrap gap-3">
        {SWEETNESS.map((v) => (
          <Chip key={v} active={isSelectedMulti("sweetness", v)} onClick={() => toggleMulti("sweetness", v)}>
            {v}
          </Chip>
        ))}
      </div>
    );
  }

  if (panelKey === "fishy") {
    return (
      <div className="flex flex-wrap gap-3">
        {PRESENCE.map((v) => (
          <Chip key={v} active={isSelectedMulti("fishy", v)} onClick={() => toggleMulti("fishy", v)}>
            {v}
          </Chip>
        ))}
      </div>
    );
  }

  if (panelKey === "artificial") {
    return (
      <div className="flex flex-wrap gap-3">
        {PRESENCE.map((v) => (
          <Chip key={v} active={isSelectedMulti("artificial", v)} onClick={() => toggleMulti("artificial", v)}>
            {v}
          </Chip>
        ))}
      </div>
    );
  }

  if (panelKey === "bloating") {
    return (
      <div className="flex flex-wrap gap-3">
        {PRESENCE.map((v) => (
          <Chip key={v} active={isSelectedMulti("bloating", v)} onClick={() => toggleMulti("bloating", v)}>
            {v}
          </Chip>
        ))}
      </div>
    );
  }

  if (panelKey === "water") {
    return (
      <div className="flex flex-wrap gap-3">
        {RECO.map((v) => (
          <Chip key={v} active={isSelectedSingle("water", v)} onClick={() => toggleSingle("water", v)}>
            {v}
          </Chip>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {RECO.map((v) => (
        <Chip key={v} active={isSelectedSingle("milk", v)} onClick={() => toggleSingle("milk", v)}>
          {v}
        </Chip>
      ))}
    </div>
  );
}

/* ---------------- components ---------------- */

function RowButton({
  label,
  onClick,
  onMouseEnter,
  onMouseLeave,
  active = false,
  focused = false,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  focused?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`flex h-11 w-full items-center justify-between rounded-2xl px-4 text-[14px] font-medium ${
        active
          ? "bg-neutral-200 text-neutral-700"
          : `text-neutral-700 ring-neutral-200 ${focused ? "bg-neutral-200" : "bg-white hover:bg-neutral-200"}`
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
        active ? "bg-neutral-500 text-white" : "bg-neutral-200 text-neutral-600"
      }`}
    >
      {iconUrl && <img src={iconUrl} alt="" width={26} height={26} style={{ display: "block" }} />}
      {children}
    </button>
  );
}
