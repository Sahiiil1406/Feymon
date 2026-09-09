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

  // Speech hook — pipe transcript into draft, with explicit mic permission
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

  // Keep draft in sync with interim for live preview (optional display)
  const interimPreview = speech.isListening ? speech.interim : "";

  const handleMicClick = async () => {
    if (speech.isListening) {
      speech.stop();
      return;
    }
    // This will request permission via getUserMedia if needed (shows browser prompt)
    await speech.start();
  };

  useEffect(() => {
    // auto scroll history
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
      // Prefer the combined action (saves + generates Q via LLM). Fallback to mutation if not available.
      const res: any = await submitAndGenerate({
        sessionId: active.session._id as Id<"feynmanSessions">,
        playerId: pid,
        content: txt,
        isAudio: speech.transcript.length > 0,
      });
      setDraft("");
      speech.reset();
      if (res.needsRating) {
        // UI will show Rate button
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
        strengths: [], // will be fetched via refreshed session; show placeholder until refetch
        weaknesses: [],
        feedback: "Scored! Refreshing...",
        xpAwarded: res.xpAwarded,
        leveledUp: res.leveledUp,
        newLevel: res.newLevel,
      });
      if (res.leveledUp && res.newLevel) onLeveledUp?.(res.newLevel, res.xpAwarded);
      // After rating, the active query will become null (status completed). We can fetch the just-completed session via list.
    } catch (err: any) {
      setSendErr(err.message ?? "Rating failed");
    } finally { setRating(false); }
  };

  // When active becomes null and we have history, show latest completed rating details if completed state empty
  const latestCompleted = useMemo(() => {
    if (!history || history.length === 0) return null;
    const c = history.find((h: any) => h.status === "completed");
    return c ?? null;
  }, [history]);

  // If we rated very recently, hydrate completed from latestCompleted
  useEffect(() => {
    if (completed && latestCompleted && completed.feedback === "Scored! Refreshing..." && latestCompleted._id === active?.session?._id) {
      // not yet; wait
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

  // ── No active session: show topic picker + history ──
  if (!active) {
    return (
      <div className="fl-root">
        <style>{styles}</style>
        <div className="fl-head">
          <div className="fl-head-left">
            <span className="fl-badge">FEYNMAN DOJO</span>
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
                <div className="fl-result-title">SESSION RATED</div>
                <div className="fl-result-sub">+{completed.xpAwarded} XP {completed.leveledUp ? `• LV UP → ${completed.newLevel}!` : ""}</div>
              </div>
            </div>
            {!!completed.feedback && <p className="fl-feedback">“{completed.feedback}”</p>}
            {(completed.strengths?.length || completed.weaknesses?.length) ? (
              <div className="fl-grid2">
                <div className="fl-col"><span className="fl-col-title ok">STRENGTHS</span><ul>{completed.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                <div className="fl-col"><span className="fl-col-title bad">TO IMPROVE</span><ul>{completed.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              </div>
            ) : null}
            <button className="fl-btn ghost" onClick={() => setCompleted(null)}>Start another loop</button>
          </div>
        )}

        {!completed && (
          <form onSubmit={startSession} className="fl-card">
            <label className="fl-field">
              <span>TOPIC TO MASTER</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis, Recursion, Black Holes..." maxLength={80} autoFocus />
            </label>
            <div className="fl-chips">
              {SUGGESTED_TOPICS.map((s) => (
                <button key={s.label} type="button" onClick={() => setTopic(s.label)} className={`fl-chip ${topic === s.label ? "on" : ""}`}>{s.label}</button>
              ))}
            </div>
            <div className="fl-row">
              <label className="fl-field small">
                <span>LOOPS BEFORE RATING</span>
                <select value={maxTurns} onChange={(e) => setMaxTurns(parseInt(e.target.value, 10))}>
                  <option value={3}>3 — quick</option>
                  <option value={4}>4 — standard</option>
                  <option value={5}>5 — deep</option>
                  <option value={6}>6 — mastery</option>
                </select>
              </label>
              <button type="submit" disabled={creating} className="fl-btn primary big">{creating ? "OPENING DOJO..." : "► START LOOP"}</button>
            </div>
            {createErr && <div className="fl-err">{createErr}</div>}
            <p className="fl-hint">Mic tip: Chrome/Edge recommended. Allow microphone when prompted. You can also type.</p>
          </form>
        )}

        {!!history && history.length > 0 && (
          <div className="fl-history">
            <div className="fl-history-title">RECENT LOOPS</div>
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

  // ── Active session: loop UI ──
  const sess = active.session as any;
  const turns = active.turns as any[];

  return (
    <div className="fl-root active">
      <style>{styles}</style>
      <div className="fl-head compact">
        <div className="fl-head-left">
          <span className="fl-badge">LIVE LOOP</span>
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

          {/* Permission banner */}
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

const styles = `
  .fl-loading{padding:22px;text-align:center;font-family:'Press Start 2P',monospace;font-size:8px;background:#000;color:#ffcb05;border:3px solid #000}
  .fl-root{display:flex;flex-direction:column;gap:12px;max-height:min(82dvh, 760px);overflow:auto;background:#f8f8f8;border:4px solid #000;box-shadow:6px 6px 0 #000;padding:12px;font-family:'Inter',system-ui,sans-serif;color:#111}
  .fl-root.active{padding:0}
  .fl-root.active .fl-head{padding:12px;border-bottom:4px solid #000}
  .fl-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;background:linear-gradient(180deg,#2a4a8c 0%,#1e3a6a 100%);color:#fff;padding:14px;border:3px solid #000;box-shadow:3px 3px 0 #000}
  .fl-head.compact{position:sticky;top:0;z-index:2}
  .fl-head-left{display:grid;gap:6px}
  .fl-badge{display:inline-block;background:#ffcb05;color:#000;border:2px solid #000;padding:3px 7px;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:2px 2px 0 #000;width:fit-content;letter-spacing:0.04em}
  .fl-title{margin:0;font-family:'Press Start 2P',monospace;font-size:11px;line-height:1.2;text-shadow:1px 1px 0 #000}
  .fl-title.small{font-size:9px}
  .fl-sub{margin:0;font-size:13px;color:#c8d6f0;line-height:1.3}
  .fl-x{width:28px;height:28px;display:grid;place-items:center;background:#ff5a5a;color:#fff;border:3px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer;font:700 18px/1 monospace}
  .fl-card{background:#fff;border:3px solid #000;box-shadow:3px 3px 0 #000;padding:12px;display:grid;gap:10px}
  .fl-field{display:grid;gap:5px}
  .fl-field span{font-family:'Press Start 2P',monospace;font-size:6px;letter-spacing:0.04em}
  .fl-field input,.fl-field select{padding:10px 11px;border:3px solid #000;font-family:'Press Start 2P',monospace;font-size:7px;background:#fffff8;box-shadow:inset 2px 2px 0 rgba(0,0,0,0.06)}
  .fl-field select{cursor:pointer}
  .fl-field.small{flex:1}
  .fl-chips{display:flex;flex-wrap:wrap;gap:6px}
  .fl-chip{padding:6px 9px;border:2px solid #000;background:#f0f0f0;font-family:'Press Start 2P',monospace;font-size:5.5px;cursor:pointer;box-shadow:1px 1px 0 #000}
  .fl-chip.on{background:#ffcb05}
  .fl-row{display:flex;gap:10px;align-items:end;flex-wrap:wrap}
  .fl-btn{padding:10px 14px;border:3px solid #000;background:#fff;font-family:'Press Start 2P',monospace;font-size:7px;box-shadow:3px 3px 0 #000;cursor:pointer;letter-spacing:0.02em}
  .fl-btn:disabled{opacity:0.55;cursor:not-allowed}
  .fl-btn:active:not(:disabled){transform:translate(2px,2px);box-shadow:1px 1px 0 #000}
  .fl-btn.primary{background:#ffcb05;color:#000}
  .fl-btn.big{padding:12px 16px;font-size:7px}
  .fl-btn.ghost{background:#fff}
  .fl-btn.sm{padding:7px 10px;font-size:6px}
  .fl-btn.mic{min-width:96px}
  .fl-btn.mic.on{background:#ff5a5a;color:#fff;animation:pulseMic 1.1s infinite}
  @keyframes pulseMic{0%,100%{box-shadow:3px 3px 0 #000}50%{box-shadow:0 0 10px #ff5a5a, 3px 3px 0 #000}}
  .fl-err{background:#ffe0e0;border:2px solid #c00;padding:8px;font-family:'Press Start 2P',monospace;font-size:6px;color:#900}
  .fl-warn{background:#fff3c0;border:2px solid #c90;padding:8px;font-size:12px;line-height:1.4}
  .fl-ok{background:#dcfce7;border:2px solid #166534;padding:8px;font-size:11px;color:#14532d}
  .fl-mic-ask{display:flex;gap:8px;align-items:center;justify-content:space-between;background:#fff8c0;border:3px solid #000;padding:8px;font-size:11px;line-height:1.3;box-shadow:1px 1px 0 #000;flex-wrap:wrap}
  .fl-hint{margin:0;font-size:12px;color:#666;line-height:1.3}
  .fl-history{display:grid;gap:6px}
  .fl-history-title{font-family:'Press Start 2P',monospace;font-size:6px;background:#000;color:#fff;padding:6px 8px;width:fit-content}
  .fl-hist-row{display:flex;gap:8px;align-items:center;padding:8px 10px;background:#fff;border:2px solid #000;font-family:'Press Start 2P',monospace;font-size:6px;box-shadow:1px 1px 0 #000;flex-wrap:wrap}
  .fl-hist-row.completed{border-left:6px solid #22c55e}
  .fl-hist-row.active{border-left:6px solid #ffcb05}
  .fl-hist-row.abandoned{opacity:0.6}
  .fl-hist-topic{flex:1}
  .fl-hist-meta{color:#3a5a8c}
  .fl-hist-score{margin-left:auto;background:#000;color:#fff;padding:4px 6px;border:2px solid #000}
  .fl-hist-badge{margin-left:auto;padding:3px 6px;border:2px solid #000}
  .fl-hist-badge.active{background:#ffcb05}
  .fl-hist-badge.completed{background:#22c55e;color:#fff}
  .fl-footer-note{font-size:11px;color:#667;padding:6px 2px;border-top:2px dashed #bbb}
  .fl-footer-note code{background:#000;color:#ffcb05;padding:1px 4px;border:1px solid #000;font-family:monospace;font-size:10px}
  .fl-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;vertical-align:middle;margin-right:6px;box-shadow:0 0 6px #22c55e}
  .fl-result{background:linear-gradient(180deg,#fff 0%,#fff8c0 100%);border:3px solid #000;box-shadow:3px 3px 0 #000;padding:12px;display:grid;gap:10px}
  .fl-result-head{display:flex;gap:12px;align-items:center}
  .fl-score{font-family:'Press Start 2P',monospace;font-size:20px;background:#000;color:#ffcb05;border:3px solid #000;padding:10px 12px;box-shadow:3px 3px 0 #000}
  .fl-score em{font-size:10px}
  .fl-result-title{font-family:'Press Start 2P',monospace;font-size:8px}
  .fl-result-sub{font-family:'Press Start 2P',monospace;font-size:6px;color:#3a5a8c}
  .fl-feedback{margin:0;background:#fff;border:2px solid #000;padding:10px;font-size:13px;line-height:1.4;box-shadow:1px 1px 0 #000}
  .fl-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media(max-width:640px){.fl-grid2{grid-template-columns:1fr}}
  .fl-col{background:#fff;border:2px solid #000;padding:8px;box-shadow:1px 1px 0 #000}
  .fl-col-title{font-family:'Press Start 2P',monospace;font-size:6px;padding:3px 6px;border:2px solid #000;display:inline-block;margin-bottom:6px}
  .fl-col-title.ok{background:#dcfce7;border-color:#166534;color:#14532d}
  .fl-col-title.bad{background:#fee2e2;border-color:#991b1b;color:#7f1d1d}
  .fl-col ul{margin:0;padding-left:16px;font-size:12.5px;line-height:1.35;display:grid;gap:4px}
  /* active session */
  .fl-progress-wrap{display:flex;align-items:center;gap:8px}
  .fl-progress-label{font-family:'Press Start 2P',monospace;font-size:6px;background:#000;color:#fff;padding:4px 6px;border:2px solid #fff}
  .fl-progress{flex:1;max-width:190px;height:12px;background:#000;border:2px solid #fff;box-shadow:1px 1px 0 #000;overflow:hidden}
  .fl-progress i{display:block;height:100%;background:linear-gradient(90deg,#ffcb05 0%,#22c55e 100%);transition:width 0.3s}
  .fl-head-actions{display:flex;gap:8px;align-items:center}
  .fl-turns{flex:1;min-height:260px;max-height:40vh;overflow:auto;padding:12px;display:grid;gap:8px;background:#e9eef5}
  .fl-turn{padding:10px;border:3px solid #000;box-shadow:2px 2px 0 #000;background:#fff;display:grid;gap:6px}
  .fl-turn.ai_question{border-left:6px solid #ffcb05;background:#fffef0}
  .fl-turn.ai_feedback{border-left:6px solid #22c55e;background:#f0fdf4}
  .fl-turn.user{border-left:6px solid #3a5a8c;background:#f8fbff}
  .fl-turn.generating{opacity:0.85}
  .fl-turn-role{font-family:'Press Start 2P',monospace;font-size:5.5px;letter-spacing:0.04em;color:#000;background:#000;color:#fff;padding:3px 6px;width:fit-content}
  .fl-turn.ai_question .fl-turn-role{background:#ffcb05;color:#000;border:2px solid #000}
  .fl-turn.user .fl-turn-role{background:#1e3a6a;color:#fff}
  .fl-turn-body{font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
  .fl-turn-body.pulse{animation:pulse 1s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
  .fl-turn-time{font-family:'Press Start 2P',monospace;font-size:5px;color:#888;justify-self:end}
  .fl-currentQ{padding:10px;background:#ffcb05;border:3px solid #000;box-shadow:2px 2px 0 #000}
  .fl-currentQ-label{font-family:'Press Start 2P',monospace;font-size:6px;background:#000;color:#ffcb05;padding:3px 6px}
  .fl-currentQ p{margin:8px 0 0 0;font-family:'Press Start 2P',monospace;font-size:7px;line-height:1.6}
  .fl-needs{padding:10px;background:#dcfce7;border:3px solid #166534;font-family:'Press Start 2P',monospace;font-size:6.5px;line-height:1.5;box-shadow:2px 2px 0 #000}
  .fl-composer{padding:12px;background:#fff;border-top:4px solid #000;display:grid;gap:8px}
  .fl-composer-top{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
  .fl-field-label{font-family:'Press Start 2P',monospace;font-size:6px;background:#000;color:#fff;padding:4px 6px}
  .fl-mic-hint{font-family:'Press Start 2P',monospace;font-size:5px;color:#666;background:#f0f0f0;border:1px solid #000;padding:3px 6px}
  .fl-textarea{width:100%;padding:10px;border:3px solid #000;font-family:'Inter',sans-serif;font-size:14px;line-height:1.4;resize:vertical;background:#fffff8;box-shadow:inset 2px 2px 0 rgba(0,0,0,0.06)}
  .fl-textarea.listening{background:#fff3c0;outline:3px solid #ffcb05}
  .fl-composer-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .fl-grow{flex:1}
  .fl-char{font-family:'Press Start 2P',monospace;font-size:5px;color:#888}
  .fl-rate-box{padding:12px;background:linear-gradient(180deg,#fff 0%,#f0fdf4 100%);border-top:4px solid #000;display:grid;gap:10px}
  .fl-rate-copy{margin:0;font-size:13px;line-height:1.4;background:#fff;border:2px solid #000;padding:10px;box-shadow:1px 1px 0 #000}
  .fl-rate-actions{display:flex;gap:8px;flex-wrap:wrap}
`;
