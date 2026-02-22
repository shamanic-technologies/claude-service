export async function resolveAnthropicApiKey(params: {
  keySource: "app" | "byok";
  appId: string;
  orgId?: string;
}): Promise<string> {
  const { keySource, appId, orgId } = params;

  const baseUrl = process.env.KEY_SERVICE_URL;
  const apiKey = process.env.KEY_SERVICE_API_KEY;

  // Fallback to env var if key-service is not configured
  if (!baseUrl || !apiKey) {
    const envKey = process.env.ANTHROPIC_API_KEY;
    if (!envKey) throw new Error("No Anthropic API key available");
    return envKey;
  }

  if (keySource === "app") {
    const res = await fetch(
      `${baseUrl}/internal/app-keys/anthropic/decrypt?appId=${encodeURIComponent(appId)}`,
      { headers: { "x-api-key": apiKey } }
    );
    if (!res.ok) throw new Error(`App key lookup failed: ${res.status}`);
    const data = (await res.json()) as { key: string };
    return data.key;
  }

  // byok
  if (!orgId) throw new Error("orgId required for keySource=byok");
  const res = await fetch(
    `${baseUrl}/internal/keys/anthropic/decrypt?clerkOrgId=${encodeURIComponent(orgId)}`,
    { headers: { "x-api-key": apiKey } }
  );
  if (!res.ok) throw new Error(`BYOK key lookup failed: ${res.status}`);
  const data = (await res.json()) as { key: string };
  return data.key;
}

export async function registerAppKey(
  appId: string,
  anthropicKey: string
): Promise<void> {
  const baseUrl = process.env.KEY_SERVICE_URL;
  const apiKey = process.env.KEY_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) return;

  await fetch(`${baseUrl}/internal/app-keys`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      appId,
      provider: "anthropic",
      apiKey: anthropicKey,
    }),
  });
}
