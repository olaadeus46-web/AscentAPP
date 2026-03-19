import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../../lib/auth";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function parseSuggestions(text) {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => ({
        title: (item?.title || "").toString().trim(),
        notes: (item?.notes || "").toString().trim(),
      }))
      .filter(item => item.title)
      .slice(0, 2);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const goal = req.body?.goal;
  if (!goal?.title || !goal?.target) {
    return res.status(400).json({ error: "Goal inválido" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada" });
  }

  try {
    const system = `És um coach de produtividade financeira. Responde sempre em português europeu e APENAS com JSON válido.`;
    const prompt = `
Gera 1 a 2 sugestões práticas para ajudar a atingir este objetivo.
Cada sugestão deve ser curta, acionável e caber no calendário como tarefa.

Objetivo:
- título: ${goal.title}
- categoria: ${goal.category || "Outro"}
- progresso: ${goal.current || 0}/${goal.target} ${goal.unit || ""}
- prazo: ${goal.deadline || "sem prazo"}
- notas: ${goal.notes || "sem notas"}

Formato obrigatório de resposta (JSON puro, sem markdown):
[
  { "title": "...", "notes": "..." },
  { "title": "...", "notes": "..." }
]
`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      ?.filter(part => part.type === "text")
      .map(part => part.text)
      .join("\n")
      .trim() || "";

    let suggestions = parseSuggestions(text);

    if (!suggestions.length) {
      const fallback = text
        .split("\n")
        .map(line => line.replace(/^[-*\d.\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 2)
        .map(line => ({ title: line.slice(0, 100), notes: "" }));
      suggestions = fallback;
    }

    if (!suggestions.length) {
      suggestions = [{ title: "Definir próximo passo concreto (30 min)", notes: "Bloqueia tempo no calendário e executa hoje." }];
    }

    return res.status(200).json({ suggestions: suggestions.slice(0, 2) });
  } catch (error) {
    console.error("[goal-suggestions]", error);
    return res.status(500).json({ error: "Erro ao gerar sugestões" });
  }
}
