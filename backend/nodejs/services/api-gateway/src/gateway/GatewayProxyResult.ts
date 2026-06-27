export type GatewayProxyResult = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};
