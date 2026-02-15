type OllamaChatMsg = { role: "system" | "user" | "assistant"; content: string };

function extractFirstJsonObject(text: string) {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e === -1 || e <= s) throw new Error("No JSON object found");
  return text.slice(s, e + 1);
}

function stripCodeFences(s: string) {
  return s
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

// ✅ Ollama messages를 Gemini 프롬프트 텍스트로 안전하게 합치기
function joinMessages(messages: OllamaChatMsg[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const convo = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
    .join("\n\n");

  return (system ? `SYSTEM:\n${system}\n\n` : "") + convo;
}

async function geminiRawChat({
  messages,
  model,
}: {
  messages: OllamaChatMsg[];
  model: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to .env.local and Vercel Environment Variables."
    );
  }

  const promptText = joinMessages(messages);
  const modelId = model.replace(/^models\//, "");
const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;


  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        // ✅ 가능하면 JSON으로만 받게 강제
        response_mime_type: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 800)}`);
  }

  const data: any = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";

  return text as string;
}

export async function ollamaChatJSON<T>({
  messages,
  model = process.env.GEMINI_MODEL || "models/gemini-1.5-flash",
}: {
  messages: OllamaChatMsg[];
  model?: string;
}): Promise<T> {
  // 1차 시도
  const out1raw = await geminiRawChat({ messages, model });
  const out1 = stripCodeFences(out1raw);

  try {
    const json1 = extractFirstJsonObject(out1);
    return JSON.parse(json1) as T;
  } catch {
    // 2차: JSON 리페어 요청 (✅ 기존 너 로직 그대로)
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

    const out2raw = await geminiRawChat({ messages: repairMessages, model });
    const out2 = stripCodeFences(out2raw);

    const json2 = extractFirstJsonObject(out2);
    return JSON.parse(json2) as T;
  }
}
