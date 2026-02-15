import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { ollamaChatJSON } from "@/lib/ollama";

type ProteinType = "WPC" | "WPI";
type Reco = "추천" | "비추천";

type WithEvidence<T> = {
  values?: T;
  evidence?: string | null;
};

type MaybeEvidence<T> = T | WithEvidence<T>;

type Extracted = {
  query?: string;
  mustAsk: string | null;
  filters: {
    protein_type?: MaybeEvidence<ProteinType[]>;
    sweetness?: MaybeEvidence<string[] | number>;
    fishy?: MaybeEvidence<string[]>;
    artificial?: MaybeEvidence<string[]>;
    bloating?: MaybeEvidence<string[]>;
    water?: MaybeEvidence<Reco>;
    milk?: MaybeEvidence<Reco>;
    taste?: MaybeEvidence<string[]>;
    "fishy/artificial/bloating"?: MaybeEvidence<string[]>;
    "water/milk"?: MaybeEvidence<Reco>;
  };
};

// ✅ LLM 추천은 id만
type Rec = {
  picks: { id: string }[];
  followup: string | null;
};

const SWEETNESS = ["약함", "약간 약함", "보통", "약간 강함", "강함"] as const;
const PRESENCE = ["없음", "거의 없음", "보통", "약간 있음", "있음"] as const;

type NormalizedFilters = {
  protein_type?: ProteinType[];
  sweetness?: string[];
  fishy?: string[];
  artificial?: string[];
  bloating?: string[];
  water?: Reco;
  milk?: Reco;
  taste?: string[];
};

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function safeSearch(q: string) {
  return q.replaceAll("%", "").replaceAll(",", " ").replaceAll("&", " ").trim();
}

function normEnum(v: string) {
  return v
    .trim()
    .replaceAll("거의없음", "거의 없음")
    .replaceAll("약간약함", "약간 약함")
    .replaceAll("약간강함", "약간 강함");
}

function clampEnumList(arr: unknown, allowed: readonly string[]): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const a = new Set(allowed);
  const cleaned = uniq(
    arr
      .filter((x) => typeof x === "string")
      .map((x) => normEnum(String(x)))
  ).filter((x) => a.has(x));
  return cleaned.length ? cleaned : undefined;
}

function clampProteinType(arr: unknown): ProteinType[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const cleaned = uniq(
    arr
      .filter((x) => typeof x === "string")
      .map((x) => String(x).trim().toUpperCase())
  ).filter((x) => x === "WPC" || x === "WPI") as ProteinType[];
  return cleaned.length ? cleaned : undefined;
}

// ✅ MaybeEvidence<T> → 실제 값만 꺼내기 (values/value/items/data까지 방어)
function unwrapValue<T>(v: MaybeEvidence<T> | undefined): T | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v as any;
  if (typeof v === "object" && v !== null) {
    const anyV = v as any;
    return (anyV.values ?? anyV.value ?? anyV.items ?? anyV.data) as T | undefined;
  }
  return undefined;
}

/* ---------------- 서버 룰(LLM보다 우선) ---------------- */

// ✅ "약한/강하지 않은/부담 없는/자극적이지 않은/세지 않은" => 낮음으로 통일
function wantsLowIntensity(text: string): boolean {
  return (
    /(없(음|어|어요|다)|안\s*나(요|다)?|거의\s*없)/.test(text) ||
    /(약하(다|고|면|네|지|긴)?|약한|약하게|약함|미약|약\s*한)/.test(text) ||
    /(강하(지)?\s*않|강하지\s*않|세(지)?\s*않|세지\s*않|진하(지)?\s*않|진하지\s*않)/.test(text) ||
    /(부담\s*없|부담\s*없는|자극(적)?\s*없|자극(적)?\s*않|자극적이지\s*않)/.test(text) ||
    /(덜|적(게|은)?|낮(게|은)?)/.test(text)
  );
}

// ✅ 어떤 특성(정규식)이 "언급"됐고, wantsLowIntensity면 => ["없음","거의 없음"]
function inferLowPresence(text: string, mentionedRe: RegExp): string[] | undefined {
  if (!mentionedRe.test(text)) return undefined;
  if (!wantsLowIntensity(text)) return undefined;
  return ["없음", "거의 없음"];
}

// ✅ sweetness 숫자(1~5) 매핑 (LLM이 5 같은 숫자를 줄 때 방어)
function mapSweetnessNumber(n: unknown): string[] | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  const x = Math.round(n);
  if (x <= 1) return ["약함"];
  if (x === 2) return ["약간 약함"];
  if (x === 3) return ["보통"];
  if (x === 4) return ["약간 강함"];
  if (x >= 5) return ["강함"];
  return undefined;
}

// “단맛 적은/덜/안달/덜 달게/단맛이 약한” -> sweetness 낮게
function inferLowSweetness(text: string): string[] | undefined {
  // 달 관련 활용형까지 넓게 인식
  const mentioned = /(단맛|당도|달[고지게아았]|달아서|달면|달지)/.test(text);
  if (!mentioned) return undefined;

  const wantsLow =
    /(안\s*달|덜\s*달|달지\s*않|달고\s*싶지\s*않)/.test(text) ||
    /(단맛|당도).*(약하|낮|적)/.test(text) ||
    /(약하|낮|적).*(단맛|당도)/.test(text) ||
    /(심하(지)?\s*않|강하(지)?\s*않|세(지)?\s*않).*(단맛|당도|달)/.test(text);

  if (!wantsLow) return undefined;
  return ["약함", "약간 약함"];
}

// “인공감 적은/덜/없/약한/강하지 않은” -> artificial 낮게
function inferLowArtificial(text: string): string[] | undefined {
  return inferLowPresence(text, /(인공|인공감|화학|합성|향이\s*인공)/);
}

// “더부룩함 적은/덜/없/약한/강하지 않은” -> bloating 낮게
function inferLowBloating(text: string): string[] | undefined {
  return inferLowPresence(text, /(더부룩|속\s*불편|소화|가스|배\s*아프|복부)/);
}

// “비린맛 적은/덜/없/약한/강하지 않은” -> fishy 낮게
function inferLowFishy(text: string): string[] | undefined {
  return inferLowPresence(text, /(비린|비린맛|비린내|역한|누린)/);
}

// “물에 타/우유에 타” -> water/milk 추천 강제 (✅ 강제 필터)
function inferWaterMilk(text: string): { water?: Reco; milk?: Reco } {
  const t = text.toLowerCase();

  const wantsWater =
    /물(에|로|로만|로\s*타|에\s*타|에만|만\s*타|만\s*먹)/.test(text) || t.includes("water");

  const wantsMilk =
    /우유(에|로|로만|로\s*타|에\s*타|에만|만\s*타|만\s*먹)/.test(text) || t.includes("milk");

  if (wantsWater && !wantsMilk) return { water: "추천", milk: undefined };
  if (wantsMilk && !wantsWater) return { milk: "추천", water: undefined };
  return {};
}

// ✅ protein_type은 유저가 실제로 말했을 때만
function inferProteinTypeFromText(text: string): ProteinType[] | undefined {
  if (/(wpi|아이솔|아이솔레이트|isolate)/i.test(text)) return ["WPI"];
  if (/(wpc|콘센|콘센트레이트|농축)/i.test(text)) return ["WPC"];
  return undefined;
}
function userMentionedProteinType(text: string) {
  return /(wpi|wpc|아이솔|아이솔레이트|isolate|콘센|콘센트레이트|농축)/i.test(text);
}

/* ---------------- taste: 유저 명시만 + 다중 OR + 말고/제외/빼고 지원 ---------------- */

function normalizeTasteText(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replaceAll("앤", "and")
    .replaceAll(/\s+/g, "")
    .replaceAll(/[^0-9a-z가-힣]/g, "");
}

// ✅ taste 파싱에서 제외할 단어(혼합 방식/섭취 방식)
const TASTE_STOP_TOKENS = ["우유", "물", "milk", "water", "밀크"];

// ✅ “초콜렛=chocolate만” 정책 + 일부 별칭 매핑(확장 금지)
const TASTE_ALIASES: Array<{ id: string; tokens: string[] }> = [
  { id: "white chocolate", tokens: ["화이트초콜렛", "화이트초콜릿", "화이트초코", "whitechocolate", "whitechoc"] },
  { id: "dark chocolate", tokens: ["다크초콜렛", "다크초콜릿", "다크초코", "darkchocolate", "darkchoc"] },
  { id: "chocolate", tokens: ["초콜렛", "초콜릿", "초콜", "초코", "chocolate", "choc"] },

  { id: "cookies and cream", tokens: ["쿠키앤크림", "쿠키and크림", "쿠키&크림", "쿠앤크", "cookiesandcream", "cookiesncream"] },
  { id: "strawberry", tokens: ["딸기", "스트로베리", "strawberry"] },
  { id: "vanilla", tokens: ["바닐라", "vanilla"] },
  { id: "banana", tokens: ["바나나", "banana"] },
  { id: "caramel", tokens: ["카라멜", "캬라멜", "caramel"] },
  { id: "mint", tokens: ["민트", "mint"] },
  { id: "coffee", tokens: ["커피", "coffee"] },
  { id: "milk tea", tokens: ["밀크티", "milktea"] },
  { id: "matcha", tokens: ["말차", "matcha"] },
  { id: "green tea", tokens: ["녹차", "그린티", "greentea", "green tea"] },
  { id: "mocha latte", tokens: ["모카", "모카라떼", "모카라테", "mocha", "mochalatte", "mocha latte"] },
  { id: "yogurt", tokens: ["요거트", "요구르트", "yogurt"] },
  { id: "blueberry", tokens: ["블루베리", "blueberry"] },
];

const NEG_WORDS = ["말고", "말곤", "말구", "제외", "제외하고", "빼고", "빼", "아닌", "싫", "말지"];

function findAllOccurrences(hay: string, needle: string): number[] {
  const res: number[] = [];
  if (!needle) return res;
  let idx = 0;
  while (true) {
    const i = hay.indexOf(needle, idx);
    if (i === -1) break;
    res.push(i);
    idx = i + Math.max(1, needle.length);
  }
  return res;
}

function isNegContextAround(textLower: string, start: number, end: number): boolean {
  const window = 10;
  const pre = textLower.slice(Math.max(0, start - window), start);
  const post = textLower.slice(end, Math.min(textLower.length, end + window));
  for (const w of NEG_WORDS) {
    if (pre.includes(w) || post.includes(w)) return true;
  }
  return false;
}

// ✅ "우유/물" 같은 섭취방식만 언급된 문장은 taste로 처리하지 않음
function onlyMixingMethodMentioned(raw: string) {
  const normU = normalizeTasteText(raw);
  if (!normU) return false;

  const stopNorm = new Set(TASTE_STOP_TOKENS.map(normalizeTasteText));
  const hasStop = Array.from(stopNorm).some((s) => s && normU.includes(s));
  if (!hasStop) return false;

  // 대표 맛 토큰이 하나라도 있으면 제외(= 섭취방식 + 맛 둘 다 말한 경우)
  const hasRealTasteHint = /(딸기|스트로베리|바닐라|초코|초콜|바나나|카라멜|민트|커피|말차|녹차|쿠키|요거트|블루베리)/.test(
    raw
  );
  return !hasRealTasteHint;
}

function parseTasteConstraints(
  userText: string,
  tkIdSet: Set<string>,
  tkList: { id: string; label: string }[]
): { mentioned: boolean; include: string[]; exclude: string[] } {
  const raw = userText ?? "";
  const lower = raw.toLowerCase();

  // ✅ 섭취방식만 언급되면 taste 파싱 OFF
  if (onlyMixingMethodMentioned(raw)) {
    return { mentioned: false, include: [], exclude: [] };
  }

  const stopNorm = new Set(TASTE_STOP_TOKENS.map(normalizeTasteText));

  const include: string[] = [];
  const exclude: string[] = [];
  let mentioned = false;

  // 1) alias 기반(우선)
  for (const a of TASTE_ALIASES) {
    if (!tkIdSet.has(a.id)) continue;

    for (const tok of a.tokens) {
      const tokLower = (tok ?? "").toLowerCase();
      if (!tokLower) continue;

      // ✅ stop token이면 taste로 치지 않음
      if (stopNorm.has(normalizeTasteText(tokLower))) continue;

      const hits = findAllOccurrences(lower, tokLower);
      if (!hits.length) continue;

      mentioned = true;

      for (const start of hits) {
        const end = start + tokLower.length;
        const neg = isNegContextAround(lower, start, end);
        if (neg) exclude.push(a.id);
        else include.push(a.id);
      }
    }
  }

  // 2) label 기반(정규화 비교 포함)
  const normU = normalizeTasteText(raw);
  const hits: Array<{ id: string; neg: boolean }> = [];

  for (const k of tkList) {
    const id = String(k.id ?? "").trim();
    const label = String(k.label ?? "").trim();
    if (!id || !label || !tkIdSet.has(id)) continue;

    const lNorm = normalizeTasteText(label);
    if (stopNorm.has(lNorm)) continue;

    // a) 원문 contains
    const labelLower = label.toLowerCase();
    const idx = lower.indexOf(labelLower);
    if (idx !== -1) {
      mentioned = true;
      hits.push({
        id,
        neg: isNegContextAround(lower, idx, idx + labelLower.length),
      });
      continue;
    }

    // b) 정규화 contains
    if (lNorm && normU.includes(lNorm)) {
      mentioned = true;
      hits.push({ id, neg: false });
    }
  }

  for (const h of hits) {
    if (h.neg) exclude.push(h.id);
    else include.push(h.id);
  }

  const inc = uniq(include).filter(Boolean);
  const exc = uniq(exclude).filter(Boolean);
  const excSet = new Set(exc);
  const incFinal = inc.filter((x) => !excSet.has(x));

  return { mentioned, include: incFinal, exclude: exc };
}

/* ---------------- q: 브랜드/제품 토큰만(LLM query 사용 금지) ---------------- */

function shouldUseSearchQuery(text: string) {
  return /(마이프로틴|myprotein|옵티멈|optimumnutrition|on\b|신타|bsn|syntha|컴뱃|combat|머슬팜|musclepharm|제품|브랜드)/i.test(
    text
  );
}

function extractBrandQuery(text: string): string | undefined {
  if (/(마이프로틴|myprotein)/i.test(text)) return "myprotein";
  if (/(신타|syntha-?6|syntha|bsn)/i.test(text)) return "syntha";
  if (/(옵티멈|optimumnutrition|\bon\b)/i.test(text)) return "optimum";
  if (/(컴뱃|combat|머슬팜|musclepharm)/i.test(text)) return "combat";
  return undefined;
}

/* ---------------- Extracted filters 보정 ---------------- */

function normalizeExtractedFilters(raw: any) {
  const f: any = raw && typeof raw === "object" ? { ...raw } : {};

  const fab = unwrapValue<string[] | undefined>(f["fishy/artificial/bloating"]);
  if (fab && !f.fishy && !f.artificial && !f.bloating) {
    f.fishy = fab;
    f.artificial = fab;
    f.bloating = fab;
  }

  if (typeof f.protein_type === "string") f.protein_type = [f.protein_type];

  // sweetness: 숫자면 그대로 두고(정규화에서 mapSweetnessNumber로 처리)
  return f;
}

/* ---------------- 추천 LLM 응답 래퍼 벗기기 ---------------- */

function unwrapLLMObject(x: any) {
  if (!x || typeof x !== "object") return x;

  if (x.result && typeof x.result === "object") return x.result;
  if (x.data && typeof x.data === "object") return x.data;
  if (x.output && typeof x.output === "object") return x.output;

  const maybeText = x.text ?? x.content ?? x.message;
  if (typeof maybeText === "string") {
    try {
      return JSON.parse(maybeText);
    } catch {}
  }

  return x;
}

/* ---------------- DB query ---------------- */

function jsonbContainFilter(id: string) {
  const safeId = String(id).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `[{"id":"${safeId}"}]`;
}

// ✅ or는 1번만 호출 (q OR taste). 나머지는 AND.
function applyFiltersAndOrGroups(qb: any, f: NormalizedFilters, q?: string) {
  if (f.protein_type?.length) qb = qb.in("protein_type", f.protein_type);

  if (f.sweetness?.length) qb = qb.in("sweetness", f.sweetness);
  if (f.fishy?.length) qb = qb.in("fishy", f.fishy);
  if (f.artificial?.length) qb = qb.in("artificial", f.artificial);
  if (f.bloating?.length) qb = qb.in("bloating", f.bloating);

  if (f.water) qb = qb.eq("water", f.water);
  if (f.milk) qb = qb.eq("milk", f.milk);

  const orParts: string[] = [];

  if (q) {
    const safeQ = safeSearch(q);
    if (safeQ) {
      orParts.push(
        `brand.ilike.%${safeQ}%,product_name.ilike.%${safeQ}%,flavor_name.ilike.%${safeQ}%`
      );
    }
  }

  if (f.taste?.length) {
    const ids = uniq(f.taste).filter(Boolean);
    if (ids.length) {
      const tasteOr = ids.map((id) => `taste_keywords.cs.${jsonbContainFilter(id)}`).join(",");
      orParts.push(tasteOr);
    }
  }

  if (orParts.length) qb = qb.or(orParts.join(","));

  return qb;
}

async function runCandidateQuery({
  q,
  filters,
  limit = 120,
}: {
  q?: string;
  filters: NormalizedFilters;
  limit?: number;
}) {
  let qb = supabase
    .from("flavor_search_view")
    .select(
      "id, brand, product_name, flavor_name, summary_text, sweetness, fishy, artificial, bloating, water, milk, image_url, protein_type, taste_keywords"
    )
    .limit(limit);

  qb = applyFiltersAndOrGroups(qb, filters, q);

  const { data, error } = await qb;
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

function extractTasteIdsFromItemTasteKeywords(taste_keywords: any): string[] {
  if (!Array.isArray(taste_keywords)) return [];
  const ids = taste_keywords
    .map((x) => (x && typeof x === "object" ? String(x.id ?? "").trim() : ""))
    .filter(Boolean);
  return uniq(ids);
}

function filterOutExcluded(list: any[], excludeIds: string[]) {
  if (!excludeIds?.length) return list;
  const exc = new Set(excludeIds.filter(Boolean));
  if (!exc.size) return list;

  return list.filter((item) => {
    const ids = extractTasteIdsFromItemTasteKeywords(item?.taste_keywords);
    for (const id of ids) {
      if (exc.has(id)) return false;
    }
    return true;
  });
}

/* ---------------- best_with 서버 고정 ---------------- */

function decideBestWith(
  forced: { water?: Reco; milk?: Reco },
  item: { water?: Reco | null; milk?: Reco | null } | null | undefined
): "물" | "우유" {
  if (forced.water === "추천" && forced.milk !== "추천") return "물";
  if (forced.milk === "추천" && forced.water !== "추천") return "우유";

  const w = item?.water ?? null;
  const m = item?.milk ?? null;
  if (m === "추천" && w !== "추천") return "우유";
  return "물";
}

/* ---------------- 추천 LLM 출력 검증 + 1회 재시도 + 서버 fallback ---------------- */

function isValidRec(x: any): x is Rec {
  if (!x || typeof x !== "object") return false;
  if (!Array.isArray(x.picks) || x.picks.length < 1) return false;
  for (const p of x.picks) {
    if (!p || typeof p !== "object") return false;
    if (typeof p.id !== "string" || !p.id.trim()) return false;
  }
  if (!(x.followup === null || typeof x.followup === "string")) return false;
  return true;
}

function makeFallbackRecIds(list: any[]): Rec {
  const top = list.slice(0, 3);
  return { picks: top.map((x) => ({ id: x.id })), followup: null };
}

async function recommendWithinCandidates(text: string, compact: any[]) {
  const r1raw = await ollamaChatJSON<any>({
    messages: [
      {
        role: "system",
        content:
          "너는 '후보 내 추천'만 하는 추천봇이야.\n" +
          "반드시 JSON 오브젝트만 출력해. 설명 문장/코드블록 금지.\n" +
          "아래 후보 리스트의 id 중에서만 1~3개 picks에 넣어.\n" +
          "후보 밖의 제품명 생성 금지.\n" +
          "키는 picks, followup만 허용.\n" +
          "picks의 각 원소는 id만 허용.\n" +
          '출력형식: {"picks":[{"id":"..."}],"followup":string|null}',
      },
      { role: "user", content: `사용자 질문:\n${text}\n\n후보:\n${JSON.stringify(compact)}` },
    ],
  });

  const r1 = unwrapLLMObject(r1raw);
  if (isValidRec(r1)) return { ok: true as const, rec: r1 as Rec };

  const allowedIds = compact.map((x) => x.id);
  const r2raw = await ollamaChatJSON<any>({
    messages: [
      {
        role: "system",
        content:
          "너는 포맷 검증을 통과해야 한다.\n" +
          "절대 다른 키를 출력하지 마라. (recommendations/product/reason/name/summary/why/best_with/status_code/valid/result 금지)\n" +
          "오직 picks, followup만 허용.\n" +
          "picks[*].id는 allowed_ids 중 하나여야 한다.\n" +
          '정확한 형식: {"picks":[{"id":"<allowed_ids 중 하나>"}],"followup":null}',
      },
      {
        role: "user",
        content:
          `사용자 질문:\n${text}\n\nallowed_ids:\n${JSON.stringify(allowedIds)}\n\n후보:\n${JSON.stringify(
            compact
          )}`,
      },
    ],
  });

  const r2 = unwrapLLMObject(r2raw);
  if (isValidRec(r2)) return { ok: true as const, rec: r2 as Rec };

  return { ok: false as const, raw: { r1raw, r2raw, r1, r2 } };
}

/* ---------------- main ---------------- */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;

    const userText: string =
      typeof body?.message === "string"
        ? body.message
        : Array.isArray(body?.messages)
        ? String(body.messages.at(-1)?.content ?? "")
        : "";

    const text = (userText ?? "").trim();
    if (!text) return NextResponse.json({ error: "Empty" }, { status: 400 });

    const { data: tks, error: tkErr } = await supabase
      .from("taste_keywords")
      .select("id,label,icon_url")
      .order("sort_order", { ascending: true });
    if (tkErr) throw new Error(tkErr.message);

    const tkList = (tks ?? []).map((k: any) => ({
      id: String(k.id ?? "").trim(),
      label: String(k.label ?? "").trim(),
      icon_url: k.icon_url ?? null,
    }));
    const tkIdSet = new Set(tkList.map((x) => x.id).filter(Boolean));
    const tkMap = new Map(tkList.map((t) => [t.id, t]));

    const extractedRaw0 = await ollamaChatJSON<Extracted>({
      messages: [
        {
          role: "system",
          content:
            "너는 프로틴 추천을 위한 '필터 추출기'야.\n" +
            "반드시 JSON 오브젝트만 출력해. 설명 문장/코드블록 금지.\n" +
            "유저가 말하지 않은 조건은 채우지 마라.\n" +
            "단맛/당도 관련 요청은 sweetness로만 추출하고 taste를 채우지 마라.\n" +
            "taste는 제공된 목록의 id만 사용.\n" +
            '출력형식: {"query":string|undefined,"mustAsk":string|null,"filters":{...}}',
        },
        {
          role: "user",
          content:
            `사용자 질문:\n${text}\n\n` +
            `taste keyword 목록(id/label):\n${JSON.stringify(
              tkList.map((x) => ({ id: x.id, label: x.label }))
            )}`,
        },
      ],
    });

    const extractedRaw = {
      ...extractedRaw0,
      filters: normalizeExtractedFilters((extractedRaw0 as any)?.filters),
    } as Extracted;

    console.log("\n===== [recommend] DEBUG START =====");
    console.log("[recommend] userText =", text);
    console.log("[recommend] extractedRaw =", extractedRaw);
    console.log("===== [recommend] DEBUG END (after extract) =====\n");

    if (extractedRaw.mustAsk) {
      return NextResponse.json({ type: "ask", message: extractedRaw.mustAsk });
    }

    const q = shouldUseSearchQuery(text) ? extractBrandQuery(text) : undefined;
    const f = extractedRaw.filters ?? ({} as any);

    const protein_type = userMentionedProteinType(text)
      ? inferProteinTypeFromText(text) ?? clampProteinType(unwrapValue(f.protein_type))
      : undefined;

    // sweetness: 서버룰(low) > LLM 숫자 매핑 > LLM enum 배열
    const sweetness =
      inferLowSweetness(text) ??
      mapSweetnessNumber(unwrapValue<number | undefined>(f.sweetness as any)) ??
      clampEnumList(unwrapValue(f.sweetness as any), SWEETNESS);

    const fishy = inferLowFishy(text) ?? clampEnumList(unwrapValue(f.fishy), PRESENCE);
    const artificial = inferLowArtificial(text) ?? clampEnumList(unwrapValue(f.artificial), PRESENCE);
    const bloating = inferLowBloating(text) ?? clampEnumList(unwrapValue(f.bloating), PRESENCE);

    const forcedWM = inferWaterMilk(text);
    const water = forcedWM.water;
    const milk = forcedWM.milk;

    const tasteParsed = parseTasteConstraints(text, tkIdSet, tkList);

    if (tasteParsed.mentioned && !tasteParsed.include.length && !tasteParsed.exclude.length) {
      return NextResponse.json({ type: "empty", message: "조건에 맞는 데이터가 아직 없어요." });
    }

    const taste = tasteParsed.include.length ? tasteParsed.include : undefined;
    const tasteExclude = tasteParsed.exclude;

    const filters: NormalizedFilters = {
      protein_type,
      sweetness,
      fishy,
      artificial,
      bloating,
      water,
      milk,
      taste,
    };

    console.log("\n===== [recommend] DEBUG (normalized filters) =====");
    console.log("[recommend] query =", q);
    console.log("[recommend] filters =", filters);
    console.log("[recommend] tasteExclude =", tasteExclude);
    console.log("===== [recommend] DEBUG END (normalized) =====\n");

    let list = await runCandidateQuery({ q, filters, limit: 200 });
    list = filterOutExcluded(list, tasteExclude);

    console.log("\n===== [recommend] DEBUG (candidates) =====");
    console.log("[recommend] candidates =", list.length);
    console.log("===== [recommend] DEBUG END (candidates) =====\n");

    if (!list.length) {
      return NextResponse.json({ type: "empty", message: "조건에 맞는 데이터가 아직 없어요." });
    }

    const compact = list.map((x) => ({
      id: x.id,
      title: `${x.brand} ${x.product_name} ${x.flavor_name}`,
      summary_text: x.summary_text,
      protein_type: x.protein_type ?? null,
      tags: {
        sweetness: x.sweetness,
        fishy: x.fishy,
        artificial: x.artificial,
        bloating: x.bloating,
        water: x.water,
        milk: x.milk,
      },
    }));

    const recTry = await recommendWithinCandidates(text, compact);

    console.log("\n===== [recommend] DEBUG (rec result) =====");
    console.log("[recommend] rec =", recTry.ok ? recTry.rec : recTry.raw);
    console.log("===== [recommend] DEBUG END (rec result) =====\n");

    const map = new Map(list.map((x) => [x.id, x]));
    const rec: Rec = recTry.ok ? recTry.rec : makeFallbackRecIds(list);

    const pickedItems = (rec.picks ?? [])
      .map((p) => {
        const item = map.get(p.id);
        if (!item) return null;

        const best_with = decideBestWith(forcedWM, item);

        const taste_keywords = Array.isArray(item.taste_keywords)
          ? item.taste_keywords.map((k: any) => {
              if (k?.id) {
                const hydrated = tkMap.get(String(k.id).trim());
                if (hydrated)
                  return {
                    ...k,
                    label: k.label ?? hydrated.label,
                    icon_url: k.icon_url ?? hydrated.icon_url,
                  };
              }
              return k;
            })
          : item.taste_keywords;

        return {
          ...item,
          title: `${item.brand} ${item.product_name} ${item.flavor_name}`,
          tags: {
            sweetness: item.sweetness,
            fishy: item.fishy,
            artificial: item.artificial,
            bloating: item.bloating,
            water: item.water,
            milk: item.milk,
          },
          taste_keywords,
          best_with,
        };
      })
      .filter(Boolean) as any[];

    if (!pickedItems.length) {
      return NextResponse.json({ type: "empty", message: "추천을 만들 수 없었어." });
    }

    return NextResponse.json({
      type: "ok",
      picks: pickedItems,
      followup: rec.followup ?? null,
      candidatesCount: list.length,
    });
  } catch (e: any) {
    console.error("[recommend] ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown" }, { status: 500 });
  }
}
