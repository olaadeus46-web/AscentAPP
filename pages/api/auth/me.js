import { getAuthUser } from "../../../lib/auth";
import { countUsers } from "../../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await getAuthUser(req);
    const totalUsers = await countUsers();

    return res.status(200).json({
      authenticated: Boolean(user),
      user,
      hasUsers: totalUsers > 0,
    });
  } catch (error) {
    console.error("[auth/me]", error);
    if (error?.code === "42501") {
      return res.status(500).json({ error: "Permissões da base de dados inválidas para sessão." });
    }
    return res.status(500).json({ error: "Erro ao carregar sessão." });
  }
}
