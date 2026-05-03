import { findUserByEmail, normalizeEmail } from "../../../lib/db";
import { sanitizeUser, setAuthCookie, signAuthToken, verifyPassword } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email e password são obrigatórios." });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = signAuthToken(user);
    setAuthCookie(res, token);
    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("[auth/login]", error);
    if (error?.code === "42501") {
      return res.status(500).json({ error: "Permissões da base de dados inválidas para autenticação." });
    }
    return res.status(500).json({ error: "Erro ao autenticar utilizador." });
  }
}
