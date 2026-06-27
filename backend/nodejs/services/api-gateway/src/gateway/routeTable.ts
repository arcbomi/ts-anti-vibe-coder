import type { GatewayRoute } from "./GatewayRoute.js";

export function createGatewayRouteTable(config: {
  authServiceUrl: string;
  giteaReaderServiceUrl: string;
  questionServiceUrl: string;
  examServiceUrl: string;
}): GatewayRoute[] {
  return [
    {
      method: "POST",
      path: "/auth/login",
      upstreamBaseUrl: config.authServiceUrl,
      protected: false
    },
    {
      method: "POST",
      path: "/auth/logout",
      upstreamBaseUrl: config.authServiceUrl,
      protected: true
    },
    {
      method: "GET",
      path: "/auth/me",
      upstreamBaseUrl: config.authServiceUrl,
      protected: true
    },
    {
      method: "GET",
      path: "/succeeded-projects",
      upstreamBaseUrl: config.examServiceUrl,
      upstreamPath: "/succeeded-projects",
      protected: true
    },
    {
      method: "POST",
      path: "/succeeded-projects/:slug/prepare",
      upstreamBaseUrl: config.examServiceUrl,
      upstreamPath: "/succeeded-projects/:slug/prepare",
      protected: true
    },
    {
      method: "GET",
      path: "/repositories",
      upstreamBaseUrl: config.giteaReaderServiceUrl,
      protected: true
    },
    {
      method: "POST",
      path: "/repositories/sync-tomorrow",
      upstreamBaseUrl: config.giteaReaderServiceUrl,
      protected: true
    },
    {
      method: "POST",
      path: "/repositories",
      upstreamBaseUrl: config.giteaReaderServiceUrl,
      protected: true
    },
    {
      method: "POST",
      path: "/repositories/:id/check-bot-access",
      upstreamBaseUrl: config.giteaReaderServiceUrl,
      protected: true
    },
    {
      method: "POST",
      path: "/repositories/:id/start-analysis",
      upstreamBaseUrl: config.giteaReaderServiceUrl,
      protected: true
    },
    {
      method: "GET",
      path: "/repositories/:id",
      upstreamBaseUrl: config.giteaReaderServiceUrl,
      protected: true
    },
    {
      method: "GET",
      path: "/analysis-jobs/:id",
      upstreamBaseUrl: config.giteaReaderServiceUrl,
      protected: true
    },
    {
      method: "GET",
      path: "/analysis-jobs/:id/questions",
      upstreamBaseUrl: config.questionServiceUrl,
      upstreamPath: "/analysis-jobs/:id/questions",
      protected: true
    },
    {
      method: "POST",
      path: "/exams",
      upstreamBaseUrl: config.examServiceUrl,
      upstreamPath: "/exams",
      protected: true
    },
    {
      method: "GET",
      path: "/exams/:id",
      upstreamBaseUrl: config.examServiceUrl,
      upstreamPath: "/exams/:id",
      protected: true
    },
    {
      method: "POST",
      path: "/exams/:id/submit",
      upstreamBaseUrl: config.examServiceUrl,
      upstreamPath: "/exams/:id/submit",
      protected: true
    },
    {
      method: "GET",
      path: "/exams/:id/result",
      upstreamBaseUrl: config.examServiceUrl,
      upstreamPath: "/exams/:id/result",
      protected: true
    },
    {
      method: "GET",
      path: "/exams/:id/questions",
      upstreamBaseUrl: config.questionServiceUrl,
      upstreamPath: "/exams/:id/questions",
      protected: true
    }
  ];
}
