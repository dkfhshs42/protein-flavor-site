import { supabase } from "./supabaseClient";

/* ---------- types ---------- */

export type TasteKeyword = {
  id: string;
  label: string;
  icon_url: string | null;
};

export type FlavorRow = {
  id: string;
  product_id: string;
  flavor_name: string;
  summary_text: string;

  sweetness: string;
  fishy: string;
  artificial: string;
  bloating: string;

  water: string;
  milk: string;

  brand: string;
  product_name: string;

  // view에서 coalesce(...) as image_url 로 내려오는 값
  image_url: string | null;

  // ✅ 추가: WPC/WPI
  protein_type: "WPC" | "WPI" | null;

  taste_keywords: TasteKeyword[];
};

export type Filters = {
  sweetness?: string[];
  fishy?: string[];
  artificial?: string[];
  bloating?: string[];
  taste?: string[];

  water?: "추천" | "비추천";
  milk?: "추천" | "비추천";

  // ✅ 추가
  protein_type?: ("WPC" | "WPI")[];
};

/* ---------- helpers ---------- */

function makeSafeQuery(q: string) {
  return q
    .replaceAll(",", " ")
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .replaceAll("&", " ")
    .trim();
}

function normalizeTasteKeywords(v: unknown): TasteKeyword[] {
  if (Array.isArray(v)) return v as TasteKeyword[];

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as TasteKeyword[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

// ✅ 공백/따옴표/백슬래시 등 JSON 문자열 안전 처리
function jsonbContainFilter(id: string) {
  const safeId = id.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `[{"id":"${safeId}"}]`;
}

/* ---------- query ---------- */

export async function fetchFlavors(params?: { query?: string; filters?: Filters }) {
  const q = params?.query?.trim();
  const f = params?.filters;

  let req = supabase
    .from("flavor_search_view")
    .select(
      "id, product_id, flavor_name, summary_text, sweetness, fishy, artificial, bloating, water, milk, brand, product_name, image_url, protein_type, taste_keywords"
    )
    .order("flavor_name", { ascending: true });

  // 🔍 검색 (부분 일치)
  if (q) {
    const safeQ = makeSafeQuery(q);
    if (safeQ) {
      req = req.or(
        `brand.ilike.%${safeQ}%,product_name.ilike.%${safeQ}%,flavor_name.ilike.%${safeQ}%`
      );
    }
  }

  // 🎛 다중 선택 -> IN
  if (f?.sweetness?.length) req = req.in("sweetness", f.sweetness);
  if (f?.fishy?.length) req = req.in("fishy", f.fishy);
  if (f?.artificial?.length) req = req.in("artificial", f.artificial);
  if (f?.bloating?.length) req = req.in("bloating", f.bloating);

  // ✅ WPC/WPI 타입 필터
  if (f?.protein_type?.length) req = req.in("protein_type", f.protein_type);

  // 🥤 물/우유 단일 선택
  if (f?.water) req = req.eq("water", f.water);
  if (f?.milk) req = req.eq("milk", f.milk);

  // ✅ 맛 키워드 필터 (다중 선택)
  // - or() 문자열에 @> 넣으면 공백/따옴표에서 파싱 깨짐
  // - 해결: filter()를 OR로 직접 체인
  if (f?.taste?.length) {
    const ids = Array.from(new Set(f.taste)).filter(Boolean);

    if (ids.length > 0) {
      // 첫 조건
      req = req.filter("taste_keywords", "cs", jsonbContainFilter(ids[0]));

      // 나머지는 OR로 연결
      for (let i = 1; i < ids.length; i++) {
        req = req.or(`taste_keywords.cs.${jsonbContainFilter(ids[i])}`);
      }
    }
  }

  const { data, error } = await req;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];

  return rows.map((r) => ({
    ...r,
    taste_keywords: normalizeTasteKeywords(
      r.taste_keywords ?? r.taste_keyword ?? r.keywords ?? r.taste
    ),
  })) as FlavorRow[];
}
