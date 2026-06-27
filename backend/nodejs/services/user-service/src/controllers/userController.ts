import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "@backend/microservice-sdk";
import {
  validateExistsQuery,
  validateLookupQuery,
  validateProfileUpdateRequest,
  validateUserWriteRequest
} from "../validation/userValidation.js";

type UserControllerDependencies = {
  userService: {
    createUser(input: ReturnType<typeof validateUserWriteRequest>): Promise<unknown>;
    getUserByEmail(email: string): Promise<unknown>;
    getUserById(id: string): Promise<unknown>;
    getUserByUsername(username: string): Promise<unknown>;
    getPublicUserById(id: string): Promise<unknown>;
    updateUserForDevSeed(input: ReturnType<typeof validateUserWriteRequest>): Promise<unknown>;
    upsertExternalUser(input: ReturnType<typeof validateUserWriteRequest>): Promise<unknown>;
    updateProfile(id: string, input: ReturnType<typeof validateProfileUpdateRequest>): Promise<unknown>;
    exists(filters: ReturnType<typeof validateExistsQuery>): Promise<boolean>;
  };
};

export class UserController {
  private readonly userService: UserControllerDependencies["userService"];

  constructor({ userService }: UserControllerDependencies) {
    this.userService = userService;
  }

  async createUser(request: FastifyRequest, reply: FastifyReply) {
    return sendSuccess(reply, await this.userService.createUser(validateUserWriteRequest(request.body)), 201);
  }

  async getUserByEmail(request: FastifyRequest, reply: FastifyReply) {
    const { value } = validateLookupQuery(request.query, "email");
    return sendSuccess(reply, await this.userService.getUserByEmail(value));
  }

  async getUserById(request: FastifyRequest, reply: FastifyReply) {
    const { value } = validateLookupQuery(request.query, "id");
    return sendSuccess(reply, await this.userService.getUserById(value));
  }

  async getUserByUsername(request: FastifyRequest, reply: FastifyReply) {
    const { value } = validateLookupQuery(request.query, "username");
    return sendSuccess(reply, await this.userService.getUserByUsername(value));
  }

  async getPublicUserById(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id?: string };
    return sendSuccess(reply, await this.userService.getPublicUserById(String(params.id ?? "").trim()));
  }

  async updateUserForDevSeed(request: FastifyRequest, reply: FastifyReply) {
    return sendSuccess(reply, await this.userService.updateUserForDevSeed(validateUserWriteRequest(request.body)));
  }

  async upsertExternalUser(request: FastifyRequest, reply: FastifyReply) {
    return sendSuccess(reply, await this.userService.upsertExternalUser(validateUserWriteRequest(request.body)));
  }

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id?: string };
    return sendSuccess(
      reply,
      await this.userService.updateProfile(String(params.id ?? "").trim(), validateProfileUpdateRequest(request.body))
    );
  }

  async exists(request: FastifyRequest, reply: FastifyReply) {
    return sendSuccess(reply, { exists: await this.userService.exists(validateExistsQuery(request.query)) });
  }
}
