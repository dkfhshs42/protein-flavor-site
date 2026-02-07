import Image from "next/image";

export type TasteKeyword = {
  id: string;
  label: string;
  icon_url: string | null;
};

type Props = {
  title: string;
  summary: string;
  tags: string[];
  imageSrc?: string | null;
  tasteKeywords?: TasteKeyword[];
  showDivider?: boolean; // ✅ 추가
};

export default function FlavorCard({
  title,
  summary,
  tags,
  imageSrc,
  tasteKeywords = [],
  showDivider = false,
}: Props) {
  return (
    <div className="w-full bg-white">
      {/* 카드 본문 */}
      <div className="px-10 py-8">
        <div className="flex gap-6">
          {/* 이미지 */}
          <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-2xl bg-white">
            {imageSrc ? (
              <Image src={imageSrc} alt={title} fill className="object-contain" />
            ) : (
              <div className="h-full w-full" />
            )}
          </div>

          {/* 텍스트 영역 */}
          <div className="min-w-0 flex-1">
            {/* 제목 */}
            <h3 className="truncate text-[22px] font-semibold text-neutral-700">
              {title}
            </h3>

            {/* 태그 */}
            <div className="mt-3 flex flex-wrap gap-2">
              {tasteKeywords.map((k) => (
                <span
                  key={k.id}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-[13px] font-medium text-neutral-500"
                >
                  {k.icon_url && (
                    <img
                      src={k.icon_url}
                      alt={k.label}
                      width={22}
                      height={22}
                      className="block"
                    />
                  )}
                  {k.label}
                </span>
              ))}

              {tags.map((t) => (
                <span
                  key={t}
                  className="whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-[13px] font-medium text-neutral-500"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* 본문 */}
            <p className="mt-3 text-[16px] font-regluar leading-7 text-neutral-600">
              {summary}
            </p>
          </div>
        </div>
      </div>

      {/* ✅ 카드 하단 구분선 */}
      {showDivider && (
        <div className="mx-10 h-px bg-neutral-200" />
      )}
    </div>
  );
}
