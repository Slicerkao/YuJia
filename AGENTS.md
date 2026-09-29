# Project continuation

Read `docs/HANDOFF.md` first, then the relevant product, pipeline, schema, evaluation, and runbook documentation. Source code is authoritative if a snapshot differs.

- Preserve chef agency: AI drafts; the cook explicitly saves, sets maturity, publishes, and confirms orders.
- Keep the active `/copilot` and `/visit` flows distinct from the original V0 customer/planner experiment.
- Never commit `.env.local`, `.data`, uploaded photos, private conversations, logs, or raw evaluation transcripts.
- Do not reset the existing kitchen to make demos work. Fresh-checkout weekly menu initialization has a documented gap.
- This is a single-owner local prototype with no chef authentication. Do not expose it publicly without explicit authorization and access controls.
- Run `pnpm test` for affected logic and `pnpm build` for application changes. Live evaluations incur API costs and persist synthetic conversations; identify them clearly.
- Update handoff documentation when behavior changes. Do not claim tests or paid live calls ran unless verified.
