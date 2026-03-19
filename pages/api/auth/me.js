import { getAuthUser } from "../../../lib/auth";
import { countUsers } from "../../../lib/db";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getAuthUser(req);
  return res.status(200).json({
    authenticated: Boolean(user),
    user,
    hasUsers: countUsers() > 0,
  });
}
