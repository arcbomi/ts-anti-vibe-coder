import assert from "node:assert/strict";
import test from "node:test";
import { matchGatewayRoute } from "./matchGatewayRoute.js";
import type { GatewayRoute } from "./GatewayRoute.js";

const routes: GatewayRoute[] = [
  {
    method: "POST",
    path: "/auth/login",
    upstreamBaseUrl: "http://auth-service.test",
    protected: false
  },
  {
    method: "GET",
    path: "/analysis-jobs/:id/questions",
    upstreamBaseUrl: "http://question-service.test",
    upstreamPath: "/api/v1/analysis-jobs/:id/questions",
    protected: true
  },
  {
    method: "GET",
    path: "/repositories/:id",
    upstreamBaseUrl: "http://gitea-service.test",
    protected: true
  }
];

test("matches a static route", () => {
  const matched = matchGatewayRoute({
    method: "POST",
    url: "/auth/login",
    routes
  });

  assert.deepEqual(matched, {
    params: {},
    route: routes[0],
    upstreamUrl: "http://auth-service.test/auth/login"
  });
});

test("matches a dynamic route param", () => {
  const matched = matchGatewayRoute({
    method: "GET",
    url: "/analysis-jobs/job-123/questions",
    routes
  });

  assert.deepEqual(matched, {
    params: { id: "job-123" },
    route: routes[1],
    upstreamUrl: "http://question-service.test/api/v1/analysis-jobs/job-123/questions"
  });
});

test("respects the HTTP method", () => {
  const matched = matchGatewayRoute({
    method: "GET",
    url: "/auth/login",
    routes
  });

  assert.equal(matched, null);
});

test("returns null for an unknown route", () => {
  const matched = matchGatewayRoute({
    method: "GET",
    url: "/unknown",
    routes
  });

  assert.equal(matched, null);
});

test("preserves the query string in the upstream URL", () => {
  const matched = matchGatewayRoute({
    method: "GET",
    url: "/repositories/repo-1?include=owner&include=stats",
    routes
  });

  assert.equal(matched?.upstreamUrl, "http://gitea-service.test/repositories/repo-1?include=owner&include=stats");
});
