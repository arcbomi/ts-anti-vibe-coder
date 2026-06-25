import type {
  DiscoverProjectsInput,
  TomorrowProject,
  TomorrowRepositoryContract,
  TomorrowServiceConfig
} from "../types/tomorrow.js";

type TomorrowProjectDiscoveryServiceDependencies = {
  repository: TomorrowRepositoryContract;
  config: TomorrowServiceConfig;
};

export class TomorrowProjectDiscoveryService {
  repository: TomorrowRepositoryContract;
  config: TomorrowServiceConfig;

  constructor({ repository, config }: TomorrowProjectDiscoveryServiceDependencies) {
    this.repository = repository;
    this.config = config;
  }

  async discoverSucceededProjects(input: DiscoverProjectsInput = {}): Promise<TomorrowProject[]> {
    const username = input.username ?? this.config.username;
    const session = input.remoteToken
      ? {
          jwt: input.remoteToken,
          cookies: []
        }
      : await this.repository.login({
          username,
          password: input.password ?? this.config.password
        });

    return this.repository.fetchSucceededProjects({
      session,
      username,
      profilePath: input.profilePath ?? this.config.profilePath
    });
  }
}
