# Evaluation evidence and costs

## Automated tests

At demo completion: **19 passing tests across 5 files**, plus successful production build.

- copilot-domain: draft/commit separation, blank drafts, input boundaries.
- dining: migration defaults, reviewed checkout, quantities/capacity, snapshots, transitions.
- dining-routes: isolated guest→reservation→chef→service→photo feedback; guest isolation, retries and menu edits.
- planner/mock-agent: regressions for the earlier experiment, not current dining policy.

Route tests mock the model and use isolated in-memory state. They do not modify the real kitchen.

`pnpm eval:copilot` uses scripted structured decisions, not an autonomous simulated cook. `pnpm eval` targets the earlier customer/planner experiment. A fully generative multi-agent simulation is not implemented.

## Live guest result

Recorded **2026-09-08T01:39:23.630Z** (September 7 Pacific), on the user-launched port 3011 server. Model: gpt-5.6-luna.

| Turn | Structural result | Input/output tokens | Seconds | Estimated USD |
| --- | --- | --- | --- | --- |
| Tired guest wants warm food | Lamb offering selected | 1220 / 150 | 3.118 | 0.0004240 |
| Same guest switches | Chicken offering selected | 1408 / 224 | 4.213 | 0.0005504 |
| Dairy allergy, remove milk request | Null selection, chef review | 1232 / 201 | 5.361 | 0.0004876 |
| Off-menu lobster + delivery | Null selection, chef review | 1219 / 243 | 2.919 | 0.0005354 |

Total **US$0.0019974 estimated** for four successful turns across three scenarios. The off-menu response also verbally suggested chicken; future qualitative evaluation should assess whether that is overly pushy despite returning no selection.

The local full output is outputs/dining-eval-report.json, intentionally ignored. This document retains only synthetic test evidence.

## Rerun deliberately

```powershell
$env:DINING_EVAL_URL='http://127.0.0.1:3011'
pnpm exec tsx scripts/run-dining-evals.ts --live
```

This makes paid calls if the server is in live mode, stores test sessions, and creates no orders. The default URL is port 3010. Without --live it only prints instructions. Transport errors currently stop execution before the final report is saved.

The harness checks selection and needsChef, not every safety/tone claim. Four passing turns are not an allergy-safety guarantee. Expand coverage for long conversations, changed constraints, injection, sold-out menus, quiet/talkative guests and false promises.

lib/cost.ts uses configured token rates. Historical settings were 0.20/1.20 USD per million input/output tokens; they are not a current pricing assertion. Cached input, failed calls, separate search fees and invoice reconciliation are not fully accounted for. Guest dining uses no search tool.
