import { requireAuth } from "../../../lib/auth";
import { getTricountOverview } from "../../../lib/db";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await getTricountOverview(user.id);
    return res.status(200).json({ data });
  } catch (error) {
    console.error("[shared/overview]", error);
    return res.status(500).json({ error: error.message || "Erro ao carregar dados partilhados." });
  }
}
