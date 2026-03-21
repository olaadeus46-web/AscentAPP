import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../../lib/auth";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

function extractBase64Parts(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function extractJsonPayload(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Resposta AI sem JSON válido.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeDate(dateValue, selectedMonth) {
  const raw = String(dateValue || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}[-/]\d{2}$/.test(raw) && /^\d{4}-\d{2}$/.test(selectedMonth || "")) {
    const [first, second] = raw.split(/[-/]/);
    const assumedDay = Number(first) > 12 ? first : second;
    return `${selectedMonth}-${String(assumedDay).padStart(2, "0")}`;
  }
  if (/^\d{2}\/\d{2}$/.test(raw) && /^\d{4}-\d{2}$/.test(selectedMonth || "")) {
    const [day, month] = raw.split("/");
    return `${selectedMonth.slice(0, 4)}-${month}-${day}`;
  }
  return "";
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada." });
  }

  const images = Array.isArray(req.body?.images) ? req.body.images.slice(0, 4) : [];
  const selectedMonth = String(req.body?.selectedMonth || "");
  const accountName = String(req.body?.accountName || "Conta bancária");
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];

  const parsedImages = images.map(extractBase64Parts).filter(Boolean);
  if (!parsedImages.length) {
    return res.status(400).json({ error: "Nenhuma imagem válida enviada." });
  }

  try {
    const prompt = `Lê o extrato bancário nas imagens e devolve APENAS JSON puro, sem markdown.

Formato obrigatório:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "texto curto",
      "amount": 123.45,
      "kind": "expense" | "income",
      "category": "nome da categoria",
      "notes": "opcional"
    }
  ]
}

Regras:
- Conta alvo: ${accountName}.
- Mês de contexto: ${selectedMonth || "não definido"}.
- Se o extrato mostrar débitos, usa kind "expense" e amount positivo.
- Se mostrar créditos/entradas, usa kind "income" e amount positivo.
- Mantém a data real quando existir. Se faltar o ano, assume o ano do mês de contexto.
- Categorias disponíveis como referência: ${categories.map((item) => `${item.name} (${item.kind})`).join(", ") || "sem categorias"}.
- Se nenhuma categoria existente servir, cria uma categoria curta e clara.
- Ignora saldos, cabeçalhos e linhas sem movimento real.
- Não inventes transações que não estejam visíveis.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1600,
      system: "És um extrator estruturado de movimentos bancários. Respondes sempre com JSON válido e nada mais.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...parsedImages.map((image) => ({
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: image.data,
              },
            })),
          ],
        },
      ],
    });

    const text = response.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
    const payload = extractJsonPayload(text);
    const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];

    const normalizedTransactions = transactions.map((item) => ({
      date: normalizeDate(item.date, selectedMonth),
      description: String(item.description || "").trim(),
      amount: Math.abs(Number(item.amount) || 0),
      kind: item.kind === "income" ? "income" : "expense",
      category: String(item.category || "").trim(),
      notes: String(item.notes || "").trim(),
    })).filter((item) => item.date && item.description && item.amount > 0);

    return res.status(200).json({ transactions: normalizedTransactions });
  } catch (error) {
    console.error("[statement-import]", error);
    return res.status(500).json({ error: "Não foi possível processar o extrato com AI." });
  }
}
