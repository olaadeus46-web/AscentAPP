import { requireAuth } from "../../../lib/auth";
import { addTricountExpense, deleteTricountExpense } from "../../../lib/db";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (!["POST", "DELETE"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (req.method === "DELETE") {
      const data = await deleteTricountExpense({
        userId: user.id,
        expenseId: req.body?.expenseId,
      });

      return res.status(200).json({ data });
    }

    const data = await addTricountExpense({
      userId: user.id,
      groupId: req.body?.groupId,
      description: req.body?.description,
      amount: req.body?.amount,
      currency: req.body?.currency,
      paidByUserId: req.body?.paidByUserId,
      splitMode: req.body?.splitMode,
      participantIds: req.body?.participantIds,
      percentageShares: req.body?.percentageShares,
      manualShares: req.body?.manualShares,
      expenseDate: req.body?.expenseDate,
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error("[shared/expense]", error);
    return res.status(400).json({ error: error.message || "Erro ao adicionar despesa." });
  }
}
