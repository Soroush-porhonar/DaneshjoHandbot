const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL = process.env.OLLAMA_MODEL || "qwen3.5:9b";

interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export async function askAI(question: string): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "تو یک دستیار هوشمند تحصیلی هستی. به سؤالات دانشجویان دقیق، واضح و دوستانه پاسخ بده. در صورت امکان، به زبان خود دانشجو پاسخ بده.",
        },
        {
          role: "user",
          content: question,
        },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as OllamaResponse;

  if (!data.message?.content) {
    throw new Error("Ollama returned an empty response.");
  }

  return data.message.content;
}
