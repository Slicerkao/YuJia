# Data model

Canonical schemas: `lib/copilot-domain.ts`, `lib/dining-domain.ts`. Zod validates inputs and persisted state. Workspace stays version 2, with a default empty dining property for older V2 workspaces.

| Artifact | Meaning / commitment |
| --- | --- |
| BrainstormSession | Resumable topic with optional linked dish and draft |
| Capture / CaptureAsset | Original text/photo input and tentative interpretation |
| CopilotMessage | Chef/assistant conversation, sources and usage |
| DishProposalDraft / DraftClaim | Temporary inference with provenance, confidence, review status |
| Dish | Explicitly saved recipe knowledge; chef owns maturity |
| CookRecord | Chef-reported cooking event/reflection |
| SharedMeal / TasterFeedback | Dish-linked sharing, feedback, personal reply |
| Offering | Published weekly recipe snapshot, price/capacity, sides, pickup and warnings |
| DiningSession | Guest messages, current recommendation, preference summary, needsChef, usage |
| DinnerOrder | Guest details and immutable offering snapshot, status, messages, feedback |

Claim sourceType values: user_message, copilot_inference, cook_record, guest_feedback, external_source. Confidence is confirmed/probable/uncertain; review is unreviewed/confirmed/corrected. These are provenance labels, not calibrated probabilities.

Recipe maturity: want_to_try, confident, signature. The assistant does not autonomously promote it.

## Order transitions

```text
requested → confirmed → served
    ↓           ↓
 declined    declined
```

Only chef actions advance status. Feedback requires served. Marking served adds a cook record and shared meal linked to the original dish without changing maturity or inventory.

Requested, confirmed, and served orders count against weekly capacity; declined orders release it. Submission rechecks capacity. Chef capacity edits cannot go below reservations. A requestKey deduplicates same-checkout retries; reopening checkout generates a new key.

Order meal is a deep copy of the offering: later price/recipe edits do not rewrite previous orders. Refreshing an offering from the latest dish is an explicit chef action.

## Persistence and identity

The JSON file at `.data/copilot-workspace.json` is updated through an in-process queue and temporary-file rename. This does not coordinate concurrent server processes; run one writer per workspace. It is not a multi-tenant database or event log.

Chef photos are separate files under `.data/copilot-uploads`. Guest feedback photos are currently data URLs in JSON, which will not scale well.

Guest continuity uses a 90-day HTTP-only SameSite=Lax cookie; guest routes filter by that cookie. There is no chef login, and Copilot/chef endpoints expose the private workspace to anyone who can access them. Keep the prototype on a private network.

Raw conversations are persisted locally. The app must not claim it does not collect/store chat. Guest summaries aim to preserve only meal-related preferences, but raw chat still requires future retention controls. OpenAI requests use store:false; that alone is not a complete privacy policy.
