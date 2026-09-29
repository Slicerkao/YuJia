# 有家：從料理簿到餐桌

## Try the complete loop

Guest: `/visit` (also the home page). Chef: `/copilot/table`. The original Copilot remains at `/copilot`, with a new table shortcut on Today.

1. As chef, open 本週供應. The two recipes selected by Sam are initialized from the saved kitchen, without changing their maturity. Add a personal note and edit price, portions, sides, ingredient warnings, and pickup details. Publishing here is independent of saving a recipe.
2. As guest, browse or choose 幫我想想吃什麼. The AI uses only published, available recipe snapshots. It offers a meal after a short conversation. The existing server-side OpenAI key and Copilot mode are reused unless `YOUJIA_DINING_MODE` overrides them.
3. Select a meal, enter a name, portions, dietary restrictions (explicitly enter 無 if none), and an optional note. Submit a reservation request. Nothing is charged. Sam must confirm ingredients and timing.
4. In the chef table, read the compact request and reply personally. Confirm, then mark served when cooking is done. These actions are manual and also available during the demo to simulate the meal lifecycle.
5. The guest's 在有家吃過的 page updates on refresh or every 12 seconds. After service, leave feedback and an optional JPG/PNG/WebP image under 4 MB.
6. Feedback appears on the order and the original dish in Copilot. A reply from either place reaches the guest. Chef decides whether feedback warrants a recipe change.

## Data decisions

The existing version-2 JSON workspace gains a backward-compatible `dining` property. It is validated and written through a process-local queue and temporary-file rename; this is not a multi-process transactional database. Old workspaces are parsed with an empty dining layer; initialization resolves the two exact recipe names once. Missing recipes are never invented. A fresh checkout does not include Sam's private recipe records, so its menu can be empty; see [HANDOFF.md](HANDOFF.md) before testing.

- Offering: snapshot of the selected recipe, description, authored chef note, price, total capacity, pickup text, sides, ingredient warning, publication state, demo-value flag.
- Guest session: messages, the current recommendation, meal preference summary, review flag, and per-call token/cost/latency data. The assistant has no access to chef brainstorming conversations.
- Reservation: guest ID, idempotency key, quantity, restrictions, guest note, preference summary, and an immutable offering snapshot.
- Personal messages: explicit author `guest` or `chef`. AI output cannot create chef messages or advance an order.
- Service: a manual chef action creates a cook record and a shared meal linked to the original dish. It does not change dish maturity or consume inventory.
- Feedback: linked to that shared meal, with optional photo and chef reply. It remains a guest's statement, not an automatically accepted recipe update.

Pending, confirmed, and served reservations all count against a week's capacity. Declined reservations release their portions. The server rechecks availability on submission. Retries with the same request key return the original order. Updates to weekly prices, descriptions, or recipes do not alter prior reservations.

## Honest demo boundaries

- Single-owner local server with private Tailscale access. No chef authentication, public invitation enforcement, payment, delivery integration, email, or push notifications. Do not make this prototype publicly reachable without implementing role-based access.
- Guests are separated by an HTTP-only, same-site browser cookie. Use the same browser/device to return to a meal; cross-device customer login is not implemented.
- Initial prices (NT$320 and NT$260), eight portions each, rice side, and Saturday pickup text are editable demo assumptions. They remain labeled until Sam changes the demo setting. Food descriptions are based on saved recipe details; only the dedicated chef-note field is presented as authored by Sam.
- The dining-table image is generated atmosphere, not a photograph of Sam's dishes. No fabricated dish photos are shown.
- Allergy information is incomplete until chef review. All reservations require manual confirmation, and the assistant must not promise allergen removal or delivery.
- Conversations are saved locally to support the ongoing selection and evaluation. The UI makes no promise that chat is not stored. Feedback and photos are also stored locally. Production retention/export controls remain future work.
- The assistant does not search the web or invent dishes. Real OpenAI calls incur usage; estimates use configured token rates and are not a billing statement.

## Verify

`pnpm test` includes isolated tests of migration, quantities, capacity, immutable snapshots, status transitions, guest isolation, duplicate submission, and the guest→chef→feedback API loop. Those tests do not change the real kitchen.

With the local server running: `pnpm exec tsx scripts/run-dining-evals.ts --live`. This makes four paid calls across three scripted guest scenarios, persists the evaluation conversations (no orders), and writes `outputs/dining-eval-report.json`. It checks grounded recommendations, changing preferences, dairy allergy handling, and off-menu requests. It is a small regression sample, not proof of conversational quality or allergy safety.

Chef stats: `/copilot/table` → 試用紀錄與費用. This includes successful guest chat calls, including live evaluation calls.

## Start independently of the coding session

Install dependencies and build first. From a normal Windows PowerShell window in the project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-copilot.ps1 -Port 3011
```

This uses the existing server-side key and starts the production app on port 3011. The execution-policy override applies only to this process; do not change the machine-wide policy just to start the app. Phone guest URL: `http://<computer-tailscale-ip>:3011/visit`. Chef URL: `http://<computer-tailscale-ip>:3011/copilot/table`. Keep that window open. The computer and phone need Tailscale connected. Only one server process should write to the same workspace.

The historical production build and 19 automated tests passed. Initial live evaluation failed because the coding sandbox blocked Node's outgoing OpenAI connection (`EACCES`). After launching from the user's normal terminal, four live guest turns passed on 2026-09-07 Pacific / September 8 UTC, with an estimated total model cost of US$0.0019974 at the configured rates. See [EVALUATION.md](EVALUATION.md) for scope and caveats. This is historical evidence, not a claim that a server is currently online.
