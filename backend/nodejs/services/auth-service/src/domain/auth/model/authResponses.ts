import type { AuthResponse, MeResponse, MessageResponse, PublicUser } from "../../../shared/contracts/auth.js";

export function buildAuthResponse(user: PublicUser, accessToken: string): AuthResponse {
  return {
    user,
    access_token: accessToken
  };
}

export function buildMeResponse(user: PublicUser): MeResponse {
  return { user };
}

export function buildLogoutResponse(): MessageResponse {
  return {
    message: "Logged out successfully"
  };
}
