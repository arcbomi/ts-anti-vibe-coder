export type GatewayRoute = {
  method?: string;
  path: string;
  upstreamBaseUrl: string;
  upstreamPath?: string;
  protected: boolean;
};
