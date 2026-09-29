# 有家 · Sam's Kitchen

A local cooking prototype connecting a home cook's evolving recipes to meals shared with guests.

**New session? Start with [docs/HANDOFF.md](docs/HANDOFF.md).** It records the actual implementation, product decisions, known gaps, and continuation instructions.

| Surface | Route | Purpose |
| --- | --- | --- |
| Chef Copilot | `/copilot` | Freeform discussions, photos, explicit web search, inspectable 料理草稿, saved recipes |
| Guest 有家 | `/visit` or `/` | Browse or chat, reserve a meal, message the cook, leave photo feedback |
| Chef table | `/copilot/table` | Weekly offerings, compact order sheets, personal replies, service status, usage stats |

The current local weekly menu uses 白味噌茴香藤椒燉羊肉 and 青辣椒香煎雞腿. These saved recipe records live in the owner's private workspace, which is not included in Git. Read the fresh-checkout caveat in the handoff before testing the menu.

## Run

Use Node.js compatible with the pinned Next.js version and pnpm. Preserve the lockfile.

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env.local`. Add your own key for live mode; never commit it.

```dotenv
OPENAI_API_KEY=your_key_here
YOUJIA_COPILOT_MODE=openai
YOUJIA_DINING_MODE=openai
OPENAI_MODEL=gpt-5.6-luna
```

That is the historically tested model setting, not a guarantee of current model access or pricing. Mock mode is available without a key.

```sh
pnpm dev --hostname 0.0.0.0 --port 3011
# Or build and serve:
pnpm build
pnpm start --hostname 0.0.0.0 --port 3011
```

Open `http://localhost:3011/visit`. On a phone connected to the same Tailscale network, use `http://<computer-tailscale-ip>:3011/visit`. Keep the computer awake and server running. This is not a publicly deployed service.

## Verify

```sh
pnpm test
pnpm build
pnpm eval:copilot
```

For paid live guest checks against a running server, set `DINING_EVAL_URL=http://127.0.0.1:3011` and run:

```sh
pnpm exec tsx scripts/run-dining-evals.ts --live
```

## Boundaries

- Local data: `.data/copilot-workspace.json`; chef uploads: `.data/copilot-uploads/`.
- Single owner, no separate chef authentication, payment, delivery integration, public invitation enforcement, or cloud sync.
- All meal reservations await manual chef confirmation.
- One write-serving process per workspace; the JSON write queue is process-local.
- Model interprets; app preserves provenance; cook commits.

## Read next

- [Handoff and next-session entry point](docs/HANDOFF.md)
- [Product experience and decisions](docs/PRODUCT.md)
- [Exact prompts and execution pipelines](docs/AGENTS-AND-PIPELINES.md)
- [Data model](docs/DATA-MODEL.md)
- [Demo walkthrough](docs/dining-demo.md)
- [Runbook and troubleshooting](docs/RUNBOOK.md)
- [Evaluation evidence and cost limits](docs/EVALUATION.md)
