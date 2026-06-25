import test from "node:test";
import assert from "node:assert/strict";
import { TomorrowRepository } from "../src/repositories/tomorrowRepository.js";

function createJwt(userId: number) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: userId })).toString("base64url");
  return `${header}.${payload}.`;
}

test("TomorrowRepository fetchSucceededProjectsViaGraphql maps succeeded projects", async () => {
  const jwt = createJwt(42);
  const repository = new TomorrowRepository(
    {
      baseUrl: "https://01.tomorrow-school.ai",
      username: "dmukhat",
      password: "secret",
      authEndpoint: "",
      referrer: "",
      xJwtToken: "undefined",
      sessionId: "",
      profilePath: "/intra/astanahub/profile?event=96"
    },
    async () =>
      new Response(
        JSON.stringify({
          data: {
            progress: [
              {
                path: "piscine/go-reloaded",
                object: { name: "go-reloaded", type: "project" }
              },
              {
                path: "piscine/ascii-art",
                object: { name: "ascii-art", type: "project" }
              }
            ],
            groups: [
              {
                path: "piscine/go-reloaded",
                captainLogin: "dmukhat",
                members: [{ userId: 42, accepted: true }],
                event: { path: "event/path" }
              }
            ]
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
  );

  const projects = await repository.fetchSucceededProjectsViaGraphql({
    session: { jwt, cookies: [] },
    username: "dmukhat"
  });

  assert.equal(projects.length, 2);
  assert.equal(projects[0].repoUrl, "https://01.tomorrow-school.ai/git/dmukhat/go-reloaded");
  assert.equal(projects[1].isSucceeded, true);
});
