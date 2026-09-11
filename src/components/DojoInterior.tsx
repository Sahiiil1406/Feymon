import { useEffect, useState } from "react";
import FeynmanLoop from "./FeynmanLoop";

type Props = {
  playerId: string;
  onExit: () => void;
  onLeveledUp?: (lvl: number, xp: number) => void;
};

export default function DojoInterior({ playerId, onExit, onLeveledUp }: Props) {
  const [phase, setPhase] = useState<"lobby" | "training">("lobby");
  const [permStatus, setPermStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      // @ts-ignore
      navigator.permissions?.query?.({ name: "microphone" as any }).then((r: any) => {
        if (r.state === "granted") setPermStatus("granted");
        else if (r.state === "denied") setPermStatus("denied");
        else setPermStatus("prompt");
      });
    } catch {}
  }, []);

  const askMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setPermStatus("granted");
    } catch (e: any) {
      if (e?.name === "NotAllowedError") setPermStatus("denied");
      else setPermStatus("prompt");
    }
  };

  if (phase === "training") {
    return (
      <div className="dojo-interior training">
        <style>{styles}</style>
        <div className="dojo-bar">
          <button className="dojo-back" onClick={() => setPhase("lobby")}>
            ← Lobby
          </button>
          <span className="dojo-title">Dojo — Training Hall</span>
          <span className="dojo-live">
            <i /> LIVE LOOP
          </span>
          <button className="dojo-exit" onClick={onExit}>
            Exit
          </button>
        </div>
        <div className="dojo-training-wrap">
          <FeynmanLoop playerId={playerId} onClose={() => setPhase("lobby")} onLeveledUp={onLeveledUp} />
        </div>
      </div>
    );
  }

  return (
    <div className="dojo-interior lobby">
      <style>{styles}</style>
      <div className="dojo-bar">
        <div className="dojo-dots">
          <span />
          <span />
          <span />
        </div>
        <span className="dojo-title">feynman.dojo — central.building</span>
        <span className="dojo-live">
          <i /> READY
        </span>
        <button className="dojo-exit" onClick={onExit}>
          Exit
        </button>
      </div>

      <div className="dojo-room">
        <div className="dojo-grid" />
        <div className="dojo-glow" />
        <div className="dojo-room-head">
          <span className="mono">PLAZA › DOJO › LOBBY</span>
          <span className="mono dim">1.4.0 — realtime • smooth</span>
        </div>
        <div className="dojo-stage">
          <div className="dojo-avatar-ring">
            <div className="ring-bg" />
            <div className="ring-progress" style={{ background: `conic-gradient(#FF6B35 68%, #1a1a1a 0)` }} />
            <div className="ring-inner">
              <span className="ring-lv">Lv7</span>
              <span className="ring-sub">68% → Lv8</span>
            </div>
            <span className="ring-spark">✦</span>
          </div>
          <div className="dojo-desk">
            <div className="dojo-sensei">先</div>
            <div className="dojo-scroll">AI SENSEI • FEYNMAN</div>
            <span className="dojo-ver">v3</span>
          </div>
          <div className="dojo-evo-mini">
            <span>Lv1</span>
            <i>→</i>
            <span className="on">Lv7</span>
            <i className="lime">→</i>
            <span className="next">Lv8 + Desert</span>
          </div>
        </div>
      </div>

      <div className="dojo-lobby">
        <div className="dojo-lobby-left">
          <h3 className="dojo-h">You entered the Evolution Dojo</h3>
          <p className="dojo-p">
            No distractions. Pick a topic, teach it simply, and watch your avatar evolve — new skin, aura and region on every level.
          </p>

          <div className="dojo-timeline">
            <div className="tl-step">
              <span className="tl-num">01</span>
              <div>
                <b>Pick topic</b>
                <p>5 seeds or your own • one click</p>
              </div>
              <i className="tl-line" />
            </div>
            <div className="tl-step">
              <span className="tl-num">02</span>
              <div>
                <b>Explain</b>
                <p>Voice or type • AI listens</p>
              </div>
              <i className="tl-line" />
            </div>
            <div className="tl-step">
              <span className="tl-num">03</span>
              <div>
                <b>Counter</b>
                <p>One sharp Socratic probe</p>
              </div>
              <i className="tl-line" />
            </div>
            <div className="tl-step">
              <span className="tl-num lime">04</span>
              <div>
                <b>Evolve</b>
                <p>Score 1–10 → XP → unlock</p>
              </div>
            </div>
          </div>
        </div>

        <div className="dojo-lobby-right">
          <div className="dojo-avatar-card">
            <div className="avatar-head">
              <span>◎</span>
              <div>
                <b>Lv7 Explainer</b>
                <p>1,240 XP • Desert Outpost next</p>
              </div>
              <span className="avatar-badge">68%</span>
            </div>
            <div className="avatar-bar">
              <i style={{ width: "68%" }} />
            </div>
            <div className="avatar-unlocks">
              <span>New character</span>
              <span>New aura</span>
              <span>New region</span>
            </div>
          </div>

          <div className="dojo-mic-card">
            <div className="dojo-mic-status">
              <span className={`mic-dot ${permStatus}`}>●</span>
              <span className="mic-label">
                {permStatus === "granted"
                  ? "Microphone ready"
                  : permStatus === "denied"
                    ? "Mic blocked — allow in browser"
                    : "Voice ready • or type"}
              </span>
              <span className={`mic-pill ${permStatus}`}>{permStatus === "granted" ? "Ready" : permStatus === "denied" ? "Blocked" : "Check"}</span>
            </div>
            {permStatus !== "granted" && (
              <button className="dojo-btn mic" onClick={askMic}>
                Allow mic
              </button>
            )}
          </div>

          <button className="dojo-btn primary big" onClick={() => setPhase("training")}>
            Start training — evolve →
          </button>
          <button className="dojo-btn ghost" onClick={onExit}>
            Back to plaza
          </button>
          <p className="dojo-hint">Smooth • 60fps • Abandon anytime • Web Speech + typing • No install</p>
        </div>
      </div>
    </div>
  );
}

const styles = `.dojo-interior{width:min(720px,94vw);height:min(84dvh, 660px);max-height:84dvh;overflow:hidden;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,107,53,0.06);animation:dojoIn 0.45s cubic-bezier(0.16,1,0.3,1)}
  @keyframes dojoIn{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  .dojo-interior.training{height:min(86dvh, 680px)}
  .dojo-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#000;border-bottom:1px solid #1a1a1a;color:#ededed;font-size:12px;font-weight:500;flex-shrink:0;font-family:'JetBrains Mono',monospace}
  .dojo-dots{ display:flex; gap:6px; margin-right:4px; }
  .dojo-dots span{ width:9px; height:9px; border-radius:50%; background:#1a1a1a; border:1px solid #232323; }
  .dojo-dots span:nth-child(1){ background:#ff5f56; border-color:#ff5f56; }
  .dojo-dots span:nth-child(2){ background:#ffbd2e; border-color:#ffbd2e; }
  .dojo-dots span:nth-child(3){ background:#27c93f; border-color:#27c93f; }
  .dojo-title{flex:1;text-align:center;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#8a8a8a;font-size:11px}
  .dojo-live{ display:inline-flex; gap:6px; align-items:center; padding:4px 8px; background:rgba(255,107,53,0.08); border:1px solid rgba(255,107,53,0.14); border-radius:999px; color:#FF6B35; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; }
  .dojo-live i{ width:6px; height:6px; background:#FF6B35; border-radius:50%; box-shadow:0 0 0 4px rgba(255,107,53,0.10); animation:pulse 1.6s ease-in-out infinite; }
  @keyframes pulse{0%,100%{box-shadow:0 0 0 4px rgba(255,107,53,0.10)}50%{box-shadow:0 0 0 7px rgba(255,107,53,0.06)}}
  .dojo-back,.dojo-exit{padding:7px 12px;border-radius:8px;border:1px solid #1a1a1a;background:#0a0a0a;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.18s;flex-shrink:0;color:#ededed;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .dojo-back:hover{background:#111;border-color:#232323;transform:translateY(-1px)}
  .dojo-exit{background:#FF6B35;color:#000;border-color:#FF6B35}
  .dojo-exit:hover{filter:brightness(1.05);transform:translateY(-1px)}
  .dojo-room{position:relative;height:112px;min-height:112px;background:#000;border-bottom:1px solid #1a1a1a;overflow:hidden;flex-shrink:0;display:grid;place-items:center}
  .dojo-grid{ position:absolute; inset:0; background-image: linear-gradient(#1a1a1a 1px, transparent 1px), linear-gradient(90deg, #1a1a1a 1px, transparent 1px); background-size:22px 22px; opacity:1; }
  .dojo-glow{ position:absolute; inset:0; background: radial-gradient(500px 220px at 50% 0%, rgba(255,107,53,0.06), transparent 72%); pointer-events:none; }
  .dojo-room-head{ position:absolute; top:8px; left:10px; right:10px; display:flex; justify-content:space-between; font-size:9px; color:#666; font-family:'JetBrains Mono',monospace; letter-spacing:0.08em; text-transform:uppercase; }
  .dojo-room-head .dim{ color:#3a3a3a; }
  .dojo-stage{ position:relative; display:flex; gap:18px; align-items:center; padding-top:6px; }
  .dojo-avatar-ring{ position:relative; width:64px; height:64px; display:grid; place-items:center; flex-shrink:0; }
  .ring-bg{ position:absolute; inset:0; border-radius:50%; background:#0a0a0a; border:1px solid #1a1a1a; }
  .ring-progress{ position:absolute; inset:0; border-radius:50%; mask: radial-gradient(circle, transparent 28px, black 29px); opacity:0.95; }
  .ring-inner{ position:relative; width:52px; height:52px; background:#000; border:1px solid #1a1a1a; border-radius:50%; display:grid; place-items:center; }
  .ring-lv{ font-size:12px; font-weight:800; color:#fff; line-height:1; }
  .ring-sub{ font-size:8px; color:#8a8a8a; font-family:'JetBrains Mono',monospace; letter-spacing:0.04em; }
  .ring-spark{ position:absolute; top:-4px; right:-2px; font-size:10px; color:#FF6B35; animation:spark 2s ease-in-out infinite; }
  @keyframes spark{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.2)}}
  .dojo-desk{display:flex;align-items:center;gap:8px;padding:6px 10px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.4)}
  .dojo-sensei{width:32px;height:32px;display:grid;place-items:center;background:#FF6B35;color:#000;border-radius:8px;font-size:13px;font-weight:800;flex-shrink:0}
  .dojo-scroll{padding:4px 8px;background:#000;color:#FF6B35;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-family:'JetBrains Mono',monospace;border:1px solid #1a1a1a}
  .dojo-ver{ padding:2px 6px; background:#000; border:1px solid #1a1a1a; border-radius:6px; font-size:9px; color:#666; font-family:'JetBrains Mono',monospace; }
  .dojo-evo-mini{ display:flex; gap:6px; align-items:center; padding:4px 8px; background:#000; border:1px solid #1a1a1a; border-radius:999px; font-size:11px; font-family:'JetBrains Mono',monospace; }
  .dojo-evo-mini span{ padding:2px 6px; border-radius:999px; border:1px solid #1a1a1a; background:#0a0a0a; color:#8a8a8a; font-weight:700; }
  .dojo-evo-mini span.on{ background:#FF6B35; color:#000; border-color:#FF6B35; box-shadow:0 0 0 4px rgba(255,107,53,0.08); }
  .dojo-evo-mini span.next{ border-style:dashed; color:#666; }
  .dojo-evo-mini i{ color:#3a3a3a; font-style:normal; }
  .dojo-evo-mini i.lime{ color:#FF6B35; }
  /* lobby - unique split with smooth */
  .dojo-lobby{ display:grid; grid-template-columns:1.15fr 0.85fr; gap:14px; padding:14px; background:#0a0a0a; overflow:auto; flex:1; min-height:0; }
  .dojo-lobby-left{ display:grid; gap:10px; align-content:start; }
  .dojo-h{margin:0;font-size:15px;font-weight:800;letter-spacing:-0.02em;color:#fff;line-height:1.1}
  .dojo-p{margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;background:#000;border:1px solid #1a1a1a;border-radius:10px;padding:10px 12px}
  .dojo-timeline{ display:grid; gap:0; background:#000; border:1px solid #1a1a1a; border-radius:12px; padding:10px; position:relative; overflow:hidden; }
  .dojo-timeline::before{ content:""; position:absolute; left:19px; top:18px; bottom:18px; width:1px; background:linear-gradient(180deg, #1a1a1a, #232323, #1a1a1a); }
  .tl-step{ display:flex; gap:10px; align-items:flex-start; position:relative; padding:6px 0; }
  .tl-step:first-child{ padding-top:0; }
  .tl-step:last-child{ padding-bottom:0; }
  .tl-num{ width:20px; height:20px; display:grid; place-items:center; background:#0a0a0a; border:1px solid #1a1a1a; color:#8a8a8a; border-radius:50%; font-size:10px; font-weight:800; font-family:'JetBrains Mono',monospace; flex-shrink:0; position:relative; z-index:1; transition:all 0.2s; }
  .tl-num.lime{ background:#FF6B35; color:#000; border-color:#FF6B35; box-shadow:0 0 0 4px rgba(255,107,53,0.08); }
  .tl-step div{ display:grid; gap:2px; }
  .tl-step b{ font-size:12px; font-weight:700; color:#fff; }
  .tl-step p{ margin:0; font-size:11px; color:#8a8a8a; font-family:'JetBrains Mono',monospace; }
  .tl-step:hover .tl-num{ transform:scale(1.08); }
  .dojo-lobby-right{ display:grid; gap:10px; align-content:start; }
  .dojo-avatar-card{ background:#000; border:1px solid #1a1a1a; border-radius:12px; padding:12px; display:grid; gap:10px; position:relative; overflow:hidden; }
  .dojo-avatar-card::before{ content:""; position:absolute; inset:0; background: radial-gradient(400px 180px at 20% 0%, rgba(255,107,53,0.04), transparent 72%); pointer-events:none; }
  .avatar-head{ display:flex; gap:10px; align-items:center; position:relative; }
  .avatar-head span:first-child{ width:36px; height:36px; display:grid; place-items:center; background:#FF6B35; color:#000; border-radius:10px; font-size:14px; font-weight:800; }
  .avatar-head div{ display:grid; gap:2px; }
  .avatar-head b{ font-size:13px; color:#fff; }
  .avatar-head p{ margin:0; font-size:11px; color:#8a8a8a; font-family:'JetBrains Mono',monospace; }
  .avatar-badge{ margin-left:auto; padding:4px 8px; background:rgba(255,107,53,0.08); border:1px solid rgba(255,107,53,0.14); border-radius:999px; color:#FF6B35; font-size:11px; font-weight:700; font-family:'JetBrains Mono',monospace; }
  .avatar-bar{ height:8px; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:999px; overflow:hidden; position:relative; }
  .avatar-bar i{ position:absolute; left:0; top:0; bottom:0; background:linear-gradient(90deg, #FF6B35, #E85D2F); width:68%; transition:width 0.6s cubic-bezier(0.16,1,0.3,1); }
  .avatar-unlocks{ display:flex; gap:6px; flex-wrap:wrap; }
  .avatar-unlocks span{ padding:4px 8px; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:999px; font-size:10px; color:#8a8a8a; font-family:'JetBrains Mono',monospace; }
  .dojo-mic-card{ background:#000; border:1px solid #1a1a1a; border-radius:12px; padding:10px; display:grid; gap:8px; }
  .dojo-mic-status{display:flex;gap:8px;align-items:center;font-size:11px;font-weight:600;color:#8a8a8a;font-family:'JetBrains Mono',monospace}
  .mic-dot.granted{color:#FF6B35}
  .mic-dot.denied{color:#ff3b30}
  .mic-dot.prompt,.mic-dot.checking{color:#f59e0b}
  .mic-pill{ margin-left:auto; padding:3px 8px; border-radius:999px; font-size:10px; font-weight:700; font-family:'JetBrains Mono',monospace; letter-spacing:0.04em; text-transform:uppercase; border:1px solid #1a1a1a; background:#0a0a0a; color:#666; }
  .mic-pill.granted{ background:rgba(255,107,53,0.08); color:#FF6B35; border-color:rgba(255,107,53,0.14); }
  .mic-pill.denied{ background:rgba(255,59,48,0.08); color:#ff3b30; border-color:rgba(255,59,48,0.14); }
  .dojo-btn{padding:8px 14px;border-radius:10px;border:1px solid #1a1a1a;background:#0a0a0a;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s;color:#ededed;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .dojo-btn:hover{background:#111;border-color:#232323;transform:translateY(-1px)}
  .dojo-btn.primary{background:#FF6B35;color:#000;border-color:#FF6B35;box-shadow:0 4px 16px rgba(255,107,53,0.14)}
  .dojo-btn.primary:hover{filter:brightness(1.05);box-shadow:0 8px 24px rgba(255,107,53,0.18)}
  .dojo-btn.big{padding:11px 16px;width:100%;justify-content:center;display:flex;font-size:12px}
  .dojo-btn.ghost{background:#000;border-color:#1a1a1a;width:100%;justify-content:center;display:flex}
  .dojo-btn.mic{padding:6px 10px;font-size:11px}
  .dojo-btn:active{transform:scale(0.99)}
  .dojo-hint{margin:0;font-size:10px;color:#666;background:transparent;border:none;padding:0;line-height:1.4;font-family:'JetBrains Mono',monospace;text-align:center}
  .dojo-training-wrap{flex:1;overflow:auto;min-height:0;background:#000;display:flex;flex-direction:column;padding:0}
  .dojo-training-wrap .fl-root{border:none;border-radius:0;box-shadow:none;max-height:none;height:100%}
  @media(max-width:640px){ .dojo-lobby{ grid-template-columns:1fr; } .dojo-stage{ flex-direction:column; gap:10px; } .dojo-room{ height:140px; } }
`;
