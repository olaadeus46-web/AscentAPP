import { requireAuth } from "../../../lib/auth";
import { addTricountSettlement } from "../../../lib/db";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await addTricountSettlement({
      userId: user.id,
      groupId: req.body?.groupId,
      fromUserId: req.body?.fromUserId,
      toUserId: req.body?.toUserId,
      amount: req.body?.amount,
      currency: req.body?.currency,
      note: req.body?.note,
      settledAt: req.body?.settledAt,
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error("[shared/settlement]", error);
    return res.status(400).json({ error: error.message || "Erro ao registar liquidação." });
  }
}
