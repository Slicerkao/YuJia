# Continue 有家 from here

Snapshot: **2026-09-28**. This describes an implemented local prototype, not a production release. Source files are authoritative.

## Product intent

Sam is a home-cooking enthusiast growing a personal repertoire of 拿手菜 through exploration, cooking, sharing, and reflection. Chef Copilot adapts to freeform input and helps form an inspectable 料理草稿. A separate guest experience chooses from explicitly offered dishes. Real chef replies and guest feedback connect back to the original dish.

Preserve chef agency. Do not turn this into a cooking course, compulsory inventory workflow, general therapist, restaurant ERP, or autonomous recipe factory. AI must not impersonate Sam.

Read PRODUCT.md, AGENTS-AND-PIPELINES.md, DATA-MODEL.md, dining-demo.md, RUNBOOK.md, and EVALUATION.md before extending the flow.

## Active implementation

- `components/CopilotApp.tsx`: Today, resumable discussions, chat/photos, recipe drafts, My Kitchen, cooking records, feedback, usage.
- `components/GuestApp.tsx`: invitation framing, weekly menu, short food-selection chat, reservation, meal page, messages and photo feedback.
- `components/ChefTable.tsx`: weekly menu editing, short order sheets, personal replies, confirm/serve actions, guest-call stats.
- `lib/copilot-agent.ts` and `lib/dining-agent.ts`: direct OpenAI Responses calls with Zod structured outputs.
- `lib/copilot-store.ts`: one validated JSON workspace with a process-local write queue and temporary-file rename.

There is no autonomous multi-agent planner in the active demo. The installed `@openai/agents` package does not orchestrate these paths.

## Earlier experiment still present

`components/YoujiaApp.tsx`, `lib/openai-customer.ts`, `lib/mock-agent.ts`, `lib/planner.ts`, and `/api/customer-agent` belong to the earlier customer/planner experiment. It has its own intent schema, recipe scoring, and inventory-like capacity logic. Current `/visit` uses `/api/dining/guest`, not that planner. Do not assume the old planner's allergy filters protect the new flow.

## Implemented state

Both chef and guest agents support real API calls. Chef search happens only on explicit request; guest dining has no search tool. The model can propose drafts/recommendations but cannot commit recipes, publish menu changes, or accept orders autonomously.

The weekly demo dishes were explicitly selected by Sam: 白味噌茴香藤椒燉羊肉 and 青辣椒香煎雞腿. Publishing did not promote their recipe maturity. Prices, capacity, white-rice side, and pickup text began as labeled, editable demo assumptions.

The full loop is: chef recipe → weekly offering → guest reservation → chef confirmation → served meal → guest feedback → recipe-linked reflection. Replies from either the chef table or recipe feedback view reach the guest meal page.

Historical validation: production build and 19 tests passed. Four live guest turns passed on **2026-09-07 Pacific / September 8 UTC**, with estimated model cost **US$0.0019974**, using the configured gpt-5.6-luna model. This is historical evidence, not a claim the app is currently online.

## Fresh checkout: private kitchen is deliberately absent

Do not commit or copy private `.data`, conversations, orders, or photos into a public/shared repo. The default seed has example dishes such as 薑香蛤蜊絲瓜, 菜脯燒雞腿, and 番茄炒蛋; it does not contain Sam's two selected weekly recipes.

Current `initializeDining()` resolves those two exact names once and sets initialized=true even if missing. A clean checkout can therefore have an empty guest menu; adding those names afterward does not backfill automatically. This is a known reproducibility gap.

A sensible next task is an explicit, idempotent demo fixture/bootstrap or publish-from-any-recipe UI. It should preserve existing user records. Do not solve this by exporting Sam's private workspace. Do not run reset_demo on the existing kitchen: it replaces the workspace, including dining data.

## Known limitations / useful next work

1. Fresh-workspace setup and publishing arbitrary chef-selected recipes, instead of exact hard-coded names.
2. Chef authentication and role separation before public hosting. Tailscale is currently the perimeter.
3. Durable transactional storage, cross-process coordination, separate image storage, retention/export/deletion controls.
4. Structured persistent dietary constraints. The sticky needsChef flag is durable, but summary fidelity still depends on model output.
5. More realistic conversation evals: talkative/quiet guests, long contexts, changed restrictions, injection, sold-out menus, and false promises.
6. Cost accounting for cached tokens, failed calls, tool fees, current model rates, and budget limits.
7. Cross-device guest accounts, notifications, and stronger semantic duplicate-order handling.

These are proposed next steps, not a direction to implement everything automatically.

## Prompt for the next session

> Read docs/HANDOFF.md and docs/AGENTS-AND-PIPELINES.md, then inspect the linked source. Preserve the local kitchen and secrets. Distinguish the active Copilot/dining paths from the earlier planner experiment. Summarize the current runnable state and ask which feature or feedback we are iterating next. Do not reset data, change recipe maturity, or expose the local service publicly without the user's direction.
