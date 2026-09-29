"use client";

import { useEffect, useMemo, useState } from "react";
import { demoKitchen, demoOrders } from "@/lib/demo-data";
import type { ChatTurn, Constraint, KitchenWindow, MealIntent, Order, Proposal } from "@/lib/domain";
import { initialCustomerState, mockCustomerReply, openingTurn, parseChefWeek, type CustomerChatState } from "@/lib/mock-agent";
import { planMeals, reserveProposal } from "@/lib/planner";

type View = "home" | "customer" | "market" | "table" | "chef" | "stats";

const defaultConstraints: Constraint[] = [{ kind: "allergy", ingredient: "peanut", severity: "severe" }];

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved) setValue(JSON.parse(saved));
  }, [key]);
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue] as const;
}

export default function YoujiaApp() {
  const [view, setView] = useState<View>("home");
  const [kitchen, setKitchen] = useStoredState<KitchenWindow>("youjia-kitchen", demoKitchen);
  const [orders, setOrders] = useStoredState<Order[]>("youjia-orders", demoOrders);
  const [turns, setTurns] = useState<ChatTurn[]>([openingTurn()]);
  const [chatState, setChatState] = useState<CustomerChatState>(initialCustomerState);
  const [input, setInput] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [chefNote, setChefNote] = useState("");
  const [chefDraft, setChefDraft] = useState<ReturnType<typeof parseChefWeek> | null>(null);
  const [toast, setToast] = useState("");

  const usage = useMemo(() => {
    const runs = turns.flatMap((turn) => (turn.stats ? [turn.stats] : []));
    return {
      runs: runs.length,
      input: runs.reduce((sum, run) => sum + run.inputTokens, 0),
      output: runs.reduce((sum, run) => sum + run.outputTokens, 0),
      cost: runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0),
      latency: runs.length ? Math.round(runs.reduce((sum, run) => sum + run.latencyMs, 0) / runs.length) : 0,
    };
  }, [turns]);

  function resetDemo() {
    localStorage.removeItem("youjia-kitchen");
    localStorage.removeItem("youjia-orders");
    location.reload();
  }

  const [sending, setSending] = useState(false);

  async function sendCustomer(text = input) {
    if (!text.trim()) return;
    const userTurn: ChatTurn = { role: "user", text: text.trim() };
    setTurns((current) => [...current, userTurn]);
    setInput("");
    setSending(true);
    let result: ReturnType<typeof mockCustomerReply>;
    try {
      const response = await fetch("/api/customer-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, state: chatState, turns }),
      });
      if (!response.ok) throw new Error("agent request failed");
      result = await response.json();
    } catch {
      result = mockCustomerReply(text, chatState);
      result.turn.text += "\n\n（連線暫時不穩，先用本機模式陪你。）";
    } finally {
      setSending(false);
    }
    setTurns((current) => [...current, result.turn]);
    setChatState(result.state);
    if (result.readyForProposal) {
      const planned = planMeals({ intent: result.state.intent, constraints: defaultConstraints, kitchen, maxPrice: 24 });
      setProposals(planned);
      setSelected(planned[0] ?? null);
    }
  }

  function quick(value: string) {
    sendCustomer(value);
  }

  function confirmProposal() {
    if (!selected) return;
    const updatedKitchen = reserveProposal(selected, kitchen);
    const order: Order = {
      id: `YJ-${String(orders.length + 4).padStart(4, "0")}`,
      customerName: "你",
      recipeId: selected.recipe.id,
      recipeName: selected.recipe.name,
      serviceDate: kitchen.serviceDate,
      pickupWindow: "18:00–18:30",
      adjustments: [],
      constraints: defaultConstraints,
      intent: chatState.intent,
      price: selected.recipe.price,
      status: "confirmed",
    };
    setKitchen(updatedKitchen);
    setOrders((current) => [...current, order]);
    setToast(`已替你留下 ${selected.recipe.name}`);
    setTimeout(() => setToast(""), 2600);
  }

  function startMarketProposal(recipeId: string) {
    const intent: MealIntent = {
      ...initialCustomerState.intent,
      desiredExperiences: ["fresh"],
      flavorPreferences: kitchen.recipes.find((r) => r.id === recipeId)?.tags.slice(0, 2) ?? [],
      customerWords: ["我從有家超市挑了這個"],
    };
    const planned = planMeals({ intent, constraints: defaultConstraints, kitchen });
    setChatState({ step: 2, intent });
    setProposals(planned);
    setSelected(planned.find((p) => p.recipe.id === recipeId) ?? planned[0] ?? null);
    setTurns([openingTurn(), { role: "user", text: "我不太想聊，從市場替我想吧。" }, { role: "assistant", text: "好，那就不多問。你挑一個今天看了有感覺的食材，剩下的交給我。" }]);
    setView("customer");
  }

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="回到有家首頁">
          <span className="seal">有</span><span>有家</span>
        </button>
        <nav>
          <button onClick={() => setView("customer")}>替我想</button>
          <button onClick={() => setView("market")}>有家超市</button>
          <button onClick={() => setView("table")}>吃過的飯</button>
        </nav>
      </header>

      {view === "home" && (
        <section className="hero page">
          <div className="hero-copy">
            <p className="eyebrow">朋友帶你來的，一週只開幾桌</p>
            <h1>小林說，<br />你可能會喜歡來<br /><em>有家</em>吃飯。</h1>
            <p className="lede">不是想好要點什麼才來。說說今晚的感覺，剩下的讓我替你想。</p>
            <div className="actions">
              <button className="primary" onClick={() => setView("customer")}>今晚替我想</button>
              <button className="secondary" onClick={() => setView("market")}>我去市場逛逛</button>
            </div>
          </div>
          <div className="window-scene" aria-label="有家廚房插畫">
            <div className="sun" />
            <div className="curtain left" /><div className="curtain right" />
            <div className="table-shape"><div className="bowl">湯</div><div className="plate" /></div>
            <span className="scene-note">今天慢慢吃。</span>
          </div>
        </section>
      )}

      {view === "customer" && (
        <section className="conversation page narrow">
          <div className="section-heading">
            <p className="eyebrow">今晚的飯</p><h2>先坐一下。</h2>
          </div>
          <div className="chat-card">
            {turns.map((turn, index) => (
              <div className={`bubble ${turn.role}`} key={`${index}-${turn.text}`}>
                {turn.text.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}
                {turn.stats && <small>{turn.stats.mode} · {turn.stats.latencyMs}ms</small>}
              </div>
            ))}
            {!proposals.length && (
              <div className="quick-row">
                <button disabled={sending} onClick={() => quick("今天有點累，想吃熱熱的")}>今天有點累</button>
                <button disabled={sending} onClick={() => quick("想吃清爽一點，醒過來的味道")}>想清爽一點</button>
                <button disabled={sending} onClick={() => quick("你幫我決定就好")}>你幫我決定</button>
              </div>
            )}
            {!proposals.length && (
              <form onSubmit={(event) => { event.preventDefault(); sendCustomer(); }} className="chat-input">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="今晚想說什麼都可以，短短一句就好" />
                <button className="send" disabled={sending} type="submit">{sending ? "想一下…" : "送出"}</button>
              </form>
            )}
          </div>

          {selected && (
            <div className={`proposal ${selected.recipe.palette}`}>
              <div className="proposal-art"><span>{selected.recipe.ingredients[0]}</span></div>
              <div className="proposal-copy">
                <p className="eyebrow">我想替你做</p>
                <h3>{selected.recipe.name}</h3>
                <p>{selected.recipe.description}</p>
                <p className="why">你今天聽起來需要一點溫暖，但不要太厚重。這份味道夠下飯，吃完不會太累。</p>
                <div className="proposal-meta"><span>週六 7/18</span><span>18:00–18:30</span><span>${selected.recipe.price}</span></div>
                <details><summary>安全與食材確認</summary><p>本次已排除花生；廚房仍會在確認單標記嚴重過敏。含：{selected.recipe.allergens.join("、") || "無常見過敏原"}。</p></details>
                <div className="actions"><button className="primary" onClick={confirmProposal}>就煮這個</button><button className="secondary" onClick={() => setView("market")}>我再看看</button></div>
                {proposals.length > 1 && <button className="text-button" onClick={() => { const index = proposals.indexOf(selected); setSelected(proposals[(index + 1) % proposals.length]); }}>換一個接近的</button>}
              </div>
            </div>
          )}
        </section>
      )}

      {view === "market" && (
        <section className="page">
          <div className="section-heading"><p className="eyebrow">有家超市 · {kitchen.weekLabel}</p><h2>這週市場上，<br />有這些好東西。</h2><p>不是買菜。挑一樣今天看了有感覺的，我替你把它變成一頓飯。</p></div>
          <div className="market-grid">
            {kitchen.recipes.map((recipe) => (
              <article className={`market-card ${recipe.palette}`} key={recipe.id}>
                <div className="ingredient-art"><span>{recipe.ingredients[0]}</span></div>
                <p className="eyebrow">還有 {recipe.portionsAvailable} 份</p><h3>{recipe.ingredients.slice(0, 2).join(" · ")}</h3>
                <p>{recipe.description}</p><button onClick={() => startMarketProposal(recipe.id)}>我對這個有興趣</button>
              </article>
            ))}
          </div>
          <aside className="market-note"><span>市場小紙條</span>{kitchen.marketNotes.map((note) => <p key={note}>— {note}</p>)}</aside>
        </section>
      )}

      {view === "table" && (
        <section className="page wall">
          <div className="section-heading"><p className="eyebrow">不是聊天紀錄</p><h2>吃過的飯</h2><p>有家不想蒐集你的生活。你願意留下的照片和幾句話，會幫我把下一頓飯煮得更適合你。</p></div>
          <div className="photo-wall">
            <article className="polaroid tilt-left"><div className="food-photo terracotta">菜脯<br />雞腿</div><h3>6月12日</h3><p>「茄子好好吃，雞腿可以再淡一點。」</p><blockquote>廚師：收到，下次醬汁收短一點。</blockquote></article>
            <article className="polaroid tilt-right"><div className="food-photo jade">蛤蜊<br />絲瓜</div><h3>7月3日</h3><p>「湯汁很喜歡，飯剛剛好。」</p><blockquote>廚師：那天的蛤蜊真的很漂亮。</blockquote></article>
          </div>
        </section>
      )}

      {view === "chef" && (
        <section className="page chef-page">
          <div className="chef-header"><div><p className="eyebrow">Chef Copilot</p><h2>這週開灶</h2><p>{kitchen.weekLabel} · 還能接 {kitchen.capacity - kitchen.committed} 份</p></div><div className="chef-actions"><button onClick={() => setView("stats")}>查看 Agent Stats</button><button onClick={resetDemo}>重設 Demo</button></div></div>
          <div className="chef-grid">
            <div className="panel weekly-chat"><h3>跟廚房說說這週</h3><p>市場找到什麼、想試什麼、哪天最多幾份。Agent 只整理成 draft，不會自己承諾。</p>
              <textarea value={chefNote} onChange={(e) => setChefNote(e.target.value)} placeholder="例：今天蛤蜊很漂亮，買了約十二份。這週想讓一位熟客試蛤蜊絲瓜。週五最多六份。" />
              <button onClick={() => setChefDraft(parseChefWeek(chefNote))}>整理成這週草稿</button>
              {chefDraft && <div className="draft"><span className="status">DRAFT</span><p><strong>Capacity：</strong>{chefDraft.capacity} 份</p><p><strong>市場：</strong>{chefDraft.marketNotes.join("；")}</p><p><strong>實驗：</strong>{chefDraft.experiment}</p><button className="primary" onClick={() => { setKitchen({ ...kitchen, capacity: chefDraft.capacity, marketNotes: chefDraft.marketNotes, experiment: chefDraft.experiment }); setChefDraft(null); setChefNote(""); setToast("已記進這週廚房"); }}>記進這週廚房</button></div>}
            </div>
            <div className="panel"><h3>本週訂單</h3>{orders.map((order) => <button className="order-row" key={order.id}><span><strong>{order.customerName}</strong><small>{order.pickupWindow}</small></span><span>{order.recipeName}<small>{order.adjustments.join(" · ") || "標準份量"}</small></span><b>${order.price}</b></button>)}</div>
          </div>
          <div className="order-sheet">
            <div><p className="eyebrow">料理單 · {orders[0].id}</p><h3>{orders[0].customerName}｜{orders[0].recipeName}</h3><p>{orders[0].serviceDate} · {orders[0].pickupWindow} 自取</p></div>
            <div className="alert danger"><strong>一定注意</strong><p>花生嚴重過敏</p><p>18:30 前完成</p></div>
            <div className="sheet-block"><strong>這次想吃的感覺</strong><p>{orders[0].intent.customerWords.join("；")}</p></div>
            <div className="sheet-block"><strong>料理建議</strong><p>少飯、青菜增加半份。菜脯本批偏鹹，先試味。</p></div>
            <div className="sheet-block"><strong>廚房</strong><p>與另外 4 份同批製作 · 建議 15:40 開始前置</p></div>
          </div>
          <div className="capture"><div><p className="eyebrow">Recipe Memory</p><h3>剛煮完，記一下</h3><p>一句話、照片或語音都可以。先成為 draft，你決定要不要留下這道。</p></div><button>＋ 新料理筆記</button></div>
        </section>
      )}

      {view === "stats" && (
        <section className="page stats-page">
          <div className="section-heading"><p className="eyebrow">Evaluation & Cost</p><h2>Agent Stats</h2><p>目前是免費 mock mode。接上 API key 後，同一位置會顯示實際 token usage 與依設定單價估算的成本。</p></div>
          <div className="stat-grid"><div><span>Runs</span><strong>{usage.runs}</strong></div><div><span>Input tokens</span><strong>{usage.input.toLocaleString()}</strong></div><div><span>Output tokens</span><strong>{usage.output.toLocaleString()}</strong></div><div><span>Estimated cost</span><strong>${usage.cost.toFixed(4)}</strong></div><div><span>Avg latency</span><strong>{usage.latency}ms</strong></div></div>
          <div className="panel"><h3>最近的 Agent runs</h3>{turns.filter((t) => t.stats).map((turn, i) => <div className="run-row" key={i}><span>{turn.stats?.model}</span><span>{turn.stats?.toolCalls.join(" → ") || "conversation"}</span><span>{turn.stats?.latencyMs}ms</span><span>${turn.stats?.estimatedCostUsd.toFixed(4)}</span></div>)}</div>
          <button className="secondary" onClick={() => setView("chef")}>回 Chef 廚房</button>
        </section>
      )}
      {toast && <div className="toast">{toast}</div>}
      <footer><span>有家 · personal chef</span><button onClick={() => setView("stats")}>MVP stats</button></footer>
    </main>
  );
}
