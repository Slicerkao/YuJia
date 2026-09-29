import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { copilotWorkspaceSchema, type CopilotTurnInput, type CopilotWorkspace } from "./copilot-domain";
import { createSeedWorkspace } from "./copilot-seed";

const dataDirectory = path.join(process.cwd(), ".data");
const workspacePath = path.join(dataDirectory, "copilot-workspace.json");
const uploadsDirectory = path.join(dataDirectory, "copilot-uploads");
let updateQueue: Promise<void> = Promise.resolve();

async function readWorkspaceFile(): Promise<CopilotWorkspace> {
  try {
    const contents = await readFile(workspacePath, "utf8");
    const raw = JSON.parse(contents) as Record<string, unknown>;
    if (raw.version === 2) return copilotWorkspaceSchema.parse(raw);

    const migrated = migrateLegacyWorkspace(raw);
    await writeWorkspaceFile(migrated);
    return migrated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const seed = createSeedWorkspace();
    await writeWorkspaceFile(seed);
    return seed;
  }
}

function migrateLegacyWorkspace(raw: Record<string, unknown>): CopilotWorkspace {
  const now = new Date().toISOString();
  const seed = createSeedWorkspace(now);
  const legacyDishes = Array.isArray(raw.dishMemories) ? raw.dishMemories : [];
  const imported = legacyDishes.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.name !== "string" || seed.dishes.some((dish) => dish.name === item.name)) return [];
    return [{
      id: typeof item.id === "string" ? item.id : `dish_${crypto.randomUUID()}`,
      name: item.name,
      stage: item.maturity === "signature" ? "signature" as const : item.maturity === "reliable" ? "confident" as const : "want_to_try" as const,
      summary: typeof item.summary === "string" ? item.summary : "從上一版料理簿保留下來。",
      sensoryTarget: "",
      techniques: [],
      successfulPatterns: Array.isArray(item.successfulPatterns) ? item.successfulPatterns.filter((value): value is string => typeof value === "string") : [],
      openQuestions: Array.isArray(item.openQuestions) ? item.openQuestions.filter((value): value is string => typeof value === "string") : [],
      versionNotes: ["從舊版料理簿匯入"],
      timesCooked: typeof item.timesCooked === "number" ? item.timesCooked : 0,
      sharedCount: 0,
      updatedAt: now,
    }];
  });
  return copilotWorkspaceSchema.parse({ ...seed, dishes: [...seed.dishes, ...imported], updatedAt: now });
}

async function writeWorkspaceFile(workspace: CopilotWorkspace) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${workspacePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
  await rename(temporaryPath, workspacePath);
}

export async function getCopilotWorkspace() {
  return readWorkspaceFile();
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

export async function saveCopilotImages(
  workspace: CopilotWorkspace,
  captureId: string,
  images: CopilotTurnInput["images"],
) {
  if (images.length === 0) return;
  const capture = workspace.captures.find((item) => item.id === captureId);
  if (!capture || capture.assets.length !== images.length) throw new Error("Capture assets do not match image input");
  await mkdir(uploadsDirectory, { recursive: true });
  await Promise.all(images.map(async (image, index) => {
    const asset = capture.assets[index];
    const match = image.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
    if (!match || match[1] !== image.mimeType) throw new Error("Invalid image data URL");
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength > 5_000_000) throw new Error("Image is larger than 5 MB");
    await writeFile(path.join(uploadsDirectory, `${asset.id}.${extensionForMimeType(asset.mimeType)}`), bytes);
  }));
}

export async function getCopilotAsset(assetId: string) {
  if (!/^asset_[a-zA-Z0-9-]+$/.test(assetId)) return null;
  const workspace = await readWorkspaceFile();
  const asset = workspace.captures.flatMap((capture) => capture.assets).find((item) => item.id === assetId);
  if (!asset) return null;
  const bytes = await readFile(path.join(uploadsDirectory, `${asset.id}.${extensionForMimeType(asset.mimeType)}`));
  return { bytes, mimeType: asset.mimeType, name: asset.name };
}

export function updateCopilotWorkspace<T>(
  updater: (workspace: CopilotWorkspace) => Promise<{ workspace: CopilotWorkspace; value: T }> | { workspace: CopilotWorkspace; value: T },
): Promise<{ workspace: CopilotWorkspace; value: T }> {
  let resolveResult: (value: { workspace: CopilotWorkspace; value: T }) => void;
  let rejectResult: (reason?: unknown) => void;
  const result = new Promise<{ workspace: CopilotWorkspace; value: T }>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  updateQueue = updateQueue.then(async () => {
    try {
      const current = await readWorkspaceFile();
      const next = await updater(current);
      const parsed = copilotWorkspaceSchema.parse(next.workspace);
      await writeWorkspaceFile(parsed);
      resolveResult({ workspace: parsed, value: next.value });
    } catch (error) {
      rejectResult(error);
    }
  });

  return result;
}
