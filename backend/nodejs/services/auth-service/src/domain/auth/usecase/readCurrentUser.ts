import type { PublicUser } from "../../../shared/contracts/auth.js";
import type { JwtManager } from "../../../shared/security/jwt.js";

export async function readCurrentUser(
  token: string,
  dependencies: {
    tokenManager: JwtManager;
  }
) {
  const claims = dependencies.tokenManager.validate(token);

  const user: PublicUser = {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
    full_name: [claims.first_name, claims.last_name].filter(Boolean).join(" ") || claims.name,
    first_name: claims.first_name,
    last_name: claims.last_name
  };

  return user;
}
