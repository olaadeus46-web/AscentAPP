import { requireAuth } from "../../../lib/auth";
import { createTricountInvite } from "../../../lib/db";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, groupName, baseCurrency } = req.body || {};

  try {
    const data = await createTricountInvite({
      ownerUserId: user.id,
      inviteeEmail: email,
      groupName,
      baseCurrency,
    });
    return res.status(200).json({ data });
  } catch (error) {
    console.error("[shared/invite]", error);
    return res.status(400).json({ error: error.message || "Erro ao criar convite." });
  }
}
