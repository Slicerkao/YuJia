"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./CopilotApp.module.css";
import type {
  BrainstormSession,
  CopilotMessage,
  CopilotTurnResult,
  CopilotWorkspace,
  Dish,
  DraftClaim,
  TasterFeedback,
} from "@/lib/copilot-domain";
import { createSeedWorkspace } from "@/lib/copilot-seed";

type View = "today" | "chat" | "kitchen";
type KitchenTab = "want_to_try" | "confident" | "shared";
type PhotoDraft = { name: string; mimeType: string; dataUrl: string };
type Modal = { kind: "dish"; dishId: string } | { kind: "cook"; dishId: string } | { kind: "feedback"; feedback: TasterFeedback } | { kind: "status" } | null;

const initialWorkspace = createSeedWorkspace("2026-08-29T09:00:00.000Z");
const claimLabels: Record<DraftClaim["kind"], string> = {
  sensory_target: "想留下的味道",
  ingredient: "食材與角色",
  technique: "做法方向",
  constraint: "這次要顧到",
  decision: "已經比較確定",
  open_question: "還沒確定",
};
const sourceTone: Record<DraftClaim["sourceType"], string> = {
  user_message: "你說的",
  copilot_inference: "Copilot 推測",
  cook_record: "料理記錄",
  guest_feedback: "客人回饋",
  external_source: "外部資料",
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatTime(value: string) {
  const match = value.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return "最近";
  return `${Number(match[1])}/${Number(match[2])} · ${match[3]}:${match[4]}`;
}

function statsText(message: CopilotMessage) {
  if (!message.stats) return "";
  const tokens = message.stats.inputTokens + message.stats.outputTokens;
  return `${tokens.toLocaleString()} tokens · $${message.stats.estimatedCostUsd.toFixed(4)} · ${(message.stats.latencyMs / 1000).toFixed(1)}s`;
}

function renderMessageText(text: string) {
  const withoutInlineCitations = text.replace(/\(\[[^\]]+\]\(https?:\/\/[^)]+\)\)/g, "");
  return withoutInlineCitations.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <span key={index}>{part}</span>,
  );
}

export default function CopilotApp() {
  const [workspace, setWorkspace] = useState<CopilotWorkspace>(initialWorkspace);
  const [view, setView] = useState<View>("today");
  const [activeSessionId, setActiveSessionId] = useState("session_loofah");
  const [kitchenTab, setKitchenTab] = useState<KitchenTab>("want_to_try");
  const [draftOpen, setDraftOpen] = useState(false);
  const [composer, setComposer] = useState("");
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [webSearchRequested, setWebSearchRequested] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState({ mode: "mock", model: "copilot-rules-v2" });
  const [modal, setModal] = useState<Modal>(null);
  const [cookReflection, setCookReflection] = useState("");
  const [cookChanges, setCookChanges] = useState("");
  const [cookPhotos, setCookPhotos] = useState<PhotoDraft[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cookFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/copilot/state", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "讀取失敗");
        setWorkspace(data.workspace);
        setAgentInfo({ mode: data.mode, model: data.model });
      })
      .catch(() => setError("目前讀不到本機料理資料，先顯示示範內容。"))
      .finally(() => setLoading(false));
  }, []);

  const visibleSessions = useMemo(
    () => workspace.sessions.filter((session) => session.status !== "discarded" && session.status !== "archived").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [workspace.sessions],
  );
  const activeSession = workspace.sessions.find((session) => session.id === activeSessionId) ?? visibleSessions[0] ?? null;
  const messages = activeSession ? workspace.messages.filter((message) => message.sessionId === activeSession.id) : [];
  const activeDish = activeSession?.linkedDishId ? workspace.dishes.find((dish) => dish.id === activeSession.linkedDishId) ?? null : null;
  const unreviewedClaims = activeSession?.draft?.claims.filter((claim) => claim.confirmation === "unreviewed").length ?? 0;
  const totalStats = useMemo(() => workspace.messages.reduce((sum, message) => ({
    tokens: sum.tokens + (message.stats?.inputTokens ?? 0) + (message.stats?.outputTokens ?? 0),
    cost: sum.cost + (message.stats?.estimatedCostUsd ?? 0),
    runs: sum.runs + (message.stats ? 1 : 0),
  }), { tokens: 0, cost: 0, runs: 0 }), [workspace.messages]);

  useEffect(() => {
    if (view === "chat") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending, view]);

  async function addPhotos(files: FileList | null, target: "chat" | "cook") {
    if (!files) return;
    const current = target === "chat" ? photos : cookPhotos;
    const accepted = Array.from(files).slice(0, Math.max(0, 4 - current.length));
    if (accepted.some((file) => file.size > 5_000_000)) {
      setError("每張照片目前請小於 5 MB。");
      return;
    }
    const next = await Promise.all(accepted.map(async (file) => ({ name: file.name, mimeType: file.type || "image/jpeg", dataUrl: await fileToDataUrl(file) })));
    if (target === "chat") setPhotos((value) => [...value, ...next].slice(0, 4));
    else setCookPhotos((value) => [...value, ...next].slice(0, 4));
  }

  async function performAction(body: Record<string, unknown>) {
    const response = await fetch("/api/copilot/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "操作失敗");
    setWorkspace(data.workspace);
    return data;
  }

  async function createSession() {
    try {
      const data = await performAction({ type: "create_session" });
      setActiveSessionId(data.createdSessionId);
      setDraftOpen(false);
      setView("chat");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "無法開啟新的討論");
    }
  }

  function openSession(session: BrainstormSession) {
    setActiveSessionId(session.id);
    setDraftOpen(false);
    setView("chat");
  }

  async function sendMessage() {
    if ((!composer.trim() && photos.length === 0) || sending || !activeSession) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/copilot/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: composer.trim(), sessionId: activeSession.id, images: photos, webSearchRequested }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Copilot 暫時沒有回應");
      const result = data as CopilotTurnResult;
      setWorkspace(result.workspace);
      setAgentInfo({ mode: result.mode, model: result.model });
      setComposer("");
      setPhotos([]);
      setWebSearchRequested(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Copilot 暫時沒有回應");
    } finally {
      setSending(false);
    }
  }

  async function saveDraft(target: "idea" | "version") {
    if (!activeSession) return;
    try {
      await performAction({ type: "save_draft", sessionId: activeSession.id, target });
      setDraftOpen(false);
      setKitchenTab(target === "idea" ? "want_to_try" : "confident");
      setView("kitchen");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "料理草稿暫時存不了");
    }
  }

  async function editClaim(claim: DraftClaim) {
    if (!activeSession) return;
    const text = window.prompt("調整這一條料理草稿", claim.text);
    if (!text?.trim() || text.trim() === claim.text) return;
    try {
      await performAction({ type: "update_claim", sessionId: activeSession.id, claimId: claim.id, text: text.trim(), confirmation: "corrected" });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "草稿更新失敗");
    }
  }

  async function confirmClaim(claim: DraftClaim) {
    if (!activeSession || claim.confirmation !== "unreviewed") return;
    try {
      await performAction({ type: "update_claim", sessionId: activeSession.id, claimId: claim.id, text: claim.text, confirmation: "confirmed" });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "草稿更新失敗");
    }
  }

  async function recordCook(dishId: string) {
    if (!cookReflection.trim()) return;
    try {
      await performAction({ type: "record_cook", dishId, reflection: cookReflection.trim(), changes: cookChanges.trim(), images: cookPhotos });
      setCookReflection("");
      setCookChanges("");
      setCookPhotos([]);
      setModal({ kind: "dish", dishId });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "料理記錄失敗");
    }
  }

  const kitchenDishes = workspace.dishes.filter((dish) => {
    if (kitchenTab === "shared") return dish.sharedCount > 0;
    if (kitchenTab === "confident") return dish.stage === "confident" || dish.stage === "signature";
    return dish.stage === "want_to_try";
  });

  return (
    <main className={styles.app}>
      <aside className={styles.sidebar}>
        <button className={styles.brand} onClick={() => setView("today")}>
          <span className={styles.seal}>有</span>
          <span><strong>料理 Copilot</strong><small>Sam&apos;s Kitchen</small></span>
        </button>
        <button className={styles.newButton} onClick={createSession}><span>＋</span> 新料理討論</button>
        <div className={styles.sideLabel}><span>進行中的討論</span><b>{visibleSessions.length}</b></div>
        <div className={styles.sessionRail}>
          {visibleSessions.map((session) => (
            <button className={`${styles.railCard} ${activeSessionId === session.id && view === "chat" ? styles.railActive : ""}`} key={session.id} onClick={() => openSession(session)}>
              <strong>{session.title}</strong>
              <small>{session.draft?.workingTitle ? `料理草稿 · ${session.draft.workingTitle}` : "還沒有形成料理草稿"}</small>
              <time>{formatTime(session.updatedAt)}</time>
            </button>
          ))}
        </div>
        <div className={styles.sideFooter}>
          <button onClick={() => setModal({ kind: "status" })}><span className={`${styles.statusDot} ${agentInfo.mode === "openai" ? styles.live : ""}`} />{agentInfo.mode === "openai" ? "OpenAI 已連線" : "規則示範"}</button>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.mobileHeader}>
          <button className={styles.brand} onClick={() => setView("today")}><span className={styles.seal}>有</span><span><strong>料理 Copilot</strong><small>Sam&apos;s Kitchen</small></span></button>
          <button className={styles.avatar} onClick={() => setModal({ kind: "status" })}>Sam</button>
        </header>

        {error && <div className={styles.errorBanner}>{error}<button onClick={() => setError(null)}>×</button></div>}

        {view === "today" && (
          <div className={styles.today}>
            <header className={styles.pageHeader}>
              <div><small>{loading ? "正在拿回你的料理脈絡…" : "今天 · Sam's Kitchen"}</small><h1>想到什麼，就從這裡開始。</h1><p>一句話、一張市場照片，或一道還沒想清楚的菜。Copilot 會陪你聊，整理放在旁邊，但不急著替你決定。</p></div>
              <button className={styles.primaryButton} onClick={createSession}>＋ 開一段新討論</button>
            </header>

            <section className={styles.focusCard}>
              <div className={styles.focusMark}>今</div>
              <div><span>繼續上次</span><h2>{visibleSessions[0]?.title}</h2><p>{visibleSessions[0]?.teaser}</p></div>
              {visibleSessions[0] && <button onClick={() => openSession(visibleSessions[0])}>接著聊 <span>→</span></button>}
            </section>

            <section className={styles.focusCard}>
              <div className={styles.focusMark}>席</div>
              <div><span>THIS WEEK’S TABLE</span><h2>這週，請大家吃飯。</h2><p>本週供應、客人預留的餐，還有吃完留下的回話。</p></div>
              <a href="/copilot/table">打開餐桌 →</a>
            </section>

            <section className={styles.sectionBlock}>
              <div className={styles.sectionHead}><div><small>ONGOING</small><h2>還在想的</h2></div><button onClick={createSession}>新的討論</button></div>
              <div className={styles.discussionGrid}>
                {visibleSessions.slice(0, 3).map((session) => (
                  <button className={styles.discussionCard} key={session.id} onClick={() => openSession(session)}>
                    <div><span className={session.status === "active" ? styles.activePill : styles.pausedPill}>{session.status === "active" ? "正在聊" : "先放著"}</span><time>{formatTime(session.updatedAt)}</time></div>
                    <h3>{session.title}</h3><p>{session.teaser}</p>
                    <footer><span className={styles.draftMini}>稿</span><span>{session.draft?.workingTitle ?? "草稿還是空的"}</span><b>›</b></footer>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.kitchenSummary}>
              <div><small>MY KITCHEN</small><h2>我的料理</h2><p>只留下你真的想保留的東西。成熟度由你決定。</p></div>
              <div className={styles.summaryLinks}>
                <button onClick={() => { setKitchenTab("want_to_try"); setView("kitchen"); }}><strong>{workspace.dishes.filter((dish) => dish.stage === "want_to_try").length}</strong><span>想試的</span><b>→</b></button>
                <button onClick={() => { setKitchenTab("confident"); setView("kitchen"); }}><strong>{workspace.dishes.filter((dish) => dish.stage !== "want_to_try").length}</strong><span>有信心的</span><b>→</b></button>
                <button onClick={() => { setKitchenTab("shared"); setView("kitchen"); }}><strong>{workspace.sharedMeals.length}</strong><span>分享過的</span><b>→</b></button>
              </div>
            </section>
          </div>
        )}

        {view === "chat" && activeSession && (
          <div className={`${styles.chatLayout} ${draftOpen ? styles.withDraft : ""}`}>
            <section className={styles.chatPane}>
              <header className={styles.chatHeader}>
                <button className={styles.mobileBack} onClick={() => setView("today")}>‹</button>
                <div><small>{activeSession.status === "active" ? "正在聊" : "先放著"}</small><h1>{activeSession.title}</h1></div>
                <div className={styles.chatActions}>
                  <button onClick={() => performAction({ type: "set_session_status", sessionId: activeSession.id, status: activeSession.status === "paused" ? "active" : "paused" })}>{activeSession.status === "paused" ? "繼續" : "先放著"}</button>
                  <button className={`${styles.draftIconButton} ${draftOpen ? styles.draftSelected : ""}`} onClick={() => setDraftOpen((value) => !value)} aria-label="打開料理草稿"><span>稿</span>{unreviewedClaims > 0 && <b>{unreviewedClaims}</b>}</button>
                </div>
              </header>

              <div className={styles.messages}>
                <div className={styles.threadIntro}><span className={styles.threadLine} /><p>{activeSession.teaser}</p><span className={styles.threadLine} /></div>
                {messages.map((message) => {
                  const capture = message.captureId ? workspace.captures.find((item) => item.id === message.captureId) : null;
                  return (
                    <article className={`${styles.message} ${message.role === "chef" ? styles.chefMessage : styles.copilotMessage}`} key={message.id}>
                      <span className={styles.messageAuthor}>{message.role === "chef" ? "你" : "有家"}</span>
                      {capture && capture.assets.length > 0 && <div className={styles.messagePhotos}>{capture.assets.map((asset) => <img src={asset.url} alt={asset.name} key={asset.id} />)}</div>}
                      <p>{renderMessageText(message.text)}</p>
                      {message.webSources.length > 0 && <div className={styles.sourceList}><small>這次查到的資料</small>{message.webSources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong><span>{source.snippet || new URL(source.url).hostname}</span></a>)}</div>}
                      {message.stats && <details className={styles.runStats}><summary>這次用了 {statsText(message)}</summary><p>{message.stats.model} · {message.stats.toolCalls.join(" · ")}</p></details>}
                    </article>
                  );
                })}
                {sending && <article className={`${styles.message} ${styles.copilotMessage}`}><span className={styles.messageAuthor}>有家</span><p className={styles.thinking}>正在看看這段和你做過的料理有什麼關係<span>…</span></p></article>}
                <div ref={messagesEndRef} />
              </div>

              <div className={styles.composerWrap}>
                {photos.length > 0 && <div className={styles.photoPreview}>{photos.map((photo, index) => <div key={`${photo.name}-${index}`}><img src={photo.dataUrl} alt={photo.name} /><button onClick={() => setPhotos((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div>}
                <div className={styles.composerTools}>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(event) => addPhotos(event.target.files, "chat")} />
                  <button onClick={() => fileInputRef.current?.click()}>＋ 照片</button>
                  <button className={webSearchRequested ? styles.toolOn : ""} onClick={() => setWebSearchRequested((value) => !value)}>⌕ {webSearchRequested ? "會查資料" : "查資料"}</button>
                </div>
                <div className={styles.composerBox}>
                  <textarea value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="說說你現在想到的…" rows={2} />
                  <button onClick={sendMessage} disabled={sending || (!composer.trim() && photos.length === 0)} aria-label="送出">↑</button>
                </div>
                <small>Copilot 會整理暫時的理解；只有你按下保存，才會進入我的料理。</small>
              </div>
            </section>

            {draftOpen && (
              <aside className={styles.draftDrawer}>
                <header><div><small>DISCUSSION DRAFT</small><h2>料理草稿</h2></div><button onClick={() => setDraftOpen(false)}>×</button></header>
                {!activeSession.draft ? (
                  <div className={styles.blankDraft}><span>稿</span><h3>還沒有形成料理草稿</h3><p>繼續聊就好。有一道菜的方向時，Copilot 才會慢慢整理在這裡。</p></div>
                ) : (
                  <>
                    <div className={styles.draftTitle}><span>{activeSession.draft.relationship === "existing_variation" ? "既有料理的變化" : "新的方向"}</span><h3>{activeSession.draft.workingTitle ?? "還沒有名字"}</h3><p>第 {activeSession.draft.revision} 次整理 · {unreviewedClaims} 件還沒確認</p></div>
                    <div className={styles.claimList}>
                      {activeSession.draft.claims.map((claim) => (
                        <section className={styles.claim} key={claim.id}>
                          <div><small>{claimLabels[claim.kind]}</small><span className={styles[claim.sourceType]}>{sourceTone[claim.sourceType]}</span></div>
                          <p>{claim.text}</p>
                          <footer><button onClick={() => editClaim(claim)}>調整</button>{claim.confirmation === "unreviewed" ? <button onClick={() => confirmClaim(claim)}>這樣沒錯</button> : <span>{claim.confirmation === "corrected" ? "你調整過" : "已確認"}</span>}</footer>
                        </section>
                      ))}
                    </div>
                    <div className={styles.draftActions}>
                      {activeSession.linkedDishId ? <button className={styles.primaryButton} onClick={() => saveDraft("version")}>留成下一版草稿</button> : <button className={styles.primaryButton} onClick={() => saveDraft("idea")}>留成想試的</button>}
                      <button onClick={() => setDraftOpen(false)}>繼續聊</button>
                      <button className={styles.dangerLink} onClick={() => performAction({ type: "reject_draft", sessionId: activeSession.id })}>不要留這份草稿</button>
                    </div>
                  </>
                )}
              </aside>
            )}
          </div>
        )}

        {view === "kitchen" && (
          <div className={styles.kitchenPage}>
            <header className={styles.pageHeader}><div><small>MY KITCHEN</small><h1>我的料理</h1><p>這裡是你明確留下來的菜、實際煮過的記錄，和分享後收到的回話。</p></div></header>
            <nav className={styles.kitchenTabs}>
              <button className={kitchenTab === "want_to_try" ? styles.tabActive : ""} onClick={() => setKitchenTab("want_to_try")}>想試的 <b>{workspace.dishes.filter((dish) => dish.stage === "want_to_try").length}</b></button>
              <button className={kitchenTab === "confident" ? styles.tabActive : ""} onClick={() => setKitchenTab("confident")}>有信心的 <b>{workspace.dishes.filter((dish) => dish.stage !== "want_to_try").length}</b></button>
              <button className={kitchenTab === "shared" ? styles.tabActive : ""} onClick={() => setKitchenTab("shared")}>分享過的 <b>{workspace.sharedMeals.length}</b></button>
            </nav>
            <div className={styles.dishGrid}>
              {kitchenDishes.map((dish, index) => (
                <button className={styles.dishCard} key={dish.id} onClick={() => setModal({ kind: "dish", dishId: dish.id })}>
                  <div className={`${styles.dishTile} ${styles[`tile${index % 3}`]}`}><span>{dish.name.slice(0, 1)}</span><small>{dish.stage === "want_to_try" ? "想試" : dish.stage === "signature" ? "拿手" : "有信心"}</small></div>
                  <div><h3>{dish.name}</h3><p>{dish.summary}</p><footer><span>做過 {dish.timesCooked} 次</span><span>分享 {dish.sharedCount} 次</span><b>›</b></footer></div>
                </button>
              ))}
              {kitchenDishes.length === 0 && <div className={styles.emptyKitchen}><h3>這裡還是空的</h3><p>從料理討論裡明確留下的草稿，才會出現在這裡。</p><button className={styles.primaryButton} onClick={createSession}>開始聊一道菜</button></div>}
            </div>
          </div>
        )}

        <nav className={styles.mobileNav}>
          <button className={view === "today" ? styles.navActive : ""} onClick={() => setView("today")}><span>⌂</span>今天</button>
          <button className={view === "chat" ? styles.navActive : ""} onClick={() => activeSession ? setView("chat") : createSession()}><span>◌</span>Copilot</button>
          <button className={view === "kitchen" ? styles.navActive : ""} onClick={() => setView("kitchen")}><span>▤</span>我的料理</button>
        </nav>
      </section>

      {modal && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <section className={styles.modal}>
            <button className={styles.modalClose} onClick={() => setModal(null)}>×</button>
            {modal.kind === "status" && (
              <><small className={styles.modalKicker}>COPILOT STATUS</small><h2>{agentInfo.mode === "openai" ? "OpenAI 已連線" : "目前是規則示範"}</h2><p>模型：{agentInfo.model}</p><div className={styles.statStrip}><div><strong>{totalStats.runs}</strong><span>API runs</span></div><div><strong>{totalStats.tokens.toLocaleString()}</strong><span>tokens</span></div><div><strong>${totalStats.cost.toFixed(4)}</strong><span>估計花費</span></div></div><p className={styles.modalNote}>花費依回傳 token 使用量估算；搜尋工具的獨立費用若未出現在模型 usage 中，會另外標示為尚未計入。</p></>
            )}
            {modal.kind === "dish" && (() => {
              const dish = workspace.dishes.find((item) => item.id === modal.dishId);
              if (!dish) return null;
              const records = workspace.cookRecords.filter((record) => record.dishId === dish.id);
              const meals = workspace.sharedMeals.filter((meal) => meal.dishId === dish.id);
              const feedbackIds = new Set(meals.flatMap((meal) => meal.feedbackIds));
              const feedback = workspace.feedback.filter((item) => feedbackIds.has(item.id));
              return <><small className={styles.modalKicker}>{dish.stage === "want_to_try" ? "想試的" : "有信心的"}</small><h2>{dish.name}</h2><p className={styles.modalLead}>{dish.summary}</p><div className={styles.detailGrid}><section><small>想做出的感覺</small><p>{dish.sensoryTarget || "還沒有留下"}</p></section><section><small>做法與提醒</small>{dish.techniques.map((item) => <p key={item}>· {item}</p>)}</section><section><small>還想試試看</small>{dish.openQuestions.map((item) => <p key={item}>· {item}</p>)}</section></div><div className={styles.modalActions}><button className={styles.primaryButton} onClick={() => setModal({ kind: "cook", dishId: dish.id })}>我煮了</button>{dish.stage === "want_to_try" && <button onClick={() => performAction({ type: "set_dish_stage", dishId: dish.id, stage: "confident" })}>我對這道有信心了</button>}</div>{records.length > 0 && <section className={styles.history}><h3>料理記錄</h3>{records.map((record) => <article key={record.id}><time>{record.cookedAt}</time><strong>{record.title}</strong><p>{record.reflection}</p>{record.changes && <small>這次改了：{record.changes}</small>}</article>)}</section>}{feedback.length > 0 && <section className={styles.history}><h3>分享後的回話</h3>{feedback.map((item) => <button key={item.id} onClick={() => setModal({ kind: "feedback", feedback: item })}><strong>{item.tasterName}</strong><p>「{item.comment}」</p>{item.chefReply && <small>你回：{item.chefReply}</small>}</button>)}</section>}</>;
            })()}
            {modal.kind === "cook" && (() => {
              const dish = workspace.dishes.find((item) => item.id === modal.dishId);
              return dish ? <><small className={styles.modalKicker}>COOK RECORD</small><h2>今天煮了 {dish.name}</h2><p className={styles.modalLead}>不用寫完整食譜。留下你現在還記得、下次會有用的事就好。</p><label className={styles.field}><span>這次怎麼樣？</span><textarea value={cookReflection} onChange={(event) => setCookReflection(event.target.value)} placeholder="例如：湯很乾淨，薑少一半剛好…" rows={4} /></label><label className={styles.field}><span>這次有改什麼？（選填）</span><textarea value={cookChanges} onChange={(event) => setCookChanges(event.target.value)} placeholder="例如：蛤蜊開口先取出" rows={2} /></label><input ref={cookFileInputRef} className={styles.hiddenInput} type="file" accept="image/*" multiple onChange={(event) => addPhotos(event.target.files, "cook")} /><button className={styles.photoAdd} onClick={() => cookFileInputRef.current?.click()}>＋ 加一張成品照</button>{cookPhotos.length > 0 && <div className={styles.photoPreview}>{cookPhotos.map((photo) => <div key={photo.name}><img src={photo.dataUrl} alt={photo.name} /></div>)}</div>}<div className={styles.modalActions}><button className={styles.primaryButton} disabled={!cookReflection.trim()} onClick={() => recordCook(dish.id)}>留下這次料理</button><button onClick={() => setModal({ kind: "dish", dishId: dish.id })}>取消</button></div></> : null;
            })()}
            {modal.kind === "feedback" && <><small className={styles.modalKicker}>GUEST FEEDBACK</small><h2>{modal.feedback.tasterName} 的回話</h2>{modal.feedback.photoUrl && <img src={modal.feedback.photoUrl} alt="客人分享的餐點照片" style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain" }} />}<blockquote className={styles.feedbackQuote}>「{modal.feedback.comment}」</blockquote>{modal.feedback.chefReply ? <p>你回：{modal.feedback.chefReply}</p> : <button className={styles.primaryButton} onClick={async () => { const reply = window.prompt("回一句話給對方"); if (reply?.trim()) { await performAction({ type: "reply_feedback", feedbackId: modal.feedback.id, reply: reply.trim() }); setModal(null); } }}>回一句話</button>}</>}
          </section>
        </div>
      )}
    </main>
  );
}
