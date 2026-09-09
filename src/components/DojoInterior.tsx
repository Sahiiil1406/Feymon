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
          <button className="dojo-back" onClick={() => setPhase("lobby")}>← Lobby</button>
          <span className="dojo-title">Dojo — Training Hall (Inside)</span>
          <button className="dojo-exit" onClick={onExit}>Exit</button>
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
        <span className="dojo-title">Feynman Dojo — Central Building</span>
        <button className="dojo-exit" onClick={onExit}>Exit</button>
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
        <h3 className="dojo-h">You entered the Village Center Dojo</h3>
        <p className="dojo-p">
          You stepped inside the big central building — now a calm training hall. No distractions. Pick a topic, explain it out loud, and the AI Sensei will probe with Socratic counter-questions. You’ll get a score, strengths, weaknesses and XP.
        </p>

        <div className="dojo-steps">
          <span><b>1</b> Pick topic</span>
          <span className="arrow">→</span>
          <span><b>2</b> Explain</span>
          <span className="arrow">→</span>
          <span><b>3</b> Answer counters</span>
          <span className="arrow">→</span>
          <span><b>4</b> Get rated</span>
        </div>

        <div className="dojo-mic-row">
          <div className="dojo-mic-status">
            <span className={`mic-dot ${permStatus}`}>●</span>
            <span className="mic-label">
              {permStatus === "granted" ? "Microphone ready" : permStatus === "denied" ? "Mic blocked — allow in browser" : "Microphone needed for voice"}
            </span>
          </div>
          {permStatus !== "granted" && (
            <button className="dojo-btn mic" onClick={askMic}>Allow mic</button>
          )}
          {permStatus === "granted" && <span className="mic-ok">Ready</span>}
        </div>
        <p className="dojo-hint">Tip: Chrome / Edge on HTTPS or localhost works best. You can always type. The mic prompt also appears when you tap “Speak”.</p>

        <button className="dojo-btn primary big" onClick={() => setPhase("training")}>Start training →</button>
        <button className="dojo-btn ghost" onClick={onExit}>Back to village</button>
      </div>
    </div>
  );
}

const styles = `.dojo-interior{width:min(720px,92vw);height:min(86dvh, 680px);max-height:86dvh;overflow:hidden;background:#fff;border:1px solid #e9ddd0;border-radius:20px;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(28,25,23,0.16), 0 1px 3px rgba(28,25,23,0.06)}
  .dojo-bar{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#fdfbf7;border-bottom:1px solid #f2e8d9;color:#1c1917;font-size:13px;font-weight:500;flex-shrink:0}
  .dojo-title{flex:1;text-align:center;font-weight:600;letter-spacing:-0.01em}
  .dojo-back,.dojo-exit{padding:7px 12px;border-radius:999px;border:1px solid #e9ddd0;background:#fff;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.12s;flex-shrink:0}
  .dojo-back:hover{background:#fdfbf7}
  .dojo-exit{background:#1c1917;color:#fdfbf7;border-color:#1c1917}
  .dojo-exit:hover{opacity:0.92}
  /* COMPACT room - was 160px, now 110px to fit one screen */
  .dojo-room{position:relative;height:110px;min-height:110px;background:#fdfbf7;border-bottom:1px solid #f2e8d9;overflow:hidden;flex-shrink:0;display:grid;place-items:center}
  .dojo-wall{position:absolute;inset:0 0 52% 0;background:linear-gradient(180deg,#fdfbf7 0%,#f5efe6 100%);border-bottom:1px solid #f2e8d9}
  .dojo-floor{position:absolute;left:0;right:0;bottom:0;height:48%;background:linear-gradient(180deg,#fdfbf7 0%,#f5efe6 100%);border-top:1px solid #f2e8d9}
  .dojo-tatami{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:260px;height:34px;background:#fff;border:1px solid #e9ddd0;border-radius:10px;box-shadow:0 1px 2px rgba(28,25,23,0.04)}
  .dojo-desk{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:170px;height:36px;background:#fff;border:1px solid #e9ddd0;border-radius:10px;display:flex;align-items:center;justify-content:space-between;padding:5px 8px;box-shadow:0 1px 2px rgba(28,25,23,0.04)}
  .dojo-sensei{width:28px;height:28px;display:grid;place-items:center;background:#f5efe6;border:1px solid #e9ddd0;border-radius:8px;font-size:12px}
  .dojo-scroll{padding:3px 8px;background:#1c1917;color:#fdfbf7;border-radius:999px;font-size:10px;font-weight:600}
  .dojo-shelf{position:absolute;top:10px;left:10px;display:flex;gap:5px;background:#fff;border:1px solid #e9ddd0;border-radius:9px;padding:5px 7px;box-shadow:0 1px 2px rgba(28,25,23,0.04)}
  .dojo-shelf span{font-size:12px;opacity:0.9}
  .dojo-lantern{position:absolute;top:12px;width:7px;height:7px;background:#1c1917;border-radius:50%;opacity:0.12}
  .dojo-lantern.left{left:100px}
  .dojo-lantern.right{right:100px}
  .dojo-sign{position:absolute;top:10px;right:10px;background:#fff;border:1px solid #e9ddd0;padding:6px 9px;border-radius:9px;font-size:10px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;text-align:center;color:#1c1917;box-shadow:0 1px 2px rgba(28,25,23,0.04)}
  /* lobby card - flex 1 scroll if needed but compact so no scroll on 768px */
  .dojo-lobby-card{padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:#fff;overflow:auto;flex:1;min-height:0}
  .dojo-h{margin:0;font-size:14px;font-weight:600;letter-spacing:-0.02em;color:#1c1917}
  .dojo-p{margin:0;font-size:12.5px;line-height:1.55;color:#57534e;background:#fdfbf7;border:1px solid #f2e8d9;border-radius:12px;padding:10px 12px}
  .dojo-steps{display:flex;gap:5px;flex-wrap:wrap;align-items:center;justify-content:center;background:#fdfbf7;border:1px solid #f2e8d9;border-radius:10px;padding:8px;font-size:11px;color:#57534e}
  .dojo-steps b{width:18px;height:18px;display:inline-grid;place-items:center;background:#1c1917;color:#fdfbf7;border-radius:999px;font-size:10px}
  .dojo-steps .arrow{color:#a8a29e;font-size:10px}
  .dojo-mic-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid #e9ddd0;border-radius:10px;padding:8px 10px}
  .dojo-mic-status{display:flex;gap:6px;align-items:center;flex:1;font-size:11.5px;font-weight:500;color:#57534e}
  .mic-dot.granted{color:#22c55e}
  .mic-dot.denied{color:#ef4444}
  .mic-dot.prompt,.mic-dot.checking{color:#f59e0b}
  .mic-ok{font-size:11px;background:#dcfce7;color:#166534;padding:3px 8px;border-radius:999px;border:1px solid #bbf7d0;font-weight:600}
  .dojo-btn{padding:8px 14px;border-radius:999px;border:1px solid #e9ddd0;background:#fff;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.12s}
  .dojo-btn:hover{background:#fdfbf7}
  .dojo-btn.primary{background:#1c1917;color:#fdfbf7;border-color:#1c1917}
  .dojo-btn.primary:hover{opacity:0.92}
  .dojo-btn.big{padding:10px 16px;font-weight:600;width:100%;justify-content:center;display:flex}
  .dojo-btn.ghost{background:#fff;border-color:#e9ddd0;width:100%;justify-content:center;display:flex;font-size:12.5px}
  .dojo-btn.mic{background:#fff;padding:6px 10px;font-size:12px}
  .dojo-btn:active{transform:scale(0.99)}
  .dojo-hint{margin:0;font-size:10.5px;color:#a8a29e;background:#fdfbf7;border:1px solid #f2e8d9;border-radius:8px;padding:6px 8px;line-height:1.4}
  .dojo-training-wrap{flex:1;overflow:auto;min-height:0;background:#fdfbf7;display:flex;flex-direction:column;padding:0}
  .dojo-training-wrap .fl-root{border:none;border-radius:0;box-shadow:none;max-height:none;height:100%}
`;
