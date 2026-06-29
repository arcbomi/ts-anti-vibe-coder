import type { ExternalIdentity } from "./ExternalIdentity.js";

export type User = {
  id: string;
  email?: string;
  login?: string;
  username?: string;
  displayName?: string;
  externalIdentities: ExternalIdentity[];
  createdAt: string;
  updatedAt: string;
};
