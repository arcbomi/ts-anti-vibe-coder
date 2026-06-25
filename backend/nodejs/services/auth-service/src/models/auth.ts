import type { AuthResponse, MessageResponse, MeResponse, PublicUser } from "../types/auth.js";

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
