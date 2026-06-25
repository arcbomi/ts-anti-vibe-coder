import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseProjectsFromProfileHtml } from "../src/utils/htmlProjectParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "dmukhat_profile.html");
const profileHtml = fs.readFileSync(fixturePath, "utf8");

test("parseProjectsFromProfileHtml extracts project cards", () => {
  const projects = parseProjectsFromProfileHtml({
    profileHtml,
    baseUrl: "https://01.tomorrow-school.ai",
    username: "dmukhat"
  });

  assert.equal(projects.length, 4);
  assert.deepEqual(
    projects.map((project) => project.slug),
    ["go-reloaded", "ascii-art", "graphql", "unlock-me"]
  );
  assert.equal(projects[0].auditText, "5 peer audits required");
  assert.equal(projects[1].repoUrl, "https://01.tomorrow-school.ai/git/dmukhat/ascii-art");
  assert.equal(projects[2].isSucceeded, false);
});
