import { normalizeProjectSlug } from "./normalizeProjectSlug.js";

export function mapSucceededProject(input: {
  path?: string;
  object?: {
    name?: string;
    type?: string;
  } | null;
}) {
  if ((input.object?.type ?? "").trim().toLowerCase() !== "project") {
    return null;
  }

  const name = String(input.object?.name ?? "").trim();
  const slug = normalizeProjectSlug(name || input.path || "");
  if (!name || !slug) {
    return null;
  }

  return {
    id: slug,
    name,
    slug,
    status: "succeeded" as const
  };
}
