import { createUser, findUserByEmail, normalizeEmail } from "../../../lib/db";
import { hashPassword, sanitizeUser, setAuthCookie, signAuthToken } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (name.length < 2) {
    return res.status(400).json({ error: "O nome deve ter pelo menos 2 caracteres." });
  }

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Email inválido." });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "A password deve ter pelo menos 8 caracteres." });
  }

  if (await findUserByEmail(email)) {
    return res.status(409).json({ error: "Já existe uma conta com esse email." });
  }

  try {
    const passwordHash = await hashPassword(password);
    const user = createUser({ name, email, passwordHash });
    const token = signAuthToken(user);
    setAuthCookie(res, token);
    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("[auth/register]", error);
    return res.status(500).json({ error: "Erro ao criar utilizador." });
  }
}
