const DEFAULT_MAX_FILE_SIZE_BYTES = 204800;
const SKIPPED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".mp4",
  ".mov",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".db",
  ".sqlite",
  ".pdf",
  ".exe",
  ".dll",
  ".so"
]);
const SOURCE_EXTENSIONS = [".go", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml"];

export class FileFilter {
  maxFileSizeBytes: number;

  constructor(maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES) {
    this.maxFileSizeBytes = maxFileSizeBytes > 0 ? maxFileSizeBytes : DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  shouldReadPath(filePath: string) {
    const normalized = filePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized || normalized.endsWith("/")) {
      return false;
    }

    const name = normalized.split("/").at(-1)?.toLowerCase() ?? "";
    const lower = normalized.toLowerCase();
    if (
      name === ".env" ||
      name.startsWith(".env.") ||
      name === "id_rsa" ||
      name === "id_ed25519" ||
      name.startsWith("secrets.") ||
      name.endsWith(".secret")
    ) {
      return false;
    }

    const ignoredDirectories = new Set([
      ".git",
      "node_modules",
      "vendor",
      "dist",
      "build",
      "coverage",
      ".cache",
      ".next",
      ".nuxt",
      "target",
      "bin",
      "obj",
      "tmp",
      "logs"
    ]);
    const segments = lower.split("/");
    for (const segment of segments.slice(0, -1)) {
      if (ignoredDirectories.has(segment)) {
        return false;
      }
    }

    const extension = lower.slice(lower.lastIndexOf("."));
    if (SKIPPED_EXTENSIONS.has(extension) || [".pem", ".key", ".p12", ".crt", ".der", ".log", ".lock"].some((item) => lower.endsWith(item))) {
      return false;
    }

    if (["readme.md", "go.mod", "package.json", "dockerfile", "docker-compose.yml"].includes(name)) {
      return true;
    }
    if (lower.startsWith("docs/") && lower.endsWith(".md")) {
      return true;
    }
    if ((lower.startsWith("cmd/") || lower.startsWith("internal/") || lower.startsWith("pkg/")) && lower.endsWith(".go")) {
      return true;
    }
    if (lower.startsWith("src/") && [".tsx", ".ts", ".jsx", ".js"].some((item) => lower.endsWith(item))) {
      return true;
    }
    if (["route", "handler", "service", "model", "store", "hook", "page"].some((item) => lower.includes(item))) {
      return SOURCE_EXTENSIONS.some((item) => lower.endsWith(item));
    }

    return SOURCE_EXTENSIONS.some((item) => lower.endsWith(item)) && !lower.includes("/testdata/");
  }

  shouldReadContent(content: Buffer) {
    if (content.length === 0) {
      return true;
    }
    if (content.length > this.maxFileSizeBytes) {
      return false;
    }

    return !content.subarray(0, Math.min(content.length, 8000)).includes(0);
  }
}
