import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API wrapper — audio → text
// Uses SpeechRecognition (Chrome/Edge; webkit prefix). No extra deps.
// Now explicitly asks mic permission via getUserMedia before starting recognition,
// so browser shows the permission prompt reliably.

type UseSpeechOpts = {
  lang?: string; // default en-US
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
};

type PermissionState = "prompt" | "granted" | "denied" | "unsupported" | "checking";

export function useSpeechRecognition(opts: UseSpeechOpts = {}) {
  const { lang = "en-US", continuous = false, interimResults = true } = opts;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<PermissionState>("prompt");
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const recRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const networkRetryRef = useRef(0);
  const lastStartRef = useRef<number>(0);

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      setPermission("unsupported");
    } else {
      // probe mic permission state if Permissions API available
      try {
        // @ts-ignore
        navigator.permissions?.query?.({ name: "microphone" as any }).then((res: any) => {
          if (res.state === "granted") setPermission("granted");
          else if (res.state === "denied") setPermission("denied");
          else setPermission("prompt");
          res.onchange = () => {
            if (res.state === "granted") setPermission("granted");
            else if (res.state === "denied") setPermission("denied");
          };
        }).catch(() => {});
      } catch {}
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("getUserMedia not available — use HTTPS or localhost");
      setPermission("unsupported");
      return false;
    }
    setPermission("checking");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // keep track to stop later, show that permission granted
      streamRef.current = stream;
      // immediately stop tracks — we only needed the prompt/grant. SpeechRecognition will use mic itself.
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setPermission("granted");
      setError(null);
      return true;
    } catch (e: any) {
      const name = e?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPermission("denied");
        setError("Microphone permission denied — click the lock icon in address bar → Allow microphone, then reload.");
      } else if (name === "NotFoundError") {
        setPermission("denied");
        setError("No microphone found — connect a mic and reload.");
      } else if (name === "NotReadableError") {
        setError("Microphone busy — close other apps using mic.");
        setPermission("prompt");
      } else {
        setError(e?.message ?? "Mic permission failed");
        setPermission("prompt");
      }
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      setPermission("unsupported");
      setError("SpeechRecognition not supported — use Chrome, Edge, or Samsung Internet on HTTPS/localhost.");
      return;
    }

    // Ensure mic permission first — this shows the browser prompt reliably
    if (permission !== "granted") {
      const ok = await requestPermission();
      if (!ok) {
        // if permission denied, still try SpeechRecognition — it will fire not-allowed error which we handle
        if (permission === "denied") return;
      }
    }

    // Must be called from user gesture; we are (button click). Check secure context.
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      setError("Microphone needs HTTPS — site is on HTTP. Use localhost or deploy to HTTPS.");
      return;
    }

    try {
      // Throttle rapid restarts (major cause of spurious 'network' in Chromium)
      const gap = Date.now() - lastStartRef.current;
      if (gap < 450) await new Promise((r) => setTimeout(r, 450 - gap));
      // Clean old instance
      try { recRef.current?.abort?.(); } catch {}
      // small yield so abort settles
      await new Promise((r) => setTimeout(r, 80));
      const rec = new SR();
      recRef.current = rec;
      rec.lang = lang;
      rec.continuous = continuous;
      rec.interimResults = interimResults;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
        setInterim("");
      };
      rec.onaudiostart = () => setError(null);
      rec.onsoundstart = () => {};
      rec.onspeechstart = () => {};
      rec.onend = () => {
        setIsListening(false);
      };
      rec.onerror = (e: any) => {
        const msg: string = e?.error ?? "unknown";
        console.warn("[speech] error", msg, e);
        if (msg === "no-speech") {
          setError("No speech detected — speak louder / closer to mic, then tap SPEAK again.");
        } else if (msg === "not-allowed" || msg === "service-not-allowed") {
          setPermission("denied");
          setError("Mic blocked — allow microphone in browser settings (lock icon → Site settings → Microphone → Allow) then reload.");
        } else if (msg === "aborted") {
          // user stopped — not an error
          setError(null);
          networkRetryRef.current = 0;
        } else if (msg === "audio-capture") setError("Mic not found or in use by another app. Check mic connection.");
        else if (msg === "network") {
          // Chromium 'network' even with good internet = cloud STT hiccup/block (incognito, firewall, Firefox, etc) — NOT your WiFi.
          // After .env fix we make this non-blocking: first hiccup shows brief yellow tip then auto-clears, second persistent failure silently falls back to typing.
          if (!navigator.onLine) {
            setError("You appear offline — voice needs internet, but you can still type and SEND (AI loop works without mic).");
            setTimeout(() => setError((p) => (p?.includes("offline") ? null : p)), 3000);
          } else {
            const attempts = networkRetryRef.current;
            if (attempts < 1) {
              networkRetryRef.current++;
              setError("Voice hiccup — typing is primary. Your internet is fine. Tap SPEAK again if you want, or just type below — AI will counter you either way.");
              setTimeout(() => {
                setError((prev) => (prev?.includes("hiccup") ? null : prev));
              }, 2500);
            } else {
              // persistent cloud failure in this browser/session (common in Firefox/incognito/blocked) — silently disable voice, force typing fallback
              networkRetryRef.current = 0;
              setVoiceUnavailable(true);
              setError(null);
              console.warn("[speech] persistent network — disabling voice, using typing fallback");
              // show one-time soft info (auto-clears) instead of persistent red error
              setTimeout(() => setError(null), 100);
            }
          }
        } else setError(`Speech error: ${msg} — try again or type instead.`);
        setIsListening(false);
      };
      rec.onresult = (event: any) => {
        let finalTxt = "";
        let interimTxt = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const txt = res[0]?.transcript ?? "";
          if (res.isFinal) finalTxt += txt + " ";
          else interimTxt += txt + " ";
        }
        if (interimTxt) setInterim(interimTxt.trim());
        if (finalTxt) {
          const t = finalTxt.trim();
          setTranscript((prev) => (prev ? prev + " " + t : t));
          setInterim("");
          networkRetryRef.current = 0; // success resets hiccup counter
          opts.onResult?.(t, true);
        } else if (interimTxt) {
          opts.onResult?.(interimTxt, false);
        }
      };
      lastStartRef.current = Date.now();
      rec.start();
    } catch (e: any) {
      setError(e?.message ?? "Failed to start mic");
      setIsListening(false);
    }
  }, [lang, continuous, interimResults, opts, permission, requestPermission]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    setIsListening(false);
    networkRetryRef.current = 0;
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
    networkRetryRef.current = 0;
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      try { recRef.current?.abort?.(); } catch {}
      try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    };
  }, []);

  return {
    supported,
    permission,
    voiceUnavailable,
    isListening,
    transcript,
    interim,
    error,
    start,
    stop,
    reset,
    toggle,
    requestPermission,
    setTranscript,
    setVoiceUnavailable,
  } as const;
}
