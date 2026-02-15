type OllamaChatMsg = { role: "system" | "user" | "assistant"; content: string };

function extractFirstJsonObject(text: string) {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e === -1 || e <= s) throw new Error("No JSON object found");
  return text.slice(s, e + 1);
}

async function ollamaRawChat({
  messages,
  model,
}: {
  messages: OllamaChatMsg[];
  model: string;
}): Promise<string> {
  const base = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      // 모델/버전에 따라 무시될 수 있지만, 되면 JSON 강제에 도움
      format: "json",
      options: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama error ${res.status}: ${t.slice(0, 400)}`);
  }

  const data = await res.json();
  return (data?.message?.content ?? "") as string;
}

export async function ollamaChatJSON<T>({
  messages,
  model = process.env.OLLAMA_MODEL || "llama3:8b",
}: {
  messages: OllamaChatMsg[];
  model?: string;
}): Promise<T> {
  // 1차 시도
  const out1 = await ollamaRawChat({ messages, model });

  try {
    const json1 = extractFirstJsonObject(out1);
    return JSON.parse(json1) as T;
  } catch {
    // 2차: JSON 리페어 요청
    const repairMessages: OllamaChatMsg[] = [
      {
        role: "system",
        content:
          "너는 JSON 리페어 도구야. 반드시 JSON 오브젝트만 출력해. 설명/문장/코드블록 금지.",
      },
      {
        role: "user",
        content:
          "아래 출력은 JSON이 아니거나 깨졌어. 같은 의미로 VALID JSON 오브젝트만 다시 출력해.\n\n" +
          out1,
      },
    ];

    const out2 = await ollamaRawChat({ messages: repairMessages, model });
    const json2 = extractFirstJsonObject(out2);
    return JSON.parse(json2) as T;
  }
}
