// Connectivity only: no API key, customer data, or paid model call is sent.
export async function checkAiNetwork(fetcher = fetch) {
  try {
    const response = await fetcher("https://api.openai.com/v1/models", {
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    // An unauthenticated 401 is expected and confirms the HTTPS connection works.
    if (response.status === 401 || response.ok) return { ok: true, status: response.status };
    return { ok: false, code: `HTTP_${response.status}`, message: "OpenAI is reachable but returned an unexpected response. Check the network before starting live chat." };
  } catch (error) {
    const code = error?.cause?.code ?? error?.code ?? error?.name ?? "UNKNOWN";
    return {
      ok: false,
      code,
      message: code === "EACCES" || code === "EPERM"
        ? "Windows denied this process permission to connect to OpenAI. Start from a normal PowerShell window or restore network permission for this task. Your API key was not tested or sent."
        : "Could not establish an HTTPS connection to OpenAI. Check the internet connection and network rules. Your API key was not tested or sent.",
    };
  }
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const result = await checkAiNetwork();
  console.log(result.ok ? `OpenAI network check passed (HTTP ${result.status}).` : `OpenAI network check failed (${result.code}).\n${result.message}`);
  if (!result.ok) process.exitCode = 1;
}
