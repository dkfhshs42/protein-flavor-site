"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TasteKeywordRow = {
  id: string;
  label: string;
  icon_url: string | null;
  sort_order: number | null;
};

type Chip = {
  key: string;
  value: string;
  label: string;
};

const MULTI_KEYS = ["taste", "sweetness", "fishy", "artificial", "bloating", "protein_type"] as const;
const SINGLE_KEYS = ["water", "milk"] as const;

const LABEL_MAP: Record<string, string> = {
  protein_type: "종류",
  taste: "맛 키워드",
  sweetness: "단맛",
  fishy: "비린맛",
  artificial: "인공감",
  bloating: "더부룩함",
  water: "물",
  milk: "우유",
};

export default function ActiveFilterChips({
  tasteKeywords,
}: {
  tasteKeywords: TasteKeywordRow[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const tasteLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasteKeywords) m.set(t.id, t.label);
    return m;
  }, [tasteKeywords]);

  const chips = useMemo<Chip[]>(() => {
    const out: Chip[] = [];

    // 멀티 필터
    for (const key of MULTI_KEYS) {
      const values = sp.getAll(key);
      for (const v of values) {
        const pretty =
          key === "taste" ? (tasteLabelMap.get(v) ?? v) : v;

        out.push({
          key,
          value: v,
          label: `${LABEL_MAP[key] ?? key}: ${pretty}`,
        });
      }
    }

    // 단일 필터
    for (const key of SINGLE_KEYS) {
      const v = sp.get(key);
      if (!v) continue;

      out.push({
        key,
        value: v,
        label: `${LABEL_MAP[key] ?? key}: ${v}`,
      });
    }

    return out;
  }, [sp, tasteLabelMap]);

  const removeChip = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());

    // 같은 key가 여러 개면: 해당 value만 제거하고 나머지는 유지
    const all = params.getAll(key);
    if (all.length > 1) {
      params.delete(key);
      for (const v of all) {
        if (v !== value) params.append(key, v);
      }
    } else {
      params.delete(key);
    }

    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    // 검색어(q)는 유지하고 필터만 제거
    const q = sp.get("q");
    const params = new URLSearchParams();
    if (q) params.set("q", q);

    router.replace(`?${params.toString()}`, { scroll: false });
  };

  if (chips.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((c, idx) => (
        <button
          key={`${c.key}-${c.value}-${idx}`}
          type="button"
          onClick={() => removeChip(c.key, c.value)}
          className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-sm text-neutral-800 hover:bg-neutral-200"
          title="클릭하면 제거"
        >
          <span>{c.label}</span>
          <span className="ml-1 text-neutral-500">×</span>
        </button>
      ))}

      <button
        type="button"
        onClick={clearFilters}
        className="ml-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        전체 해제
      </button>
    </div>
  );
}
