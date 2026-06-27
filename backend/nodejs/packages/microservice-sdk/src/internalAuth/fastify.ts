import "fastify";

export type InternalAuthContext = {
  userId: string;
};

declare module "fastify" {
  interface FastifyRequest {
    auth?: InternalAuthContext;
  }
}
