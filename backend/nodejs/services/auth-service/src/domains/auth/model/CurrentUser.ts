export type CurrentUser = {
  id: string;
  login?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
};

export type HttpCurrentUser = {
  id: string;
  login?: string;
  email?: string;
  name: string;
  full_name?: string;
  avatar_url?: string;
};

export function toHttpCurrentUser(user: CurrentUser): HttpCurrentUser {
  return {
    id: user.id,
    login: user.login,
    email: user.email,
    name: user.displayName ?? user.login ?? user.email ?? user.id,
    full_name: user.displayName,
    avatar_url: user.avatarUrl
  };
}
