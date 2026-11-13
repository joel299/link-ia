export function getAppBaseUrl(requestUrl: string): URL {
  const url = new URL(process.env.APP_BASE_URL?.trim() || requestUrl);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw new Error("APP_BASE_URL precisa ser uma URL HTTP ou HTTPS válida.");
  }
  return new URL(url.origin);
}
