"use client";

import { useState } from "react";
import FlavorCard from "@/components/FlavorCard";
import type { TasteKeyword } from "@/components/FlavorCard";

type Reco = "추천" | "비추천";
type ProteinType = "WPC" | "WPI";

type FlavorPick = {
  id: string;
  brand: string;
  product_name: string;
  flavor_name: string;
  summary_text: string;
  image_url: string | null;
  protein_type?: ProteinType | null;
  taste_keywords?: any[] | null;
  tags?: {
    sweetness?: string | null;
    fishy?: string | null;
    artificial?: string | null;
    bloating?: string | null;
    water?: Reco | null;
    milk?: Reco | null;
  };
};

type ChatMsg =
  | { role: "user"; type: "text"; text: string }
  | { role: "assistant"; type: "text"; text: string }
  | { role: "assistant"; type: "cards"; picks: FlavorPick[] };

function UpArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M12 19V6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M7.5 10.5L12 6l4.5 4.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DotWave() {
  return (
    <span className="inline-flex items-center gap-[4px]">
      <span className="h-[5px] w-[5px] rounded-full bg-white [animation:dotWaveBounce_900ms_infinite_ease-in-out]" />
      <span className="h-[5px] w-[5px] rounded-full bg-white [animation:dotWaveBounce_900ms_infinite_ease-in-out] [animation-delay:120ms]" />
      <span className="h-[5px] w-[5px] rounded-full bg-white [animation:dotWaveBounce_900ms_infinite_ease-in-out] [animation-delay:240ms]" />
    </span>
  );
}

export default function ProteinChatClient() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setLog((l) => [...l, { role: "user", type: "text", text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      setLoading(false);

      if (data?.type === "ok") {
        setLog((l) => [...l, { role: "assistant", type: "cards", picks: data.picks ?? [] }]);
        return;
      }

      setLog((l) => [
        ...l,
        { role: "assistant", type: "text", text: data?.message ?? "에러가 발생했어." },
      ]);
    } catch {
      setLoading(false);
      setLog((l) => [
        ...l,
        { role: "assistant", type: "text", text: "네트워크 에러가 발생했어." },
      ]);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">

      

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="mx-auto w-full max-w-6xl px-10 pt-6 pb-6 space-y-5">
            {log.map((m, idx) => {
              if (m.type === "text") {
                const isUser = m.role === "user";
                return (
                  <div key={idx} className={isUser ? "text-right" : "text-left"}>
                    <div
  className={`inline-block whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm font-sans ${
    isUser
      ? "bg-neutral-700 text-white"
      : "bg-neutral-100 text-neutral-700"
  }`}
>
  {m.text}
</div>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="rounded-2xl overflow-hidden border border-neutral-200 bg-white"
                >
                  {m.picks.map((f, i) => {
                    const proteinTag =
                      f.protein_type === "WPI" || f.protein_type === "WPC"
                        ? f.protein_type
                        : null;

                    const hydratedTasteKeywords: TasteKeyword[] =
                      (f.taste_keywords ?? []).map((k: any) => ({
                        id: String(k.id),
                        label: k.label ?? String(k.id),
                        icon_url: k.icon_url ?? null,
                      }));

                    const t = f.tags ?? {};
                    const tagLines = [
                      ...(proteinTag ? [proteinTag] : []),
                      t.sweetness ? `단맛 ${t.sweetness}` : null,
                      t.fishy ? `비린맛 ${t.fishy}` : null,
                      t.artificial ? `인공감 ${t.artificial}` : null,
                      t.bloating ? `더부룩함 ${t.bloating}` : null,
                      t.water === "추천"
                        ? "물 추천"
                        : t.water === "비추천"
                        ? "물 비추천"
                        : null,
                      t.milk === "추천"
                        ? "우유 추천"
                        : t.milk === "비추천"
                        ? "우유 비추천"
                        : null,
                    ].filter(Boolean) as string[];

                    return (
                      <FlavorCard
                        key={f.id}
                        title={`${f.brand} ${f.product_name} ${f.flavor_name}`}
                        summary={f.summary_text}
                        imageSrc={f.image_url}
                        tasteKeywords={hydratedTasteKeywords}
                        tags={tagLines}
                        showDivider={i !== m.picks.length - 1}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 입력창 (하단 고정) */}
      <div className="mx-auto w-full max-w-6xl px-10 pb-6">
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? send() : null)}
            placeholder="어떤 맛을 찾고 있나요? (예: 인공감 적은 딸기, 물에 타도 맛있는 초코)"
            className="h-12 w-full rounded-full border border-neutral-300 bg-white pl-5 pr-[60px] text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
          />

          <button
            type="button"
            onClick={send}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-700 text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? <DotWave /> : <UpArrowIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
