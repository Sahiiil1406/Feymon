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
      <div className="fr-gate-card landscape">
        <div className="fr-gate-left">
          <div className="fr-oak-sprite">OAK</div>
          <div className="fr-oak-box">
            <p>Hello there! Welcome to the world of FEYMON!</p>
            <p>My name is OAK! People call me the FEYMON PROF!</p>
            <p>This world is inhabited by creatures called FEYMON!</p>
          </div>
        </div>
        <div className="fr-gate-right">
          <div className="fr-form-title">NEW TRAINER</div>
          <form onSubmit={submit} className="fr-form">
            <label className="fr-field"><span>NAME</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="ASH" maxLength={7} autoFocus /></label>
            <div className="fr-field"><span>COLOR</span>
              <div className="fr-colors">{COLORS.map((c) => (<button key={c} type="button" onClick={() => setColor(c)} className={`fr-dot ${color === c ? "on" : ""}`} style={{ background: c }} />))}</div>
            </div>
            <button type="submit" disabled={loading} className="fr-btn">{loading ? "► ..." : "► OK"}</button>
            {err && <div className="fr-err">{err}</div>}
            <p className="fr-hint">FIRE RED • 16x16 TILES • GRID MOVEMENT</p>
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
        <div className="fr-header">
          <div className="fr-header-inner">
            <span className="fr-ball">◉</span>
            <span className="fr-title">FEYMON FIRE RED</span>
            <span className="fr-loc">VILLAGE • ROUTE 1</span>
            <span className="fr-live"><i />{online?.length ?? 0} ONLINE</span>
            <button className={`fr-dojo-btn ${hasActiveLoop ? "active" : ""}`} onClick={() => setShowDojo(true)} title="Enter Feynman Dojo — North Gate (F)">
              {hasActiveLoop ? "◉ DOJO ●" : "⛩ DOJO"}
            </button>
            <button className="fr-menu-btn" onClick={() => setShowMenu(!showMenu)}>MENU</button>
            <button className="fr-quit" onClick={handleLogout}>QUIT</button>
          </div>
        </div>
        <div className="fr-landscape">
          <div className="fr-game-col">
            <div className="fr-frame">
              {isLoading ? <div className="fr-loading">LOADING...</div> : (
                <PhaserGame myPlayerId={myId} players={online as any} npcs={npcs as any} me={me as any} onMove={handleMove} onInteractNpc={handleInteract} onEnterFeynmanTower={handleEnterTower} latestChat={latestChat} />
              )}
              <div className="fr-loc-banner">FEYMON VILLAGE — ⛩ FEYNMAN DOJO AT NORTH GATE (walk north)</div>
              <div className="fr-ctrl">GRID MOVE: D-PAD/WASD • ENTER: TALK / ENTER DOJO • CLICK DOOR • F: DOJO • M: MENU</div>
              {activeNpc && (
                <div className="fr-dialog">
                  <div className="fr-dialog-head"><span className="fr-who">{activeNpc.name.toUpperCase()}</span><button className="fr-x" onClick={() => setActiveNpcId(null)}>×</button></div>
                  <div className="fr-dialog-body">“{activeNpc.introLine}”</div>
                  <div className="fr-dialog-actions"><button className="fr-btn-sm" onClick={() => setActiveNpcId(null)}>B: BACK</button><button className="fr-btn-sm primary" onClick={() => { if(playerIdConvex) sendMsg({ authorId: playerIdConvex, body: `Hi ${activeNpc.name}!`, mapId:"overworld", channel:"nearby"});}}>A: HI</button></div>
                  <span className="fr-arrow">▼</span>
                </div>
              )}
              {showMenu && (
                <div className="fr-menu-overlay" onClick={() => setShowMenu(false)}>
                  <div className="fr-start-box" onClick={e=>e.stopPropagation()}>
                    <div className="fr-start-title">MENU</div>
                    <div className="fr-start-list">
                      <div className="fr-start-item on"><span>▶</span> MAP</div>
                      <div className="fr-start-item"><span> </span> ONLINE <em>{online?.length ?? 0}</em></div>
                      <div className="fr-start-item"><span> </span> NPCs <em>{npcs?.length ?? 0}</em></div>
                      <button className="fr-start-item as-btn" onClick={handleLogout}><span> </span> QUIT</button>
                    </div>
                    <div className="fr-trainer"><div className="fr-trainer-head">TRAINER</div><div className="fr-trainer-row"><span>NAME</span><b>{myName}</b></div><div className="fr-trainer-row"><span>LV</span><b>{(me as any)?.player?.level ?? 1}</b></div><div className="fr-trainer-row"><span>XP</span><b>{(me as any)?.player?.xp ?? 0}/{((me as any)?.player?.level ?? 1)*100}</b></div><div className="fr-trainer-row"><span>AT</span><b>{(me as any)?.presence ? `${Math.round((me as any).presence.x)},${Math.round((me as any).presence.y)}` : "—"}</b></div></div>
                  </div>
                </div>
              )}
              {showDojo && (
                <div className="fr-feynman-overlay" onClick={() => setShowDojo(false)}>
                  <div className="fr-feynman-modal" onClick={e=>e.stopPropagation()}>
                    <DojoInterior playerId={myId} onExit={()=>setShowDojo(false)} onLeveledUp={(lvl,xp)=>showToast(`LEVEL UP! → LV ${lvl}  +${xp} XP`)} />
                  </div>
                </div>
              )}
              {toast && <div className="fr-toast">{toast}</div>}
            </div>
          </div>
          <div className="fr-side">
            <div className="fr-box dojo-box">
              <div className="fr-box-title">⛩ FEYNMAN DOJO — NORTH GATE</div>
              <div className="fr-dojo-card">
                <div className="fr-dojo-icon">⛩</div>
                <div className="fr-dojo-text">
                  <b>FEYNMAN DOJO</b>
                  <span>Moved to north gate — top center</span>
                  <span>Walk north + ENTER to go inside</span>
                </div>
                <button className={`fr-dojo-enter ${hasActiveLoop ? "pulse" : ""}`} onClick={()=>setShowDojo(true)}>{hasActiveLoop ? "● RESUME" : "▶ ENTER HOME"}</button>
              </div>
              <div className="fr-dojo-stats">
                <span>Lv {(me as any)?.player?.level ?? 1}</span>
                <span className="fr-dojo-xp"><i style={{width:`${Math.min(100, ((me as any)?.player?.xp ?? 0)/((me as any)?.player?.level ?? 1))}%`}} /> {(me as any)?.player?.xp ?? 0} XP</span>
                <span>{(me as any)?.player?.totalExplanations ?? 0} loops</span>
              </div>
              {hasActiveLoop && <div className="fr-dojo-active">● ACTIVE: “{(activeFeynman?.session as any)?.topic}” {activeFeynman?.session.turnCount}/{activeFeynman?.session.maxTurns}</div>}
              <div className="fr-dojo-hint">Inside: lobby → allow mic → START TRAINING → voice loop → rating &amp; XP</div>
            </div>
            <div className="fr-box"><div className="fr-box-title">TRAINERS</div><div className="fr-box-list">{!online ? <span className="fr-muted">LOADING...</span> : online.map((o:any)=>(<div key={o.player._id} className={`fr-row ${o.player._id===myId?"me":""}`}><i style={{ background: o.player.color }} /><span>{o.player.name}</span><em>Lv{o.player.level}</em><span className="fr-dot">●</span></div>))}</div></div>
            <div className="fr-box"><div className="fr-box-title">TOWN PEOPLE</div><div className="fr-box-list">{npcs?.map((n:any)=>(<button key={n._id} onClick={()=>handleInteract(n._id)} className={`fr-row-btn ${activeNpcId===n._id?"on":""}`}><i style={{ background: n.color }} /><span>{n.name}</span><em>{n.role}</em></button>))}</div></div>
            <div className="fr-box soft"><div className="fr-box-title">FIRE RED CONTROLS</div><div className="fr-help"><p>GRID MOVE: One tile per press (32px)</p><p><b>ENTER</b> — TALK to NPC / enter <b>⛩ DOJO</b> (north gate)</p><p><b>F</b> — Open DOJO anywhere</p><p><b>M</b> — MENU</p><p>Go to <b>FEYNMAN DOJO</b> (north) + <b>ENTER</b> → enter home → START TRAINING</p><p>🎙️ uses <b>Web Speech API</b> — click SPEAK → Allow mic</p><p>LLM via <b>convex/ai.ts</b> — <code>LLM_PROVIDER</code> in .env</p></div></div>
          </div>
        </div>
        <div className="fr-footer">FEYMON • FIRE RED GRID • FEYNMAN DOJO • OPEN SOURCE • NOT AFFILIATED WITH NINTENDO</div>
      </div>
    </>
  );
}
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Inter:wght@500;700&display=swap');
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:#050a1a;color:#0a0a0a;font-family:'VT323',monospace}
  .fr-root{min-height:100dvh;display:flex;flex-direction:column;background:radial-gradient(1000px 600px at 50% -10%, #1a2f5a 0%, #080c18 55%), linear-gradient(180deg, #0a1020 0%, #050a1a 100%)}
  .fr-header{position:sticky;top:0;z-index:20;background:linear-gradient(180deg, #2e4a8a 0%, #1a2f5a 100%);border-bottom:4px solid #000;box-shadow:0 4px 0 rgba(0,0,0,0.5)}
  .fr-header-inner{max-width:1280px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:'Press Start 2P',monospace;font-size:7px}
  .fr-ball{color:#ffcb05;font-size:12px;text-shadow:1px 1px 0 #000}
  .fr-title{color:#fff;letter-spacing:0.06em;text-shadow:1px 1px 0 #000;font-size:9px}
  .fr-loc{margin-left:6px;color:#a8c0e8;background:#000;padding:4px 8px;border:2px solid #fff;font-size:6px;box-shadow:2px 2px 0 #000}
  .fr-live{margin-left:auto;background:#000;color:#fff;padding:6px 10px;border:2px solid #fff;display:flex;align-items:center;gap:6px;box-shadow:2px 2px 0 #000}
  .fr-live i{width:7px;height:7px;background:#22c55e;border-radius:50%;box-shadow:0 0 8px #22c55e;animation:pulse 1.6s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
  .fr-dojo-btn{font-family:'Press Start 2P',monospace;font-size:6px;padding:8px 10px;border:3px solid #000;background:#fff;color:#000;box-shadow:2px 2px 0 #000;cursor:pointer}
  .fr-dojo-btn.active{background:#ffcb05;animation:blink 0.9s infinite}
  .fr-dojo-btn:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #000}
  .fr-menu-btn,.fr-quit{font-family:'Press Start 2P',monospace;font-size:6px;padding:8px 12px;border:3px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer;transition:transform 0.08s}
  .fr-menu-btn{background:#ffcb05;color:#000}
  .fr-menu-btn:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #000}
  .fr-quit{background:#ff5a5a;color:#fff}
  .fr-gate{min-height:100dvh;display:grid;place-items:center;padding:20px;background:radial-gradient(800px 500px at 50% 0%, #1e3a6a 0%, #080c18 70%)}
  .fr-gate-card{width:min(900px, 96vw);display:grid;grid-template-columns:1.05fr 0.95fr;gap:0;background:#f8f8f8;border:4px solid #000;box-shadow:8px 8px 0 #000;overflow:hidden;border-radius:2px}
  .fr-gate-left{background:linear-gradient(180deg, #5a8ad0 0%, #3a5a8c 100%);padding:20px;color:#fff;display:flex;flex-direction:column;gap:14px;position:relative}
  .fr-gate-left::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.04) 3px 4px);pointer-events:none}
  .fr-oak-sprite{width:72px;height:72px;display:grid;place-items:center;background:#fff;border:4px solid #000;font:700 28px/1 'Press Start 2P',monospace;color:#000;box-shadow:4px 4px 0 #000}
  .fr-oak-box{background:#fff;border:4px solid #000;box-shadow:4px 4px 0 rgba(0,0,0,0.3);padding:12px;color:#000;font-size:16px;line-height:1.5;position:relative}
  .fr-oak-box::before{content:"PROF. OAK";position:absolute;top:-12px;left:12px;background:#ffcb05;border:3px solid #000;padding:3px 8px;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:2px 2px 0 #000}
  .fr-gate-right{background:#fff;padding:20px;border-left:4px solid #000;display:flex;flex-direction:column}
  .fr-form-title{font-family:'Press Start 2P',monospace;font-size:9px;background:#ffcb05;border:3px solid #000;padding:9px;text-align:center;box-shadow:3px 3px 0 #000;letter-spacing:0.04em}
  .fr-field{display:grid;gap:6px;margin:14px 0;font-family:'Press Start 2P',monospace;font-size:7px}
  .fr-field input{padding:10px 12px;border:3px solid #000;font-family:'Press Start 2P',monospace;font-size:8px;box-shadow:inset 2px 2px 0 rgba(0,0,0,0.08);background:#fffff8}
  .fr-field input:focus{outline:none;background:#ffffcc;border-color:#2a4a8a}
  .fr-colors{display:flex;gap:8px;flex-wrap:wrap}
  .fr-dot{width:26px;height:26px;border:3px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer;transition:transform 0.08s}
  .fr-dot:hover{transform:translateY(-1px)}
  .fr-dot.on{outline:3px solid #ffcb05;outline-offset:2px;transform:scale(1.05)}
  .fr-btn{width:100%;padding:11px;border:3px solid #000;background:#ffcb05;font-family:'Press Start 2P',monospace;font-size:8px;box-shadow:3px 3px 0 #000;cursor:pointer;letter-spacing:0.04em}
  .fr-btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #000}
  .fr-landscape{max-width:1280px;width:100%;margin:0 auto;padding:16px;display:grid;grid-template-columns:1.45fr 320px;gap:16px;align-items:start;flex:1}
  .fr-game-col{display:flex;flex-direction:column;gap:14px;min-width:0}
  .fr-frame{position:relative;background:#000;border:4px solid #000;box-shadow:6px 6px 0 #000;overflow:hidden;border-radius:2px}
  .fr-frame .phaser-wrap{width:100% !important;aspect-ratio: 16 / 9 !important;max-width:none !important;border:none !important;border-radius:0 !important}
  .fr-loading{height:360px;display:grid;place-items:center;background:#78c850;font-family:'Press Start 2P',monospace;font-size:10px;color:#000;letter-spacing:0.04em}
  .fr-loc-banner{position:absolute;top:10px;left:10px;background:linear-gradient(180deg, #2a4a8c 0%, #1e3a6a 100%);color:#fff;border:3px solid #000;padding:6px 10px;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:3px 3px 0 #000;z-index:10;letter-spacing:0.04em}
  .fr-ctrl{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:#000;color:#fff;font-family:'Press Start 2P',monospace;font-size:5px;padding:5px 10px;border:2px solid #fff;white-space:nowrap;z-index:10;box-shadow:2px 2px 0 rgba(0,0,0,0.5)}
  .fr-dialog{position:absolute;bottom:32px;left:10px;right:10px;background:#f8f8f8;border:4px solid #000;box-shadow:4px 4px 0 rgba(0,0,0,0.4);padding:12px;z-index:15}
  .fr-dialog-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .fr-who{font-family:'Press Start 2P',monospace;font-size:7px;color:#c00;background:#fff;border:2px solid #000;padding:4px 8px;box-shadow:2px 2px 0 #000}
  .fr-x{margin-left:auto;width:22px;height:22px;border:2px solid #000;background:#ff5a5a;color:#fff;cursor:pointer;font:700 14px/1 monospace;display:grid;place-items:center}
  .fr-dialog-body{font-family:'Press Start 2P',monospace;font-size:7px;line-height:1.7;color:#000}
  .fr-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
  .fr-btn-sm{padding:7px 10px;border:3px solid #000;background:#fff;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:2px 2px 0 #000;cursor:pointer}
  .fr-btn-sm.primary{background:#ffcb05}
  .fr-btn-sm:active{transform:translate(1px,1px);box-shadow:1px 1px 0 #000}
  .fr-arrow{position:absolute;bottom:8px;right:12px;animation:blink 0.8s infinite;font-size:10px}
  @keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}
  .fr-menu-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.65);display:grid;place-items:center;z-index:20;padding:16px;backdrop-filter:blur(2px)}
  .fr-start-box{width:min(340px, 92%);background:linear-gradient(180deg, #5a8ad0 0%, #3a5a8c 100%);border:4px solid #000;box-shadow:6px 6px 0 #000;overflow:hidden}
  .fr-start-title{background:#ffcb05;border-bottom:4px solid #000;padding:10px;text-align:center;font-family:'Press Start 2P',monospace;font-size:9px;letter-spacing:0.06em}
  .fr-start-list{padding:10px;display:grid;gap:6px}
  .fr-start-item{padding:10px 12px;background:#f8f8f8;border:3px solid #000;font-family:'Press Start 2P',monospace;font-size:7px;display:flex;gap:8px;box-shadow:2px 2px 0 rgba(0,0,0,0.2);align-items:center}
  .fr-start-item em{margin-left:auto;color:#3a5a8c}
  .fr-start-item.as-btn{cursor:pointer;width:100%;text-align:left}
  .fr-start-item.on{background:#fff8c0;border-color:#c00}
  .fr-trainer{margin:10px;background:#f8f8f8;border:3px solid #000;padding:10px}
  .fr-trainer-head{font-family:'Press Start 2P',monospace;font-size:6px;background:#000;color:#fff;padding:5px;text-align:center;letter-spacing:0.04em}
  .fr-trainer-row{display:flex;justify-content:space-between;font-family:'Press Start 2P',monospace;font-size:6px;padding:5px 0;border-bottom:1px solid #e0e0e0}
  .fr-side{display:grid;gap:14px;align-content:start}
  .fr-box{background:#f8f8f8;border:4px solid #000;box-shadow:4px 4px 0 #000;overflow:hidden}
  .fr-box-title{background:#000;color:#fff;padding:8px 10px;font-family:'Press Start 2P',monospace;font-size:6px;letter-spacing:0.06em;display:flex;align-items:center;gap:6px}
  .fr-box-title::before{content:"";width:3px;height:10px;background:#ffcb05;display:inline-block}
  .fr-box-list{padding:8px;display:grid;gap:5px;max-height:220px;overflow:auto;background:#fff}
  .fr-box-list::-webkit-scrollbar{width:6px}
  .fr-box-list::-webkit-scrollbar-thumb{background:#c0c0c0;border:1px solid #000}
  .fr-row{display:flex;align-items:center;gap:8px;padding:7px 8px;background:#f0f0f0;border:2px solid #000;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:1px 1px 0 #000}
  .fr-row.me{background:#fff8c0;border-color:#c00}
  .fr-row i{width:9px;height:9px;border:2px solid #000;flex-shrink:0}
  .fr-row em{margin-left:auto;color:#3a5a8c}
  .fr-dot{color:#22c55e}
  .fr-row-btn{width:100%;display:flex;align-items:center;gap:8px;padding:7px 8px;background:#f0f0f0;border:2px solid #000;font-family:'Press Start 2P',monospace;font-size:6px;cursor:pointer;box-shadow:1px 1px 0 #000;text-align:left;transition:background 0.08s}
  .fr-row-btn:hover{background:#fff}
  .fr-row-btn.on{background:#ffcb05}
  .fr-help{padding:10px;font-family:'Press Start 2P',monospace;font-size:6px;line-height:1.7;background:#fff}
  .fr-footer{padding:12px;text-align:center;font-family:'Press Start 2P',monospace;font-size:5px;color:#5a6a8a;border-top:2px solid #1a1a2e;margin-top:16px;letter-spacing:0.04em}
  @media(max-width:900px){ .fr-landscape{grid-template-columns:1fr} .fr-gate-card{grid-template-columns:1fr} .fr-gate-right{border-left:none;border-top:4px solid #000} }
  /* Feynman Dojo */
  .fr-feynman-overlay{position:absolute;inset:0;z-index:30;background:rgba(0,0,0,0.68);display:grid;place-items:start center;padding:12px;overflow:auto;backdrop-filter:blur(3px)}
  .fr-feynman-modal{width:min(740px, 96%);margin:12px auto;background:transparent}
  .fr-toast{position:absolute;top:42px;left:50%;transform:translateX(-50%);background:#000;color:#ffcb05;border:3px solid #ffcb05;padding:10px 16px;font-family:'Press Start 2P',monospace;font-size:7px;box-shadow:4px 4px 0 #000;z-index:40;white-space:nowrap;animation:toastIn 0.2s}
  @keyframes toastIn{from{transform:translateX(-50%) translateY(-8px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
  .dojo-box{border-color:#c00}
  .dojo-box .fr-box-title{background:#c00}
  .fr-dojo-card{display:flex;gap:10px;align-items:center;padding:10px;background:linear-gradient(180deg,#fff 0%,#fff8c0 100%);border-bottom:3px solid #000}
  .fr-dojo-icon{width:48px;height:48px;display:grid;place-items:center;background:#ffcb05;border:3px solid #000;font-size:22px;box-shadow:2px 2px 0 #000;flex-shrink:0}
  .fr-dojo-text{display:grid;gap:1px;font-family:'Press Start 2P',monospace;line-height:1.2}
  .fr-dojo-text b{font-size:7px}
  .fr-dojo-text span{font-size:5.5px;color:#333;font-family:'VT323',monospace}
  .fr-dojo-enter{margin-left:auto;padding:9px 12px;background:#ffcb05;border:3px solid #000;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:2px 2px 0 #000;cursor:pointer;white-space:nowrap}
  .fr-dojo-enter.pulse{animation:blink 0.9s infinite;background:#fff}
  .fr-dojo-enter:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #000}
  .fr-dojo-stats{display:flex;gap:8px;padding:8px;background:#fff;border-bottom:2px solid #000;font-family:'Press Start 2P',monospace;font-size:5.5px}
  .fr-dojo-stats span{background:#f0f0f0;border:2px solid #000;padding:4px 6px;box-shadow:1px 1px 0 #000}
  .fr-dojo-xp{flex:1;position:relative;overflow:hidden}
  .fr-dojo-xp i{position:absolute;left:0;top:0;bottom:0;background:#ffcb05;opacity:0.5;z-index:0}
  .fr-dojo-active{padding:7px 10px;background:#000;color:#ffcb05;font-family:'Press Start 2P',monospace;font-size:5.5px;letter-spacing:0.02em}
  .fr-dojo-hint{padding:6px 8px;background:#fff3c0;border-top:2px dashed #bbb;font-family:'Press Start 2P',monospace;font-size:5px;color:#333}
`;
