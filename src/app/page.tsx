import FilterBar from "@/components/FilterBar";
import FlavorCard from "@/components/FlavorCard";
import { fetchFlavors } from "@/lib/flavors";
import type { Filters } from "@/lib/flavors";
import { fetchTasteKeywords } from "@/lib/tasteKeywords";
import AIRecommendButton from "@/components/AIRecommendButton";

type ProteinType = "WPC" | "WPI";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sweetness?: string | string[];
    fishy?: string | string[];
    artificial?: string | string[];
    bloating?: string | string[];
    water?: string;
    milk?: string;
    taste?: string | string[];
    protein_type?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q;

  const proteinTypeArrRaw = Array.isArray(sp.protein_type)
    ? sp.protein_type
    : sp.protein_type
    ? [sp.protein_type]
    : undefined;

  const proteinTypeArr = proteinTypeArrRaw?.filter(
    (v): v is ProteinType => v === "WPC" || v === "WPI"
  );

  const filters: Filters = {
    sweetness: Array.isArray(sp.sweetness)
      ? sp.sweetness
      : sp.sweetness
      ? [sp.sweetness]
      : undefined,

    fishy: Array.isArray(sp.fishy) ? sp.fishy : sp.fishy ? [sp.fishy] : undefined,

    artificial: Array.isArray(sp.artificial)
      ? sp.artificial
      : sp.artificial
      ? [sp.artificial]
      : undefined,

    bloating: Array.isArray(sp.bloating)
      ? sp.bloating
      : sp.bloating
      ? [sp.bloating]
      : undefined,

    taste: Array.isArray(sp.taste) ? sp.taste : sp.taste ? [sp.taste] : undefined,

    water: sp.water === "추천" || sp.water === "비추천" ? sp.water : undefined,
    milk: sp.milk === "추천" || sp.milk === "비추천" ? sp.milk : undefined,

    protein_type: proteinTypeArr?.length ? proteinTypeArr : undefined,
  };

  const [flavors, tasteKeywords] = await Promise.all([
    fetchFlavors({ query: q, filters }),
    fetchTasteKeywords(),
  ]);

  const tkMap = new Map(tasteKeywords.map((k) => [k.id, k]));

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      {/* ✅ 전체를 왼쪽으로 더 당기고 싶으면 max-w-7xl 유지 + center 정렬 제거 */}
      <div className="mx-60 w-full max-w-7xl">
        {/* ✅ 1행: (필터 컬럼 비우고) 오른쪽 컬럼에서 검색창 시작 */}
        <div className="grid grid-cols-[200px_1fr] items-center gap-10">
          <div /> {/* 왼쪽 필터 자리(상단은 비워서 정렬 맞춤) */}

          <div className="flex items-center gap-4">
            <form method="GET" className="flex w-full items-center gap-3">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="브랜드 · 맛 이름으로 검색 (예: 마이프로틴 초콜렛)"
                className="h-12 w-full rounded-full bg-white px-6 text-sm
                  border border-neutral-300
                  outline-none
                  focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              />

              {/* 🔑 기존 필터 쿼리 유지 */}
              {Object.entries(filters).flatMap(([k, v]) => {
                if (!v) return [];
                if (Array.isArray(v)) {
                  return v.map((val) => (
                    <input key={`${k}-${val}`} type="hidden" name={k} value={val} />
                  ));
                }
                return <input key={k} type="hidden" name={k} value={v} />;
              })}
            </form>

            <AIRecommendButton />
          </div>
        </div>

        {/* ✅ 2행: 왼쪽 필터 / 오른쪽 (총 결과 + 카드) */}
        <div className="mt-6 grid grid-cols-[200px_1fr] items-start gap-10">
          <div className="pt-1">
            <FilterBar tasteKeywords={tasteKeywords} />
          </div>

          <div>
            {/* ✅ 이 텍스트의 왼쪽 시작점 = 검색 input 시작점 */}
            <p className="text-[13px] text-neutral-600">
              총 <span className="text-[13px] text-neutral-600">{flavors.length}</span>개 결과
            </p>

            <div className="mt-6 flex flex-col">
              {flavors.map((f: any, idx) => {
                const hydratedTasteKeywords = (f.taste_keywords ?? [])
                  .map((k: any) => {
                    if (typeof k === "string") return tkMap.get(k) ?? null;
                    if (k?.id) return tkMap.get(k.id) ?? k;
                    return null;
                  })
                  .filter(Boolean);

                const proteinTag =
                  f.protein_type === "WPI" || f.protein_type === "WPC"
                    ? f.protein_type
                    : null;

                return (
                  <FlavorCard
                    key={f.id}
                    title={`${f.brand} ${f.product_name} ${f.flavor_name}`}
                    summary={f.summary_text}
                    imageSrc={f.image_url}
                    tasteKeywords={hydratedTasteKeywords}
                    tags={[
                      ...(proteinTag ? [proteinTag] : []),
                      `단맛 ${f.sweetness}`,
                      `비린맛 ${f.fishy}`,
                      `인공감 ${f.artificial}`,
                      `더부룩함 ${f.bloating}`,
                      f.water === "추천"
                        ? "물 추천"
                        : f.water === "비추천"
                        ? "물 비추천"
                        : "물 중립",
                      f.milk === "추천"
                        ? "우유 추천"
                        : f.milk === "비추천"
                        ? "우유 비추천"
                        : "우유 중립",
                    ]}
                    showDivider={idx !== flavors.length - 1}
                  />
                );
              })}

              {flavors.length === 0 && (
                <p className="py-10 text-center text-sm text-neutral-500">
                  해당 조건에 맞는 맛이 아직 없어요.
                  <br />
                  필터를 조금 줄여보세요.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
