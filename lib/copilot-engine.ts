import type { UsageStats } from "./domain";
import type {
  CopilotTurnDecision,
  CopilotTurnInput,
  CopilotWorkspace,
  DishProposalDraft,
  WebSource,
} from "./copilot-domain";

export function applyCopilotDecision(input: {
  workspace: CopilotWorkspace;
  turn: CopilotTurnInput;
  decision: CopilotTurnDecision;
  webSources?: Array<Omit<WebSource, "id" | "sessionId">>;
  stats: UsageStats;
  now?: string;
  createId?: () => string;
}) {
  const now = input.now ?? new Date().toISOString();
  const createId = input.createId ?? (() => crypto.randomUUID());
  const session = input.workspace.sessions.find((item) => item.id === input.turn.sessionId);
  if (!session) throw new Error("Brainstorm session not found");

  const captureId = `capture_${createId()}`;
  const capture = {
    id: captureId,
    sessionId: session.id,
    createdAt: now,
    text: input.turn.text.trim(),
    assets: input.turn.images.map((image) => ({
      id: `asset_${createId()}`,
      kind: "image" as const,
      name: image.name,
      mimeType: image.mimeType,
      url: "",
    })),
    kind: input.decision.captureKind,
    interpretation: input.decision.interpretation,
    confidence: input.decision.confidence,
  };

  let draft = session.draft;
  if (input.decision.draftUpdate) {
    const previous = session.draft;
    const claims = input.decision.draftUpdate.claims.map((claim) => {
      const existing = previous?.claims.find((item) => item.kind === claim.kind && item.text === claim.text);
      return {
        ...claim,
        id: existing?.id ?? `claim_${createId()}`,
        confirmation: existing?.confirmation ?? (claim.sourceType === "user_message" ? "confirmed" as const : "unreviewed" as const),
      };
    });
    draft = {
      id: previous?.id ?? `draft_${createId()}`,
      sessionId: session.id,
      status: "active",
      workingTitle: input.decision.draftUpdate.workingTitle,
      relationship: input.decision.draftUpdate.relationship,
      readiness: input.decision.draftUpdate.readiness,
      claims,
      revision: (previous?.revision ?? 0) + 1,
      updatedAt: now,
    } satisfies DishProposalDraft;
  }

  const webSources: WebSource[] = (input.webSources ?? []).map((source) => ({
    ...source,
    id: `source_${createId()}`,
    sessionId: session.id,
  }));
  const sessions = input.workspace.sessions.map((item) => item.id === session.id ? {
    ...item,
    title: input.decision.sessionTitle ?? item.title,
    teaser: input.decision.sessionTeaser || item.teaser,
    status: "active" as const,
    linkedDishId: input.decision.linkedDishId ?? item.linkedDishId,
    draft,
    updatedAt: now,
  } : item);

  const chefMessage = {
    id: `message_${createId()}`,
    sessionId: session.id,
    role: "chef" as const,
    text: input.turn.text.trim() || `傳了 ${input.turn.images.length} 張照片`,
    createdAt: now,
    captureId,
    photoCount: input.turn.images.length,
    webSources: [],
  };
  const copilotMessage = {
    id: `message_${createId()}`,
    sessionId: session.id,
    role: "copilot" as const,
    text: input.decision.reply,
    createdAt: now,
    captureId: null,
    photoCount: 0,
    webSources,
    stats: input.stats,
  };
  const workspace: CopilotWorkspace = {
    ...input.workspace,
    sessions,
    captures: [...input.workspace.captures, capture],
    messages: [...input.workspace.messages, chefMessage, copilotMessage],
    updatedAt: now,
  };
  const savedCapture = workspace.captures.find((item) => item.id === captureId)!;
  savedCapture.assets = savedCapture.assets.map((asset) => ({ ...asset, url: `/api/copilot/assets/${asset.id}` }));
  return { workspace, captureId };
}
