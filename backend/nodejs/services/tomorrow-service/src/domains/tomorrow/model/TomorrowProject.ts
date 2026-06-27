export type TomorrowProject = {
  id?: string;
  name: string;
  slug: string;
  status: "succeeded" | "failed" | "in_progress" | "not_started" | string;
};
