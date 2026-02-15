"use client";

import { useEffect, useState } from "react";
import ProteinChatClient from "@/components/ProteinChatClient";

export default function AIRecommendButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // ✅ 모달 열렸을 때 스크롤 잠금(필터 느낌 강화)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
  type="button"
  onClick={() => setOpen(true)}
  className="h-12 whitespace-nowrap rounded-full bg-neutral-700 px-5 text-sm
    text-white active:scale-[0.99]
    focus:outline-none focus:ring-2 focus:ring-neutral-200"
>
  AI 추천
</button>


      {open && (
        <>
          {/* ✅ 필터처럼: 딤 + 블러 */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* ✅ 모달 패널 */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            {/* ✅ panel 클릭이 overlay로 전파되면 닫히니까 stop */}
            <div
              className="relative flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
                <div className="flex flex-col">
                  <p className="text-base font-semibold text-neutral-900">AI 추천</p>
                  <p className="text-xs text-neutral-500">
                    등록된 리뷰 데이터를 바탕으로 조건에 맞는 제품을 추천해요.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  닫기
                </button>
              </div>

              {/* ✅ 내부 레이아웃/스크롤은 ProteinChatClient가 담당 */}
              <div className="flex-1 overflow-hidden">
                <ProteinChatClient />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
