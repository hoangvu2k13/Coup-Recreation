<script>
  import { push } from "svelte-spa-router";

  function goHome() {
    push("/");
  }

  function goBack() {
    // if there's no history, fallback home
    if (history.length > 1) history.back();
    else goHome();
  }
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === "Escape") goHome();
    if (e.key === "Enter") goBack();
  }}
/>

<main class="nf-wrap" aria-label="404 Not Found">
  <div class="nf-card" role="region" aria-label="Navigation failure terminal">
    <div class="nf-topline">
      <div class="nf-badge">SIGNAL LOST</div>
      <div class="nf-code">404</div>
    </div>

    <h1 class="nf-title">PAGE NOT FOUND</h1>
    <p class="nf-desc">
      The coordinates you requested do not exist, Agent.
      <span class="nf-dim">Return to base or reroute.</span>
    </p>

    <div class="nf-actions">
      <button class="btn-main" on:click={goHome} aria-label="Go home">
        RETURN TO BASE
      </button>

      <button class="nf-btn-secondary" on:click={goBack} aria-label="Go back">
        GO BACK
      </button>
    </div>

    <div class="nf-hint">
      <span class="nf-kbd">ESC</span> Home • <span class="nf-kbd">ENTER</span> Back
    </div>
  </div>
</main>

<style>
  .nf-wrap {
    height: 100vh;
    width: 100vw;
    display: grid;
    place-items: center;
    padding: 2rem;
    background: radial-gradient(
      circle at 50% 35%,
      oklch(20% 0.06 40 / 0.25),
      oklch(5% 0.02 20 / 0.95)
    );
  }

  .nf-card {
    width: min(820px, 92vw);
    padding: 3rem;
    border-radius: 28px;
    border: 1px solid oklch(85% 0.16 85 / 0.18);
    background: linear-gradient(
      160deg,
      oklch(14% 0.03 20 / 0.88),
      oklch(10% 0.02 260 / 0.92)
    );
    box-shadow: 0 30px 90px oklch(0% 0 0 / 0.75);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    position: relative;
    overflow: hidden;
    animation: nfPop 0.35s ease-out;
  }

  .nf-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      oklch(0% 0 0 / 0.12) 3px
    );
    opacity: 0.35;
    pointer-events: none;
  }

  .nf-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 2rem;
    position: relative;
    z-index: 1;
  }

  .nf-badge {
    font-family: var(--font-h);
    font-weight: 900;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    padding: 0.65rem 1rem;
    border-radius: 999px;
    background: oklch(85% 0.16 85 / 0.08);
    border: 1px solid oklch(85% 0.16 85 / 0.22);
    color: var(--gold-main);
    box-shadow: 0 0 25px var(--gold-glow);
  }

  .nf-code {
    font-family: var(--font-mono);
    font-weight: 900;
    font-size: 2.6rem;
    color: var(--blood-vivid);
    text-shadow: 0 0 30px var(--blood-glow);
  }

  .nf-title {
    font-family: var(--font-h);
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 900;
    letter-spacing: 0.15em;
    margin-bottom: 1rem;
    text-transform: uppercase;
    color: var(--txt-pure);
    position: relative;
    z-index: 1;
  }

  .nf-desc {
    font-size: 1.1rem;
    color: var(--txt-dim);
    line-height: 1.7;
    margin-bottom: 2.2rem;
    position: relative;
    z-index: 1;
  }

  .nf-dim {
    opacity: 0.85;
    display: inline-block;
    margin-left: 0.4rem;
  }

  .nf-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  .nf-btn-secondary {
    width: 100%;
    padding: 1.25rem;
    border-radius: var(--radius-lg);
    font-family: var(--font-h);
    font-weight: 900;
    letter-spacing: 0.15em;
    font-size: 1.05rem;
    text-transform: uppercase;
    background: oklch(0% 0 0 / 0.25);
    border: 1px solid oklch(85% 0.16 85 / 0.25);
    color: var(--txt-pure);
    transition:
      transform 0.25s var(--ease-elastic),
      box-shadow 0.25s var(--ease-smooth),
      border-color 0.25s var(--ease-smooth);
  }

  .nf-btn-secondary:hover {
    transform: translateY(-2px);
    border-color: var(--gold-main);
    box-shadow: 0 0 35px var(--gold-glow);
  }

  .nf-hint {
    margin-top: 1.75rem;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    letter-spacing: 0.08em;
    color: oklch(85% 0.06 70 / 0.55);
    display: flex;
    justify-content: center;
    gap: 0.6rem;
    position: relative;
    z-index: 1;
  }

  .nf-kbd {
    padding: 0.25rem 0.55rem;
    border-radius: 8px;
    border: 1px solid oklch(85% 0.16 85 / 0.18);
    background: oklch(0% 0 0 / 0.3);
    color: var(--gold-main);
    box-shadow: 0 0 15px var(--gold-glow);
  }

  @keyframes nfPop {
    from {
      transform: translateY(12px) scale(0.98);
      opacity: 0;
      filter: blur(6px);
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
      filter: blur(0);
    }
  }

  @media (max-width: 640px) {
    .nf-actions {
      grid-template-columns: 1fr;
    }
  }
</style>
