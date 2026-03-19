import { requireAuth } from "../../lib/auth";
import { getUserData, saveUserData } from "../../lib/db";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    return res.status(200).json({ data: await getUserData(user.id) });
  }

  if (req.method === "PUT") {
    return res.status(200).json({ data: await saveUserData(user.id, req.body || {}) });
  }

  return res.status(405).json({ error: "Method not allowed" });
}