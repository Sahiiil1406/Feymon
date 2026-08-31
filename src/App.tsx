import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import PhaserGame from "./components/PhaserGame";
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
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="fr-gate-landscape">
      <div className="fr-gate-card">
        <div className="fr-gate-left">
          <div className="fr-oak">OAK</div>
          <div className="fr-speech">
            <p>Hello there! Welcome to the world of FEYMON!</p>
            <p>My name is OAK! People call me the FEYMON PROF!</p>
            <p>For some people, FEYMON are pets. Others use them for learning.</p>
            <p>Tell me, what is your name?</p>
          </div>
        </div>
        <div className="fr-gate-right">
          <div className="fr-form-title">NEW GAME</div>
          <form onSubmit={submit} className="fr-form">
            <label className="fr-field">
              <span>NAME</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ASH" maxLength={7} autoFocus />
            </label>
            <div className="fr-field">
              <span>COLOR</span>
              <div className="fr-colors">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} className={`fr-dot ${color === c ? "on" : ""}`} style={{ background: c }} aria-label={c} />
                ))}
              </div>
            </div>
            <button type="submit" disabled={loading} className="fr-btn">
              {loading ? "► ..." : "► OK"}
            </button>
            {err && <div className="fr-err">{err}</div>}
            <p className="fr-hint">© FEYMON • FIRE RED UI • CC0 ASSETS</p>
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
  const [chatInput, setChatInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);

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
  useEffect(() => {
    if (topics && topics.length === 0) seed({}).catch(() => {});
  }, [topics, seed]);

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
      if ((e.key === "Enter" || e.key === "m" || e.key === "M") && myId) setShowMenu((v) => !v);
      if (e.key === "Escape") { setShowMenu(false); setActiveNpcId(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [myId]);

  const activeNpc = useMemo(() => {
    if (!activeNpcId || !npcs) return null;
    return npcs.find((n: any) => n._id === activeNpcId) ?? null;
  }, [activeNpcId, npcs]);

  const latestChat = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    return messages[0];
  }, [messages]);

  const lastMoveRef = useRef<{x:number;y:number;dir:string}>({x:0,y:0,dir:"down"});
  const pendingRef = useRef(false);
  const doMove = useCallback((x: number, y: number, dir: "up"|"down"|"left"|"right") => {
    if (!playerIdConvex) return;
    const last = lastMoveRef.current;
    const dist = Math.hypot(x - last.x, y - last.y);
    if (dist < 1.2 && last.dir === dir && pendingRef.current) return;
    if (pendingRef.current) {
      lastMoveRef.current = {x,y,dir};
      return;
    }
    pendingRef.current = true;
    lastMoveRef.current = {x,y,dir};
    move({ playerId: playerIdConvex, x, y, direction: dir })
      .catch((e)=>{ console.warn("move failed", e); })
      .finally(()=>{
        pendingRef.current = false;
        const cur = lastMoveRef.current;
        if (Math.hypot(cur.x - x, cur.y - y) > 0.5 || cur.dir !== dir) {
          doMove(cur.x, cur.y, cur.dir as any);
        }
      });
  }, [playerIdConvex, move]);
  const handleMove = doMove;

  const handleInteract = useCallback((id: string) => setActiveNpcId(id), []);
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerIdConvex || !chatInput.trim()) return;
    const body = chatInput.trim(); setChatInput("");
    try { await sendMsg({ authorId: playerIdConvex, body, mapId: "overworld", channel: "world" }); } catch {}
  };
  const handleLogout = async () => {
    if (playerIdConvex) try { await setOffline({ playerId: playerIdConvex }); } catch {}
    clearStoredPlayer(); setMyId(null); setMyName(null);
  };

  if (!myId) {
    return <><style>{styles}</style><AccountGate onCreated={(id,n)=>{setMyId(id); setMyName(n);}} /></>;
  }

  const isLoading = !me || !online || !npcs;

  return (
    <>
      <style>{styles}</style>
      <div className="fr-root">
        <div className="fr-header">
          <div className="fr-header-inner">
            <span className="fr-ball">◉</span>
            <span className="fr-title">FEYMON</span>
            <span className="fr-route">FIRE RED</span>
            <span className="fr-loc">VILLAGE • ROUTE 1</span>
            <span className="fr-live"><i />{online?.length ?? 0} ONLINE</span>
            <button className="fr-menu-btn" onClick={() => setShowMenu(!showMenu)}>MENU</button>
            <button className="fr-quit" onClick={handleLogout}>QUIT</button>
          </div>
        </div>

        <div className="fr-landscape">
          <div className="fr-game-col">
            <div className="fr-game-frame">
              {isLoading ? <div className="fr-loading">LOADING...</div> : (
                <PhaserGame
                  myPlayerId={myId}
                  players={online as any}
                  npcs={npcs as any}
                  onMove={handleMove}
                  onInteractNpc={handleInteract}
                  latestChat={latestChat}
                />
              )}
              <div className="fr-loc-banner">FEYMON VILLAGE</div>
              <div className="fr-ctrl">MOVE: D-PAD/WASD • TALK: A(E) • MENU: START(ENTER)</div>

              {activeNpc && (
                <div className="fr-dialog">
                  <div className="fr-dialog-head">
                    <span className="fr-dialog-who">{activeNpc.name.toUpperCase()}</span>
                    <button className="fr-x" onClick={() => setActiveNpcId(null)}>×</button>
                  </div>
                  <div className="fr-dialog-body">“{activeNpc.introLine}”</div>
                  <div className="fr-dialog-actions">
                    <button className="fr-btn-sm" onClick={() => setActiveNpcId(null)}>B: BACK</button>
                    <button className="fr-btn-sm primary" onClick={() => { if(playerIdConvex) sendMsg({ authorId: playerIdConvex, body: `Hi ${activeNpc.name}!`, mapId:"overworld", channel:"nearby"});}}>A: HI</button>
                  </div>
                  <span className="fr-arrow">▼</span>
                </div>
              )}

              {showMenu && (
                <div className="fr-start-menu" onClick={() => setShowMenu(false)}>
                  <div className="fr-start-box" onClick={e=>e.stopPropagation()}>
                    <div className="fr-start-title">MENU</div>
                    <div className="fr-start-list">
                      <div className="fr-start-item on"><span>▶</span> MAP</div>
                      <div className="fr-start-item"><span> </span> ONLINE <em>{online?.length ?? 0}</em></div>
                      <div className="fr-start-item"><span> </span> NPCs <em>{npcs?.length ?? 0}</em></div>
                      <div className="fr-start-item"><span> </span> BAG</div>
                      <button className="fr-start-item as-btn" onClick={handleLogout}><span> </span> SAVE & QUIT</button>
                    </div>
                    <div className="fr-trainer">
                      <div className="fr-trainer-head">TRAINER</div>
                      <div className="fr-trainer-row"><span>NAME</span><b>{myName}</b></div>
                      <div className="fr-trainer-row"><span>LV</span><b>{(me as any)?.player?.level ?? 1}</b></div>
                      <div className="fr-trainer-row"><span>AT</span><b>{(me as any)?.presence ? `${Math.round((me as any).presence.x)},${Math.round((me as any).presence.y)}` : "—"}</b></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="fr-chat">
              <div className="fr-chat-head">
                <span>WORLD CHAT</span>
                <span className="fr-chat-count">{messages?.length ?? 0}</span>
              </div>
              <div className="fr-chat-log">
                {!messages ? <span className="fr-muted">LOADING...</span> :
                 messages.length===0 ? <span className="fr-muted">NO MESSAGES.</span> :
                 [...messages].reverse().slice(-8).map((m:any)=>(
                  <div key={m._id} className={`fr-msg ${m.authorId===myId?"me":""}`}>
                    <b style={{ color: online?.find((p:any)=>p.player._id===m.authorId)?.player?.color ?? "#000" }}>{m.authorName}:</b> {m.body}
                  </div>
                 ))}
              </div>
              <form onSubmit={handleSend} className="fr-chat-form">
                <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="SAY SOMETHING..." maxLength={30} />
                <button type="submit" disabled={!chatInput.trim()}>A</button>
              </form>
            </div>
          </div>

          <div className="fr-side">
            <div className="fr-box">
              <div className="fr-box-title">TRAINERS</div>
              <div className="fr-box-list">
                {!online ? <span className="fr-muted">LOADING...</span> : online.map((o:any)=>(
                  <div key={o.player._id} className={`fr-row ${o.player._id===myId?"me":""}`}>
                    <i style={{ background: o.player.color }} />
                    <span>{o.player.name}</span>
                    <em>Lv{o.player.level}</em>
                    <span className="fr-on">●</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="fr-box">
              <div className="fr-box-title">TOWN PEOPLE</div>
              <div className="fr-box-list">
                {npcs?.map((n:any)=>(
                  <button key={n._id} onClick={()=>handleInteract(n._id)} className={`fr-row-btn ${activeNpcId===n._id?"on":""}`}>
                    <i style={{ background: n.color }} />
                    <span>{n.name}</span>
                    <em>{n.role}</em>
                  </button>
                ))}
              </div>
            </div>
            <div className="fr-box soft">
              <div className="fr-box-title">CONTROLS</div>
              <div className="fr-help">
                <p>▲▼◄► / WASD — MOVE</p>
                <p><b>A</b> (E) — TALK</p>
                <p><b>START</b> (ENTER) — MENU</p>
                <p>CLICK GROUND — MOVE</p>
                <p className="fr-muted">Tiles: CC0 tiny16 / pokemon-inspired (208×144). Characters: Kenney roguelike CC0. Replace in <code>public/assets/</code></p>
              </div>
            </div>
          </div>
        </div>

        <div className="fr-footer">FEYMON • FIRE RED STYLE • OPEN SOURCE TILES (CC BY/SA) • KENNEY CC0 • NOT AFFILIATED WITH NINTENDO • LANDSCAPE 16:9</div>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:#080c18;color:#0a0a0a;font-family:'VT323',monospace}
  /* Landscape base */
  .fr-root{min-height:100dvh;display:flex;flex-direction:column;background:radial-gradient(900px 600px at 20% -10%, #1a2a4a 0%, #080c18 55%), linear-gradient(180deg, #0a0f1e 0%, #060a14 100%);color:#e8e8e8}
  .fr-header{position:sticky;top:0;z-index:20;background:linear-gradient(180deg, #2a4a8c 0%, #1e3a6a 100%);border-bottom:4px solid #000;box-shadow:0 4px 0 rgba(0,0,0,0.4)}
  .fr-header-inner{max-width:1280px;margin:0 auto;padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:'Press Start 2P',monospace;font-size:7px}
  .fr-ball{color:#ffcb05;font-size:12px;text-shadow:1px 1px 0 #000}
  .fr-title{color:#fff;letter-spacing:0.06em;text-shadow:1px 1px 0 #000;font-size:9px}
  .fr-route{color:#ffd700;background:#000;padding:4px 6px;border:2px solid #fff;box-shadow:2px 2px 0 #000}
  .fr-loc{margin-left:6px;color:#a8c0e8;background:#000;padding:4px 6px;border:2px solid #fff;font-size:6px}
  .fr-live{margin-left:auto;background:#000;color:#fff;padding:5px 8px;border:2px solid #fff;display:flex;align-items:center;gap:6px;box-shadow:2px 2px 0 #000}
  .fr-live i{width:7px;height:7px;background:#22c55e;border-radius:50%;box-shadow:0 0 6px #22c55e}
  .fr-menu-btn,.fr-quit{font-family:'Press Start 2P',monospace;font-size:6px;padding:7px 10px;border:3px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer}
  .fr-menu-btn{background:#ffcb05;color:#000}
  .fr-quit{background:#ff6b6b;color:#fff}
  /* Gate landscape */
  .fr-gate-landscape{min-height:100dvh;display:grid;place-items:center;padding:16px;background:radial-gradient(900px 600px at 50% -10%, #1a2a4a 0%, #080c18 60%)}
  .fr-gate-card{width:min(860px, 96vw);display:grid;grid-template-columns:1.1fr 0.9fr;gap:0;background:#f8f8f8;border:4px solid #000;box-shadow:6px 6px 0 #000;overflow:hidden}
  .fr-gate-left{background:linear-gradient(180deg, #5a8ad0 0%, #3a5a8c 100%);padding:16px;color:#fff;display:flex;flex-direction:column;gap:12px}
  .fr-oak{width:72px;height:72px;display:grid;place-items:center;background:#fff;border:4px solid #000;font:700 28px/1 monospace;color:#000;box-shadow:4px 4px 0 #000}
  .fr-speech{background:#fff;border:4px solid #000;box-shadow:4px 4px 0 rgba(0,0,0,0.3);padding:10px;color:#000;font-size:15px;line-height:1.4}
  .fr-speech p{margin:6px 0}
  .fr-gate-right{background:#fff;padding:16px;border-left:4px solid #000}
  .fr-form-title{font-family:'Press Start 2P',monospace;font-size:9px;background:#ffcb05;border:3px solid #000;padding:8px;text-align:center;box-shadow:3px 3px 0 #000}
  .fr-field{display:grid;gap:4px;margin:10px 0;font-family:'Press Start 2P',monospace;font-size:7px}
  .fr-field input{padding:9px;border:3px solid #000;font-family:'Press Start 2P',monospace;font-size:8px;box-shadow:inset 2px 2px 0 rgba(0,0,0,0.1)}
  .fr-colors{display:flex;gap:6px;flex-wrap:wrap}
  .fr-dot{width:24px;height:24px;border:3px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer}
  .fr-dot.on{outline:3px solid #ffcb05;outline-offset:2px}
  .fr-btn{width:100%;padding:10px;border:3px solid #000;background:#ffcb05;font-family:'Press Start 2P',monospace;font-size:8px;box-shadow:3px 3px 0 #000;cursor:pointer}
  .fr-hint{font-family:'Press Start 2P',monospace;font-size:5px;text-align:center;margin-top:8px;opacity:0.6}
  .fr-err{background:#ff6b6b;color:#fff;border:3px solid #000;padding:6px;font-family:'Press Start 2P',monospace;font-size:6px}
  /* Landscape main */
  .fr-landscape{max-width:1280px;width:100%;margin:0 auto;padding:14px;display:grid;grid-template-columns:1fr 300px;gap:14px;align-items:start;flex:1}
  .fr-game-col{display:flex;flex-direction:column;gap:12px;min-width:0}
  .fr-game-frame{position:relative;background:#000;border:4px solid #000;box-shadow:6px 6px 0 #000;overflow:hidden}
  .fr-game-frame .phaser-wrap{width:100% !important;aspect-ratio: 16 / 9 !important;max-width:none !important;border:none !important;border-radius:0 !important}
  .fr-loc-banner{position:absolute;top:8px;left:8px;background:linear-gradient(180deg, #2a4a8c 0%, #1e3a6a 100%);color:#fff;border:3px solid #000;padding:5px 8px;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:3px 3px 0 #000;z-index:10}
  .fr-ctrl{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);background:#000;color:#fff;font-family:'Press Start 2P',monospace;font-size:5px;padding:4px 8px;border:2px solid #fff;white-space:nowrap;z-index:10}
  .fr-loading{height:360px;display:grid;place-items:center;background:#78c850;font-family:'Press Start 2P',monospace;font-size:10px;color:#000}
  /* Dialog - FireRed exact */
  .fr-dialog{position:absolute;bottom:28px;left:8px;right:8px;background:#f8f8f8;border:4px solid #000;box-shadow:4px 4px 0 rgba(0,0,0,0.4), inset 2px 2px 0 #fff;padding:10px;z-index:15}
  .fr-dialog-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .fr-dialog-who{font-family:'Press Start 2P',monospace;font-size:7px;color:#c00;background:#fff;border:2px solid #000;padding:3px 6px;box-shadow:2px 2px 0 #000}
  .fr-x{margin-left:auto;width:20px;height:20px;border:2px solid #000;background:#ff6b6b;color:#fff;cursor:pointer;font:700 14px/1 monospace}
  .fr-dialog-body{font-family:'Press Start 2P',monospace;font-size:7px;line-height:1.6;color:#000}
  .fr-dialog-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}
  .fr-btn-sm{padding:6px 8px;border:3px solid #000;background:#fff;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:2px 2px 0 #000;cursor:pointer}
  .fr-btn-sm.primary{background:#ffcb05}
  .fr-arrow{position:absolute;bottom:6px;right:10px;animation:blink 0.8s infinite}
  @keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}
  .fr-start-menu{position:absolute;inset:0;background:rgba(0,0,0,0.6);display:grid;place-items:center;z-index:20;padding:12px}
  .fr-start-box{width:min(340px, 92%);background:linear-gradient(180deg, #5a8ad0 0%, #3a5a8c 100%);border:4px solid #000;box-shadow:6px 6px 0 #000;overflow:hidden}
  .fr-start-title{background:#ffcb05;border-bottom:4px solid #000;padding:8px;text-align:center;font-family:'Press Start 2P',monospace;font-size:9px}
  .fr-start-list{padding:8px;display:grid;gap:5px}
  .fr-start-item{padding:8px 10px;background:#f8f8f8;border:3px solid #000;font-family:'Press Start 2P',monospace;font-size:7px;display:flex;gap:8px;box-shadow:2px 2px 0 rgba(0,0,0,0.2)}
  .fr-start-item.on{background:#fff;border-color:#c00}
  .fr-start-item em{margin-left:auto;color:#3a5a8c}
  .fr-start-item.as-btn{cursor:pointer;width:100%;text-align:left}
  .fr-trainer{margin:8px;background:#f8f8f8;border:3px solid #000;padding:8px}
  .fr-trainer-head{font-family:'Press Start 2P',monospace;font-size:6px;background:#000;color:#fff;padding:4px;text-align:center}
  .fr-trainer-row{display:flex;justify-content:space-between;font-family:'Press Start 2P',monospace;font-size:6px;padding:4px 0;border-bottom:1px solid #e0e0e0}
  /* Chat */
  .fr-chat{background:#f8f8f8;border:4px solid #000;box-shadow:4px 4px 0 #000}
  .fr-chat-head{display:flex;justify-content:space-between;padding:6px 8px;background:#000;color:#fff;font-family:'Press Start 2P',monospace;font-size:6px}
  .fr-chat-count{background:#ffcb05;color:#000;padding:2px 6px;border:2px solid #fff}
  .fr-chat-log{max-height:140px;overflow:auto;padding:6px;display:flex;flex-direction:column;gap:4px;background:#fff;min-height:90px}
  .fr-msg{font-family:'Press Start 2P',monospace;font-size:6px;line-height:1.5;padding:5px 6px;background:#f0f0f0;border:2px solid #000;box-shadow:1px 1px 0 #000}
  .fr-msg.me{background:#fff8c0;border-color:#c00}
  .fr-chat-form{display:flex;gap:6px;padding:6px;background:#c0c0c0;border-top:3px solid #000}
  .fr-chat-form input{flex:1;padding:7px;border:3px solid #000;font-family:'Press Start 2P',monospace;font-size:6px}
  .fr-chat-form button{padding:7px 12px;border:3px solid #000;background:#ffcb05;font-family:'Press Start 2P',monospace;font-size:7px;box-shadow:2px 2px 0 #000;cursor:pointer}
  /* Side */
  .fr-side{display:grid;gap:12px;align-content:start}
  .fr-box{background:#f8f8f8;border:4px solid #000;box-shadow:4px 4px 0 #000;overflow:hidden}
  .fr-box-title{background:#000;color:#fff;padding:6px 8px;font-family:'Press Start 2P',monospace;font-size:6px;letter-spacing:0.06em}
  .fr-box-list{padding:6px;display:grid;gap:4px;max-height:200px;overflow:auto;background:#fff}
  .fr-row{display:flex;align-items:center;gap:6px;padding:6px;background:#f0f0f0;border:2px solid #000;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:1px 1px 0 #000}
  .fr-row.me{background:#fff8c0;border-color:#c00}
  .fr-row i{width:8px;height:8px;border:2px solid #000;flex-shrink:0}
  .fr-row em{margin-left:auto;color:#3a5a8c}
  .fr-on{color:#22c55e}
  .fr-row-btn{width:100%;display:flex;align-items:center;gap:6px;padding:6px;background:#f0f0f0;border:2px solid #000;font-family:'Press Start 2P',monospace;font-size:6px;cursor:pointer;box-shadow:1px 1px 0 #000;text-align:left}
  .fr-row-btn.on{background:#ffcb05}
  .fr-row-btn i{width:8px;height:8px;border:2px solid #000;flex-shrink:0}
  .fr-row-btn em{margin-left:auto;font-size:5px}
  .fr-help{padding:8px;font-family:'Press Start 2P',monospace;font-size:6px;line-height:1.6;background:#fff}
  .fr-help b{color:#c00}
  .fr-muted{color:#888;font-family:'Press Start 2P',monospace;font-size:6px}
  .fr-footer{padding:10px;text-align:center;font-family:'Press Start 2P',monospace;font-size:5px;color:#5a6a8a;border-top:2px solid #1a1a2e;margin-top:10px}
  @media(max-width:900px){
    .fr-landscape{grid-template-columns:1fr}
    .fr-gate-card{grid-template-columns:1fr}
    .fr-gate-card .fr-gate-right{border-left:none;border-top:4px solid #000}
  }
`;
