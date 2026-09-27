const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const isProduction = process.env.NODE_ENV === "production";
if (!configuredApiUrl && isProduction) {
  throw new Error("NEXT_PUBLIC_API_URL must be configured before building the production frontend.");
}

const apiBaseUrl = (configuredApiUrl ?? "http://localhost:4000/api").replace(/\/$/, "");
if (isProduction) {
  let productionApiUrl: URL;
  try {
    productionApiUrl = new URL(apiBaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be an absolute HTTPS URL in production.");
  }
  if (productionApiUrl.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(productionApiUrl.hostname)) {
    throw new Error("NEXT_PUBLIC_API_URL must point to the deployed HTTPS API in production.");
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return payload as T;
}
