import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import PhaserGame from "./components/PhaserGame";
import DojoInterior from "./components/DojoInterior";
import LandingPage from "./components/LandingPage";
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
  const [showLanding, setShowLanding] = useState(true);
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
  if (showLanding) return <LandingPage onStart={() => setShowLanding(false)} />;
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

          </aside>
        </div>
        <footer className="fr-footer">Feymon — A minimal open world for learning. Inspired by Mobbin. Open source • Not affiliated with Nintendo.</footer>
      </div>
    </>
  );
}
const styles = `*{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:#000;color:#ededed;font-family:'Inter',system-ui,-apple-system,sans-serif}
  .fr-root{min-height:100dvh;display:flex;flex-direction:column;background:#000;color:#ededed;--ps-accent:#FF6B35;--ps-accent-2:#E85D2F;--ps-line:#1a1a1a;--ps-line2:#232323;--ps-card:#0a0a0a;--ps-bg:#000;--ps-muted:#8a8a8a;--ps-muted2:#666;}
  /* header - PlanetScale editorial */
  .fr-header{position:sticky;top:0;z-index:20;background:rgba(0,0,0,0.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid #1a1a1a}
  .fr-header-inner{max-width:1440px;margin:0 auto;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between;gap:16px}
  .fr-brand{display:flex;align-items:center;gap:10px;min-width:0}
  .fr-ball{width:28px;height:28px;display:grid;place-items:center;background:#FF6B35;color:#000;border-radius:6px;font-size:11px;flex-shrink:0;font-weight:800;border:1px solid #FF6B35}
  .fr-title{font-size:14px;font-weight:700;letter-spacing:-0.02em;color:#fff;font-family:'Inter',sans-serif}
  .fr-loc{margin-left:8px;padding:4px 10px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:999px;font-size:11px;font-weight:600;color:#8a8a8a;white-space:nowrap;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fr-header-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0}
  .fr-live{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:999px;font-size:11px;font-weight:600;color:#8a8a8a;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fr-live i{width:6px;height:6px;background:#FF6B35;border-radius:50%;box-shadow:0 0 0 4px rgba(255,107,53,0.10)}
  .fr-dojo-btn{padding:8px 14px;border-radius:8px;border:1px solid #FF6B35;background:#FF6B35;color:#000;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.15s;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fr-dojo-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
  .fr-dojo-btn.active{background:#0a0a0a;color:#FF6B35;border-color:#FF6B35}
  .fr-menu-btn{padding:8px 14px;border-radius:8px;border:1px solid #1a1a1a;background:#0a0a0a;color:#ededed;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fr-menu-btn:hover{background:#111;border-color:#232323;color:#fff}
  .fr-quit{padding:8px 12px;border-radius:8px;border:1px solid transparent;background:transparent;color:#666;font-size:12px;font-weight:600;cursor:pointer;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fr-quit:hover{background:#0a0a0a;color:#fff;border-color:#1a1a1a}

  /* gate - PlanetScale onboarding */
  .fr-gate{min-height:100dvh;display:grid;place-items:center;padding:32px 16px;background:#000;background-image:linear-gradient(rgba(255,107,53,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,26,1) 1px, transparent 1px);background-size:32px 32px, 32px 32px}
  .fr-gate-card{width:min(920px,100%);display:grid;grid-template-columns:1.1fr 0.9fr;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:16px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,107,53,0.04)}
  .fr-gate-left{padding:28px 24px;background:#000;display:flex;flex-direction:column;gap:14px;border-right:1px solid #1a1a1a;position:relative}
  .fr-gate-left::before{content:"";position:absolute;inset:0;background:radial-gradient(600px 300px at 20% 0%, rgba(255,107,53,0.06), transparent 72%);pointer-events:none}
  .fr-gate-brand{display:flex;align-items:center;gap:8px;position:relative}
  .fr-gate-logo{width:28px;height:28px;display:grid;place-items:center;background:#FF6B35;color:#000;border-radius:6px;font-size:11px;font-weight:800;border:1px solid #FF6B35}
  .fr-gate-brand-text{font-weight:700;letter-spacing:-0.02em;color:#fff}
  .fr-gate-badge{padding:3px 8px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:999px;font-size:10px;font-weight:700;color:#FF6B35;font-family:'JetBrains Mono',monospace;letter-spacing:0.08em;text-transform:uppercase}
  .fr-gate-h1{margin:6px 0 0 0;font-size:28px;font-weight:800;letter-spacing:-0.04em;line-height:0.96;color:#fff;position:relative}
  .fr-gate-sub{margin:0;color:#8a8a8a;font-size:13px;line-height:1.6;position:relative}
  .fr-oak-box{background:#0f0f0f;border:1px solid #1a1a1a;border-radius:12px;padding:14px;color:#ededed;font-size:13px;line-height:1.6;position:relative}
  .fr-oak-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:600;font-size:11px;color:#fff;font-family:'JetBrains Mono',monospace;letter-spacing:0.06em;text-transform:uppercase}
  .fr-oak-avatar{width:24px;height:24px;display:grid;place-items:center;background:#1a1a1a;border:1px solid #232323;border-radius:999px;font-size:12px;color:#FF6B35}
  .fr-oak-tag{margin-left:auto;padding:3px 8px;background:#000;border:1px solid #1a1a1a;border-radius:999px;font-size:10px;color:#666;font-family:'JetBrains Mono',monospace;letter-spacing:0.06em;text-transform:uppercase}
  .fr-oak-box p{margin:0}
  .fr-gate-meta{margin-top:auto;display:flex;flex-direction:column;gap:4px;padding-top:14px;border-top:1px solid #1a1a1a;font-size:11px;color:#666;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase;position:relative}
  .fr-gate-right{padding:24px 20px;display:flex;flex-direction:column;background:#0a0a0a;position:relative}
  .fr-form-title{font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#fff}
  .fr-form-sub{margin:6px 0 16px 0;font-size:12px;color:#8a8a8a;line-height:1.5}
  .fr-field{display:grid;gap:6px;margin:12px 0}
  .fr-field span{font-size:11px;font-weight:600;color:#ededed;letter-spacing:0.06em;text-transform:uppercase;font-family:'JetBrains Mono',monospace}
  .fr-field input{padding:11px 12px;border:1px solid #1a1a1a;border-radius:8px;background:#000;color:#fff;font-size:13px;transition:border-color 0.15s, box-shadow 0.15s;font-family:'Inter',sans-serif}
  .fr-field input::placeholder{color:#3a3a3a}
  .fr-field input:focus{outline:none;border-color:#FF6B35;box-shadow:0 0 0 3px rgba(255,107,53,0.08);background:#0a0a0a}
  .fr-colors{display:flex;gap:8px;flex-wrap:wrap;padding-top:2px}
  .fr-dot{width:30px;height:30px;border-radius:999px;border:2px solid #000;box-shadow:0 0 0 1px #232323, 0 1px 2px rgba(0,0,0,0.4);cursor:pointer;transition:transform 0.12s, box-shadow 0.12s}
  .fr-dot:hover{transform:scale(1.06)}
  .fr-dot.on{box-shadow:0 0 0 2px #FF6B35, 0 2px 8px rgba(255,107,53,0.14);transform:scale(1.05)}
  .fr-btn{width:100%;padding:12px 16px;border-radius:8px;border:1px solid #FF6B35;background:#FF6B35;color:#000;font-size:13px;font-weight:700;cursor:pointer;transition:opacity 0.15s, transform 0.12s;letter-spacing:0.04em;text-transform:uppercase;font-family:'JetBrains Mono',monospace}
  .fr-btn:hover{filter:brightness(1.05)}
  .fr-btn:active{transform:scale(0.99)}
  .fr-btn:disabled{opacity:0.5;cursor:not-allowed}
  .fr-err{margin-top:10px;padding:10px 12px;background:rgba(255,0,64,0.08);border:1px solid rgba(255,0,64,0.22);border-radius:8px;color:#ff6b8a;font-size:12px;font-family:'JetBrains Mono',monospace}
  .fr-hint{margin:8px 0 0 0;font-size:11px;color:#666;line-height:1.5;text-align:center;font-family:'JetBrains Mono',monospace}

  /* layout - PlanetScale tight */
  .fr-landscape{max-width:1280px;width:100%;margin:0 auto;padding:14px;display:grid;grid-template-columns:1fr 320px;gap:14px;align-items:start;flex:1;background:#000}
  .fr-game-col{display:flex;flex-direction:column;min-width:0}
  .fr-frame{position:relative;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px #1a1a1a, 0 8px 24px rgba(0,0,0,0.6)}
  .fr-frame .phaser-wrap{width:100% !important;aspect-ratio:16/9 !important;max-width:none !important;border:none !important;border-radius:0 !important}
  .fr-loading{height:360px;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:#0a0a0a;color:#8a8a8a;font-size:12px;font-weight:500;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fr-spinner{width:18px;height:18px;border:2px solid #1a1a1a;border-top-color:#FF6B35;border-radius:50%;animation:spin 0.7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .fr-loc-banner{position:absolute;top:10px;left:10px;padding:6px 10px;background:rgba(0,0,0,0.82);backdrop-filter:blur(10px);border:1px solid #1a1a1a;border-radius:999px;font-size:11px;font-weight:600;color:#ededed;box-shadow:0 1px 8px rgba(0,0,0,0.6);z-index:10;font-family:'JetBrains Mono',monospace;letter-spacing:0.03em;text-transform:uppercase}
  .fr-ctrl{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);padding:6px 12px;background:#FF6B35;color:#000;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;z-index:10;box-shadow:0 2px 12px rgba(255,107,53,0.22);font-family:'JetBrains Mono',monospace}
  .fr-dialog{position:absolute;bottom:48px;left:10px;right:10px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:12px;padding:14px;z-index:15;box-shadow:0 16px 40px rgba(0,0,0,0.7)}
  .fr-dialog-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}
  .fr-who{padding:5px 10px;background:#FF6B35;color:#000;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-family:'JetBrains Mono',monospace}
  .fr-x{margin-left:auto;width:28px;height:28px;border-radius:999px;border:1px solid #1a1a1a;background:#000;color:#666;cursor:pointer;display:grid;place-items:center;font-size:16px;line-height:1}
  .fr-x:hover{background:#111;color:#fff;border-color:#232323}
  .fr-dialog-body{font-size:13px;line-height:1.6;color:#ededed}
  .fr-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
  .fr-btn-sm{padding:8px 14px;border-radius:8px;border:1px solid #1a1a1a;background:#0a0a0a;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.12s;color:#ededed;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fr-btn-sm:hover{background:#111;border-color:#232323}
  .fr-btn-sm.primary{background:#FF6B35;color:#000;border-color:#FF6B35}
  .fr-btn-sm.primary:hover{filter:brightness(1.05)}
  .fr-menu-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);display:grid;place-items:center;z-index:20;padding:16px}
  .fr-start-box{width:min(360px,92%);background:#0a0a0a;border:1px solid #1a1a1a;border-radius:12px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.8)}
  .fr-start-title{padding:16px 16px 6px 16px;font-size:13px;font-weight:700;letter-spacing:-0.02em;color:#fff;font-family:'Inter',sans-serif}
  .fr-start-sub{margin:0;padding:0 16px 12px 16px;font-size:12px;color:#8a8a8a;border-bottom:1px solid #1a1a1a}
  .fr-start-list{padding:12px;display:grid;gap:8px}
  .fr-start-item{padding:11px 14px;background:#000;border:1px solid #1a1a1a;border-radius:8px;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#ededed;font-family:'JetBrains Mono',monospace;letter-spacing:0.03em;text-transform:uppercase}
  .fr-start-item em{font-style:normal;color:#8a8a8a;font-weight:500;background:#0a0a0a;padding:3px 8px;border-radius:999px;border:1px solid #1a1a1a;font-size:11px;font-family:'JetBrains Mono',monospace}
  .fr-start-item.as-btn{cursor:pointer;width:100%;text-align:left;transition:all 0.12s}
  .fr-start-item.as-btn:hover{background:#0f0f0f;border-color:#232323}
  .fr-start-item.on{background:#FF6B35;color:#000;border-color:#FF6B35}
  .fr-start-item.on em{background:rgba(0,0,0,0.12);color:#000;border-color:rgba(0,0,0,0.14)}
  .fr-trainer{margin:0 12px 12px 12px;background:#000;border:1px solid #1a1a1a;border-radius:10px;padding:12px}
  .fr-trainer-head{font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#666;margin-bottom:8px;font-family:'JetBrains Mono',monospace}
  .fr-trainer-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1a1a1a;font-size:12px;font-family:'JetBrains Mono',monospace}
  .fr-trainer-row:last-child{border-bottom:none}
  .fr-trainer-row span{color:#666}
  .fr-trainer-row b{font-weight:600;color:#fff}
  .fr-side{display:grid;gap:12px;align-content:start;position:sticky;top:64px}
  .fr-box{background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,0.4)}
  .fr-box-title{padding:8px 10px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ededed;background:#000;border-bottom:1px solid #1a1a1a;display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace}
  .fr-box-title::before{content:"";width:6px;height:6px;border-radius:50%;background:#FF6B35;flex-shrink:0;box-shadow:0 0 8px rgba(255,107,53,0.4)}
  .fr-box-count{margin-left:auto;padding:2px 8px;background:#000;border:1px solid #1a1a1a;border-radius:999px;font-size:10px;font-weight:700;color:#8a8a8a;font-family:'JetBrains Mono',monospace;letter-spacing:0.06em;text-transform:uppercase}
  .fr-box-list{padding:10px;display:grid;gap:6px;max-height:240px;overflow:auto;background:#0a0a0a}
  .fr-row{display:flex;align-items:center;gap:8px;padding:9px 10px;background:#000;border:1px solid #1a1a1a;border-radius:8px;font-size:12px;transition:all 0.12s;font-family:'JetBrains Mono',monospace}
  .fr-row.me{background:#FF6B35;color:#000;border-color:#FF6B35}
  .fr-row.me .fr-row-name,.fr-row.me em{color:#000}
  .fr-row i{width:8px;height:8px;border-radius:999px;border:1px solid rgba(255,255,255,0.08);flex-shrink:0}
  .fr-row-name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fr-row em{margin-left:auto;font-style:normal;color:#8a8a8a;font-size:11px;font-weight:600;background:#0a0a0a;padding:2px 7px;border-radius:999px;border:1px solid #1a1a1a;flex-shrink:0;font-family:'JetBrains Mono',monospace}
  .fr-row.me em{background:rgba(0,0,0,0.12);color:#000;border-color:rgba(0,0,0,0.14)}
  .fr-row-dot{font-size:8px}
  .fr-muted{font-size:12px;color:#666;padding:8px;font-family:'JetBrains Mono',monospace}
  .fr-row-btn{width:100%;display:flex;align-items:center;gap:8px;padding:9px 10px;background:#000;border:1px solid #1a1a1a;border-radius:8px;font-size:12px;cursor:pointer;text-align:left;transition:all 0.12s;color:#ededed;font-family:'JetBrains Mono',monospace}
  .fr-row-btn:hover{background:#111;border-color:#232323}
  .fr-row-btn.on{background:#FF6B35;color:#000;border-color:#FF6B35}
  .fr-row-btn.on .fr-row-name,.fr-row-btn.on em{color:#000}
  .fr-row-btn.on em{background:rgba(0,0,0,0.12);border-color:rgba(0,0,0,0.14)}
  .fr-row-btn i{width:8px;height:8px;border-radius:999px;flex-shrink:0;border:1px solid rgba(255,255,255,0.08)}
  .fr-help{padding:14px;font-size:12px;line-height:1.6;color:#ededed;background:#0a0a0a;font-family:'JetBrains Mono',monospace}
  .fr-help p{margin:0 0 6px 0}
  .fr-help p:last-child{margin-bottom:0}
  .fr-help b{color:#fff}
  .fr-help-muted{color:#666 !important;font-size:11px !important;line-height:1.5 !important;margin-top:8px !important;padding-top:8px !important;border-top:1px solid #1a1a1a;font-family:'JetBrains Mono',monospace}
  .fr-help code{background:#000;border:1px solid #1a1a1a;padding:2px 6px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#FF6B35}
  .fr-footer{padding:12px;text-align:center;font-size:11px;color:#666;border-top:1px solid #1a1a1a;margin-top:12px;letter-spacing:0.06em;text-transform:uppercase;font-family:'JetBrains Mono',monospace;background:#000}
  @media(max-width:980px){ .fr-landscape{grid-template-columns:1fr; padding:12px} .fr-side{position:static} .fr-gate-card{grid-template-columns:1fr} .fr-gate-left{border-right:none;border-bottom:1px solid #1a1a1a} .fr-header-inner{padding:0 16px} .fr-loc{display:none} }
  @media(max-width:640px){ .fr-header-inner{height:52px} .fr-title{font-size:13px} .fr-live{display:none} .fr-landscape{padding:10px;gap:12px} .fr-frame{border-radius:10px} .fr-ctrl{font-size:9px;padding:5px 10px;bottom:8px} .fr-loc-banner{font-size:10px;top:8px;left:8px} }
  /* feynman / dojo - PlanetScale overlay */
  .fr-feynman-overlay{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,0.78);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:grid;place-items:center;padding:16px;overflow:auto}
  .fr-feynman-modal{width:min(680px,94vw);margin:auto;background:transparent;display:flex;justify-content:center}
  .fr-toast{position:absolute;top:16px;left:50%;transform:translateX(-50%);background:#FF6B35;color:#000;border:1px solid #FF6B35;padding:10px 16px;border-radius:999px;font-size:11px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.6);z-index:40;white-space:nowrap;animation:toastIn 0.2s ease;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  @keyframes toastIn{from{transform:translateX(-50%) translateY(-6px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
  .dojo-box{border-color:#1a1a1a}
  .dojo-box .fr-box-title{border-bottom:1px solid #1a1a1a}
  .fr-dojo-card{display:flex;gap:10px;align-items:center;padding:10px;background:#0f0f0f;border-bottom:1px solid #1a1a1a}
  .fr-dojo-icon{width:32px;height:32px;display:grid;place-items:center;background:#000;border:1px solid #1a1a1a;border-radius:8px;font-size:14px;flex-shrink:0;color:#FF6B35}
  .fr-dojo-text{display:grid;gap:1px;line-height:1.2}
  .fr-dojo-text b{font-size:12px;font-weight:700;letter-spacing:-0.01em;color:#fff}
  .fr-dojo-text span{font-size:10px;color:#8a8a8a;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fr-dojo-enter{margin-left:auto;padding:7px 12px;background:#FF6B35;color:#000;border:1px solid #FF6B35;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all 0.12s;font-family:'JetBrains Mono',monospace;letter-spacing:0.06em;text-transform:uppercase}
  .fr-dojo-enter:hover{filter:brightness(1.05)}
  .fr-dojo-enter.pulse{animation:pulseSoft 1.4s infinite}
  @keyframes pulseSoft{0%,100%{box-shadow:0 0 0 0 rgba(255,107,53,0.14)}50%{box-shadow:0 0 0 5px rgba(255,107,53,0.08)}}
  .fr-dojo-stats{display:flex;gap:6px;padding:8px 10px;background:#000;border-bottom:1px solid #1a1a1a;font-size:10px;font-weight:600;color:#8a8a8a;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fr-dojo-stats span{padding:4px 8px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:999px}
  .fr-dojo-xp{flex:1;position:relative;overflow:hidden}
  .fr-dojo-xp i{position:absolute;left:0;top:0;bottom:0;background:#FF6B35;opacity:0.22;z-index:0}
  .fr-dojo-active{padding:6px 10px;background:#0a0a0a;color:#ededed;font-size:10px;font-weight:600;border-bottom:1px solid #1a1a1a;font-family:'JetBrains Mono',monospace;letter-spacing:0.03em}
  /* minimap - PlanetScale compact */
  .fr-minimap-wrap{padding:8px;background:#000;display:grid;gap:6px}
  .fr-minimap{position:relative;width:100%;height:148px;background:#000;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden}
  .fr-minimap-grid{position:absolute;inset:0;background-image:linear-gradient(#1a1a1a 1px, transparent 1px), linear-gradient(90deg, #1a1a1a 1px, transparent 1px);background-size:20px 20px;opacity:1}
  .fr-minimap-dojo{position:absolute;left:34.7%;top:37.5%;width:17.5%;height:7.5%;background:#FF6B35;border:1.5px solid #FF6B35;border-radius:4px;box-shadow:0 1px 8px rgba(255,107,53,0.14);opacity:0.95}
  .fr-minimap-dojo::after{content:"⛩";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:10px;color:#000}
  .fr-minimap-dot{position:absolute;width:10px;height:10px;border-radius:50%;border:2px solid #000;box-shadow:0 1px 6px rgba(0,0,0,0.6);transform:translate(-50%,-50%);transition:left 0.18s linear, top 0.18s linear}
  .fr-minimap-dot.npc{width:11px;height:11px;border-color:#000;box-shadow:0 1px 6px rgba(0,0,0,0.6);z-index:2}
  .fr-minimap-dot.npc.active{width:13px;height:13px;border-color:#FF6B35;box-shadow:0 0 0 3px rgba(255,107,53,0.22)}
  .fr-minimap-dot.player{width:10px;height:10px;z-index:3}
  .fr-minimap-dot.player.me{width:12px;height:12px;border-color:#FF6B35 !important;box-shadow:0 0 0 3px rgba(255,107,53,0.18), 0 1px 6px rgba(0,0,0,0.6);z-index:4}
  .fr-minimap-legend{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;color:#8a8a8a;font-family:'JetBrains Mono',monospace;letter-spacing:0.03em;text-transform:uppercase}
  .fr-minimap-legend i{width:8px;height:8px;border-radius:50%;display:inline-block;vertical-align:middle;margin-right:4px;border:1px solid #1a1a1a}
  .fr-minimap-hint{margin-left:auto;font-size:10px;color:#666;font-family:'JetBrains Mono',monospace}
`