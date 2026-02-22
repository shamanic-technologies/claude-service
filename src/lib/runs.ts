interface CreateRunParams {
  clerkOrgId?: string;
  clerkUserId?: string;
  appId: string;
  serviceName: string;
  taskName: string;
  parentRunId?: string;
}

export async function createChildRun(
  params: CreateRunParams
): Promise<string | null> {
  const baseUrl = process.env.RUNS_SERVICE_URL;
  const apiKey = process.env.RUNS_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const res = await fetch(`${baseUrl}/v1/runs`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      console.warn(`[RUNS] Create run failed: ${res.status}`);
      return null;
    }
    const run = (await res.json()) as { id: string };
    return run.id;
  } catch (err) {
    console.warn("[RUNS] Create run error:", err);
    return null;
  }
}

export async function addCosts(
  runId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const baseUrl = process.env.RUNS_SERVICE_URL;
  const apiKey = process.env.RUNS_SERVICE_API_KEY;
  if (!baseUrl || !apiKey || !runId) return;

  try {
    await fetch(`${baseUrl}/v1/runs/${runId}/costs`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          { costName: "anthropic-input-tokens", quantity: inputTokens, status: "actual" },
          { costName: "anthropic-output-tokens", quantity: outputTokens, status: "actual" },
        ],
      }),
    });
  } catch (err) {
    console.warn("[RUNS] Add costs error:", err);
  }
}

export async function completeRun(
  runId: string,
  status: "completed" | "failed"
): Promise<void> {
  const baseUrl = process.env.RUNS_SERVICE_URL;
  const apiKey = process.env.RUNS_SERVICE_API_KEY;
  if (!baseUrl || !apiKey || !runId) return;

  try {
    await fetch(`${baseUrl}/v1/runs/${runId}`, {
      method: "PATCH",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    console.warn("[RUNS] Complete run error:", err);
  }
}
