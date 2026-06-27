export type HttpRequestOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  searchParams?: Record<string, string | number | boolean | undefined>;
};

export type HttpClient = {
  get<T>(path: string, options?: HttpRequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T>;
  delete<T>(path: string, options?: HttpRequestOptions): Promise<T>;
};
