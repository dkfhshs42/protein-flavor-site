import FilterBar from "@/components/FilterBar";
import FlavorCard from "@/components/FlavorCard";
import { fetchFlavors } from "@/lib/flavors";
import type { Filters } from "@/lib/flavors";
import { fetchTasteKeywords } from "@/lib/tasteKeywords";

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
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q;

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
  };

  const [flavors, tasteKeywords] = await Promise.all([
    fetchFlavors({ query: q, filters }),
    fetchTasteKeywords(),
  ]);

  // ✅ id -> keyword (label/icon_url 포함) 맵
  const tkMap = new Map(tasteKeywords.map((k) => [k.id, k]));

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      {/* 상단 검색 / 필터 영역 */}
      <div className="mx-auto flex max-w-5xl items-center gap-4">
        {/* 검색 */}
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

          {/* 🔑 기존 필터 쿼리 유지 (taste 포함 자동) */}
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

        {/* ✅ 필터 버튼 (키워드 목록 전달) */}
        <FilterBar tasteKeywords={tasteKeywords} />
      </div>

      {/* 결과 수 */}
      <div className="mx-auto mt-6 max-w-5xl">
        <p className="text-[13px] text-neutral-600">
          총{" "}
          <span className="text-[13px] text-neutral-600">{flavors.length}</span>
          개 결과
        </p>
      </div>

      {/* 카드 리스트 */}
      <div className="mx-auto mt-6 flex max-w-5xl flex-col">
        {flavors.map((f, idx) => {
          // ✅ f.taste_keywords가 어떤 형태(id만/문자열/완전체)로 오든
          //    label/icon_url까지 채워서 FlavorCard로 전달
          const hydratedTasteKeywords = (f.taste_keywords ?? [])
            .map((k: any) => {
              // case 1) ["id1","id2"]
              if (typeof k === "string") return tkMap.get(k) ?? null;

              // case 2) [{id:"..."}] or {id,label,icon_url}
              if (k?.id) return tkMap.get(k.id) ?? k;

              return null;
            })
            .filter(Boolean);

          return (
            <FlavorCard
              key={f.id}
              title={`${f.brand} ${f.product_name} ${f.flavor_name}`}
              summary={f.summary_text}
              imageSrc={f.image_url}
              tasteKeywords={hydratedTasteKeywords}
              tags={[
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
              showDivider={idx !== flavors.length - 1} // ✅ 마지막 카드 제외
            />
          );
        })}

        {flavors.length === 0 && (
          <p className="text-center text-sm text-neutral-500 py-10">
            해당 조건에 맞는 맛이 아직 없어요.
            <br />
            필터를 조금 줄여보세요.
          </p>
        )}
      </div>
    </main>
  );
}
