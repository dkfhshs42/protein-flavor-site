import { supabase } from "./supabaseClient";

export type TasteKeywordRow = {
  id: string;
  label: string;
  icon_url: string | null;
  sort_order: number | null;
};

export async function fetchTasteKeywords() {
  const { data, error } = await supabase
    .from("taste_keywords")
    .select("id, label, icon_url, sort_order")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as TasteKeywordRow[];
}
