# Local operation and troubleshooting

Create `.env.local` from `.env.example` in the checkout root. Never commit keys or prefix them NEXT_PUBLIC.

| Variable | Purpose |
| --- | --- |
| YOUJIA_COPILOT_MODE | Chef live/mock mode |
| YOUJIA_DINING_MODE | Guest override, otherwise inherits chef mode |
| OPENAI_COPILOT_MODEL | Chef override before OPENAI_MODEL |
| OPENAI_CUSTOMER_MODEL | Active guest override before OPENAI_MODEL |
| OPENAI_MODEL | Shared fallback model |
| OPENAI_INPUT_USD_PER_MILLION / OPENAI_OUTPUT_USD_PER_MILLION | Configured estimate rates |
| YOUJIA_AGENT_MODE | Earlier customer-agent experiment only |

## Windows without PowerShell script execution

From a normal terminal in the checkout:

```powershell
node scripts/check-ai-network.mjs
pnpm build
node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3011
```

If node is not on PATH, use the installed Node executable's full path. On the original machine it came from the bundled Codex runtime under the user's cache directory. No machine-specific credentials or runtime installation are part of this repo.

Keep the terminal and computer awake. The phone needs Tailscale connected and the computer's tailnet IP. Production next start serves the last build; source changes need rebuild/restart.

## Resolved September incident

The coding-session-launched process on 3010 served pages and stored chat history, but new chef and guest OpenAI calls failed. DNS worked; IPv4 and IPv6 connections to OpenAI:443 returned EACCES. The session policy rejected unrestricted launch requests.

A separate user PowerShell launch first failed because .ps1 execution was disabled. Invoking Node directly then passed the network check and started production on 3011. Four actual model turns succeeded afterward. This was not caused by recipe prompts or a dangling Tailscale session.

| Symptom | Meaning |
| --- | --- |
| App HTTP 200 | Web server reachable; does not prove AI works |
| Network probe HTTP 401 | Expected without authentication; HTTPS works, key not tested |
| EACCES on connect | Process/network permission failure before HTTP |
| PSSecurityException | PowerShell script did not execute |
| EADDRINUSE | Local port already occupied |
| Authenticated API 401/403 | Investigate key/project access |
| API 429 | Investigate quota/rate limits |
| Localhost works, phone fails | Check Tailscale, bind address, firewall and sleep |

Do not disable the firewall globally, rotate keys just for EACCES, or kill arbitrary Node processes. Identify the project server. Avoid simultaneous write-serving processes against the same .data file.

Keep local backups private. Never use reset_demo to troubleshoot the real kitchen.
