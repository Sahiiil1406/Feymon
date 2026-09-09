import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import PhaserGame from "./components/PhaserGame";
import DojoInterior from "./components/DojoInterior";
import { getStoredPlayer, setStoredPlayer, clearStoredPlayer } from "./lib/playerStorage";

const COLORS = ["#0ea5e9", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
const SPRITES = ["hero_blue", "hero_red", "hero_green", "hero_girl"];

function AccountGate({ onCreated }: { onCreated: (id: string, name: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]!);
  const [sprite] = useState(SPRITES[Math.floor(Math.random() * SPRITES.length)]!);
  const create = useMutation(api.players.create);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = name.trim();
    if (t.length < 2) { setErr("Name needs at least 2 characters"); return; }
    setLoading(true); setErr(null);
    try {
      const id = await create({ name: t, color, sprite, mapId: "overworld" });
      setStoredPlayer({ playerId: id as string, name: t });
      onCreated(id as string, t);
    } catch (e: any) { setErr(e.message ?? "Failed"); } finally { setLoading(false); }
  };
  return (
    <div className="fr-gate">
      <div className="fr-gate-card">
        <div className="fr-gate-left">
          <div className="fr-gate-brand">
            <span className="fr-gate-logo">◉</span>
            <span className="fr-gate-brand-text">Feymon</span>
            <span className="fr-gate-badge">Beta</span>
          </div>
          <h1 className="fr-gate-h1">Welcome to Feymon</h1>
          <p className="fr-gate-sub">A calm, collaborative world to explore, learn and practice. Inspired by minimal design — focused on clarity and flow.</p>
          <div className="fr-oak-box">
            <div className="fr-oak-head">
              <span className="fr-oak-avatar">◐</span>
              <span>Professor Oak</span>
              <span className="fr-oak-tag">Guide</span>
            </div>
            <p>“This world is inhabited by creatures called Feymon. Choose your name and color to begin your journey.”</p>
          </div>
          <div className="fr-gate-meta">
            <span>16×16 tiles • Grid movement • Realtime</span>
            <span>Works in browser • No download</span>
          </div>
        </div>
        <div className="fr-gate-right">
          <div className="fr-form-title">Create trainer</div>
          <p className="fr-form-sub">Pick a display name and accent color. You can change it later.</p>
          <form onSubmit={submit} className="fr-form">
            <label className="fr-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ash" maxLength={12} autoFocus /></label>
            <div className="fr-field"><span>Accent</span>
              <div className="fr-colors">{COLORS.map((c) => (<button key={c} type="button" onClick={() => setColor(c)} className={`fr-dot ${color === c ? "on" : ""}`} style={{ background: c }} aria-label={c} />))}</div>
            </div>
            <button type="submit" disabled={loading} className="fr-btn">{loading ? "Creating…" : "Continue →"}</button>
            {err && <div className="fr-err">{err}</div>}
            <p className="fr-hint">By continuing you agree to be a kind explorer. Be respectful in the village.</p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [myId, setMyId] = useState<string | null>(() => getStoredPlayer()?.playerId ?? null);
  const [myName, setMyName] = useState<string | null>(() => getStoredPlayer()?.name ?? null);
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const [_chatInput, _setChatInput] = useState("");
  void _chatInput; void _setChatInput;
  const [showMenu, setShowMenu] = useState(false);
  const [showDojo, setShowDojo] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const playerIdConvex = myId as Id<"players"> | null;
  const me = useQuery(api.players.get, playerIdConvex ? { playerId: playerIdConvex } : "skip");
  const online = useQuery(api.players.listOnline, myId ? { mapId: "overworld" } : "skip") as any[] | undefined;
  const npcs = useQuery(api.npcs.list, myId ? { mapId: "overworld" } : "skip") as any[] | undefined;
  const messages = useQuery(api.worldMessages.list, myId ? { mapId: "overworld", limit: 50 } : "skip") as any[] | undefined;
  const seed = useMutation(api.seed.seed);
  const heartbeat = useMutation(api.players.heartbeat);
  const move = useMutation(api.players.move);
  const sendMsg = useMutation(api.worldMessages.send);
  const setOffline = useMutation(api.players.setOffline);
  const topics = useQuery(api.topics.list, myId ? {} : "skip");
  const activeFeynman = useQuery(api.feynman.getActiveSession, playerIdConvex ? { playerId: playerIdConvex } : "skip") as any | undefined;
  useEffect(() => { if (topics && topics.length === 0) seed({}).catch(() => {}); }, [topics, seed]);
  useEffect(() => {
    if (!playerIdConvex) return;
    const iv = setInterval(() => heartbeat({ playerId: playerIdConvex }).catch(() => {}), 5000);
    heartbeat({ playerId: playerIdConvex }).catch(() => {});
    const onUnload = () => { try { setOffline({ playerId: playerIdConvex }); } catch {} };
    window.addEventListener("beforeunload", onUnload);
    return () => { clearInterval(iv); window.removeEventListener("beforeunload", onUnload); setOffline({ playerId: playerIdConvex }).catch(()=>{}); };
  }, [playerIdConvex, heartbeat, setOffline]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "m" || e.key === "M") && myId) setShowMenu((v) => !v);
      if ((e.key === "f" || e.key === "F") && myId) setShowDojo((v) => !v);
      if (e.key === "Escape") { setShowMenu(false); setActiveNpcId(null); if(showDojo) setShowDojo(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [myId, showDojo]);
  const activeNpc = useMemo(() => { if (!activeNpcId || !npcs) return null; return npcs.find((n: any) => n._id === activeNpcId) ?? null; }, [activeNpcId, npcs]);
  const latestChat = useMemo(() => { if (!messages || messages.length === 0) return null; return messages[0]; }, [messages]);
  const lastMoveRef = useRef<{x:number;y:number;dir:string}>({x:0,y:0,dir:"down"});
  const pendingRef = useRef(false);
  const doMove = useCallback((x: number, y: number, dir: "up"|"down"|"left"|"right") => {
    if (!playerIdConvex) return;
    const last = lastMoveRef.current;
    const dist = Math.hypot(x - last.x, y - last.y);
    if (dist < 1.2 && last.dir === dir && pendingRef.current) return;
    if (pendingRef.current) { lastMoveRef.current = {x,y,dir}; return; }
    pendingRef.current = true;
    lastMoveRef.current = {x,y,dir};
    move({ playerId: playerIdConvex, x, y, direction: dir }).catch((e)=>{ console.warn("move failed", e); }).finally(()=>{
      pendingRef.current = false;
      const cur = lastMoveRef.current;
      if (Math.hypot(cur.x - x, cur.y - y) > 0.5 || cur.dir !== dir) doMove(cur.x, cur.y, cur.dir as any);
    });
  }, [playerIdConvex, move]);
  const handleMove = doMove;
  const handleInteract = useCallback((id: string) => setActiveNpcId(id), []);
  const handleEnterTower = useCallback(() => setShowDojo(true), []);
  const _handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const _body = (_chatInput as string).trim(); if (!_body) return;
    try { await sendMsg({ authorId: playerIdConvex!, body: _body, mapId: "overworld", channel: "world" }); _setChatInput(""); } catch {}
  }; void _handleSend;
  const handleLogout = async () => {
    if (playerIdConvex) try { await setOffline({ playerId: playerIdConvex }); } catch {}
    clearStoredPlayer(); setMyId(null); setMyName(null);
  };
  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(null), 3200); };
  if (!myId) return <><style>{styles}</style><AccountGate onCreated={(id,n)=>{setMyId(id); setMyName(n);}} /></>;
  const isLoading = !me || !online || !npcs;
  const hasActiveLoop = !!activeFeynman?.session;
  return (
    <>
      <style>{styles}</style>
      <div className="fr-root">
        <header className="fr-header">
          <div className="fr-header-inner">
            <div className="fr-brand">
              <span className="fr-ball">◉</span>
              <span className="fr-title">Feymon</span>
              <span className="fr-loc">Village • Route 1</span>
            </div>
            <div className="fr-header-actions">
              <span className="fr-live"><i />{online?.length ?? 0} online</span>
              <button className={`fr-dojo-btn ${hasActiveLoop ? "active" : ""}`} onClick={() => setShowDojo(true)}>
                {hasActiveLoop ? "Dojo • Active" : "Dojo"}
              </button>
              <button className="fr-menu-btn" onClick={() => setShowMenu(!showMenu)}>Menu</button>
              <button className="fr-quit" onClick={handleLogout}>Sign out</button>
            </div>
          </div>
        </header>

        <div className="fr-landscape">
          <div className="fr-game-col">
            <div className="fr-frame">
              {isLoading ? <div className="fr-loading"><span className="fr-spinner" /> Loading world…</div> : (
                <PhaserGame myPlayerId={myId} players={online as any} npcs={npcs as any} me={me as any} onMove={handleMove} onInteractNpc={handleInteract} onEnterFeynmanTower={handleEnterTower} latestChat={latestChat} />
              )}
              <div className="fr-loc-banner">Feymon Village — Dojo inside the big central building. Find the ⛩ sign.</div>
              <div className="fr-ctrl">Move: WASD / Arrows • Enter: Talk / Enter Dojo (big building) • Click door • F: Dojo • M: Menu</div>
              {activeNpc && (
                <div className="fr-dialog">
                  <div className="fr-dialog-head"><span className="fr-who">{activeNpc.name}</span><button className="fr-x" onClick={() => setActiveNpcId(null)} aria-label="Close">×</button></div>
                  <div className="fr-dialog-body">“{activeNpc.introLine}”</div>
                  <div className="fr-dialog-actions"><button className="fr-btn-sm" onClick={() => setActiveNpcId(null)}>Dismiss</button><button className="fr-btn-sm primary" onClick={() => { if(playerIdConvex) sendMsg({ authorId: playerIdConvex, body: `Hi ${activeNpc.name}!`, mapId:"overworld", channel:"nearby"});}}>Say hi</button></div>
                </div>
              )}
              {showMenu && (
                <div className="fr-menu-overlay" onClick={() => setShowMenu(false)}>
                  <div className="fr-start-box" onClick={e=>e.stopPropagation()}>
                    <div className="fr-start-title">Menu</div>
                    <p className="fr-start-sub">Quick overview of your session.</p>
                    <div className="fr-start-list">
                      <div className="fr-start-item on"><span>Map</span><em>Village</em></div>
                      <div className="fr-start-item"><span>Online</span><em>{online?.length ?? 0}</em></div>
                      <div className="fr-start-item"><span>Town people</span><em>{npcs?.length ?? 0}</em></div>
                      <button className="fr-start-item as-btn" onClick={handleLogout}><span>Sign out</span><em>→</em></button>
                    </div>
                    <div className="fr-trainer"><div className="fr-trainer-head">Trainer</div><div className="fr-trainer-row"><span>Name</span><b>{myName}</b></div><div className="fr-trainer-row"><span>Level</span><b>{(me as any)?.player?.level ?? 1}</b></div><div className="fr-trainer-row"><span>XP</span><b>{(me as any)?.player?.xp ?? 0} / {((me as any)?.player?.level ?? 1)*100}</b></div><div className="fr-trainer-row"><span>Position</span><b>{(me as any)?.presence ? `${Math.round((me as any).presence.x)}, ${Math.round((me as any).presence.y)}` : "—"}</b></div></div>
                  </div>
                </div>
              )}
              {showDojo && (
                <div className="fr-feynman-overlay" onClick={() => setShowDojo(false)}>
                  <div className="fr-feynman-modal" onClick={e=>e.stopPropagation()}>
                    <DojoInterior playerId={myId} onExit={()=>setShowDojo(false)} onLeveledUp={(lvl,xp)=>showToast(`Level up → Lv ${lvl}  +${xp} XP`)} />
                  </div>
                </div>
              )}
              {toast && <div className="fr-toast">{toast}</div>}
            </div>
          </div>
          <aside className="fr-side">
            <div className="fr-box dojo-box">
              <div className="fr-box-title">Feynman Dojo — Village Center Building</div>
              <div className="fr-dojo-card">
                <div className="fr-dojo-icon">⛩</div>
                <div className="fr-dojo-text">
                  <b>Feynman Dojo</b>
                  <span>Inside the big central building</span>
                  <span>Walk to center + Enter at door</span>
                </div>
                <button className={`fr-dojo-enter ${hasActiveLoop ? "pulse" : ""}`} onClick={()=>setShowDojo(true)}>{hasActiveLoop ? "Resume" : "Enter"}</button>
              </div>
              <div className="fr-dojo-stats">
                <span>Lv {(me as any)?.player?.level ?? 1}</span>
                <span className="fr-dojo-xp"><i style={{width:`${Math.min(100, ((me as any)?.player?.xp ?? 0)/(((me as any)?.player?.level ?? 1)*100)*100)}%`}} /> {(me as any)?.player?.xp ?? 0} XP</span>
                <span>{(me as any)?.player?.totalExplanations ?? 0} loops</span>
              </div>
              {hasActiveLoop && <div className="fr-dojo-active">Active: “{(activeFeynman?.session as any)?.topic}” — {activeFeynman?.session.turnCount}/{activeFeynman?.session.maxTurns}</div>}
              <div className="fr-dojo-hint">Reuse of existing building — no extra tower. Inside: lobby → mic → training → rating & XP.</div>
            </div>
            <div className="fr-box">
              <div className="fr-box-title">Trainers <span className="fr-box-count">{online?.length ?? 0}</span></div>
              <div className="fr-box-list">{!online ? <span className="fr-muted">Loading…</span> : online.map((o:any)=>(<div key={o.player._id} className={`fr-row ${o.player._id===myId?"me":""}`}><i style={{ background: o.player.color }} /><span className="fr-row-name">{o.player.name}</span><em>Lv{o.player.level}</em><span className="fr-row-dot">●</span></div>))}</div>
            </div>
            <div className="fr-box">
              <div className="fr-box-title">Live Map <span className="fr-box-count">Realtime</span></div>
              <div className="fr-minimap-wrap">
                <div className="fr-minimap">
                  {/* faint grid */}
                  <div className="fr-minimap-grid" />
                  {/* Dojo building */}
                  <div className="fr-minimap-dojo" title="Dojo - Central Building" />
                  {/* NPCs */}
                  {npcs?.map((n:any)=>(
                    <div
                      key={n._id}
                      className={`fr-minimap-dot npc ${activeNpcId===n._id ? "active" : ""}`}
                      style={{ left: `${(n.x/1280*100).toFixed(2)}%`, top: `${(n.y/1280*100).toFixed(2)}%`, background: n.color }}
                      title={n.name}
                    />
                  ))}
                  {/* Other players */}
                  {online?.map((o:any)=>(
                    <div
                      key={o.player._id}
                      className={`fr-minimap-dot player ${o.player._id===myId ? "me" : ""}`}
                      style={{ left: `${(o.presence.x/1280*100).toFixed(2)}%`, top: `${(o.presence.y/1280*100).toFixed(2)}%`, background: o.player.color, borderColor: o.player._id===myId ? "#1c1917" : "#fff" }}
                      title={`${o.player.name} Lv${o.player.level}`}
                    />
                  ))}
                  {/* my position if not in online (fallback) */}
                  {me && (me as any)?.presence && !online?.some((o:any)=>o.player._id===myId) && (
                    <div className="fr-minimap-dot player me" style={{ left: `${((me as any).presence.x/1280*100).toFixed(2)}%`, top: `${((me as any).presence.y/1280*100).toFixed(2)}%`, background: (me as any).player.color }} />
                  )}
                </div>
                <div className="fr-minimap-legend">
                  <span><i style={{background:"#1c1917"}} /> You</span>
                  <span><i style={{background:"#f59e0b"}} /> NPC</span>
                  <span><i style={{background:"#e9ddd0", border:"1px solid #1c1917"}} /> Dojo</span>
                  <span className="fr-minimap-hint">Live • {online?.length ?? 0} trainers move in real-time</span>
                </div>
              </div>
            </div>
            <div className="fr-box">
              <div className="fr-box-title">Town people <span className="fr-box-count">{npcs?.length ?? 0}</span></div>
              <div className="fr-box-list">{npcs?.map((n:any)=>(<button key={n._id} onClick={()=>handleInteract(n._id)} className={`fr-row-btn ${activeNpcId===n._id?"on":""}`}><i style={{ background: n.color }} /><span className="fr-row-name">{n.name}</span><em>{n.role}</em></button>))}</div>
            </div>
            <div className="fr-box soft">
              <div className="fr-box-title">How to play</div>
              <div className="fr-help">
                <p><b>Move</b> one tile at a time — grid based.</p>
                <p><b>Enter</b> — Talk to people / enter Dojo.</p>
                <p><b>F</b> — Open Dojo from anywhere.</p>
                <p><b>M</b> — Toggle menu.</p>
                <p className="fr-help-muted">Voice uses Web Speech API — tap Speak and allow mic. Or just type. LLM provider is set via <code>LLM_PROVIDER</code> in <code>.env.local</code>.</p>
              </div>
            </div>
          </aside>
        </div>
        <footer className="fr-footer">Feymon — A minimal open world for learning. Inspired by Mobbin. Open source • Not affiliated with Nintendo.</footer>
      </div>
    </>
  );
}
const styles = `*{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:#f7f3ec;color:#1c1917;font-family:'Inter',system-ui,-apple-system,sans-serif}
  .fr-root{min-height:100dvh;display:flex;flex-direction:column;background:#f7f3ec}
  /* header - warm minimal, mobbin style */
  .fr-header{position:sticky;top:0;z-index:20;background:rgba(253,251,247,0.88);backdrop-filter:blur(12px) saturate(180%);-webkit-backdrop-filter:blur(12px) saturate(180%);border-bottom:1px solid #e9ddd0}
  .fr-header-inner{max-width:1440px;margin:0 auto;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between;gap:16px}
  .fr-brand{display:flex;align-items:center;gap:10px;min-width:0}
  .fr-ball{width:28px;height:28px;display:grid;place-items:center;background:#1c1917;color:#fdfbf7;border-radius:8px;font-size:12px;flex-shrink:0}
  .fr-title{font-size:15px;font-weight:650;letter-spacing:-0.02em;color:#1c1917}
  .fr-loc{margin-left:8px;padding:4px 10px;background:#fdfbf7;border:1px solid #e9ddd0;border-radius:999px;font-size:12px;font-weight:500;color:#78716c;white-space:nowrap}
  .fr-header-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0}
  .fr-live{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:#fff;border:1px solid #e9ddd0;border-radius:999px;font-size:12px;font-weight:500;color:#57534e}
  .fr-live i{width:6px;height:6px;background:#22c55e;border-radius:50%;box-shadow:0 0 0 4px rgba(34,197,94,0.14)}
  .fr-dojo-btn{padding:8px 14px;border-radius:999px;border:1px solid #1c1917;background:#1c1917;color:#fdfbf7;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s}
  .fr-dojo-btn:hover{opacity:0.92;transform:translateY(-1px)}
  .fr-dojo-btn.active{background:#fff;color:#1c1917;border-color:#1c1917}
  .fr-menu-btn{padding:8px 14px;border-radius:999px;border:1px solid #e9ddd0;background:#fff;color:#1c1917;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s}
  .fr-menu-btn:hover{background:#fdfbf7;border-color:#d6c7b8}
  .fr-quit{padding:8px 12px;border-radius:999px;border:1px solid transparent;background:transparent;color:#78716c;font-size:13px;font-weight:500;cursor:pointer}
  .fr-quit:hover{background:#efe8dc;color:#1c1917}

  /* gate - warm onboarding */
  .fr-gate{min-height:100dvh;display:grid;place-items:center;padding:32px 16px;background:#f7f3ec;background-image:radial-gradient(#e9ddd0 1px, transparent 1px);background-size:24px 24px}
  .fr-gate-card{width:min(920px,100%);display:grid;grid-template-columns:1.1fr 0.9fr;background:#fff;border:1px solid #e9ddd0;border-radius:24px;overflow:hidden;box-shadow:0 1px 2px rgba(28,25,23,0.04), 0 12px 32px rgba(28,25,23,0.08)}
  .fr-gate-left{padding:28px 24px;background:#fdfbf7;display:flex;flex-direction:column;gap:14px;border-right:1px solid #f2e8d9}
  .fr-gate-brand{display:flex;align-items:center;gap:8px}
  .fr-gate-logo{width:28px;height:28px;display:grid;place-items:center;background:#1c1917;color:#fdfbf7;border-radius:8px;font-size:12px}
  .fr-gate-brand-text{font-weight:600;letter-spacing:-0.02em}
  .fr-gate-badge{padding:2px 8px;background:#fff;border:1px solid #e9ddd0;border-radius:999px;font-size:11px;font-weight:600;color:#78716c}
  .fr-gate-h1{margin:6px 0 0 0;font-size:26px;font-weight:700;letter-spacing:-0.03em;line-height:1.1;color:#1c1917}
  .fr-gate-sub{margin:0;color:#78716c;font-size:13.5px;line-height:1.6}
  .fr-oak-box{background:#fff;border:1px solid #e9ddd0;border-radius:16px;padding:14px;color:#292524;font-size:13px;line-height:1.6}
  .fr-oak-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:600;font-size:12px;color:#1c1917}
  .fr-oak-avatar{width:24px;height:24px;display:grid;place-items:center;background:#f5efe6;border:1px solid #e9ddd0;border-radius:999px;font-size:13px}
  .fr-oak-tag{margin-left:auto;padding:3px 8px;background:#fdfbf7;border:1px solid #e9ddd0;border-radius:999px;font-size:11px;color:#78716c}
  .fr-oak-box p{margin:0}
  .fr-gate-meta{margin-top:auto;display:flex;flex-direction:column;gap:4px;padding-top:14px;border-top:1px solid #f2e8d9;font-size:12px;color:#a8a29e}
  .fr-gate-right{padding:24px 20px;display:flex;flex-direction:column;background:#fff}
  .fr-form-title{font-size:16px;font-weight:600;letter-spacing:-0.02em;color:#1c1917}
  .fr-form-sub{margin:6px 0 16px 0;font-size:13px;color:#78716c;line-height:1.5}
  .fr-field{display:grid;gap:6px;margin:12px 0}
  .fr-field span{font-size:12px;font-weight:600;color:#292524;letter-spacing:-0.01em}
  .fr-field input{padding:11px 12px;border:1px solid #e7ddd0;border-radius:10px;background:#fdfbf7;font-size:14px;transition:border-color 0.15s, box-shadow 0.15s}
  .fr-field input::placeholder{color:#a8a29e}
  .fr-field input:focus{outline:none;border-color:#1c1917;box-shadow:0 0 0 3px rgba(28,25,23,0.08);background:#fff}
  .fr-colors{display:flex;gap:8px;flex-wrap:wrap;padding-top:2px}
  .fr-dot{width:30px;height:30px;border-radius:999px;border:2px solid #fff;box-shadow:0 0 0 1px #e7ddd0, 0 1px 2px rgba(28,25,23,0.06);cursor:pointer;transition:transform 0.12s, box-shadow 0.12s}
  .fr-dot:hover{transform:scale(1.06)}
  .fr-dot.on{box-shadow:0 0 0 2px #1c1917, 0 2px 8px rgba(28,25,23,0.14);transform:scale(1.05)}
  .fr-btn{width:100%;padding:12px 16px;border-radius:12px;border:1px solid #1c1917;background:#1c1917;color:#fdfbf7;font-size:14px;font-weight:600;cursor:pointer;transition:opacity 0.15s, transform 0.12s;letter-spacing:-0.01em}
  .fr-btn:hover{opacity:0.92}
  .fr-btn:active{transform:scale(0.99)}
  .fr-btn:disabled{opacity:0.6;cursor:not-allowed}
  .fr-err{margin-top:10px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#991b1b;font-size:13px}
  .fr-hint{margin:8px 0 0 0;font-size:11.5px;color:#a8a29e;line-height:1.5;text-align:center}

  /* layout */
  .fr-landscape{max-width:1440px;width:100%;margin:0 auto;padding:20px;display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start;flex:1}
  .fr-game-col{display:flex;flex-direction:column;min-width:0}
  .fr-frame{position:relative;background:#fff;border:1px solid #e9ddd0;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(28,25,23,0.04), 0 4px 16px rgba(28,25,23,0.06)}
  .fr-frame .phaser-wrap{width:100% !important;aspect-ratio:16/9 !important;max-width:none !important;border:none !important;border-radius:0 !important}
  .fr-loading{height:360px;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:#fdfbf7;color:#78716c;font-size:13px;font-weight:500}
  .fr-spinner{width:20px;height:20px;border:2px solid #e9ddd0;border-top-color:#1c1917;border-radius:50%;animation:spin 0.7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .fr-loc-banner{position:absolute;top:10px;left:10px;padding:6px 10px;background:rgba(255,255,255,0.94);backdrop-filter:blur(8px);border:1px solid #e9ddd0;border-radius:999px;font-size:11.5px;font-weight:500;color:#44403c;box-shadow:0 1px 3px rgba(28,25,23,0.08);z-index:10}
  .fr-ctrl{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);padding:5px 10px;background:rgba(28,25,23,0.88);backdrop-filter:blur(8px);color:#fdfbf7;border-radius:999px;font-size:11px;font-weight:500;letter-spacing:-0.01em;white-space:nowrap;z-index:10;box-shadow:0 2px 8px rgba(28,25,23,0.18)}
  .fr-dialog{position:absolute;bottom:48px;left:10px;right:10px;background:#fff;border:1px solid #e9ddd0;border-radius:16px;padding:14px;z-index:15;box-shadow:0 12px 32px rgba(28,25,23,0.14)}
  .fr-dialog-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}
  .fr-who{padding:5px 10px;background:#1c1917;color:#fdfbf7;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:-0.01em}
  .fr-x{margin-left:auto;width:28px;height:28px;border-radius:999px;border:1px solid #e9ddd0;background:#fff;color:#78716c;cursor:pointer;display:grid;place-items:center;font-size:16px;line-height:1}
  .fr-x:hover{background:#fdfbf7;color:#1c1917}
  .fr-dialog-body{font-size:13.5px;line-height:1.6;color:#292524}
  .fr-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
  .fr-btn-sm{padding:8px 14px;border-radius:999px;border:1px solid #e7ddd0;background:#fff;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.12s}
  .fr-btn-sm:hover{background:#fdfbf7}
  .fr-btn-sm.primary{background:#1c1917;color:#fdfbf7;border-color:#1c1917}
  .fr-btn-sm.primary:hover{opacity:0.92}
  .fr-menu-overlay{position:absolute;inset:0;background:rgba(28,25,23,0.36);backdrop-filter:blur(4px);display:grid;place-items:center;z-index:20;padding:16px}
  .fr-start-box{width:min(360px,92%);background:#fff;border:1px solid #e9ddd0;border-radius:20px;overflow:hidden;box-shadow:0 16px 40px rgba(28,25,23,0.18)}
  .fr-start-title{padding:16px 16px 6px 16px;font-size:15px;font-weight:600;letter-spacing:-0.02em;color:#1c1917}
  .fr-start-sub{margin:0;padding:0 16px 12px 16px;font-size:13px;color:#78716c;border-bottom:1px solid #f5efe6}
  .fr-start-list{padding:12px;display:grid;gap:8px}
  .fr-start-item{padding:11px 14px;background:#fdfbf7;border:1px solid #f2e8d9;border-radius:12px;font-size:13px;font-weight:500;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#1c1917}
  .fr-start-item em{font-style:normal;color:#78716c;font-weight:500;background:#fff;padding:3px 8px;border-radius:999px;border:1px solid #e9ddd0;font-size:12px}
  .fr-start-item.as-btn{cursor:pointer;width:100%;text-align:left;transition:all 0.12s}
  .fr-start-item.as-btn:hover{background:#fff;border-color:#e7ddd0}
  .fr-start-item.on{background:#1c1917;color:#fdfbf7;border-color:#1c1917}
  .fr-start-item.on em{background:rgba(255,255,255,0.14);color:#fdfbf7;border-color:rgba(255,255,255,0.18)}
  .fr-trainer{margin:0 12px 12px 12px;background:#fdfbf7;border:1px solid #f2e8d9;border-radius:14px;padding:12px}
  .fr-trainer-head{font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#78716c;margin-bottom:8px}
  .fr-trainer-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f2e8d9;font-size:13px}
  .fr-trainer-row:last-child{border-bottom:none}
  .fr-trainer-row span{color:#78716c}
  .fr-trainer-row b{font-weight:600;color:#1c1917}
  .fr-side{display:grid;gap:16px;align-content:start;position:sticky;top:76px}
  .fr-box{background:#fff;border:1px solid #e9ddd0;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(28,25,23,0.03)}
  .fr-box-title{padding:11px 14px;font-size:12px;font-weight:600;letter-spacing:-0.01em;color:#1c1917;background:#fdfbf7;border-bottom:1px solid #f2e8d9;display:flex;align-items:center;gap:8px}
  .fr-box-title::before{content:"";width:6px;height:6px;border-radius:50%;background:#1c1917;flex-shrink:0}
  .fr-box-count{margin-left:auto;padding:2px 8px;background:#fff;border:1px solid #e9ddd0;border-radius:999px;font-size:11px;font-weight:600;color:#78716c}
  .fr-box-list{padding:10px;display:grid;gap:6px;max-height:240px;overflow:auto;background:#fff}
  .fr-row{display:flex;align-items:center;gap:8px;padding:9px 10px;background:#fdfbf7;border:1px solid #f2e8d9;border-radius:12px;font-size:13px;transition:all 0.12s}
  .fr-row.me{background:#1c1917;color:#fdfbf7;border-color:#1c1917}
  .fr-row.me .fr-row-name,.fr-row.me em{color:#fdfbf7}
  .fr-row i{width:8px;height:8px;border-radius:999px;border:1px solid rgba(28,25,23,0.08);flex-shrink:0}
  .fr-row-name{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fr-row em{margin-left:auto;font-style:normal;color:#78716c;font-size:12px;font-weight:500;background:#fff;padding:2px 7px;border-radius:999px;border:1px solid #e9ddd0;flex-shrink:0}
  .fr-row.me em{background:rgba(255,255,255,0.14);color:#fdfbf7;border-color:rgba(255,255,255,0.18)}
  .fr-row-dot{font-size:8px}
  .fr-muted{font-size:13px;color:#a8a29e;padding:8px}
  .fr-row-btn{width:100%;display:flex;align-items:center;gap:8px;padding:9px 10px;background:#fdfbf7;border:1px solid #f2e8d9;border-radius:12px;font-size:13px;cursor:pointer;text-align:left;transition:all 0.12s;color:#1c1917}
  .fr-row-btn:hover{background:#fff;border-color:#e7ddd0}
  .fr-row-btn.on{background:#1c1917;color:#fdfbf7;border-color:#1c1917}
  .fr-row-btn.on .fr-row-name,.fr-row-btn.on em{color:#fdfbf7}
  .fr-row-btn.on em{background:rgba(255,255,255,0.14);border-color:rgba(255,255,255,0.18)}
  .fr-row-btn i{width:8px;height:8px;border-radius:999px;flex-shrink:0;border:1px solid rgba(28,25,23,0.08)}
  .fr-help{padding:14px;font-size:13px;line-height:1.6;color:#292524;background:#fff}
  .fr-help p{margin:0 0 6px 0}
  .fr-help p:last-child{margin-bottom:0}
  .fr-help-muted{color:#78716c !important;font-size:12px !important;line-height:1.5 !important;margin-top:8px !important;padding-top:8px !important;border-top:1px solid #f5efe6}
  .fr-help code{background:#fdfbf7;border:1px solid #e9ddd0;padding:2px 6px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#1c1917}
  .fr-footer{padding:18px;text-align:center;font-size:12px;color:#a8a29e;border-top:1px solid #f2e8d9;margin-top:20px;letter-spacing:-0.01em}
  @media(max-width:980px){ .fr-landscape{grid-template-columns:1fr; padding:16px} .fr-side{position:static} .fr-gate-card{grid-template-columns:1fr} .fr-gate-left{border-right:none;border-bottom:1px solid #f2e8d9} .fr-header-inner{padding:0 16px} .fr-loc{display:none} }
  @media(max-width:640px){ .fr-header-inner{height:52px} .fr-title{font-size:14px} .fr-live{display:none} .fr-landscape{padding:12px;gap:16px} .fr-frame{border-radius:16px} .fr-ctrl{font-size:10px;padding:5px 10px;bottom:8px} .fr-loc-banner{font-size:11px;top:8px;left:8px} }
  /* feynman / dojo - FIXED overlay so it fits one screen */
  .fr-feynman-overlay{position:fixed;inset:0;z-index:50;background:rgba(28,25,23,0.42);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:grid;place-items:center;padding:16px;overflow:auto}
  .fr-feynman-modal{width:min(740px,100%);margin:auto;background:transparent;display:flex;justify-content:center}
  .fr-toast{position:absolute;top:16px;left:50%;transform:translateX(-50%);background:#1c1917;color:#fdfbf7;border:1px solid #292524;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:500;box-shadow:0 8px 24px rgba(28,25,23,0.22);z-index:40;white-space:nowrap;animation:toastIn 0.2s ease}
  @keyframes toastIn{from{transform:translateX(-50%) translateY(-6px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
  .dojo-box{border-color:#e9ddd0}
  .dojo-box .fr-box-title{border-bottom:1px solid #f2e8d9}
  .fr-dojo-card{display:flex;gap:12px;align-items:center;padding:14px;background:#fdfbf7;border-bottom:1px solid #f2e8d9}
  .fr-dojo-icon{width:40px;height:40px;display:grid;place-items:center;background:#fff;border:1px solid #e9ddd0;border-radius:12px;font-size:16px;flex-shrink:0}
  .fr-dojo-text{display:grid;gap:2px;line-height:1.25}
  .fr-dojo-text b{font-size:13px;font-weight:600;letter-spacing:-0.01em;color:#1c1917}
  .fr-dojo-text span{font-size:12px;color:#78716c}
  .fr-dojo-enter{margin-left:auto;padding:8px 14px;background:#1c1917;color:#fdfbf7;border:1px solid #1c1917;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.12s}
  .fr-dojo-enter:hover{opacity:0.92}
  .fr-dojo-enter.pulse{animation:pulseSoft 1.4s infinite}
  @keyframes pulseSoft{0%,100%{box-shadow:0 0 0 0 rgba(28,25,23,0.12)}50%{box-shadow:0 0 0 6px rgba(28,25,23,0.08)}}
  .fr-dojo-stats{display:flex;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #f2e8d9;font-size:12px;font-weight:500;color:#57534e}
  .fr-dojo-stats span{padding:5px 10px;background:#fdfbf7;border:1px solid #f2e8d9;border-radius:999px}
  .fr-dojo-xp{flex:1;position:relative;overflow:hidden}
  .fr-dojo-xp i{position:absolute;left:0;top:0;bottom:0;background:#1c1917;opacity:0.08;z-index:0}
  .fr-dojo-active{padding:8px 12px;background:#fdfbf7;color:#1c1917;font-size:12px;font-weight:500;border-bottom:1px solid #f2e8d9}
  .fr-dojo-hint{padding:8px 12px;background:#fff;font-size:11px;color:#a8a29e}
  /* minimap - live map */
  .fr-minimap-wrap{padding:10px;background:#fff;display:grid;gap:8px}
  .fr-minimap{position:relative;width:100%;height:180px;background:#fdfbf7;border:1px solid #f2e8d9;border-radius:12px;overflow:hidden}
  .fr-minimap-grid{position:absolute;inset:0;background-image:linear-gradient(#f2e8d9 1px, transparent 1px), linear-gradient(90deg, #f2e8d9 1px, transparent 1px);background-size:32px 32px;opacity:0.35}
  .fr-minimap-dojo{position:absolute;left:34.7%;top:37.5%;width:17.5%;height:7.5%;background:#fff;border:1.5px solid #1c1917;border-radius:4px;box-shadow:0 1px 4px rgba(28,25,23,0.12);background-image:linear-gradient(180deg,#fff 0%, #f59e0b 100%);opacity:0.95}
  .fr-minimap-dojo::after{content:"⛩";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:10px}
  .fr-minimap-dot{position:absolute;width:10px;height:10px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.24);transform:translate(-50%,-50%);transition:left 0.18s linear, top 0.18s linear}
  .fr-minimap-dot.npc{width:11px;height:11px;border-color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.28);z-index:2}
  .fr-minimap-dot.npc.active{width:13px;height:13px;border-color:#1c1917;box-shadow:0 0 0 3px rgba(245,158,11,0.5)}
  .fr-minimap-dot.player{width:10px;height:10px;z-index:3}
  .fr-minimap-dot.player.me{width:12px;height:12px;border-color:#1c1917 !important;box-shadow:0 0 0 3px rgba(28,25,23,0.18), 0 1px 4px rgba(0,0,0,0.24);z-index:4}
  .fr-minimap-legend{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:11px;color:#78716c}
  .fr-minimap-legend i{width:8px;height:8px;border-radius:50%;display:inline-block;vertical-align:middle;margin-right:4px}
  .fr-minimap-hint{margin-left:auto;font-size:10px;color:#a8a29e}
`;
