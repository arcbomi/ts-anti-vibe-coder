export type TomorrowServiceConfig = {
  baseUrl: string;
  username: string;
  password: string;
  authEndpoint: string;
  referrer: string;
  xJwtToken: string;
  sessionId: string;
  profilePath: string;
};

export type TomorrowAppConfig = {
  serviceName: string;
  port: number;
  tomorrow: TomorrowServiceConfig;
};

export type TomorrowSession = {
  jwt: string;
  cookies: string[];
};

export type TomorrowProject = {
  id: string;
  slug: string;
  name: string;
  repoUrl: string;
  status: string;
  auditText: string;
  isSucceeded: boolean;
};

export type DiscoverProjectsInput = {
  profilePath?: string;
  username?: string;
  password?: string;
  remoteToken?: string;
};

export type TomorrowRepositoryContract = {
  login(credentials: { username: string; password: string }): Promise<TomorrowSession>;
  fetchSucceededProjects(input: {
    session: TomorrowSession;
    username: string;
    profilePath?: string;
  }): Promise<TomorrowProject[]>;
};

export type GraphqlProgressRecord = {
  path?: string;
  object?: {
    name?: string;
    type?: string;
  };
};

export type GraphqlGroupRecord = {
  path?: string;
  captainLogin?: string;
  members?: Array<{
    userId?: number;
    accepted?: boolean | null;
  }>;
  event?: {
    path?: string;
  };
};

export type GraphqlPayload = {
  data?: {
    progress?: GraphqlProgressRecord[];
    groups?: GraphqlGroupRecord[];
  };
  errors?: Array<{
    message?: string;
  }>;
};
