import type { GetSucceededProjectReposInput } from "./getSucceededProjectRepos.input.js";
import type { GetSucceededProjectReposOutput } from "./getSucceededProjectRepos.output.js";
import { assertGetSucceededProjectReposAllowed } from "./getSucceededProjectRepos.policy.js";

export function createGetSucceededProjectRepos(deps: {
  tomorrowProjectClient: {
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
}) {
  return async function getSucceededProjectRepos(
    input: GetSucceededProjectReposInput
  ): Promise<GetSucceededProjectReposOutput> {
    assertGetSucceededProjectReposAllowed(input);

    const projects = await deps.tomorrowProjectClient.listSucceededProjects({
      accessToken: input.accessToken,
      tomorrowUserId: input.tomorrowUserId
    });

    return {
      repos: projects.map((project) => ({
        projectName: project.name,
        projectSlug: project.slug,
        tomorrowLogin: input.tomorrowLogin,
        expectedGiteaOwner: input.tomorrowLogin,
        expectedGiteaRepo: project.slug,
        status: "succeeded" as const
      }))
    };
  };
}
