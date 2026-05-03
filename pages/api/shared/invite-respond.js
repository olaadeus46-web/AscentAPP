import { requireAuth } from "../../../lib/auth";
import { respondTricountInvite } from "../../../lib/db";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { inviteId, action } = req.body || {};

  try {
    const data = await respondTricountInvite({
      userId: user.id,
      inviteId,
      action,
    });
    return res.status(200).json({ data });
  } catch (error) {
    console.error("[shared/invite-respond]", error);
    return res.status(400).json({ error: error.message || "Erro ao responder convite." });
  }
}
