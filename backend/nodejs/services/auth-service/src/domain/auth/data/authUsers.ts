import type { UserServiceClient } from "../../../clients/userServiceClient.js";
import type { UserWriteRequest } from "../../../shared/contracts/auth.js";

export class AuthUsers {
  constructor(private readonly userService: UserServiceClient) {}

  upsertExternal(input: UserWriteRequest) {
    return this.userService.upsertExternalUser(input);
  }
}
