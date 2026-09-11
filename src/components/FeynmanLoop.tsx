import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

type Props = {
  playerId: string;
  onClose?: () => void;
  onLeveledUp?: (newLevel: number, xpAwarded: number) => void;
};

const SUGGESTED_TOPICS = [
  { label: "Photosynthesis", cat: "science" },
  { label: "Recursion", cat: "cs" },
  { label: "Black Holes", cat: "science" },
  { label: "Supply & Demand", cat: "economics" },
  { label: "Neural Networks", cat: "cs" },
  { label: "Blockchain", cat: "cs" },
  { label: "Evolution", cat: "science" },
  { label: "Inflation", cat: "economics" },
];

export default function FeynmanLoop({ playerId, onClose, onLeveledUp }: Props) {
  const pid = playerId as Id<"players">;
  const active = useQuery(api.feynman.getActiveSession, { playerId: pid }) as any | undefined;
  const history = useQuery(api.feynman.listSessions, { playerId: pid, limit: 6 }) as any[] | undefined;
  const createSession = useMutation(api.feynman.createSession);
  const abandon = useMutation(api.feynman.abandonSession);
  const submitAndGenerate = useAction(api.feynman.submitAndGenerate);
  const rateSession = useAction(api.feynman.rateSession);

  const [topic, setTopic] = useState("");
  const [maxTurns, setMaxTurns] = useState(4);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [completed, setCompleted] = useState<null | { score: number; strengths: string[]; weaknesses: string[]; feedback: string; xpAwarded: number; leveledUp?: boolean; newLevel?: number }>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speech = useSpeechRecognition({
    lang: "en-US",
    interimResults: true,
    continuous: false,
    onResult: (txt, isFinal) => {
      if (isFinal) {
        setDraft((prev) => (prev ? prev + (prev.endsWith(" ") ? "" : " ") + txt : txt));
      }
    },
  });

  const interimPreview = speech.isListening ? speech.interim : "";

  const handleMicClick = async () => {
    if (speech.isListening) {
      speech.stop();
      return;
    }
    await speech.start();
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active?.turns, completed]);

  const needsRating = useMemo(() => {
    if (!active?.session) return false;
    if (completed) return false;
    return active.session.turnCount >= active.session.maxTurns && active.session.status === "active";
  }, [active, completed]);

  const currentQ = active?.session?.currentQuestion as string | undefined;
  const isGenerating = currentQ === "__generating__";

  const startSession = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = topic.trim();
    if (t.length < 2) { setCreateErr("Pick a topic (at least 2 chars)"); return; }
    setCreating(true); setCreateErr(null);
    try {
      await createSession({ playerId: pid, topic: t, maxTurns });
      setDraft("");
      setCompleted(null);
      setTopic("");
    } catch (err: any) { setCreateErr(err.message ?? "Failed"); }
    finally { setCreating(false); }
  };

  const handleSend = async () => {
    if (!active?.session) return;
    const txt = draft.trim();
    if (txt.length < 10) { setSendErr("Explain a bit more — at least 10 chars"); return; }
    setSending(true); setSendErr(null);
    try {
      const res: any = await submitAndGenerate({
        sessionId: active.session._id as Id<"feynmanSessions">,
        playerId: pid,
        content: txt,
        isAudio: speech.transcript.length > 0,
      });
      setDraft("");
      speech.reset();
      if (res.needsRating) {
      }
    } catch (err: any) {
      setSendErr(err.message ?? "Failed to send");
    } finally { setSending(false); }
  };

  const handleRate = async () => {
    if (!active?.session) return;
    setRating(true); setSendErr(null);
    try {
      const res: any = await rateSession({ sessionId: active.session._id as Id<"feynmanSessions">, playerId: pid });
      setCompleted({
        score: res.score,
        strengths: [],
        weaknesses: [],
        feedback: "Scored! Refreshing...",
        xpAwarded: res.xpAwarded,
        leveledUp: res.leveledUp,
        newLevel: res.newLevel,
      });
      if (res.leveledUp && res.newLevel) onLeveledUp?.(res.newLevel, res.xpAwarded);
    } catch (err: any) {
      setSendErr(err.message ?? "Rating failed");
    } finally { setRating(false); }
  };

  const latestCompleted = useMemo(() => {
    if (!history || history.length === 0) return null;
    const c = history.find((h: any) => h.status === "completed");
    return c ?? null;
  }, [history]);

  useEffect(() => {
    if (completed && latestCompleted && completed.feedback === "Scored! Refreshing..." && latestCompleted._id === active?.session?._id) {
    }
    if (!active && latestCompleted && completed && completed.feedback === "Scored! Refreshing...") {
      setCompleted({
        score: latestCompleted.score ?? completed.score,
        strengths: latestCompleted.strengths ?? [],
        weaknesses: latestCompleted.weaknesses ?? [],
        feedback: latestCompleted.feedback ?? "",
        xpAwarded: latestCompleted.xpAwarded ?? completed.xpAwarded,
        leveledUp: latestCompleted.leveledUp,
        newLevel: latestCompleted.levelAfter,
      });
    }
  }, [latestCompleted, active, completed]);

  if (active === undefined) return <div className="fl-loading">LOADING FEYNMAN DOJO...</div>;

  if (!active) {
    return (
      <div className="fl-root">
        <style>{styles}</style>
        <div className="fl-head">
          <div className="fl-head-left">
            <span className="fl-badge">Feynman Dojo</span>
            <h2 className="fl-title">AI Socratic Loop</h2>
            <p className="fl-sub">Pick a topic → Explain out loud (🎙️ Web Speech) → AI counters → Get rated → Level up</p>
          </div>
          {onClose && <button className="fl-x" onClick={onClose} aria-label="Close">×</button>}
        </div>

        {completed && (
          <div className="fl-result">
            <div className="fl-result-head">
              <span className="fl-score">{completed.score}<em>/100</em></span>
              <div>
                <div className="fl-result-title">Session rated</div>
                <div className="fl-result-sub">+{completed.xpAwarded} XP {completed.leveledUp ? `• LV UP → ${completed.newLevel}!` : ""}</div>
              </div>
            </div>
            {!!completed.feedback && <p className="fl-feedback">“{completed.feedback}”</p>}
            {(completed.strengths?.length || completed.weaknesses?.length) ? (
              <div className="fl-grid2">
                <div className="fl-col"><span className="fl-col-title ok">Strengths</span><ul>{completed.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                <div className="fl-col"><span className="fl-col-title bad">To improve</span><ul>{completed.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              </div>
            ) : null}
            <button className="fl-btn ghost" onClick={() => setCompleted(null)}>Start another loop</button>
          </div>
        )}

        {!completed && (
          <form onSubmit={startSession} className="fl-card">
            <label className="fl-field">
              <span>Topic to master</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis, Recursion, Black Holes..." maxLength={80} autoFocus />
            </label>
            <div className="fl-chips">
              {SUGGESTED_TOPICS.map((s) => (
                <button key={s.label} type="button" onClick={() => setTopic(s.label)} className={`fl-chip ${topic === s.label ? "on" : ""}`}>{s.label}</button>
              ))}
            </div>
            <div className="fl-row">
              <label className="fl-field small">
                <span>Loops before rating</span>
                <select value={maxTurns} onChange={(e) => setMaxTurns(parseInt(e.target.value, 10))}>
                  <option value={3}>3 — quick</option>
                  <option value={4}>4 — standard</option>
                  <option value={5}>5 — deep</option>
                  <option value={6}>6 — mastery</option>
                </select>
              </label>
              <button type="submit" disabled={creating} className="fl-btn primary big">{creating ? "Starting…" : "► START LOOP"}</button>
            </div>
            {createErr && <div className="fl-err">{createErr}</div>}
            <p className="fl-hint">Mic tip: Chrome/Edge recommended. Allow microphone when prompted. You can also type.</p>
          </form>
        )}

        {!!history && history.length > 0 && (
          <div className="fl-history">
            <div className="fl-history-title">Recent loops</div>
            {history.slice(0, 6).map((h: any) => (
              <div key={h._id} className={`fl-hist-row ${h.status}`}>
                <span className="fl-hist-topic">{h.topic}</span>
                <span className="fl-hist-meta">{h.turnCount}/{h.maxTurns} turns</span>
                {h.status === "completed" ? (
                  <span className="fl-hist-score">{h.score ?? "—"}/100 • +{h.xpAwarded ?? 0} XP {h.leveledUp ? "↑" : ""}</span>
                ) : (
                  <span className={`fl-hist-badge ${h.status}`}>{h.status}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="fl-footer-note">
          <span className="fl-dot" /> LLM via <b>convex/ai.ts</b> — switch provider with <code>LLM_PROVIDER</code> in <code>.env.local</code> (openai / gemini / mock)
        </div>
      </div>
    );
  }

  const sess = active.session as any;
  const turns = active.turns as any[];

  return (
    <div className="fl-root active">
      <style>{styles}</style>
      <div className="fl-head compact">
        <div className="fl-head-left">
          <span className="fl-badge">Live Loop</span>
          <h2 className="fl-title small">“{sess.topic}”</h2>
          <div className="fl-progress-wrap">
            <div className="fl-progress-label">TURN {sess.turnCount}/{sess.maxTurns}</div>
            <div className="fl-progress">
              <i style={{ width: `${Math.round((sess.turnCount / sess.maxTurns) * 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="fl-head-actions">
          <button className="fl-btn ghost sm" onClick={async () => {
            try { await abandon({ sessionId: sess._id as Id<"feynmanSessions">, playerId: pid }); setDraft(""); setSendErr(null); } catch {}
          }}>✕ ABANDON</button>
          {onClose && <button className="fl-x" onClick={onClose}>×</button>}
        </div>
      </div>

      <div className="fl-turns" ref={scrollRef}>
        {turns.map((t: any) => (
          <div key={t._id} className={`fl-turn ${t.role}`}>
            <span className="fl-turn-role">
              {t.role === "ai_question" ? "◉ AI SENSEI" : t.role === "ai_feedback" ? "★ RATING" : t.role === "user" ? (t.isAudio ? "🎙️ YOU (voice)" : "✎ YOU") : "SYSTEM"}
            </span>
            <div className="fl-turn-body">{t.content}</div>
            <span className="fl-turn-time">{new Date(t._creationTime ?? t.createdAt).toLocaleTimeString()}</span>
          </div>
        ))}
        {isGenerating && <div className="fl-turn ai_question generating"><span className="fl-turn-role">◉ AI SENSEI</span><div className="fl-turn-body pulse">Sensei is thinking... crafting your next counter-question</div></div>}
        {!isGenerating && !needsRating && currentQ && (
          <div className="fl-currentQ">
            <span className="fl-currentQ-label">▶ CURRENT CHALLENGE</span>
            <p>{currentQ}</p>
          </div>
        )}
        {needsRating && <div className="fl-needs">✔ Loop complete — hit <b>GET RATED</b> to see your score &amp; level up!</div>}
      </div>

      {!needsRating ? (
        <div className="fl-composer">
          <div className="fl-composer-top">
            <span className="fl-field-label">YOUR EXPLANATION {speech.isListening ? "• LISTENING..." : ""}</span>
            <span className="fl-mic-hint">
              {(speech as any).voiceUnavailable ? "⏸ Voice paused — type to continue" : !speech.supported ? "⚠ Mic not supported — type instead" : speech.permission === "denied" ? "🔴 Mic blocked" : speech.permission === "granted" ? "🎙️ Web Speech API ✓" : "🎙️ Web Speech API — click SPEAK to allow"}
            </span>
          </div>

          {speech.supported && speech.permission === "denied" && (
            <div className="fl-warn">Microphone is blocked. Click the 🔒 lock icon in your address bar → Site settings → Microphone → Allow → Reload. Or use typing.</div>
          )}
          {speech.supported && speech.permission !== "granted" && speech.permission !== "denied" && !speech.isListening && (
            <div className="fl-mic-ask">
              <span>🎙️ Voice input needs microphone permission — your audio is transcribed locally by the browser (Web Speech API) and sent as text to the AI.</span>
              <button type="button" className="fl-btn sm ghost" onClick={() => speech.requestPermission()}>ALLOW MIC</button>
            </div>
          )}

          <textarea
            value={draft + (interimPreview ? (draft ? " " : "") + interimPreview : "")}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={speech.isListening ? "Listening... speak now (speak clearly, then pause)" : "Explain simply — pretend you're teaching a kid. Use analogy, no jargon... (or tap 🎙️ and speak)"}
            rows={4}
            className={`fl-textarea ${speech.isListening ? "listening" : ""}`}
            disabled={sending || isGenerating}
          />
          <div className="fl-composer-actions">
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!speech.supported || (speech as any).voiceUnavailable || sending}
              className={`fl-btn mic ${speech.isListening ? "on" : ""}`}
              title={(speech as any).voiceUnavailable ? "Voice paused — type to continue (click Try again to re-enable)" : speech.supported ? "Click to start/stop voice input (will ask mic permission)" : "Not supported"}
              style={(speech as any).voiceUnavailable ? {opacity:0.5} : undefined}
            >
              {speech.isListening ? "■ STOP" : "🎙️ SPEAK"}
            </button>
            {(speech as any).voiceUnavailable && <button type="button" className="fl-btn sm ghost" onClick={() => {(speech as any).setVoiceUnavailable(false); speech.reset();}}>↻ TRY VOICE AGAIN</button>}
            <button type="button" onClick={() => { setDraft(""); speech.reset(); }} className="fl-btn ghost sm" disabled={sending}>CLEAR</button>
            <div className="fl-grow" />
            <span className="fl-char">{draft.trim().length}/4000</span>
            <button type="button" onClick={handleSend} disabled={sending || isGenerating || draft.trim().length < 10} className="fl-btn primary">
              {sending ? "SENDING..." : "SEND →"}
            </button>
          </div>
          {(speech as any).voiceUnavailable && <div className="fl-warn">Voice auto-paused after cloud hiccup. <b>Please type below and press SEND — AI loop is fully functional with typing.</b> Your internet is fine. Click “TRY VOICE AGAIN” if you want to retry mic.</div>}
          {speech.error && (() => {
            const isSoft = speech.error.includes("hiccup") || speech.error.includes("still busy") || speech.error.includes("Voice service") || speech.error.includes("Voice still") || speech.error.includes("network");
            return (
              <div className={isSoft ? "fl-warn" : "fl-err"} style={{display:"grid", gap:6}}>
                <div style={{display:"flex", gap:8, alignItems:"flex-start", justifyContent:"space-between"}}>
                  <span style={{flex:1}}>{speech.error}</span>
                  <button type="button" className="fl-btn sm ghost" onClick={() => speech.reset()} style={{flexShrink:0}}>✕</button>
                </div>
                {isSoft && <div style={{fontSize:11, lineHeight:1.2}}>💡 This is a transient browser cloud glitch — not your internet. <b>Typing works 100%</b> — just type in the box and press SEND.</div>}
                {!isSoft && <div style={{fontSize:11, lineHeight:1.2}}>💡 Typing works 100% — just type in the box and press SEND. AI loop does NOT require voice.</div>}
                {isSoft && (
                  <div style={{display:"flex", gap:6}}>
                    <button type="button" className="fl-btn sm ghost" onClick={handleMicClick}>↻ RETRY SPEAK</button>
                    <button type="button" className="fl-btn sm" onClick={() => speech.reset()}>DISMISS — TYPE INSTEAD</button>
                  </div>
                )}
              </div>
            );
          })()}
          {sendErr && <div className="fl-err">{sendErr}</div>}
          {!speech.supported && <div className="fl-warn">Mic needs Chrome/Edge/Samsung on HTTPS or localhost. Firefox does not support Web Speech. Typing works everywhere — AI will still counter-question you.</div>}
          {speech.permission === "granted" && !speech.error && <div className="fl-ok">Mic permission granted — tap SPEAK and explain out loud. Audio → text, then sent to AI. If “network” appears, just tap SPEAK again or type.</div>}
          <p className="fl-hint">After you send, AI Sensei will counter with ONE Socratic question. Do {sess.maxTurns - sess.turnCount} more loop(s) then get rated.</p>
        </div>
      ) : (
        <div className="fl-rate-box">
          <p className="fl-rate-copy">You've completed {sess.turnCount} explanations. Ready for your Feynman rating? You'll get a <b>score, strengths, weaknesses</b> and <b>XP/level</b>.</p>
          <div className="fl-rate-actions">
            <button className="fl-btn primary big" onClick={handleRate} disabled={rating}>{rating ? "RATING..." : "★ GET RATED & LEVEL UP"}</button>
            <button className="fl-btn ghost" onClick={() => setDraft("")} disabled={rating}>Keep explaining</button>
          </div>
          {sendErr && <div className="fl-err">{sendErr}</div>}
        </div>
      )}
    </div>
  );
}

const styles = `.fl-loading{padding:16px;text-align:center;font-size:12px;color:#8a8a8a;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;text-transform:uppercase}
  .fl-root{display:flex;flex-direction:column;gap:10px;height:100%;max-height:none;overflow:auto;background:#000;padding:14px;font-family:'Inter',system-ui,sans-serif;color:#ededed}
  .fl-root.active{padding:0;overflow:hidden;height:100%;display:flex;flex-direction:column;background:#000}
  .fl-root.active .fl-head{padding:12px 14px;border-bottom:1px solid #1a1a1a;flex-shrink:0}
  .fl-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;background:#0a0a0a;padding:12px 14px;border:1px solid #1a1a1a;border-radius:10px;flex-shrink:0}
  .fl-head.compact{position:sticky;top:0;z-index:2;border:none;border-bottom:1px solid #1a1a1a;border-radius:0;background:#000}
  .fl-head-left{display:grid;gap:4px}
  .fl-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#FF6B35;color:#000;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;width:fit-content;font-family:'JetBrains Mono',monospace}
  .fl-badge::before{content:"";width:6px;height:6px;background:#000;border-radius:50%}
  .fl-title{margin:0;font-size:14px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;color:#fff}
  .fl-title.small{font-size:13px}
  .fl-sub{margin:0;font-size:12px;color:#8a8a8a;line-height:1.5;font-family:'JetBrains Mono',monospace}
  .fl-x{width:32px;height:32px;display:grid;place-items:center;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:8px;color:#666;cursor:pointer;font:18px/1 monospace;transition:all 0.12s}
  .fl-x:hover{background:#111;color:#fff;border-color:#232323}
  .fl-card{background:#0a0a0a;border:1px solid #1a1a1a;border-radius:12px;padding:12px;display:grid;gap:10px}
  .fl-field{display:grid;gap:5px}
  .fl-field span{font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#ededed;font-family:'JetBrains Mono',monospace}
  .fl-field input,.fl-field select{padding:10px 11px;border:1px solid #1a1a1a;border-radius:8px;background:#000;color:#fff;font-size:13px;transition:border-color 0.15s}
  .fl-field input::placeholder{color:#3a3a3a}
  .fl-field input:focus,.fl-field select:focus{outline:none;border-color:#FF6B35;box-shadow:0 0 0 3px rgba(255,107,53,0.08);background:#0a0a0a}
  .fl-field select{cursor:pointer}
  .fl-field.small{flex:1}
  .fl-chips{display:flex;flex-wrap:wrap;gap:6px}
  .fl-chip{padding:6px 10px;border:1px solid #1a1a1a;background:#000;border-radius:999px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.12s;color:#8a8a8a;font-family:'JetBrains Mono',monospace;letter-spacing:0.02em;text-transform:uppercase}
  .fl-chip:hover{border-color:#232323;color:#fff}
  .fl-chip.on{background:#FF6B35;color:#000;border-color:#FF6B35}
  .fl-row{display:flex;gap:10px;align-items:end;flex-wrap:wrap}
  .fl-btn{padding:9px 14px;border-radius:8px;border:1px solid #1a1a1a;background:#0a0a0a;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.12s;color:#ededed;font-family:'JetBrains Mono',monospace;letter-spacing:0.06em;text-transform:uppercase}
  .fl-btn:disabled{opacity:0.5;cursor:not-allowed}
  .fl-btn:hover:not(:disabled){background:#111;border-color:#232323}
  .fl-btn:active:not(:disabled){transform:scale(0.99)}
  .fl-btn.primary{background:#FF6B35;color:#000;border-color:#FF6B35}
  .fl-btn.primary:hover:not(:disabled){filter:brightness(1.05)}
  .fl-btn.big{padding:10px 16px}
  .fl-btn.ghost{background:#000}
  .fl-btn.sm{padding:6px 10px;font-size:11px}
  .fl-btn.mic{min-width:88px}
  .fl-btn.mic.on{background:#FF6B35;color:#000;border-color:#FF6B35}
  .fl-err{padding:9px 11px;background:rgba(255,0,64,0.08);border:1px solid rgba(255,0,64,0.18);border-radius:8px;color:#ff6b8a;font-size:12px;font-family:'JetBrains Mono',monospace}
  .fl-warn{padding:9px 11px;background:rgba(255,107,53,0.06);border:1px solid rgba(255,107,53,0.14);border-radius:8px;font-size:11px;line-height:1.5;color:#FF6B35;font-family:'JetBrains Mono',monospace}
  .fl-ok{padding:9px 11px;background:rgba(255,107,53,0.06);border:1px solid rgba(255,107,53,0.14);border-radius:8px;font-size:11px;color:#FF6B35;font-family:'JetBrains Mono',monospace}
  .fl-mic-ask{display:flex;gap:8px;align-items:center;justify-content:space-between;background:#000;border:1px solid #1a1a1a;border-radius:8px;padding:9px 11px;font-size:11px;line-height:1.4;flex-wrap:wrap;color:#8a8a8a;font-family:'JetBrains Mono',monospace}
  .fl-hint{margin:0;font-size:11px;color:#666;line-height:1.4;font-family:'JetBrains Mono',monospace}
  .fl-history{display:grid;gap:6px}
  .fl-history-title{font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#666;font-family:'JetBrains Mono',monospace}
  .fl-hist-row{display:flex;gap:8px;align-items:center;padding:8px 10px;background:#000;border:1px solid #1a1a1a;border-radius:8px;font-size:12px;flex-wrap:wrap;font-family:'JetBrains Mono',monospace}
  .fl-hist-row.completed{border-left:3px solid #FF6B35}
  .fl-hist-row.active{border-left:3px solid #fff}
  .fl-hist-row.abandoned{opacity:0.5}
  .fl-hist-topic{flex:1;font-weight:600;color:#fff}
  .fl-hist-meta{padding:2px 7px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:999px;font-size:11px;color:#8a8a8a}
  .fl-hist-score{margin-left:auto;padding:3px 7px;background:#FF6B35;color:#000;border-radius:999px;font-size:11px;font-weight:700}
  .fl-hist-badge{margin-left:auto;padding:3px 7px;border-radius:999px;border:1px solid #1a1a1a;font-size:11px;font-weight:700}
  .fl-hist-badge.active{background:#fff;color:#000;border-color:#fff}
  .fl-hist-badge.completed{background:rgba(255,107,53,0.12);color:#FF6B35;border-color:rgba(255,107,53,0.18)}
  .fl-footer-note{font-size:11px;color:#666;padding:6px 0;border-top:1px solid #1a1a1a;font-family:'JetBrains Mono',monospace}
  .fl-footer-note code{padding:1px 5px;background:#000;border:1px solid #1a1a1a;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#FF6B35}
  .fl-dot{width:6px;height:6px;border-radius:50%;background:#FF6B35;display:inline-block;vertical-align:middle;margin-right:6px}
  .fl-result{background:#0a0a0a;border:1px solid #1a1a1a;border-radius:12px;padding:12px;display:grid;gap:10px}
  .fl-result-head{display:flex;gap:10px;align-items:center}
  .fl-score{font-size:17px;font-weight:800;background:#FF6B35;color:#000;border-radius:10px;padding:8px 12px;letter-spacing:-0.02em;font-family:'JetBrains Mono',monospace}
  .fl-score em{font-size:11px;font-weight:500;opacity:0.7;font-style:normal;margin-left:2px}
  .fl-result-title{font-size:13px;font-weight:700;color:#fff}
  .fl-result-sub{font-size:12px;color:#8a8a8a;font-family:'JetBrains Mono',monospace}
  .fl-feedback{margin:0;background:#000;border:1px solid #1a1a1a;border-radius:8px;padding:10px;font-size:12.5px;line-height:1.5;color:#ededed}
  .fl-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  @media(max-width:640px){.fl-grid2{grid-template-columns:1fr}}
  .fl-col{background:#000;border:1px solid #1a1a1a;border-radius:10px;padding:10px}
  .fl-col-title{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:3px 7px;border-radius:999px;display:inline-block;margin-bottom:6px;font-family:'JetBrains Mono',monospace}
  .fl-col-title.ok{background:rgba(255,107,53,0.12);color:#FF6B35;border:1px solid rgba(255,107,53,0.14)}
  .fl-col-title.bad{background:rgba(255,0,64,0.10);color:#ff6b8a;border:1px solid rgba(255,0,64,0.14)}
  .fl-col ul{margin:0;padding-left:14px;font-size:12px;line-height:1.5;display:grid;gap:3px;color:#ededed}
  .fl-progress-wrap{display:flex;align-items:center;gap:8px;margin-top:3px}
  .fl-progress-label{font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#666;font-family:'JetBrains Mono',monospace}
  .fl-progress{flex:1;max-width:160px;height:6px;background:#000;border:1px solid #1a1a1a;border-radius:999px;overflow:hidden}
  .fl-progress i{display:block;height:100%;background:#FF6B35;transition:width 0.3s;border-radius:999px}
  .fl-head-actions{display:flex;gap:6px;align-items:center}
  .fl-turns{flex:1;min-height:160px;max-height:none;overflow:auto;padding:12px;display:grid;gap:8px;background:#000;align-content:start}
  .fl-turn{padding:10px 11px;border:1px solid #1a1a1a;border-radius:10px;background:#0a0a0a;display:grid;gap:5px}
  .fl-turn.ai_question{border-color:#1a1a1a;background:#0a0a0a}
  .fl-turn.ai_feedback{background:rgba(255,107,53,0.06);border-color:rgba(255,107,53,0.14)}
  .fl-turn.user{background:#0f0f0f;border-color:#1a1a1a}
  .fl-turn.generating{opacity:0.8}
  .fl-turn-role{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#666;font-family:'JetBrains Mono',monospace}
  .fl-turn.ai_question .fl-turn-role{color:#FF6B35}
  .fl-turn.user .fl-turn-role{color:#ededed}
  .fl-turn-body{font-size:13px;line-height:1.6;color:#ededed;white-space:pre-wrap;word-break:break-word}
  .fl-turn-body.pulse{animation:pulse 1s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
  .fl-turn-time{font-size:10px;color:#666;justify-self:end;font-family:'JetBrains Mono',monospace}
  .fl-currentQ{padding:10px 12px;background:#FF6B35;color:#000;border-radius:10px}
  .fl-currentQ-label{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7;font-family:'JetBrains Mono',monospace}
  .fl-currentQ p{margin:6px 0 0 0;font-size:12.5px;line-height:1.5}
  .fl-needs{padding:10px 11px;background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.14);border-radius:8px;font-size:12px;color:#FF6B35;font-family:'JetBrains Mono',monospace}
  .fl-composer{padding:12px;background:#000;border-top:1px solid #1a1a1a;display:grid;gap:8px;flex-shrink:0}
  .fl-composer-top{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
  .fl-field-label{font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#666;font-family:'JetBrains Mono',monospace}
  .fl-mic-hint{font-size:10px;color:#666;background:#0a0a0a;border:1px solid #1a1a1a;padding:3px 7px;border-radius:999px;font-family:'JetBrains Mono',monospace}
  .fl-textarea{width:100%;padding:10px 11px;border:1px solid #1a1a1a;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.5;resize:vertical;min-height:72px;background:#0a0a0a;color:#fff;transition:border-color 0.15s, box-shadow 0.15s}
  .fl-textarea::placeholder{color:#3a3a3a}
  .fl-textarea:focus{outline:none;border-color:#FF6B35;box-shadow:0 0 0 3px rgba(255,107,53,0.08)}
  .fl-textarea.listening{border-color:#FF6B35;background:#111}
  .fl-composer-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .fl-grow{flex:1}
  .fl-char{font-size:11px;color:#666;font-family:'JetBrains Mono',monospace}
  .fl-rate-box{padding:12px;background:#000;border-top:1px solid #1a1a1a;display:grid;gap:10px;flex-shrink:0}
  .fl-rate-copy{margin:0;font-size:12px;line-height:1.5;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:8px;padding:10px;color:#ededed;font-family:'JetBrains Mono',monospace}
  .fl-rate-actions{display:flex;gap:8px;flex-wrap:wrap}
  .fl-root{animation:flFade 0.42s cubic-bezier(0.16,1,0.3,1)}
  @keyframes flFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .fl-turn{animation:turnIn 0.36s cubic-bezier(0.16,1,0.3,1);transition:border-color 0.2s, transform 0.2s, box-shadow 0.2s}
  @keyframes turnIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .fl-turn:hover{transform:translateY(-1px);border-color:#232323;box-shadow:0 4px 16px rgba(0,0,0,0.2)}
  .fl-card{transition:all 0.2s cubic-bezier(0.16,1,0.3,1)}
  .fl-card:hover{border-color:#232323}
  .fl-head{position:relative;overflow:hidden}
  .fl-head::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg, transparent, rgba(255,107,53,0.18) 50%, transparent)}
`;
