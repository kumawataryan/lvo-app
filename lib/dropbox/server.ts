import "server-only";

let cachedToken: { value: string; expiresAt: number } | null = null;

function envValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

type DropboxOAuthError = {
  error?: string;
  error_description?: string;
};

export async function getDropboxAccessToken() {
  const accessToken = envValue("DROPBOX_ACCESS_TOKEN");
  if (accessToken) return accessToken;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const appKey = envValue("DROPBOX_APP_KEY");
  const appSecret = envValue("DROPBOX_APP_SECRET");
  const refreshToken = envValue("DROPBOX_REFRESH_TOKEN");
  if (!appKey || !appSecret || !refreshToken) {
    throw new Error("Dropbox is not configured. Add DROPBOX_APP_KEY, DROPBOX_APP_SECRET, and DROPBOX_REFRESH_TOKEN.");
  }

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as DropboxOAuthError | null;
    const reason = result?.error_description || result?.error;
    throw new Error(`Dropbox authentication failed (${response.status})${reason ? `: ${reason}` : "."}`);
  }

  const result = await response.json() as { access_token: string; expires_in?: number };
  if (!result.access_token) throw new Error("Dropbox authentication succeeded without returning an access token.");
  cachedToken = { value: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 14_400) * 1000 };
  return result.access_token;
}

async function dropboxRpc<T>(endpoint: string, body: unknown): Promise<T> {
  const accessToken = await getDropboxAccessToken();
  const response = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Dropbox request failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<T>;
}

export function createDropboxUploadLink(path: string) {
  return dropboxRpc<{ link: string }>("files/get_temporary_upload_link", {
    commit_info: { path, mode: "add", autorename: false, mute: true, strict_conflict: true },
    duration: 14_400,
  });
}

export async function deleteDropboxFile(path: string) {
  await dropboxRpc("files/delete_v2", { path });
}

export function getDropboxTemporaryLink(path: string) {
  return dropboxRpc<{ link: string }>("files/get_temporary_link", { path });
}

export async function downloadDropboxFile(path: string) {
  const accessToken = await getDropboxAccessToken();
  return fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Dropbox-API-Arg": JSON.stringify({ path }) },
    cache: "no-store",
  });
}
