import type { GetTomorrowUserInformationInput } from "./getTomorrowUserInformation.input.js";
import type { GetTomorrowUserInformationOutput } from "./getTomorrowUserInformation.output.js";

export function createGetTomorrowUserInformation(deps: {
  tomorrowClient: {
    getCurrentUser(input: { accessToken: string }): Promise<{
      id: string;
      login: string;
      email?: string;
      displayName?: string;
      avatarUrl?: string;
      campus?: string;
      profileUrl?: string;
    }>;
  };
}) {
  return async function getTomorrowUserInformation(
    input: GetTomorrowUserInformationInput
  ): Promise<GetTomorrowUserInformationOutput> {
    const user = await deps.tomorrowClient.getCurrentUser({
      accessToken: input.accessToken
    });

    return {
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        campus: user.campus,
        profileUrl: user.profileUrl
      }
    };
  };
}
