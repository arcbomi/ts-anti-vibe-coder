export type TomorrowProjectClient = {
  listSucceededProjects(input: {
    accessToken: string;
    tomorrowUserId: string;
  }): Promise<Array<{
    id?: string;
    name: string;
    slug: string;
    status: "succeeded";
  }>>;
};
