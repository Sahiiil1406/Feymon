import { useEffect, useRef } from "react";

export default function LandingPage({ onStart }: { onStart: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in-view")),
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
    );
    root.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    const onMouse = (e: MouseEvent) => {
      if (!heroRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      heroRef.current.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const d = parseFloat(el.dataset.parallax || "0");
        el.style.transform = `translate3d(${x * d * 10}px, ${y * d * 6}px, 0)`;
      });
    };
    window.addEventListener("mousemove", onMouse);
    return () => {
      obs.disconnect();
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <style>{styles}</style>
      <div ref={rootRef} className="lp-root">
        <div className="lp-top-accent" />
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <button className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Feymon home">
              <span className="lp-logo-mark">◉</span>
              <span className="lp-logo-text">FEYMON</span>
              <span className="lp-logo-pill">METAVERSE — BETA</span>
            </button>
            <div className="lp-nav-links">
              <button onClick={() => scrollTo("concept")}>TECHNIQUE</button>
              <button onClick={() => scrollTo("dojo")}>EVOLUTION</button>
              <button onClick={() => scrollTo("world")}>PLAZA</button>
              <button onClick={() => scrollTo("world")}>DOCS</button>
            </div>
            <div className="lp-nav-actions">
              <a className="lp-nav-ghost" href="#" onClick={(e) => e.preventDefault()}>
                Sign in
              </a>
              <button className="lp-nav-cta" onClick={onStart}>
                Enter metaverse
              </button>
            </div>
          </div>
        </nav>

        <section className="lp-hero-wrap">
          <div className="lp-hero-bg" aria-hidden>
            <div className="lp-grid" />
            <div className="lp-grid-accent" />
            <div className="lp-orb o1" data-parallax="0.6" />
            <div className="lp-orb o2" data-parallax="1.0" />
          </div>

          <div ref={heroRef} className="lp-hero">
            <div className="lp-hero-head">
              <div className="lp-badge reveal">
                <span className="lp-badge-dot" />
                FEYNMAN TECHNIQUE × METAVERSE • NOW IN BROWSER
              </div>

              <h1 className="lp-title reveal">
                <span>Learn by</span>
                <span className="grad">explaining.</span>
                <span>Evolve your</span>
                <span className="grad">avatar.</span>
              </h1>

              <p className="lp-sub reveal">
                Teach any topic. Get scored <b>1–10</b>. Every clear loop levels up your avatar.
              </p>

              <div className="lp-hero-actions reveal">
                <button className="lp-btn primary" onClick={onStart}>
                  Enter metaverse <span>→</span>
                </button>
                <button className="lp-btn ghost" onClick={() => scrollTo("concept")}>
                  How evolution works
                </button>
              </div>

              <div className="lp-hero-meta reveal">
                <span>
                  <i className="dot" /> No install
                </span>
                <span>Voice or type</span>
                <span>Live plaza • 0.18s sync</span>
                <span>Convex realtime</span>
              </div>
            </div>

            <div className="lp-ascii-wrap reveal">
              <div className="lp-ascii-card">
                <div className="lp-ascii-head">
                  <div className="lp-ascii-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="lp-ascii-title">plaza.map — 2D world — ascii:live</span>
                  <span className="lp-ascii-live">
                    <i /> LIVE • 12
                  </span>
                </div>

                <div className="lp-ascii-body">
                  <div className="lp-ascii-map">
                    <pre className="lp-ascii-pre" aria-hidden>{`┌────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░  ┌──────────┐      ░░░░       ┌──────────┐  ░░░░░ │
│ ░  │  HOUSE   │      ░░░░       │  HOUSE   │  ░░░░░ │
│ ░  └────┬─────┘      ░░░░       └────┬─────┘  ░░░░░ │
│ ░░░░░░░░│     ┌────────────────┐      │  ░░░░░░░░░░ │
│ ░  ◐ NPC│     │  PATH   · · ·  │      │  ◎ YOU      │
│ ░  “new?”│     │                │      │  Lv7 ──►     │
│ ░       │     │   ⛩  DOJO      │      │  ⬢ Lv8  ✦   │
│ ░░░░░░░░│     └───┬────────────┘      │  ░░░░░░░░░░ │
│ ░░░░░░░░│         │  ░░░░░░░          │  ░░░░░░░░░░ │
│ ░  ▓▓ Desert Outpost  ░░░  ░░░  →  ░░  ✦ UNLOCKED ░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────────────────────────┘`}</pre>
                    <div className="lp-ascii-beats">
                      <span className="beat b1">
                        <i>①</i> Arrive <em>Lv1</em>
                      </span>
                      <span className="beat b2">
                        <i>②</i> Explain → AI scores 7.2
                      </span>
                      <span className="beat b3">
                        <i>③</i> Evolve <em>+skin +aura +region</em>
                      </span>
                    </div>
                    <div className="lp-ascii-avatars">
                      <span className="av a1">◐<em>AI NPC</em></span>
                      <span className="av a2">◎<em>YOU Lv7</em></span>
                      <span className="av a3">⬢<em>Lv8</em></span>
                      <span className="av a4">○<em>@nova</em></span>
                    </div>
                    <div className="lp-ascii-bubbles">
                      <span className="bubble ai">“Why green then?”</span>
                      <span className="bubble me">“Light cooking!” +40 XP</span>
                    </div>
                  </div>

                  <div className="lp-ascii-legend">
                    <span>
                      <i style={{ background: "#FF6B35" }} /> Unlocks: skin • aura • region
                    </span>
                    <span>
                      <i style={{ background: "#fff" }} /> Talk: AI NPCs + real avatars
                    </span>
                    <span className="mono">5 Hz • 0.18s sync</span>
                  </div>
                </div>

                <div className="lp-ascii-foot">
                  <span>Plaza is the map. Dojo is the forge. Explain to move.</span>
                  <span className="mono">ascii world v1 • live</span>
                </div>
              </div>

              <div className="lp-float" data-parallax="0.55">
                <div className="lp-float-head">EVOLUTION</div>
                <div className="lp-float-metric">
                  <b>Lv7 → Lv8</b>
                  <span>desert unlocked</span>
                </div>
                <div className="lp-float-bar">
                  <i style={{ width: "68%" }} />
                </div>
                <span className="lp-float-note">68% • +1 region on next level</span>
              </div>
            </div>
          </div>
        </section>

        <div className="lp-divider">
          <span className="line" />
          <span className="diamond">◆</span>
          <span className="line" />
        </div>

        <section id="concept" className="lp-section">
          <div className="lp-section-inner">
            <div className="lp-kicker reveal">
              <span>— 01 — TECHNIQUE</span> Feynman × Metaverse
            </div>
            <h2 className="lp-h2 reveal">
              Don&apos;t memorize.
              <br />
              <span className="lime">Teach and transform.</span>
            </h2>
            <p className="lp-lead reveal">
              Explain simply → find gaps → upgrade. Your avatar <em>is</em> your understanding.
            </p>

            <div className="lp-grid3">
              <div className="lp-card reveal">
                <div className="lp-card-head">
                  <span className="mono">[01]</span>
                  <span className="tag">3–5 TURNS</span>
                </div>
                <div className="lp-card-icon">◐</div>
                <h3>Explain</h3>
                <p>Teach it simply. One sharp counter-question finds the gap.</p>
                <div className="lp-card-code">$ explain --simple</div>
              </div>
              <div className="lp-card reveal" style={{ transitionDelay: "70ms" }}>
                <div className="lp-card-head">
                  <span className="mono">[02]</span>
                  <span className="tag lime">UNLOCKS</span>
                </div>
                <div className="lp-card-icon">⬢</div>
                <h3>Evolve</h3>
                <p>Score 1–10. Level → new character, aura, region.</p>
                <div className="lp-card-visual">
                  <svg viewBox="0 0 120 36" className="lp-mini-evo-svg" aria-hidden>
                    <g>
                      <circle cx="18" cy="18" r="14" fill="#0a0a0a" stroke="#1a1a1a" />
                      <text x="18" y="22" textAnchor="middle" fontSize="8" fontFamily="JetBrains Mono" fill="#666">1</text>
                      <line x1="32" y1="18" x2="46" y2="18" stroke="#1a1a1a" strokeWidth="1.2" strokeDasharray="3 2" />
                      <circle cx="60" cy="18" r="16" fill="#0a0a0a" stroke="#FF6B35" />
                      <text x="60" y="22" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono" fill="#FF6B35">7</text>
                      <line x1="76" y1="18" x2="90" y2="18" stroke="#FF6B35" strokeWidth="1.2" />
                      <circle cx="104" cy="18" r="16" fill="#FF6B35" stroke="#FF6B35" />
                      <text x="104" y="22" textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="Inter" fill="#000">8</text>
                      <g className="lp-svg-spark" style={{ transformOrigin: "104px 8px" }}>
                        <text x="104" y="8" textAnchor="middle" fontSize="7" fill="#FF6B35">✦</text>
                      </g>
                    </g>
                  </svg>
                  <span className="lp-card-code small">+ skin • + aura • + region</span>
                </div>
              </div>
              <div className="lp-card reveal" style={{ transitionDelay: "140ms" }}>
                <div className="lp-card-head">
                  <span className="mono">[03]</span>
                  <span className="tag">5 HZ</span>
                </div>
                <div className="lp-card-icon">◎</div>
                <h3>Exhibit</h3>
                <p>Live plaza. 0.18s sync. Everyone sees you evolve.</p>
                <div className="lp-card-code">live --realtime</div>
              </div>
            </div>

            <div className="lp-quote reveal">
              <p>“Explain simply — or your avatar stays.” <span>— Plaza Guide</span></p>
            </div>
          </div>
        </section>

        <section id="dojo" className="lp-section soft">
          <div className="lp-section-inner wide">
            <div className="lp-split">
              <div className="lp-split-media reveal">
                <div className="lp-diagram">
                  <div className="lp-diagram-head">
                    <span>Evolution Dojo • Heart of Plaza</span>
                    <span className="live">
                      <i /> SCORING
                    </span>
                  </div>
                  <div className="lp-diagram-body">
                    <div className="lp-diagram-stack">
                      <div className="lp-stack-node">
                        <span>◐ Lv1</span>
                        <div className="bar" style={{ width: "36%" }} />
                        <em>Novice</em>
                      </div>
                      <div className="lp-stack-arrow">↓ explain → score</div>
                      <div className="lp-stack-node active">
                        <span>◎ Lv7</span>
                        <div className="bar lime" style={{ width: "68%" }} />
                        <em>Explainer • 68% → Lv8</em>
                      </div>
                      <div className="lp-stack-arrow lime">↓ 1–10 + strengths</div>
                      <div className="lp-stack-node next">
                        <span>⬢ Lv8</span>
                        <div className="bar lime strong" style={{ width: "100%" }} />
                        <em>Aura +1 • trail • presence</em>
                      </div>
                    </div>
                    <div className="lp-diagram-side">
                      <div className="lp-side-row">
                        <span>Explain</span>
                        <i style={{ width: "82%" }} />
                      </div>
                      <div className="lp-side-row">
                        <span>Counter-Q</span>
                        <i style={{ width: "64%" }} />
                      </div>
                      <div className="lp-side-row">
                        <span>Refine</span>
                        <i style={{ width: "91%" }} />
                      </div>
                      <div className="lp-diagram-note">Mic → transcript → LLM → score</div>
                    </div>
                  </div>
                  <div className="lp-diagram-foot">
                    <span>Strengths: analogy</span>
                    <span>Weaknesses: mechanism</span>
                    <span className="xp">+40 XP → EVOLVE</span>
                  </div>
                  <div className="lp-unlock-strip">
                    <span className="unlock">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><circle cx="8" cy="7" r="4" fill="none" stroke="#FF6B35" strokeWidth="1.3"/><path d="M5 11 L11 11 L10 14 L6 14 Z" fill="#FF6B35" opacity="0.9"/></svg>
                      New character
                    </span>
                    <span className="unlock">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><circle cx="8" cy="8" r="5" fill="none" stroke="#FF6B35" strokeWidth="1.2" strokeDasharray="2 2"/><text x="8" y="11" textAnchor="middle" fontSize="7" fill="#FF6B35">✦</text></svg>
                      New aura
                    </span>
                    <span className="unlock">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><rect x="3" y="3" width="10" height="10" rx="2" fill="none" stroke="#FF6B35" strokeWidth="1.2"/><path d="M3 6 H13 M6 3 V13" stroke="#1a1a1a" strokeWidth="1"/></svg>
                      New region
                    </span>
                    <span className="unlock lime">Lv 8 → Desert Outpost unlocked</span>
                  </div>
                </div>
                <div className="lp-media-caption">One building, infinite loops • unlocks every level • Web Speech + typing</div>
              </div>

              <div className="lp-split-text">
                <div className="lp-kicker left reveal">— 02 — EVOLUTION</div>
                <h2 className="lp-h2 left reveal">
                  Knowledge
                  <br />
                  <span className="lime">becomes form.</span>
                </h2>
                <p className="lp-body reveal">Forge, not exam. Clarity → evolution.</p>

                <div className="lp-steps reveal">
                  <div className="lp-step">
                    <span>01</span>
                    <div>
                      <b>Choose</b>
                      <p>5 topics or your own.</p>
                    </div>
                  </div>
                  <div className="lp-step">
                    <span>02</span>
                    <div>
                      <b>Teach</b>
                      <p>Voice or type.</p>
                    </div>
                  </div>
                  <div className="lp-step">
                    <span>03</span>
                    <div>
                      <b>Score</b>
                      <p>1–10 + gaps.</p>
                    </div>
                  </div>
                  <div className="lp-step">
                    <span>04</span>
                    <div>
                      <b>Unlock</b>
                      <p>Character + region.</p>
                    </div>
                  </div>
                </div>

                <div className="lp-inline-cta reveal">
                  <button className="lp-btn primary small" onClick={onStart}>
                    Evolve now →
                  </button>
                  <span className="hint">Hotkey F • Or enter central Dojo door</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="world" className="lp-section">
          <div className="lp-section-inner">
            <div className="lp-kicker reveal">— 03 — PLAZA</div>
            <h2 className="lp-h2 reveal">
              A metaverse where
              <br />
              <span className="lime">learning is visible.</span>
            </h2>

            <div className="lp-world-grid reveal">
              <div className="lp-world-card">
                <div className="lp-world-icon">▦</div>
                <h4>Reputation = level</h4>
                <p>Earned by clarity alone.</p>
              </div>
              <div className="lp-world-card">
                <div className="lp-world-icon">◈</div>
                <h4>Explore → Exhibit</h4>
                <p>Walk, teach, evolve, show.</p>
              </div>
              <div className="lp-world-card">
                <div className="lp-world-icon">⬢</div>
                <h4>Scale humanely</h4>
                <p>Shard confusion, not yourself.</p>
              </div>
            </div>

            <div className="lp-alive-grid reveal">
              <div className="lp-alive-card">
                <div className="lp-alive-icon">
                  <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden>
                    <rect x="2" y="2" width="44" height="44" rx="10" fill="#0a0a0a" stroke="#1a1a1a"/>
                    <circle cx="24" cy="18" r="10" fill="none" stroke="#FF6B35" strokeWidth="1.4"/>
                    <path d="M14 36 C14 28 34 28 34 36" fill="none" stroke="#FF6B35" strokeWidth="1.4" strokeLinecap="round"/>
                    <g className="lp-ai-spark">
                      <text x="36" y="12" fontSize="8" fill="#FF6B35">✦</text>
                      <text x="10" y="14" fontSize="6" fill="#FF6B35" opacity="0.7">✦</text>
                    </g>
                  </svg>
                  <span className="lp-alive-badge">AI</span>
                </div>
                <h4>NPCs powered by AI</h4>
                <p>Every talk is new. Mentors remember context, react to your level, never repeat the same line.</p>
                <div className="lp-chat-preview">
                  <span className="bubble ai">“What if you taught that to a 12-year-old?”</span>
                  <span className="bubble user">“Photosynthesis is… plants cooking with light?”</span>
                  <span className="bubble ai typing"><i/><i/><i/></span>
                </div>
                <span className="lp-alive-tag">New text • every interaction • LLM</span>
              </div>
              <div className="lp-alive-card">
                <div className="lp-alive-icon">
                  <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden>
                    <rect x="2" y="2" width="44" height="44" rx="10" fill="#0a0a0a" stroke="#1a1a1a"/>
                    <circle cx="16" cy="18" r="7" fill="none" stroke="#fff" strokeWidth="1.3"/>
                    <path d="M9 36 C9 29 23 29 23 36" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/>
                    <circle cx="32" cy="18" r="7" fill="none" stroke="#FF6B35" strokeWidth="1.3"/>
                    <path d="M25 36 C25 29 39 29 39 36" fill="none" stroke="#FF6B35" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="23" y1="26" x2="25" y2="26" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="lp-alive-badge live"><i/> LIVE</span>
                </div>
                <h4>Talk to real meta avatars</h4>
                <p>Not bots only. Chat, drift, and learn beside live players — proximity voice + text.</p>
                <div className="lp-chat-preview">
                  <span className="bubble other">“Lv 7 — how’d you explain recursion?” <em>— @nova • Lv8</em></span>
                  <span className="bubble me">“I used Russian dolls → got +40 XP!”</span>
                </div>
                <span className="lp-alive-tag">Live plaza • 0.18s • voice + text</span>
              </div>
            </div>

            <div className="lp-feature-row reveal">
              <div className="lp-feature">
                <span className="mono">SYNC</span>
                <b>0.18s</b>
                <p>5 Hz live.</p>
              </div>
              <div className="lp-feature">
                <span className="mono">BRANCH</span>
                <b>Safe loops</b>
                <p>Abandon anytime.</p>
              </div>
              <div className="lp-feature">
                <span className="mono">INSIGHT</span>
                <b>Score + gaps</b>
                <p>Every time.</p>
              </div>
            </div>

            <div className="lp-ctrl-strip reveal">
              <span><b>WASD</b> move</span>
              <span><b>Enter</b> talk</span>
              <span><b>F</b> dojo</span>
              <span><b>M</b> profile</span>
            </div>
          </div>
        </section>

        <section className="lp-cta">
          <div className="lp-cta-inner">
            <div className="lp-cta-card reveal">
              <div className="lp-cta-kicker">— DEPLOY YOUR AVATAR —</div>
              <h2 className="lp-cta-title">
                Evolve in public.
                <span>Your knowledge, your form.</span>
              </h2>
              <p>Name, hue, explain. Your avatar does the rest.</p>
              <button className="lp-btn primary large" onClick={onStart}>
                Enter metaverse — free
              </button>
              <div className="lp-cta-meta">
                <span>Live plaza • Convex</span>
                <span>Voice or type</span>
                <span>Gemini / OpenAI / mock</span>
              </div>
              <div className="lp-cta-sub">Built for clarity — not cramming.</div>
            </div>
          </div>
          <footer className="lp-footer">
            <span>Feymon — Feynman plaza.</span>
            <span className="lp-footer-links">
              <button onClick={() => scrollTo("concept")}>Technique</button>
              <span>•</span>
              <button onClick={() => scrollTo("dojo")}>Evolution</button>
              <span>•</span>
              <button onClick={() => scrollTo("world")}>Plaza</button>
            </span>
          </footer>
        </section>
      </div>
    </>
  );
}

const styles = `
.lp-root{ --bg:#000; --bg2:#0a0a0a; --card:#0f0f0f; --line:#1a1a1a; --line2:#232323; --ink:#fff; --muted:#8a8a8a; --muted2:#666; --lime:#FF6B35; --lime2:#E85D2F; --lime-soft:rgba(255,107,53,0.08); background:var(--bg); color:var(--ink); font-family:'Inter', system-ui, -apple-system, sans-serif; overflow:clip; position:relative; }
.lp-root *{ box-sizing:border-box; }
.lp-top-accent{ height:1px; background: linear-gradient(90deg, transparent, var(--lime) 50%, transparent); opacity:0.9; }
.lp-nav{ position:sticky; top:0; z-index:30; background:rgba(0,0,0,0.84); backdrop-filter:blur(16px) saturate(180%); -webkit-backdrop-filter:blur(16px) saturate(180%); border-bottom:1px solid var(--line); }
.lp-nav-inner{ max-width:1280px; margin:0 auto; height:56px; padding:0 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
.lp-logo{ display:flex; align-items:center; gap:10px; background:none; border:none; cursor:pointer; padding:0; color:var(--ink); }
.lp-logo-mark{ width:28px; height:28px; display:grid; place-items:center; background:var(--lime); color:#000; border-radius:6px; font-size:11px; font-weight:800; flex-shrink:0; }
.lp-logo-text{ font-size:14px; font-weight:800; letter-spacing:0.12em; font-family:'JetBrains Mono',monospace; }
.lp-logo-pill{ margin-left:6px; padding:4px 8px; background:#0a0a0a; border:1px solid var(--line); border-radius:999px; font-size:10px; font-weight:600; letter-spacing:0.08em; color:var(--muted); white-space:nowrap; font-family:'JetBrains Mono',monospace; text-transform:uppercase; }
.lp-nav-links{ display:flex; gap:20px; margin-left:20px; }
.lp-nav-links button{ background:none; border:none; cursor:pointer; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; font-weight:600; color:var(--muted); padding:6px 0; border-bottom:1px solid transparent; transition:color 0.15s, border-color 0.15s; font-family:'JetBrains Mono',monospace; }
.lp-nav-links button:hover{ color:#fff; border-color:var(--lime); }
.lp-nav-actions{ display:flex; align-items:center; gap:10px; margin-left:auto; flex-shrink:0; }
.lp-nav-ghost{ font-size:13px; font-weight:500; color:var(--muted); padding:6px 10px; }
.lp-nav-ghost:hover{ color:#fff; }
.lp-nav-cta{ display:inline-flex; align-items:center; justify-content:center; padding:8px 14px; border-radius:8px; border:1px solid var(--lime); background:var(--lime); color:#000; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.15s; font-family:'JetBrains Mono',monospace; letter-spacing:0.02em; }
.lp-nav-cta:hover{ filter:brightness(1.06); transform:translateY(-1px); }
.lp-hero-wrap{ position:relative; overflow:hidden; border-bottom:1px solid var(--line); background:#000; }
.lp-hero-bg{ position:absolute; inset:0; pointer-events:none; }
.lp-grid{ position:absolute; inset:0; background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size:32px 32px; opacity:1; mask: radial-gradient(ellipse 90% 70% at 50% 0%, black 58%, transparent 82%); }
.lp-grid-accent{ position:absolute; inset:0; background-image: linear-gradient(rgba(255,107,53,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,53,0.03) 1px, transparent 1px); background-size:96px 96px; opacity:1; mask: radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 78%); }
.lp-orb{ position:absolute; border-radius:50%; filter: blur(40px); opacity:0.5; will-change:transform; transition:transform 0.35s ease-out; }
.lp-orb.o1{ width:700px; height:700px; left:-10%; top:-20%; background: radial-gradient(circle at 30% 30%, rgba(255,107,53,0.10), transparent 62%); }
.lp-orb.o2{ width:680px; height:680px; right:-8%; top:-14%; background: radial-gradient(circle at 40% 40%, rgba(255,107,53,0.06), transparent 66%); }
.lp-hero{ position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:48px 20px 36px; display:grid; gap:28px; }
.lp-hero-head{ display:grid; gap:16px; justify-items:center; text-align:center; max-width:760px; margin:0 auto; }
.lp-badge{ display:inline-flex; align-items:center; gap:8px; padding:6px 12px; background:#0a0a0a; border:1px solid var(--line); border-radius:999px; font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); font-family:'JetBrains Mono',monospace; }
.lp-badge-dot{ width:6px; height:6px; background:var(--lime); border-radius:50%; box-shadow:0 0 0 4px rgba(255,107,53,0.12); animation:pulse 1.6s ease-in-out infinite; }
@keyframes pulse{ 0%,100%{ box-shadow:0 0 0 4px rgba(255,107,53,0.12);} 50%{ box-shadow:0 0 0 7px rgba(255,107,53,0.06);} }
.lp-title{ margin:0; font-size: clamp(34px, 6vw, 62px); line-height:0.92; letter-spacing:-0.05em; font-weight:800; color:#fff; }
.lp-title span{ display:block; }
.lp-title .grad{ color:var(--lime); }
.lp-sub{ margin:0; max-width:640px; font-size:15px; line-height:1.6; color:var(--muted); }
.lp-sub b{ color:#fff; font-weight:600; }
.lp-hero-actions{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:4px; }
.lp-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 18px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.15s; letter-spacing:-0.01em; border:1px solid transparent; font-family:'JetBrains Mono',monospace; text-transform:uppercase; letter-spacing:0.04em; }
.lp-btn.primary{ background:var(--lime); color:#000; border-color:var(--lime); box-shadow:0 4px 16px rgba(255,107,53,0.18); }
.lp-btn.primary:hover{ filter:brightness(1.04); transform:translateY(-1px); box-shadow:0 8px 24px rgba(255,107,53,0.22); }
.lp-btn.ghost{ background:#0a0a0a; color:#fff; border-color:var(--line); }
.lp-btn.ghost:hover{ background:#111; border-color:var(--line2); }
.lp-btn.small{ padding:9px 14px; font-size:11px; }
.lp-btn.large{ padding:14px 22px; font-size:13px; }
.lp-hero-meta{ display:flex; gap:14px; flex-wrap:wrap; justify-content:center; font-size:11px; color:var(--muted2); font-family:'JetBrains Mono',monospace; letter-spacing:0.04em; text-transform:uppercase; }
.lp-hero-meta .dot{ width:6px; height:6px; background:var(--lime); border-radius:50%; display:inline-block; margin-right:6px; box-shadow:0 0 0 4px rgba(255,107,53,0.10); }
.lp-ascii-wrap{ position:relative; max-width:860px; width:100%; margin:0 auto; }
.lp-ascii-card{ background:#0a0a0a; border:1px solid var(--line); border-radius:12px; overflow:hidden; box-shadow:0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,107,53,0.04); }
.lp-ascii-head{ display:flex; align-items:center; gap:10px; padding:10px 12px; background:#000; border-bottom:1px solid var(--line); font-size:11px; font-family:'JetBrains Mono',monospace; }
.lp-ascii-dots{ display:flex; gap:6px; }
.lp-ascii-dots span{ width:9px; height:9px; border-radius:50%; background:#1a1a1a; border:1px solid #232323; }
.lp-ascii-dots span:nth-child(1){ background:#ff5f56; border-color:#ff5f56; }
.lp-ascii-dots span:nth-child(2){ background:#ffbd2e; border-color:#ffbd2e; }
.lp-ascii-dots span:nth-child(3){ background:#27c93f; border-color:#27c93f; }
.lp-ascii-title{ color:var(--muted); letter-spacing:0.04em; text-transform:uppercase; }
.lp-ascii-live{ margin-left:auto; display:inline-flex; gap:6px; align-items:center; padding:3px 8px; background:rgba(255,107,53,0.08); border:1px solid rgba(255,107,53,0.14); border-radius:999px; color:var(--lime); font-weight:700; font-size:10px; }
.lp-ascii-live i{ width:6px; height:6px; background:var(--lime); border-radius:50%; box-shadow:0 0 0 4px rgba(255,107,53,0.12); animation:pulse 1.6s ease-in-out infinite; }
.lp-ascii-body{ padding:12px; display:grid; gap:12px; background:linear-gradient(180deg, #0a0a0a, #000); }
.lp-ascii-map{ position:relative; background:#000; border:1px solid var(--line); border-radius:10px; overflow:hidden; padding:10px; display:grid; gap:10px; }
.lp-ascii-pre{ margin:0; padding:0; font-family:'JetBrains Mono', monospace; font-size:10.5px; line-height:1.35; color:#a1a1a1; background:transparent; white-space:pre; overflow-x:auto; text-align:center; letter-spacing:0; }
.lp-ascii-pre::selection{ background:var(--lime); color:#000; }
.lp-ascii-beats{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
.lp-ascii-beats .beat{ display:inline-flex; gap:6px; align-items:center; padding:5px 9px; background:#0a0a0a; border:1px solid var(--line); border-radius:999px; font-size:11px; font-family:'JetBrains Mono',monospace; color:var(--muted); }
.lp-ascii-beats .beat i{ width:16px; height:16px; display:grid; place-items:center; background:#000; border:1px solid var(--line); border-radius:999px; font-size:10px; font-style:normal; color:var(--muted); }
.lp-ascii-beats .beat.b3{ background:rgba(255,107,53,0.08); border-color:rgba(255,107,53,0.18); color:var(--lime); }
.lp-ascii-beats .beat.b3 i{ background:var(--lime); color:#000; border-color:var(--lime); }
.lp-ascii-avatars{ position:absolute; inset:0; pointer-events:none; }
.lp-ascii-avatars .av{ position:absolute; padding:3px 6px; background:rgba(0,0,0,0.85); border:1px solid var(--line); border-radius:999px; font-size:10px; font-weight:700; font-family:'JetBrains Mono',monospace; color:#fff; display:inline-flex; gap:4px; align-items:center; backdrop-filter:blur(4px); }
.lp-ascii-avatars .av em{ font-style:normal; font-size:9px; color:var(--muted); font-weight:500; }
.lp-ascii-avatars .av.a1{ left:12%; top:44%; border-color:rgba(255,107,53,0.22); }
.lp-ascii-avatars .av.a2{ left:52%; top:46%; background:var(--lime); color:#000; border-color:var(--lime); }
.lp-ascii-avatars .av.a2 em{ color:rgba(0,0,0,0.6); }
.lp-ascii-avatars .av.a3{ right:14%; top:48%; background:var(--lime); color:#000; border-color:var(--lime); animation: avPulse 1.8s ease-in-out infinite; }
.lp-ascii-avatars .av.a4{ left:38%; top:18%; opacity:0.9; }
@keyframes avPulse{ 0%,100%{ box-shadow:0 0 0 0 rgba(255,107,53,0.18);} 50%{ box-shadow:0 0 0 6px rgba(255,107,53,0.08);} }
.lp-ascii-bubbles{ position:absolute; top:6px; right:8px; display:grid; gap:6px; max-width:42%; }
.lp-ascii-bubbles .bubble{ padding:6px 8px; border-radius:8px; font-size:10px; line-height:1.3; font-family:'JetBrains Mono',monospace; border:1px solid var(--line); max-width:100%; }
.lp-ascii-bubbles .bubble.ai{ background:#0a0a0a; color:#ededed; border-bottom-right-radius:4px; align-self:end; }
.lp-ascii-bubbles .bubble.me{ background:var(--lime); color:#000; font-weight:600; border-color:var(--lime); border-bottom-right-radius:4px; justify-self:end; }
.lp-ascii-legend{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; font-size:11px; font-family:'JetBrains Mono',monospace; color:var(--muted); }
.lp-ascii-legend i{ width:8px; height:8px; border-radius:50%; display:inline-block; vertical-align:middle; }
.lp-ascii-foot{ display:flex; justify-content:space-between; gap:10px; padding:8px 12px; background:#000; border-top:1px solid var(--line); font-size:11px; color:var(--muted2); font-family:'JetBrains Mono',monospace; }
.lp-ascii-foot .mono{ color:var(--muted); }
.lp-float{ position:absolute; right:-10px; top:-14px; display:grid; gap:6px; padding:10px 12px; background:#0a0a0a; border:1px solid var(--line); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.5); min-width:160px; }
.lp-float-head{ font-size:10px; letter-spacing:0.10em; text-transform:uppercase; font-weight:700; color:var(--muted2); font-family:'JetBrains Mono',monospace; }
.lp-float-metric{ display:flex; align-items:baseline; gap:8px; }
.lp-float-metric b{ font-size:20px; font-weight:800; letter-spacing:-0.04em; color:var(--lime); }
.lp-float-metric span{ font-size:11px; color:var(--muted); font-family:'JetBrains Mono',monospace; text-transform:uppercase; }
.lp-float-bar{ height:6px; background:#000; border:1px solid var(--line); border-radius:999px; overflow:hidden; }
.lp-float-bar i{ display:block; height:100%; background:var(--lime); }
.lp-float-note{ font-size:10px; color:var(--muted2); font-family:'JetBrains Mono',monospace; }
.lp-divider{ display:flex; align-items:center; justify-content:center; gap:14px; padding:14px 20px; background:#000; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.lp-divider .line{ height:1px; flex:1; max-width:420px; background: linear-gradient(90deg, transparent, rgba(255,107,53,0.18) 50%, transparent); }
.lp-divider .diamond{ color:var(--lime); font-size:9px; text-shadow:0 0 10px rgba(255,107,53,0.6); }
.lp-section{ padding:48px 20px; border-bottom:1px solid var(--line); background:#000; position:relative; }
.lp-section.soft{ background:#0a0a0a; }
.lp-section-inner{ max-width:1120px; margin:0 auto; }
.lp-section-inner.wide{ max-width:1120px; }
.lp-kicker{ font-size:11px; letter-spacing:0.16em; text-transform:uppercase; font-weight:700; color:var(--muted); font-family:'JetBrains Mono',monospace; }
.lp-kicker span{ color:var(--lime); }
.lp-h2{ margin:10px 0 0 0; font-size: clamp(28px, 4.2vw, 42px); line-height:0.96; letter-spacing:-0.04em; font-weight:800; color:#fff; }
.lp-h2 .lime{ color:var(--lime); }
.lp-lead{ max-width:640px; margin:12px 0 0 0; font-size:14px; line-height:1.6; color:var(--muted); }
.lp-section .lp-lead{ margin-left:auto; margin-right:auto; text-align:center; }
.lp-lead b{ color:#fff; }
.lp-lead em{ color:#fff; font-style:normal; border-bottom:1px solid var(--line2); }
.lp-grid3{ display:grid; grid-template-columns: repeat(3, 1fr); gap:14px; margin-top:28px; }
.lp-card{ background:#0a0a0a; border:1px solid var(--line); border-radius:12px; padding:16px; position:relative; overflow:hidden; transition:border-color 0.15s, transform 0.15s; }
.lp-card:hover{ border-color:#232323; transform:translateY(-2px); }
.lp-card::before{ content:""; position:absolute; left:0; right:0; top:0; height:1px; background:linear-gradient(90deg, transparent, rgba(255,107,53,0.0) 14%, rgba(255,107,53,0.18) 50%, transparent 86%); opacity:0; transition:opacity 0.2s; }
.lp-card:hover::before{ opacity:1; }
.lp-card-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.lp-card-head .mono{ font-size:11px; color:var(--muted2); font-family:'JetBrains Mono',monospace; }
.lp-card-head .tag{ padding:3px 7px; background:#000; border:1px solid var(--line); border-radius:999px; font-size:10px; font-weight:700; letter-spacing:0.06em; color:var(--muted); font-family:'JetBrains Mono',monospace; }
.lp-card-head .tag.lime{ color:var(--lime); border-color:rgba(255,107,53,0.18); background:rgba(255,107,53,0.08); }
.lp-card-icon{ width:32px; height:32px; display:grid; place-items:center; background:#000; border:1px solid var(--line); border-radius:8px; color:var(--lime); font-size:14px; }
.lp-card h3{ margin:10px 0 6px 0; font-size:14px; font-weight:700; letter-spacing:-0.02em; color:#fff; }
.lp-card p{ margin:0; font-size:13px; line-height:1.6; color:var(--muted); }
.lp-card-code{ margin-top:12px; padding:8px 10px; background:#000; border:1px solid var(--line); border-radius:8px; font-size:11px; color:var(--muted); font-family:'JetBrains Mono',monospace; }
.lp-card-visual{ margin-top:10px; display:grid; gap:6px; justify-items:center; }
.lp-mini-evo-svg{ width:100%; max-width:140px; height:auto; display:block; }
.lp-svg-spark{ animation: sparkTwinkle 2s ease-in-out infinite; }
@keyframes sparkTwinkle{ 0%,100%{ opacity:1; transform: scale(1);} 50%{ opacity:0.6; transform: scale(1.2);} }
.lp-card-code.small{ margin-top:0; padding:4px 8px; font-size:10px; letter-spacing:0.04em; }
.lp-quote{ margin-top:20px; padding:16px; background:#0a0a0a; border:1px solid var(--line); border-radius:12px; display:grid; gap:8px; position:relative; text-align:center; }
.lp-quote p{ margin:0; font-size:14px; line-height:1.6; color:#fff; max-width:640px; margin-left:auto; margin-right:auto; }
.lp-quote span{ font-size:11px; color:var(--muted); font-family:'JetBrains Mono',monospace; letter-spacing:0.04em; text-transform:uppercase; margin-left:6px; }
.lp-split{ display:grid; grid-template-columns: 1.05fr 0.95fr; gap:28px; align-items:center; }
.lp-diagram{ background:#0a0a0a; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.lp-diagram-head{ display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#000; border-bottom:1px solid var(--line); font-size:11px; font-family:'JetBrains Mono',monospace; letter-spacing:0.04em; text-transform:uppercase; color:#fff; }
.lp-diagram-head .live{ display:inline-flex; gap:6px; align-items:center; padding:3px 8px; background:rgba(255,107,53,0.08); border:1px solid rgba(255,107,53,0.14); border-radius:999px; color:var(--lime); font-weight:700; }
.lp-diagram-head .live i{ width:6px; height:6px; background:var(--lime); border-radius:50%; }
.lp-diagram-body{ display:grid; grid-template-columns: 1.2fr 0.8fr; gap:14px; padding:14px; background:#0a0a0a; }
.lp-diagram-stack{ display:grid; gap:8px; }
.lp-stack-node{ display:grid; gap:4px; padding:10px; background:#000; border:1px solid var(--line); border-radius:10px; }
.lp-stack-node span{ font-size:12px; font-weight:700; color:#fff; font-family:'JetBrains Mono',monospace; }
.lp-stack-node em{ font-style:normal; font-size:11px; color:var(--muted); font-family:'JetBrains Mono',monospace; }
.lp-stack-node.active{ border-color:var(--lime); box-shadow:0 0 0 4px rgba(255,107,53,0.06); }
.lp-stack-node.next{ border-style:dashed; }
.lp-stack-node .bar{ height:6px; background:#1a1a1a; border-radius:999px; margin-top:4px; }
.lp-stack-node .bar.lime{ background:var(--lime); }
.lp-stack-node .bar.lime.strong{ background:linear-gradient(90deg, var(--lime), #fff); }
.lp-stack-arrow{ font-size:11px; color:var(--muted2); font-family:'JetBrains Mono',monospace; text-align:center; }
.lp-stack-arrow.lime{ color:var(--lime); }
.lp-diagram-side{ display:grid; gap:8px; align-content:start; }
.lp-side-row{ display:grid; gap:6px; padding:8px; background:#000; border:1px solid var(--line); border-radius:8px; }
.lp-side-row span{ font-size:11px; color:#fff; font-weight:600; font-family:'JetBrains Mono',monospace; letter-spacing:0.04em; text-transform:uppercase; }
.lp-side-row i{ display:block; height:6px; background:var(--lime); border-radius:999px; }
.lp-side-row:nth-child(2) i{ width:64%; opacity:0.7; }
.lp-side-row:nth-child(3) i{ width:91%; opacity:0.5; }
.lp-diagram-note{ font-size:11px; color:var(--muted2); text-align:center; font-family:'JetBrains Mono',monospace; margin-top:4px; }
.lp-diagram-foot{ display:flex; gap:8px; flex-wrap:wrap; padding:10px 12px; background:#000; border-top:1px solid var(--line); font-size:11px; font-family:'JetBrains Mono',monospace; }
.lp-diagram-foot span{ padding:4px 8px; background:#0a0a0a; border:1px solid var(--line); border-radius:999px; color:var(--muted); }
.lp-diagram-foot .xp{ margin-left:auto; background:var(--lime); color:#000; border-color:var(--lime); font-weight:700; }
.lp-unlock-strip{ display:flex; gap:8px; flex-wrap:wrap; padding:8px 12px; background:#000; border-top:1px solid var(--line); font-size:11px; font-family:'JetBrains Mono',monospace; }
.lp-unlock-strip .unlock{ display:inline-flex; gap:6px; align-items:center; padding:4px 8px; background:#0a0a0a; border:1px solid var(--line); border-radius:999px; color:var(--muted); }
.lp-unlock-strip .unlock.lime{ background:rgba(255,107,53,0.08); border-color:rgba(255,107,53,0.18); color:var(--lime); font-weight:700; margin-left:auto; }
.lp-media-caption{ margin-top:8px; text-align:center; font-size:11px; color:var(--muted2); font-family:'JetBrains Mono',monospace; }
.lp-split-text{ display:grid; gap:12px; }
.lp-h2.left{ text-align:left; }
.lp-body{ margin:0; font-size:13px; line-height:1.6; color:var(--muted); }
.lp-steps{ display:grid; gap:8px; }
.lp-step{ display:flex; gap:12px; padding:12px; background:#0a0a0a; border:1px solid var(--line); border-radius:10px; }
.lp-step span{ width:28px; height:28px; display:grid; place-items:center; background:var(--lime); color:#000; border-radius:6px; font-size:11px; font-weight:800; flex-shrink:0; font-family:'JetBrains Mono',monospace; }
.lp-step b{ display:block; font-size:13px; font-weight:600; color:#fff; }
.lp-step p{ margin:4px 0 0 0; font-size:12px; line-height:1.5; color:var(--muted); font-family:'JetBrains Mono',monospace; }
.lp-inline-cta{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:6px; }
.lp-inline-cta .hint{ font-size:11px; color:var(--muted2); font-family:'JetBrains Mono',monospace; }
.lp-world-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-top:20px; }
.lp-world-card{ background:#0a0a0a; border:1px solid var(--line); border-radius:12px; padding:14px; }
.lp-world-icon{ width:28px; height:28px; display:grid; place-items:center; background:#000; border:1px solid var(--line); border-radius:8px; font-size:12px; color:var(--lime); }
.lp-world-card h4{ margin:10px 0 6px 0; font-size:13px; line-height:1.4; color:#fff; }
.lp-world-card p{ margin:0; font-size:12px; line-height:1.6; color:var(--muted); }
.lp-alive-grid{ display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-top:16px; }
.lp-alive-card{ background:#0a0a0a; border:1px solid var(--line); border-radius:12px; padding:14px; display:grid; gap:10px; position:relative; overflow:hidden; }
.lp-alive-card::before{ content:""; position:absolute; inset:0; background: radial-gradient(400px 200px at 20% 0%, rgba(255,107,53,0.04), transparent 70%); pointer-events:none; }
.lp-alive-icon{ position:relative; display:flex; align-items:center; gap:8px; }
.lp-alive-icon svg{ flex-shrink:0; }
.lp-alive-badge{ padding:3px 7px; background:#000; border:1px solid var(--line); border-radius:999px; font-size:10px; font-weight:700; color:var(--muted); font-family:'JetBrains Mono',monospace; letter-spacing:0.06em; }
.lp-alive-badge.live{ background:rgba(255,107,53,0.08); border-color:rgba(255,107,53,0.18); color:var(--lime); display:inline-flex; gap:4px; align-items:center; }
.lp-alive-badge.live i{ width:6px; height:6px; background:var(--lime); border-radius:50%; }
.lp-alive-card h4{ margin:0; font-size:13px; font-weight:700; color:#fff; position:relative; }
.lp-alive-card p{ margin:0; font-size:12px; line-height:1.5; color:var(--muted); position:relative; }
.lp-chat-preview{ display:grid; gap:6px; margin-top:2px; position:relative; }
.lp-chat-preview .bubble{ padding:7px 10px; border-radius:10px; font-size:11px; line-height:1.4; max-width:92%; font-family:'JetBrains Mono',monospace; }
.lp-chat-preview .bubble.ai{ background:#000; border:1px solid var(--line); color:#ededed; justify-self:start; border-bottom-left-radius:4px; }
.lp-chat-preview .bubble.user{ background:rgba(255,107,53,0.08); border:1px solid rgba(255,107,53,0.14); color:var(--lime); justify-self:end; border-bottom-right-radius:4px; }
.lp-chat-preview .bubble.other{ background:#000; border:1px solid var(--line); color:#fff; justify-self:start; border-bottom-left-radius:4px; }
.lp-chat-preview .bubble.other em{ color:var(--muted); font-style:normal; font-size:10px; margin-left:4px; }
.lp-chat-preview .bubble.me{ background:var(--lime); border:1px solid var(--lime); color:#000; justify-self:end; border-bottom-right-radius:4px; font-weight:600; }
.lp-chat-preview .bubble.typing{ display:inline-flex; gap:4px; align-items:center; padding:8px 10px; }
.lp-chat-preview .bubble.typing i{ width:4px; height:4px; background:var(--muted); border-radius:50%; animation: typingDot 1s ease-in-out infinite; }
.lp-chat-preview .bubble.typing i:nth-child(2){ animation-delay:0.15s; }
.lp-chat-preview .bubble.typing i:nth-child(3){ animation-delay:0.30s; }
@keyframes typingDot{ 0%,100%{ opacity:0.3; transform: translateY(0);} 50%{ opacity:1; transform: translateY(-2px);} }
.lp-ai-spark{ animation: sparkTwinkle 1.8s ease-in-out infinite; }
.lp-alive-tag{ padding:4px 8px; background:#000; border:1px solid var(--line); border-radius:999px; font-size:10px; color:var(--muted); font-family:'JetBrains Mono',monospace; letter-spacing:0.04em; width:fit-content; position:relative; }
.lp-feature-row{ display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-top:16px; }
.lp-feature{ padding:14px; background:#0a0a0a; border:1px solid var(--line); border-radius:12px; }
.lp-feature .mono{ font-size:10px; letter-spacing:0.12em; text-transform:uppercase; font-weight:700; color:var(--lime); font-family:'JetBrains Mono',monospace; }
.lp-feature b{ display:block; margin-top:6px; font-size:13px; color:#fff; }
.lp-feature p{ margin:6px 0 0 0; font-size:12px; line-height:1.5; color:var(--muted); }
.lp-ctrl-strip{ margin-top:16px; display:flex; gap:8px; flex-wrap:wrap; padding:10px; background:#0a0a0a; border:1px solid var(--line); border-radius:10px; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted); }
.lp-ctrl-strip b{ color:#fff; }
.lp-cta{ background:#000; border-top:1px solid var(--line); }
.lp-cta-inner{ max-width:760px; margin:0 auto; padding:40px 20px 20px; }
.lp-cta-card{ background:#0a0a0a; border:1px solid var(--line); border-radius:16px; padding:28px 20px 20px; text-align:center; position:relative; overflow:hidden; }
.lp-cta-card::before{ content:""; position:absolute; inset:0; background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size:32px 32px; opacity:0.5; mask: radial-gradient(ellipse at 50% 0%, black 55%, transparent 82%); pointer-events:none; }
.lp-cta-kicker{ position:relative; font-size:11px; letter-spacing:0.14em; font-weight:700; color:var(--lime); font-family:'JetBrains Mono',monospace; text-transform:uppercase; }
.lp-cta-title{ position:relative; margin:8px 0 0 0; font-size: clamp(26px, 4vw, 36px); line-height:0.96; letter-spacing:-0.04em; font-weight:800; color:#fff; }
.lp-cta-title span{ display:block; font-size:0.55em; letter-spacing:0.06em; font-weight:600; color:var(--muted); margin-top:6px; font-family:'JetBrains Mono',monospace; text-transform:uppercase; }
.lp-cta-card p{ position:relative; max-width:520px; margin:12px auto 0; font-size:13px; line-height:1.6; color:var(--muted); }
.lp-cta-meta{ position:relative; margin-top:14px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap; font-size:11px; color:var(--muted); font-family:'JetBrains Mono',monospace; }
.lp-cta-meta span{ padding:6px 10px; background:#000; border:1px solid var(--line); border-radius:999px; }
.lp-cta-sub{ position:relative; margin-top:10px; font-size:11px; color:var(--muted2); font-family:'JetBrains Mono',monospace; }
.lp-footer{ display:flex; gap:12px; flex-wrap:wrap; justify-content:space-between; align-items:center; padding:14px 20px; border-top:1px solid var(--line); background:#000; font-size:11px; color:var(--muted2); font-family:'JetBrains Mono',monospace; }
.lp-footer-links{ display:flex; gap:8px; align-items:center; }
.lp-footer-links button{ background:none; border:none; cursor:pointer; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; font-weight:600; color:var(--muted); font-family:'JetBrains Mono',monospace; }
.lp-footer-links button:hover{ color:var(--lime); }
.reveal{ opacity:0; transform: translateY(10px); transition: opacity 0.5s ease, transform 0.5s ease; }
.reveal.in-view{ opacity:1; transform: translateY(0); }
@media (max-width: 980px){
  .lp-hero{ padding:32px 16px 24px; }
  .lp-term-grid{ display:none; }
  .lp-float{ position:static; margin-top:10px; }
  .lp-nav-links{ display:none; }
  .lp-grid3{ grid-template-columns:1fr; }
  .lp-alive-grid{ grid-template-columns:1fr; }
  .lp-split{ grid-template-columns:1fr; }
  .lp-world-grid{ grid-template-columns:1fr; }
  .lp-feature-row{ grid-template-columns:1fr; }
  .lp-h2.left, .lp-kicker.left{ text-align:center; }
  .lp-split-text{ text-align:center; }
  .lp-steps{ text-align:left; }
  .lp-inline-cta{ justify-content:center; }
  .lp-hero-head{ text-align:center; }
  .lp-section{ padding:32px 16px; }
}
@media (max-width: 640px){
  .lp-nav-inner{ padding:0 12px; height:52px; }
  .lp-logo-pill{ display:none; }
  .lp-hero{ padding:24px 14px 20px; }
  .lp-hero-actions{ width:100%; }
  .lp-btn{ width:100%; justify-content:center; }
  .lp-section{ padding:28px 14px; }
  .lp-cta-inner{ padding:20px 14px 14px; }
  .lp-footer{ flex-direction:column; text-align:center; }
}
@media (prefers-reduced-motion: reduce){
  .lp-orb, .lp-float, .mp-dot{ animation:none !important; }
  .reveal{ opacity:1; transform:none; transition:none; }
}
`;
