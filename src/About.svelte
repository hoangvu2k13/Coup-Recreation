<script>
  import { onMount, createEventDispatcher } from "svelte";
  import ICONS from "./lib/icons.json";
  import Icon from "@iconify/svelte";

  const dispatch = createEventDispatcher();
  let visible = false;

  function close() {
    dispatch("close");
  }

  function onKeyDown(e) {
    if (e.key === "Escape") close();
  }

  onMount(() => {
    const t = setTimeout(() => (visible = true), 80);
    return () => clearTimeout(t);
  });

  const specs = [
    {
      icon: "simple-icons:svelte",
      title: "REACTIVE CORE",
      text: "Built for instant feedback loops - the UI responds like hardware. Animations feel physical, state changes feel inevitable.",
    },
    {
      icon: "simple-icons:firebase",
      title: "REALTIME SYNC",
      text: "Every bluff, block, coup, and challenge replicates fast. When the table turns, it turns for everyone - together.",
    },
    {
      icon: "mdi:palette-swatch",
      title: "OKLCH COLOR SYSTEM",
      text: "Perceptually uniform gradients. Cinematic glow. No ugly banding. The entire UI is tuned to read like a golden terminal in the abyss.",
    },
    {
      icon: "mdi:shield-lock-outline",
      title: "ANTI-CHAOS UX",
      text: "The interface prevents misclick disasters while still letting you make terrible decisions on purpose.",
    },
    {
      icon: "mdi:flash-outline",
      title: "PERFORMANCE FIRST",
      text: "Glows, blur, scanlines - optimized to avoid jank. The game should feel ruthless, not laggy.",
    },
    {
      icon: "mdi:account-group-outline",
      title: "SOCIAL WARFARE",
      text: "The real gameplay isn't cards - it's your timing, confidence, and nerve. The UI is just the battlefield lighting.",
    },
  ];
</script>

<section class="about-shell" class:visible aria-label="About page">
  <div class="fx fx-vignette" aria-hidden="true"></div>
  <div class="fx fx-scanlines" aria-hidden="true"></div>
  <div class="fx fx-grain" aria-hidden="true"></div>
  <div class="fx fx-bloom" aria-hidden="true"></div>

  <div class="about-body">
    <section class="hero">
      <div class="hero-bg" aria-hidden="true"></div>

      <h1 class="hero-h1">
        THE
        <br />
        MISSION
      </h1>

      <div class="hero-line" aria-hidden="true"></div>

      <p class="hero-text">
        Coup isn't a card game. It's a <span class="glow"
          >conversation weapon</span
        >. This project rebuilds the experience into a
        <span class="glow">digital, lossless battlefield</span> - no setup time,
        no table clutter, no excuses… just intent.
      </p>

      <div class="hero-notes">
        <div class="note">
          <div class="note-top">
            <span class="n-dot"></span>
            <span class="mono dim">Goal</span>
          </div>
          <div class="note-text">
            Turn decisions into pressure. Turn pressure into mistakes.
          </div>
        </div>

        <div class="note hot">
          <div class="note-top">
            <span class="n-dot"></span>
            <span class="mono dim">Rule</span>
          </div>
          <div class="note-text">If it feels safe, you're already losing.</div>
        </div>

        <div class="note ok">
          <div class="note-top">
            <span class="n-dot"></span>
            <span class="mono dim">Promise</span>
          </div>
          <div class="note-text">The UI will never lie. Players will.</div>
        </div>
      </div>
    </section>

    <section class="grid">
      {#each specs as s}
        <article class="spec">
          <div class="spec-ico" aria-hidden="true">
            <Icon icon={s.icon} />
          </div>

          <div class="spec-title">{s.title}</div>
          <div class="spec-text">{s.text}</div>

          <div class="spec-fx" aria-hidden="true"></div>
        </article>
      {/each}
    </section>

    <section class="credits">
      <div class="credits-top">
        <span class="mono dim">ARCHITECT</span>
      </div>

      <div class="signature">FOUNDER</div>

      <p class="flavor">“Trust no one. Not even the UI.”</p>

      <div class="credits-actions">
        <button class="btn ghost" type="button" on:click={close}>
          <span class="b-ico"><Icon icon="mdi:keyboard-return" /></span>
          <span class="b-txt">RETURN</span>
        </button>
      </div>
    </section>
  </div>
</section>

<style>
  .about-shell {
    position: relative;
    width: 100%;
    height: 100%;
    isolation: isolate;
    overflow: hidden;

    opacity: 0;
    transform: translateY(10px) scale(0.995);

    transition:
      opacity var(--t-xslow) var(--ease-smooth),
      transform var(--t-xslow) var(--ease-smooth);

    background: radial-gradient(
        circle at 15% 10%,
        oklch(85% 0.16 85 / 0.08),
        transparent 60%
      ),
      radial-gradient(
        circle at 90% 85%,
        oklch(70% 0.19 45 / 0.1),
        transparent 60%
      ),
      radial-gradient(
        circle at 50% 50%,
        var(--void-surf) 0%,
        var(--abyss-black) 75%
      );

    outline: none;
    color: var(--txt-pure);
  }

  .about-shell.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .fx {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .fx-vignette {
    z-index: 0;
    background: radial-gradient(
      circle at center,
      transparent 35%,
      oklch(5% 0 0 / 0.82) 120%
    );
    mix-blend-mode: multiply;
    opacity: 0.95;
  }

  .fx-scanlines {
    z-index: 1;
    opacity: 0.28;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      oklch(0% 0 0 / 0.18) 3px
    );
    mix-blend-mode: multiply;
  }

  .fx-grain {
    z-index: 2;
    opacity: 0.085;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.75'/%3E%3C/svg%3E");
    background-size: 260px 260px;
  }

  .fx-bloom {
    z-index: 3;
    opacity: 0.28;
    background: radial-gradient(
        900px 420px at 50% -10%,
        var(--gold-glow),
        transparent 70%
      ),
      radial-gradient(
        900px 520px at 50% 120%,
        var(--flame-glow),
        transparent 70%
      );
    mix-blend-mode: screen;
    animation: bloomBreathe 5.4s var(--ease-smooth) infinite;
  }

  @keyframes bloomBreathe {
    0% {
      opacity: 0.26;
      filter: saturate(1.05);
    }
    50% {
      opacity: 0.36;
      filter: saturate(1.12);
    }
    100% {
      opacity: 0.26;
      filter: saturate(1.05);
    }
  }

  @keyframes hudScan {
    0% {
      transform: translateY(0);
      opacity: 0;
    }
    15% {
      opacity: 0.85;
    }
    55% {
      opacity: 0.55;
    }
    100% {
      transform: translateY(260px);
      opacity: 0;
    }
  }

  .mono {
    font-family: var(--font-mono);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .mono.dim {
    color: var(--txt-dim);
    opacity: 0.85;
  }

  @keyframes dotPulse {
    0%,
    100% {
      transform: scale(0.9);
      opacity: 0.75;
    }
    50% {
      transform: scale(1.25);
      opacity: 1;
    }
  }

  .about-body {
    position: relative;
    z-index: 10;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 clamp(12px, 2.2vw, 22px) clamp(60px, 6vw, 90px);
  }

  .hero {
    max-width: 1100px;
    margin: 18px auto;
    padding: clamp(18px, 3vw, 34px);

    border-radius: 34px;
    border: 1px solid oklch(85% 0.16 85 / 0.22);

    background: radial-gradient(
        900px 260px at 50% 0%,
        oklch(70% 0.19 45 / 0.14),
        transparent 72%
      ),
      radial-gradient(
        900px 420px at 50% 120%,
        oklch(55% 0.24 28 / 0.12),
        transparent 70%
      ),
      linear-gradient(
        160deg,
        oklch(16% 0.04 25 / 0.86),
        oklch(8% 0.02 20 / 0.92)
      );

    box-shadow: var(--shadow-stack-lg);
    position: relative;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.65;
    background: radial-gradient(
        1200px 240px at 50% 0%,
        oklch(85% 0.16 85 / 0.06),
        transparent 70%
      ),
      linear-gradient(180deg, oklch(100% 0 0 / 0.03), transparent);
  }

  .hero-h1 {
    position: relative;
    z-index: 2;

    margin: 0;
    font-family: var(--font-mono);
    font-weight: var(--fw-black);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: clamp(3.5rem, 7vw, 7.2rem);

    color: transparent;
    background: linear-gradient(
      to bottom,
      oklch(100% 0 0) 0%,
      var(--gold-main) 45%,
      var(--flame-main) 120%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;

    filter: drop-shadow(0 0 28px var(--gold-glow));
    line-height: 0.86;
  }

  .hero-line {
    position: relative;
    z-index: 2;
    margin: 18px 0;
    height: 6px;
    width: 120px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--flame-main), var(--gold-main));
    box-shadow: 0 0 25px var(--flame-glow);
    animation: lineGrow 0.9s var(--ease-elastic) forwards;
    transform-origin: left center;
    transform: scaleX(0.2);
    opacity: 0;
  }

  @keyframes lineGrow {
    to {
      transform: scaleX(1);
      opacity: 1;
    }
  }

  .hero-text {
    position: relative;
    z-index: 2;
    max-width: 720px;

    font-family: var(--font-b);
    color: var(--txt-dim);
    line-height: 1.75;
    font-size: 1.15rem;
    margin: 0;
  }

  .glow {
    color: var(--gold-main);
    font-weight: var(--fw-black);
    text-shadow: 0 0 22px var(--gold-glow);
  }

  .hero-notes {
    position: relative;
    z-index: 2;
    margin-top: 18px;

    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .note {
    padding: 14px 14px;
    border-radius: 18px;
    border: 1px solid oklch(100% 0 0 / 0.12);
    background: oklch(0% 0 0 / 0.18);
    box-shadow: var(--shadow-stack-sm);
  }

  .note-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }

  .n-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--gold-main);
    box-shadow: 0 0 14px var(--gold-glow);
  }

  .note.hot .n-dot {
    background: var(--blood-vivid);
    box-shadow: 0 0 14px var(--blood-glow);
  }

  .note.ok .n-dot {
    background: var(--jade-main);
    box-shadow: 0 0 14px var(--jade-glow);
  }

  .note-text {
    color: oklch(95% 0.02 85 / 0.7);
    line-height: 1.6;
  }

  .grid {
    max-width: 1100px;
    margin: 18px auto;

    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .spec {
    position: relative;
    overflow: hidden;

    padding: 16px 16px;
    border-radius: 20px;

    border: 1px solid oklch(100% 0 0 / 0.12);
    background: oklch(0% 0 0 / 0.18);
    box-shadow: var(--shadow-stack-md);

    transition:
      transform var(--t-med) var(--ease-elastic),
      box-shadow var(--t-med) var(--ease-smooth),
      border-color var(--t-med) var(--ease-smooth),
      filter var(--t-med) var(--ease-smooth);
  }

  .spec:hover {
    transform: translateY(-6px);
    border-color: var(--gold-main);
    box-shadow: var(--shadow-stack-lg), var(--glow-soft);
    filter: brightness(1.03) saturate(1.05);
  }

  .spec-ico {
    font-size: 2.2rem;
    color: var(--gold-main);
    filter: drop-shadow(0 0 16px var(--gold-glow));
    margin-bottom: 10px;
  }

  .spec-title {
    font-family: var(--font-h);
    font-weight: var(--fw-black);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: oklch(100% 0 0);
    margin-bottom: 8px;
  }

  .spec-text {
    color: var(--txt-dim);
    line-height: 1.65;
  }

  .spec-fx {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
      circle at 25% 20%,
      var(--gold-glow),
      transparent 60%
    );
    transition: opacity var(--t-med) var(--ease-smooth);
  }

  .spec:hover .spec-fx {
    opacity: 0.65;
  }

  .credits {
    max-width: 1100px;
    margin: 18px auto;
    padding: 22px 20px;

    border-radius: 34px;
    border: 1px solid oklch(100% 0 0 / 0.12);

    background: linear-gradient(
      160deg,
      oklch(12% 0.03 260 / 0.92),
      oklch(6% 0.02 20 / 0.95)
    );
    box-shadow: var(--shadow-stack-lg);
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .credits-top {
    margin-bottom: 10px;
  }

  .signature {
    font-family: var(--font-mono);
    font-weight: var(--fw-black);
    letter-spacing: 0.18em;
    text-transform: uppercase;

    font-size: clamp(2rem, 4vw, 4rem);

    color: transparent;
    background: linear-gradient(
      to bottom,
      oklch(100% 0 0) 0%,
      var(--gold-main) 45%,
      var(--flame-main) 120%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;

    filter: drop-shadow(0 0 25px var(--gold-glow));
  }

  .flavor {
    margin: 12px 0 0;
    font-family: var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--blood-vivid);
    text-shadow: 0 0 18px var(--blood-glow);
  }

  .credits-actions {
    margin-top: 14px;
    display: flex;
    justify-content: center;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;

    padding: 0.9rem 1rem;
    border-radius: 16px;

    border: 1px solid oklch(100% 0 0 / 0.12);
    background: oklch(0% 0 0 / 0.22);

    color: var(--gold-main);
    box-shadow: var(--shadow-stack-sm);

    font-family: var(--font-h);
    font-weight: var(--fw-black);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 0.85rem;

    transition:
      transform var(--t-med) var(--ease-elastic),
      box-shadow var(--t-med) var(--ease-smooth),
      border-color var(--t-med) var(--ease-smooth),
      filter var(--t-med) var(--ease-smooth);
  }

  .btn:hover {
    transform: translateY(-4px);
    border-color: var(--gold-main);
    box-shadow: var(--shadow-stack-md), var(--glow-soft);
    filter: brightness(1.03) saturate(1.05);
  }

  .btn:active {
    transform: translateY(1px) scale(0.98);
  }

  .b-ico {
    font-size: 1.25rem;
  }

  @media (max-width: 980px) {
    .hero-notes {
      grid-template-columns: 1fr;
    }

    .grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 1ms !important;
    }

    .fx-bloom {
      animation: none !important;
    }
  }
</style>
