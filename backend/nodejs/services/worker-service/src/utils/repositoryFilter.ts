const MAX_REPOSITORY_FILE_SIZE = 300 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".go",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".rb",
  ".java",
  ".kt",
  ".rs",
  ".php",
  ".cs",
  ".cpp",
  ".c",
  ".h",
  ".hpp",
  ".swift",
  ".sql",
  ".graphql",
  ".proto",
  ".yaml",
  ".yml",
  ".json",
  ".toml",
  ".md",
  ".txt",
  ".html",
  ".css",
  ".scss"
]);

const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "vendor", "dist", "build", "coverage", ".cache"]);

export class RepositoryFilter {
  constructor(private readonly maxFileSize = MAX_REPOSITORY_FILE_SIZE) {}

  shouldRead(path: string, size: number): boolean {
    const normalizedPath = path.replace(/^\/+/, "");
    if (!normalizedPath || this.isIgnoredPath(normalizedPath)) {
      return false;
    }

    if (size > 0 && size > this.maxFileSize) {
      return false;
    }

    return this.looksUsefulForAi(normalizedPath);
  }

  acceptContent(path: string, content: string): boolean {
    if (!this.shouldRead(path, Buffer.byteLength(content, "utf8"))) {
      return false;
    }

    if (Buffer.byteLength(content, "utf8") > this.maxFileSize) {
      return false;
    }

    return !this.looksBinary(content);
  }

  private isIgnoredPath(path: string): boolean {
    const baseName = path.split("/").at(-1) ?? "";
    if (path === ".env" || path.endsWith("/.env") || baseName === "id_rsa") {
      return true;
    }

    if (path.endsWith(".pem") || path.endsWith(".key")) {
      return true;
    }

    return path.split("/").some((part) => IGNORED_DIRECTORIES.has(part));
  }

  private looksUsefulForAi(path: string): boolean {
    const baseName = path.split("/").at(-1)?.toLowerCase() ?? "";
    if (baseName.startsWith(".") && baseName !== ".gitignore") {
      return false;
    }

    const extension = path.includes(".") ? `.${path.split(".").at(-1)?.toLowerCase()}` : "";
    return ALLOWED_EXTENSIONS.has(extension);
  }

  private looksBinary(content: string): boolean {
    return content.includes("\u0000");
  }
}
