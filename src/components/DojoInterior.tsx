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

  // Proactively nudge mic permission when lobby mounts (optional, not forced)
  useEffect(() => {
    // Check if already granted
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
      <div className="dojo-interior">
        <style>{styles}</style>
        <div className="dojo-bar">
          <button className="dojo-back" onClick={() => setPhase("lobby")}>← LOBBY</button>
          <span className="dojo-title">⛩ DOJO — TRAINING HALL</span>
          <button className="dojo-exit" onClick={onExit}>✕ EXIT DOJO</button>
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
        <span className="dojo-title">⛩ FEYNMAN DOJO — ENTERED</span>
        <button className="dojo-exit" onClick={onExit}>✕ EXIT</button>
      </div>

      <div className="dojo-room">
        {/* Interior art — pure CSS */}
        <div className="dojo-floor" />
        <div className="dojo-wall" />
        <div className="dojo-tatami" />
        <div className="dojo-desk">
          <div className="dojo-sensei">先生</div>
          <div className="dojo-scroll">AI SENSEI</div>
        </div>
        <div className="dojo-shelf">
          <span>📚</span><span>📖</span><span>🧠</span><span>💡</span>
        </div>
        <div className="dojo-lantern left" />
        <div className="dojo-lantern right" />
        <div className="dojo-sign">FEYNMAN<br/>DOJO</div>
      </div>

      <div className="dojo-lobby-card">
        <h3 className="dojo-h">You entered the Dojo</h3>
        <p className="dojo-p">
          This is your private training hall. No distractions. Pick a topic, explain it out loud — the AI Sensei will probe with Socratic counter-questions. At the end you get a score, strengths/weaknesses, and XP.
        </p>

        <div className="dojo-steps">
          <span><b>1</b> Pick topic</span>
          <span className="arrow">→</span>
          <span><b>2</b> 🎙️ Explain (speech-to-text)</span>
          <span className="arrow">→</span>
          <span><b>3</b> Answer AI counters</span>
          <span className="arrow">→</span>
          <span><b>4</b> Get rated &amp; level up</span>
        </div>

        <div className="dojo-mic-row">
          <div className="dojo-mic-status">
            <span className={`mic-dot ${permStatus}`}>●</span>
            <span className="mic-label">
              {permStatus === "granted" ? "Microphone ready" : permStatus === "denied" ? "Mic blocked — allow in address bar" : "Microphone permission needed for voice"}
            </span>
          </div>
          {permStatus !== "granted" && (
            <button className="dojo-btn mic" onClick={askMic}>🎙️ ALLOW MIC</button>
          )}
          {permStatus === "granted" && <span className="mic-ok">✔ Ready</span>}
        </div>
        <p className="dojo-hint">Tip: Chrome/Edge on HTTPS/localhost. You can also type if mic unavailable. Allow prompt appears when you click “SPEAK” too.</p>

        <button className="dojo-btn primary big" onClick={() => setPhase("training")}>▶ START TRAINING</button>
        <button className="dojo-btn ghost" onClick={onExit}>← Exit to Village</button>
      </div>
    </div>
  );
}

const styles = `
  .dojo-interior{width:min(760px,96vw);max-height:min(84dvh, 820px);overflow:auto;background:#f8f8f0;border:4px solid #000;box-shadow:8px 8px 0 #000;display:flex;flex-direction:column}
  .dojo-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:linear-gradient(180deg,#1a2f5a 0%,#0f1f3a 100%);border-bottom:4px solid #000;color:#fff;font-family:'Press Start 2P',monospace;font-size:6px;position:sticky;top:0;z-index:2}
  .dojo-title{flex:1;text-align:center;letter-spacing:0.04em;text-shadow:1px 1px 0 #000}
  .dojo-back,.dojo-exit{padding:6px 10px;border:3px solid #000;background:#fff;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:2px 2px 0 #000;cursor:pointer;color:#000}
  .dojo-back{background:#ffcb05}
  .dojo-exit{background:#ff5a5a;color:#fff}
  .dojo-room{position:relative;height:170px;background:linear-gradient(180deg,#2a3a5a 0%,#1e2e4a 45%,#c9a86a 45%,#b89355 100%);border-bottom:4px solid #000;overflow:hidden;flex-shrink:0}
  .dojo-wall{position:absolute;inset:0 0 55% 0;background:linear-gradient(180deg,#e8dcc8 0%,#d8c8a8 100%);border-bottom:3px solid #000;opacity:0.95}
  .dojo-floor{position:absolute;left:0;right:0;bottom:0;height:55%;background:repeating-linear-gradient(90deg,#b89355 0 24px,#a67c3a 24px 26px,#8b6230 26px 28px);border-top:2px solid #000}
  .dojo-tatami{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:320px;height:42px;background:#f8f8c0;border:3px solid #000;box-shadow:3px 3px 0 rgba(0,0,0,0.3)}
  .dojo-desk{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);width:200px;height:46px;background:#4a3020;border:3px solid #000;display:flex;align-items:center;justify-content:space-between;padding:6px 10px;box-shadow:3px 3px 0 rgba(0,0,0,0.4)}
  .dojo-sensei{width:44px;height:44px;display:grid;place-items:center;background:#fff;border:3px solid #000;font-size:18px;box-shadow:2px 2px 0 #000}
  .dojo-scroll{background:#ffcb05;border:2px solid #000;padding:5px 8px;font-family:'Press Start 2P',monospace;font-size:5px;box-shadow:1px 1px 0 #000}
  .dojo-shelf{position:absolute;top:14px;left:14px;display:flex;gap:6px;background:#4a3020;border:3px solid #000;padding:6px 8px;box-shadow:2px 2px 0 rgba(0,0,0,0.3)}
  .dojo-shelf span{font-size:14px}
  .dojo-lantern{position:absolute;top:10px;width:14px;height:14px;background:#ffcb05;border:2px solid #000;border-radius:50%;box-shadow:0 0 10px #ffcb05}
  .dojo-lantern.left{left:120px}
  .dojo-lantern.right{right:120px}
  .dojo-sign{position:absolute;top:18px;right:16px;background:#000;color:#ffcb05;border:3px solid #ffcb05;padding:8px 10px;font-family:'Press Start 2P',monospace;font-size:7px;line-height:1.2;text-align:center;box-shadow:3px 3px 0 #000}
  .dojo-lobby-card{padding:14px;display:grid;gap:10px;background:#fff}
  .dojo-h{margin:0;font-family:'Press Start 2P',monospace;font-size:9px;background:#ffcb05;border:3px solid #000;padding:8px;text-align:center;box-shadow:2px 2px 0 #000}
  .dojo-p{margin:0;font-size:13px;line-height:1.45;background:#f8f8f8;border:2px solid #000;padding:10px}
  .dojo-steps{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;background:#000;color:#fff;padding:8px;border:3px solid #000;font-family:'Press Start 2P',monospace;font-size:5px}
  .dojo-steps b{background:#ffcb05;color:#000;padding:1px 4px;border:1px solid #000}
  .dojo-steps .arrow{color:#ffcb05}
  .dojo-mic-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#fff8c0;border:3px solid #000;padding:8px;box-shadow:1px 1px 0 #000}
  .dojo-mic-status{display:flex;gap:6px;align-items:center;flex:1;font-family:'Press Start 2P',monospace;font-size:5.5px}
  .mic-dot.granted{color:#22c55e;text-shadow:0 0 6px #22c55e}
  .mic-dot.denied{color:#ef4444}
  .mic-dot.prompt,.mic-dot.checking{color:#f59e0b}
  .mic-ok{font-family:'Press Start 2P',monospace;font-size:6px;background:#22c55e;color:#fff;padding:4px 6px;border:2px solid #000}
  .dojo-btn{padding:10px 14px;border:3px solid #000;background:#fff;font-family:'Press Start 2P',monospace;font-size:7px;box-shadow:3px 3px 0 #000;cursor:pointer}
  .dojo-btn.primary{background:#ffcb05}
  .dojo-btn.big{padding:12px 16px}
  .dojo-btn.ghost{background:#fff}
  .dojo-btn.mic{background:#fff;border-color:#000}
  .dojo-btn:active{transform:translate(1px,1px);box-shadow:1px 1px 0 #000}
  .dojo-hint{margin:0;font-size:11px;color:#666;background:#f0f0f0;border:1px dashed #bbb;padding:6px}
  .dojo-training-wrap{padding:8px;background:#e9eef5;overflow:auto}
`;
