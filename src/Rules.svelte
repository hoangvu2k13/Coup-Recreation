<script>
  import { onMount, createEventDispatcher } from "svelte";
  import ICONS from "./lib/icons.json";
  import Icon from "@iconify/svelte";

  const dispatch = createEventDispatcher();

  let visible = false;
  let booted = false;
  let activeId = "intro";

  const nav = [
    {
      id: "intro",
      label: "Transmission",
      icon: ICONS.Book ?? "mdi:book-open-variant",
    },
    {
      id: "components",
      label: "Components",
      icon: ICONS.Cards ?? "mdi:cards-playing-outline",
    },
    { id: "setup", label: "Setup", icon: ICONS.Tools ?? "mdi:tools" },
    { id: "objective", label: "Objective", icon: ICONS.Target ?? "mdi:target" },
    {
      id: "influence",
      label: "Influence",
      icon: ICONS.Eye ?? "mdi:eye-outline",
    },
    {
      id: "gameplay",
      label: "Gameplay",
      icon: ICONS.Clock ?? "mdi:clock-outline",
    },
    {
      id: "actions",
      label: "Actions",
      icon: ICONS.Bolt ?? "mdi:flash-outline",
    },
    {
      id: "counteractions",
      label: "Counter",
      icon: ICONS.Shield ?? "mdi:shield-outline",
    },
    {
      id: "challenges",
      label: "Challenges",
      icon: ICONS.Skull ?? "mdi:skull-outline",
    },
  ];

  function jumpTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function close() {
    dispatch("close");
  }

  function onKeyDown(e) {
    if (e.key === "Escape") close();
  }

  let spyObserver;
  const spyIds = nav.map((n) => n.id);

  onMount(() => {
    const t1 = setTimeout(() => (booted = true), 40);
    const t2 = setTimeout(() => (visible = true), 90);

    //Setup scrollspy after paint
    const t3 = setTimeout(() => {
      const root = document.querySelector(".rules-shell");
      if (!root) return;

      const els = spyIds
        .map((id) => document.getElementById(id))
        .filter(Boolean);

      spyObserver = new IntersectionObserver(
        (entries) => {
          // pick the most visible
          const best = entries
            .filter((x) => x.isIntersecting)
            .sort(
              (a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0),
            )[0];
          if (!best) return;
          activeId = best.target.id;
        },
        {
          root,
          rootMargin: "-30% 0px -60% 0px",
          threshold: [0.05, 0.1, 0.2, 0.35, 0.5, 0.7],
        },
      );

      els.forEach((el) => spyObserver.observe(el));
    }, 220);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (spyObserver) spyObserver.disconnect();
    };
  });
</script>

<section
  class="rules-shell"
  class:booted
  class:visible
  aria-label="Coup Rules Codex"
>
  <div class="fx fx-vignette" aria-hidden="true"></div>
  <div class="fx fx-scanlines" aria-hidden="true"></div>
  <div class="fx fx-grain" aria-hidden="true"></div>
  <div class="fx fx-embers" aria-hidden="true"></div>
  <div class="fx fx-bloom" aria-hidden="true"></div>

  <!-- <header class="hud">
    <div class="hud-bg" aria-hidden="true"></div>
    <div class="hud-glow" aria-hidden="true"></div>
    <div class="hud-scan" aria-hidden="true"></div>

    <div class="hud-row">
      <div class="hud-title">
        <div class="hud-kicker">
          <span class="k-dot"></span>
          <span class="k-text">COUP ARCHIVE</span>
          <span class="k-dot"></span>
        </div>

        <h1 class="hud-h1">
          PROTOCOLS
          <span class="hud-h1-shadow" aria-hidden="true">PROTOCOLS</span>
        </h1>

        <p class="hud-sub">
          RULES OF ENGAGEMENT
          <span class="hud-sub-ghost" aria-hidden="true"
            >RULES OF ENGAGEMENT</span
          >
        </p>
      </div>

      <div class="hud-actions">
        <button
          class="hud-btn ghost"
          type="button"
          on:click={() => jumpTo("intro")}
        >
          <span class="btn-ico"
            ><Icon icon={ICONS.Eye ?? "mdi:eye-outline"} /></span
          >
          <span class="btn-txt">SYNC</span>
        </button>

        <button
          class="hud-btn danger"
          type="button"
          on:click={close}
          aria-label="Close rules"
        >
          <span class="btn-ico"><Icon icon={ICONS.Close} /></span>
          <span class="btn-txt">CLOSE</span>
        </button>
      </div>
    </div>

    <div class="hud-meta">
      <div class="chip ok">
        <span class="chip-dot"></span>
        <span class="chip-label">Status: Operational</span>
      </div>
      <div class="chip glow">
        <span class="chip-dot"></span>
        <span class="chip-label">Codex: Founder's Cut</span>
      </div>
      <div class="chip warn">
        <span class="chip-dot"></span>
        <span class="chip-label">Threat Model: Everyone</span>
      </div>
      <div class="chip hot">
        <span class="chip-dot"></span>
        <span class="chip-label">Bluff Probability: 100%</span>
      </div>
    </div>
  <nav class="toc" aria-label="Rules navigation">
      <div class="toc-rail" aria-hidden="true"></div>

      {#each nav as item}
        <button
          class="toc-link"
          class:is-active={activeId === item.id}
          type="button"
          on:click={() => jumpTo(item.id)}
        >
          <span class="toc-ico" aria-hidden="true">
            <Icon icon={item.icon} />
          </span>

          <span class="toc-text">{item.label}</span>
          <span class="toc-pulse" aria-hidden="true"></span>
          <span class="toc-sheen" aria-hidden="true"></span>
        </button>
      {/each}
    </nav>

    <div class="hud-divider" aria-hidden="true"></div>

    <div class="hud-foot">
      <div class="hud-foot-left">
        <span class="mono">SYS//</span>
        <span class="mono dim">COURT.CONSOLE</span>
        <span class="mono dim">::</span>
        <span class="mono gold">PROTOCOLS</span>
      </div>

      <div class="hud-foot-right">
        <span class="pulse-dot" aria-hidden="true"></span>
        <span class="mono dim">Scroll to decode</span>
      </div>
    </div>
  </header> -->
  <!-- <article class="panel hero" id="intro">
      <div class="panel-bg" aria-hidden="true"></div>
      <div class="panel-sheen" aria-hidden="true"></div>

      <header class="panel-head">
        <div class="panel-kicker">
          <span class="rail"></span>
          <span class="mono dim">Transmission</span>
          <span class="rail"></span>
        </div>

        <h2 class="panel-title">In the Not Too Distant Future…</h2>
        <p class="panel-sub">
          A world of power, lies, influence… and just enough coins to ruin a
          friendship.
        </p>
      </header>

      <div class="prose">
        <p>
          In the not too distant future, the government is run for profit by a
          <span class="glow">royal class</span> of multinational CEOs.
        </p>

        <p>
          Their greed and absolute control of the economy has reduced all but a
          privileged few to lives of poverty and desperation.
        </p>

        <p>
          Out of the oppressed masses rose <span class="glow"
            >The Resistance</span
          >, an underground organization focused on overthrowing these powerful
          rulers. Their valiant efforts created discord, intrigue, and weakness
          in the political courts.
        </p>

        <p>
          But for <span class="glow">you</span> - a powerful official - this is your
          opportunity to manipulate, bribe, and bluff your way into absolute power.
        </p>

        <p>
          To win, you must destroy your rivals' influence and exile them. In
          these turbulent times there is only room for <span class="glow"
            >one</span
          >.
        </p>

        <div class="quote">
          <div class="quote-mark" aria-hidden="true">“</div>
          <div class="quote-body">
            <p class="quote-text">Win with truth, win with lies - but win.</p>
            <p class="quote-sig">- Court Protocol 7: The Last Survivor</p>
          </div>
        </div>

        <div class="micro-grid">
          <div class="micro-card">
            <div class="micro-top">
              <span class="micro-dot"></span>
              <span class="micro-label">Design Intent</span>
            </div>
            <div class="micro-text">
              Zero fluff. Maximum paranoia. Every click is a confession.
            </div>
          </div>

          <div class="micro-card hot">
            <div class="micro-top">
              <span class="micro-dot"></span>
              <span class="micro-label">Operator Tip</span>
            </div>
            <div class="micro-text">
              A clean lie beats a messy truth. Don't hesitate.
            </div>
          </div>

          <div class="micro-card ok">
            <div class="micro-top">
              <span class="micro-dot"></span>
              <span class="micro-label">Win Condition</span>
            </div>
            <div class="micro-text">
              Everyone else must be gone. Influence is life.
            </div>
          </div>
        </div>
      </div>
    </article> -->

  <!-- <article class="panel" id="components">
      <div class="panel-bg" aria-hidden="true"></div>
      <div class="panel-sheen" aria-hidden="true"></div>

      <header class="panel-head compact">
        <h2 class="panel-title">Components</h2>
        <p class="panel-sub">
          Everything you need to start a political firestorm.
        </p>
      </header>

      <div class="lines">
        <div class="line gold">
          <span class="bullet"></span>
          <span class="k">3 Duke</span>
          <span class="d">cards</span>
        </div>

        <div class="line blood">
          <span class="bullet"></span>
          <span class="k">3 Assassin</span>
          <span class="d">cards</span>
        </div>

        <div class="line jade">
          <span class="bullet"></span>
          <span class="k">3 Captain</span>
          <span class="d">cards</span>
        </div>

        <div class="line cyan">
          <span class="bullet"></span>
          <span class="k">3 Ambassador</span>
          <span class="d">cards</span>
        </div>

        <div class="line violet">
          <span class="bullet"></span>
          <span class="k">3 Contessa</span>
          <span class="d">cards</span>
        </div>

        <div class="line neutral">
          <span class="bullet"></span>
          <span class="k">6 Summary</span>
          <span class="d">cards</span>
        </div>

        <div class="line gold">
          <span class="bullet"></span>
          <span class="k">50 Coins</span>
          <span class="d">treasury supply</span>
        </div>

        <div class="line soft neutral">
          <span class="bullet"></span>
          <span class="k">Instructions</span>
          <span class="d">and reference material</span>
        </div>
      </div>

      <div class="divider-fx" aria-hidden="true"></div>

      <div class="mini-prose">
        <p>
          Characters are influence. Coins are leverage. Paranoia is the
          atmosphere.
        </p>
      </div>
    </article> -->

  <article class="panel" id="setup">
    <div class="panel-bg" aria-hidden="true"></div>
    <div class="panel-sheen" aria-hidden="true"></div>

    <header class="panel-head compact">
      <h2 class="panel-title">Setup</h2>
      <p class="panel-sub">
        Build the court, seed the lies, and give everyone just enough money to
        get dangerous.
      </p>
    </header>

    <ol class="steps">
      <li class="step">
        <div class="step-num">01</div>
        <div class="step-body">
          <div class="step-title">Deal Influence</div>
          <div class="step-text">
            Shuffle all character cards. Deal <b>2 cards</b> to each player face
            down. You may always look at your own cards - keep them hidden.
          </div>
          <div class="step-text">
            Place remaining cards as the <b>Court deck</b>.
          </div>
        </div>
        <div class="step-glow" aria-hidden="true"></div>
      </li>

      <li class="step">
        <div class="step-num">02</div>
        <div class="step-body">
          <div class="step-title">Create the Treasury</div>
          <div class="step-text">
            Give each player <b>2 coins</b>. Money must remain visible. Always.
          </div>
          <div class="step-text">
            Place remaining coins as the <b>Treasury</b>.
          </div>
        </div>
        <div class="step-glow" aria-hidden="true"></div>
      </li>

      <li class="step">
        <div class="step-num">03</div>
        <div class="step-body">
          <div class="step-title">Distribute Summary Cards</div>
          <div class="step-text">
            Give one summary card to each player for reference. Everyone should
            learn the actions before chaos begins.
          </div>
        </div>
        <div class="step-glow" aria-hidden="true"></div>
      </li>

      <li class="step">
        <div class="step-num">04</div>
        <div class="step-body">
          <div class="step-title">Choose Starting Player</div>
          <div class="step-text">
            Whoever won last game starts. Otherwise… pick your favorite liar.
          </div>
        </div>
        <div class="step-glow" aria-hidden="true"></div>
      </li>
    </ol>
  </article>

  <article class="panel" id="objective">
    <div class="panel-bg" aria-hidden="true"></div>
    <div class="panel-sheen" aria-hidden="true"></div>

    <header class="panel-head compact">
      <h2 class="panel-title">Object of the Game</h2>
      <p class="panel-sub">Make everyone else disappear.</p>
    </header>

    <div class="prose">
      <p>
        Eliminate the influence of all other players and become the
        <span class="glow">last survivor</span>.
      </p>
      <p class="warn">There are no allies. Only delays.</p>
    </div>
  </article>

  <article class="panel" id="influence">
    <div class="panel-bg" aria-hidden="true"></div>
    <div class="panel-sheen" aria-hidden="true"></div>

    <header class="panel-head compact">
      <h2 class="panel-title">Influence</h2>
      <p class="panel-sub">
        Face-down cards are your power. Face-up cards are your obituary.
      </p>
    </header>

    <div class="prose">
      <p>
        Facedown cards represent who you influence at court. The characters
        printed on those cards determine which abilities you may claim.
      </p>

      <p>
        When you lose influence, reveal one facedown card. Revealed cards stay
        face up and provide no further influence.
      </p>

      <p>The player always chooses which of their cards to reveal.</p>

      <div class="alert danger">
        <div class="alert-ico" aria-hidden="true">
          <Icon icon={ICONS.Warning ?? "mdi:alert-outline"} />
        </div>
        <div class="alert-body">
          <div class="alert-title">Exile Condition</div>
          <div class="alert-text">
            When a player has lost all influence, they are exiled and removed
            from the game.
          </div>
        </div>
        <div class="alert-glow" aria-hidden="true"></div>
      </div>
    </div>
  </article>

  <article class="panel" id="gameplay">
    <div class="panel-bg" aria-hidden="true"></div>
    <div class="panel-sheen" aria-hidden="true"></div>

    <header class="panel-head compact">
      <h2 class="panel-title">Game Play</h2>
      <p class="panel-sub">One action. No passing. Maximum paranoia.</p>
    </header>

    <div class="prose">
      <p>
        The game is played clockwise in turns. On your turn, choose exactly <b
          >one action</b
        >. You may not pass.
      </p>

      <p>
        After an action is chosen, other players may challenge or counteract it.
        Challenges resolve first.
      </p>

      <p>
        If an action isn't challenged or counteracted, it succeeds
        automatically.
      </p>

      <div class="alert warn">
        <div class="alert-ico" aria-hidden="true">
          <Icon icon={ICONS.Coin ?? "mdi:coin"} />
        </div>
        <div class="alert-body">
          <div class="alert-title">Mandatory Coup</div>
          <div class="alert-text">
            If you start your turn with <b>10+ coins</b>, you must launch a
            <b>Coup</b>.
          </div>
        </div>
        <div class="alert-glow" aria-hidden="true"></div>
      </div>

      <p>
        When a player has both cards revealed, they are out immediately,
        returning all coins to the Treasury.
      </p>
    </div>
  </article>

  <article class="panel" id="actions">
    <div class="panel-bg" aria-hidden="true"></div>
    <div class="panel-sheen" aria-hidden="true"></div>

    <header class="panel-head compact">
      <h2 class="panel-title">Actions</h2>
      <p class="panel-sub">
        You may choose any action - as long as you can afford the consequences.
      </p>
    </header>

    <div class="prose">
      <h3 class="subhead">
        A. General Actions <span class="tag neutral">(Always Available)</span>
      </h3>

      <div class="action-grid">
        <div class="action-card gold">
          <div class="action-head">
            <span class="action-key">Income</span>
            <span class="cost gain">+1</span>
          </div>
          <div class="action-desc">Take 1 coin from the Treasury.</div>
          <div class="action-fx" aria-hidden="true"></div>
        </div>

        <div class="action-card gold">
          <div class="action-head">
            <span class="action-key">Foreign Aid</span>
            <span class="cost gain">+2</span>
          </div>
          <div class="action-desc">
            Take 2 coins from the Treasury.
            <span class="tag danger">Blocked by Duke</span>
          </div>
          <div class="action-fx" aria-hidden="true"></div>
        </div>

        <div class="action-card blood">
          <div class="action-head">
            <span class="action-key">Coup</span>
            <span class="cost loss">-7</span>
          </div>
          <div class="action-desc">
            Pay 7 coins. Choose a player; they lose 1 influence immediately.
            <span class="tag lethal">Always successful</span>
          </div>
          <div class="action-fx" aria-hidden="true"></div>
        </div>
      </div>

      <h3 class="subhead">
        B. Character Actions <span class="tag gold">(Requires Claim)</span>
      </h3>

      <p class="fine">
        Claim influence to use a character action. You may be telling the truth…
        or bluffing.
      </p>

      <div class="action-grid">
        <div class="action-card gold">
          <div class="action-head">
            <span class="action-key">Duke - Tax</span>
            <span class="cost gain">+3</span>
          </div>
          <div class="action-desc">Take 3 coins from the Treasury.</div>
          <div class="action-fx" aria-hidden="true"></div>
        </div>

        <div class="action-card blood">
          <div class="action-head">
            <span class="action-key">Assassin - Assassinate</span>
            <span class="cost loss">-3</span>
          </div>
          <div class="action-desc">
            Pay 3 coins, target a player; if successful they lose 1 influence.
            <span class="tag block">Blocked by Contessa</span>
          </div>
          <div class="action-fx" aria-hidden="true"></div>
        </div>

        <div class="action-card jade">
          <div class="action-head">
            <span class="action-key">Captain - Steal</span>
            <span class="cost gain">+2</span>
          </div>
          <div class="action-desc">
            Take 2 coins from another player (or 1 if they only have 1).
            <span class="tag block">Blocked by Captain / Ambassador</span>
          </div>
          <div class="action-fx" aria-hidden="true"></div>
        </div>

        <div class="action-card cyan">
          <div class="action-head">
            <span class="action-key">Ambassador - Exchange</span>
            <span class="cost neutral">↻</span>
          </div>
          <div class="action-desc">
            Draw 2 cards from Court, exchange with your facedown cards, return 2
            to Court.
          </div>
          <div class="action-fx" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  </article>

  <article class="panel" id="counteractions">
    <div class="panel-bg" aria-hidden="true"></div>
    <div class="panel-sheen" aria-hidden="true"></div>

    <header class="panel-head compact">
      <h2 class="panel-title">Counteractions</h2>
      <p class="panel-sub">Interference is allowed. Peace is not.</p>
    </header>

    <div class="prose">
      <p>
        Counteractions block actions. Like character actions, you may claim
        influence even if you don't actually have it.
      </p>

      <p>
        Counteractions may be challenged. If not challenged, they succeed
        automatically. If an action is counteracted, it fails - and any coins
        spent remain spent.
      </p>

      <div class="counter-grid">
        <div class="counter-card gold">
          <div class="counter-title">Duke blocks Foreign Aid</div>
          <div class="counter-text">
            The acting player gains no coins that turn.
          </div>
          <div class="counter-fx" aria-hidden="true"></div>
        </div>

        <div class="counter-card violet">
          <div class="counter-title">Contessa blocks Assassination</div>
          <div class="counter-text">
            The assassination fails. The Assassin's fee remains spent.
          </div>
          <div class="counter-fx" aria-hidden="true"></div>
        </div>

        <div class="counter-card cyan">
          <div class="counter-title">Ambassador / Captain blocks Stealing</div>
          <div class="counter-text">
            The player attempting to steal gains nothing.
          </div>
          <div class="counter-fx" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  </article>

  <article class="panel" id="challenges">
    <div class="panel-bg" aria-hidden="true"></div>
    <div class="panel-sheen" aria-hidden="true"></div>

    <header class="panel-head compact">
      <h2 class="panel-title">Challenges</h2>
      <p class="panel-sub">
        The most powerful action in Coup is saying: “Prove it.”
      </p>
    </header>

    <div class="prose">
      <p>
        Any action or counteraction using character influence may be challenged
        by any other player - even if they aren't directly involved.
      </p>

      <p>
        Players must have the opportunity to challenge when an action is
        declared. Once play continues, the challenge cannot be issued
        retroactively.
      </p>

      <p>
        If challenged, the player must reveal the relevant character. If they
        cannot (or refuse), they lose the challenge.
      </p>

      <div class="alert danger">
        <div class="alert-ico" aria-hidden="true">
          <Icon icon={ICONS.Skull ?? "mdi:skull-outline"} />
        </div>
        <div class="alert-body">
          <div class="alert-title">Challenge Penalty</div>
          <div class="alert-text">
            Whoever loses the challenge immediately loses <b>1 influence</b>.
          </div>
        </div>
        <div class="alert-glow" aria-hidden="true"></div>
      </div>

      <p>
        If the challenged player wins, they return the revealed character to the
        Court, reshuffle, then draw a replacement.
      </p>

      <p class="fine">
        If an action is successfully challenged, the action fails and any coins
        paid are returned.
      </p>
    </div>
  </article>

  <footer class="rules-footer">
    <div class="footer-card">
      <div class="footer-title">END OF ARCHIVE</div>
      <div class="footer-text">
        You now possess the protocols. You are not prepared for the people.
      </div>

      <div class="footer-actions">
        <button
          class="hud-btn ghost"
          type="button"
          on:click={() => jumpTo("intro")}
        >
          <span class="btn-ico"><Icon icon={ICONS.Up ?? "mdi:arrow-up"} /></span
          >
          <span class="btn-txt">TOP</span>
        </button>

        <button class="hud-btn danger" type="button" on:click={close}>
          <span class="btn-ico"><Icon icon={ICONS.Cross} /></span>
          <span class="btn-txt">EXIT</span>
        </button>
      </div>

      <div class="footer-fx" aria-hidden="true"></div>
    </div>
  </footer>
</section>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
  .rules-shell {
    position: relative;
    width: 100%;
    height: 100%;
    isolation: isolate;
    overflow-x: hidden;
    overflow-y: auto;
    color: var(--txt-pure);
    contain: layout paint;
    opacity: 0;
    transform: translateY(10px) scale(0.995);
    transition:
      opacity var(--t-xslow) var(--ease-smooth),
      transform var(--t-xslow) var(--ease-smooth);
    background: radial-gradient(
        circle at 18% 10%,
        oklch(85% 0.16 85 / 0.08),
        transparent 60%
      ),
      radial-gradient(
        circle at 90% 85%,
        oklch(70% 0.19 45 / 0.09),
        transparent 60%
      ),
      radial-gradient(
        circle at 50% 50%,
        var(--void-surf) 0%,
        var(--abyss-black) 70%
      );
    outline: none;
  }
  .rules-shell.visible {
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
    opacity: 0.06;
    background: repeating-linear-gradient(
      45deg,
      oklch(100% 0 0 / 0.02) 0px,
      oklch(100% 0 0 / 0.02) 1px,
      transparent 2px,
      transparent 6px
    );
  }
  .fx-embers {
    z-index: 3;
    opacity: 0.12;
    filter: blur(0.2px);
    background: radial-gradient(
        4px 4px at 15% 80%,
        oklch(70% 0.19 45 / 0.8),
        transparent 60%
      ),
      radial-gradient(
        3px 3px at 22% 60%,
        oklch(85% 0.16 85 / 0.75),
        transparent 62%
      ),
      radial-gradient(
        3px 3px at 72% 35%,
        oklch(70% 0.19 45 / 0.65),
        transparent 62%
      ),
      radial-gradient(
        2px 2px at 85% 68%,
        oklch(85% 0.16 85 / 0.65),
        transparent 62%
      ),
      radial-gradient(
        2px 2px at 55% 12%,
        oklch(55% 0.24 28 / 0.55),
        transparent 62%
      );
    animation: embersFloat 7s var(--ease-smooth) infinite;
  }
  .fx-bloom {
    z-index: 4;
    opacity: 0.32;
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
    animation: bloomBreathe 5.6s var(--ease-smooth) infinite;
  }
  @keyframes embersFloat {
    0% {
      transform: translateY(0px) translateX(0px);
      opacity: 0.1;
    }
    50% {
      transform: translateY(-8px) translateX(6px);
      opacity: 0.16;
    }
    100% {
      transform: translateY(0px) translateX(0px);
      opacity: 0.1;
    }
  }
  @keyframes bloomBreathe {
    0% {
      opacity: 0.28;
      filter: saturate(1.05);
    }
    50% {
      opacity: 0.38;
      filter: saturate(1.12);
    }
    100% {
      opacity: 0.28;
      filter: saturate(1.05);
    }
  }
  @keyframes hudRotate {
    to {
      transform: rotate(360deg);
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
  @keyframes dotPulse {
    0%,
    100% {
      transform: scale(0.9);
      opacity: 0.75;
      filter: brightness(0.95);
    }
    50% {
      transform: scale(1.25);
      opacity: 1;
      filter: brightness(1.05);
    }
  }
  .hud-btn {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 0.9rem 1rem;
    border-radius: 16px;
    font-family: var(--font-h);
    font-weight: var(--fw-black);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 0.85rem;
    border: 1px solid oklch(100% 0 0 / 0.12);
    transition:
      transform var(--t-med) var(--ease-elastic),
      box-shadow var(--t-med) var(--ease-smooth),
      border-color var(--t-med) var(--ease-smooth),
      background-color var(--t-med) var(--ease-smooth),
      color var(--t-med) var(--ease-smooth),
      filter var(--t-med) var(--ease-smooth);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transform: translateZ(0);
  }
  .hud-btn .btn-ico {
    font-size: 1.25rem;
    filter: drop-shadow(0 0 12px oklch(0% 0 0 / 0.6));
    display: inline-grid;
    place-items: center;
  }
  .hud-btn .btn-txt {
    white-space: nowrap;
  }
  .hud-btn.ghost {
    color: var(--gold-main);
    background: oklch(0% 0 0 / 0.22);
    box-shadow: var(--shadow-stack-sm);
  }
  .hud-btn.danger {
    color: oklch(0% 0 0);
    background: linear-gradient(135deg, var(--blood-vivid), var(--blood-main));
    border-color: oklch(100% 0 0 / 0.2);
    box-shadow:
      var(--shadow-stack-md),
      0 0 18px var(--blood-glow);
  }
  .hud-btn:hover {
    transform: translateY(-3px);
    filter: brightness(1.03) saturate(1.05);
  }
  .hud-btn.ghost:hover {
    border-color: var(--gold-main);
    box-shadow: var(--shadow-stack-md), var(--glow-soft);
  }
  .hud-btn.danger:hover {
    box-shadow:
      var(--shadow-stack-lg),
      0 0 34px var(--blood-glow);
  }
  .hud-btn:active {
    transform: translateY(1px) scale(0.98);
  }
  .panel {
    position: relative;
    max-width: 1100px;
    margin: 18px auto;
    border-radius: 34px;
    border: 1px solid oklch(100% 0 0 / 0.12);
    background: linear-gradient(
      160deg,
      oklch(16% 0.04 25 / 0.86),
      oklch(8% 0.02 20 / 0.92)
    );
    box-shadow: var(--shadow-stack-lg);
    overflow: hidden;
    padding: clamp(18px, 3vw, 34px);
    transform: translateY(18px);
    opacity: 0;
    animation: panelIn 0.7s var(--ease-snap) forwards;
  }
  @keyframes panelIn {
    to {
      transform: translateY(0px);
      opacity: 1;
    }
  }
  .panel-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.7;
    background: radial-gradient(
        1200px 240px at 50% 0%,
        oklch(85% 0.16 85 / 0.06),
        transparent 70%
      ),
      radial-gradient(
        900px 420px at 120% 60%,
        oklch(70% 0.19 45 / 0.06),
        transparent 70%
      ),
      linear-gradient(180deg, oklch(100% 0 0 / 0.03), transparent);
  }
  .panel-sheen {
    position: absolute;
    top: 0;
    left: -70%;
    width: 70%;
    height: 100%;
    pointer-events: none;
    opacity: 0.22;
    background: linear-gradient(
      90deg,
      transparent,
      oklch(100% 0 0 / 0.16),
      transparent
    );
    transform: skewX(-22deg);
    animation: panelSheen 6.4s var(--ease-smooth) infinite;
  }
  @keyframes panelSheen {
    0% {
      left: -80%;
      opacity: 0;
    }
    20% {
      opacity: 0.18;
    }
    50% {
      opacity: 0.22;
    }
    100% {
      left: 160%;
      opacity: 0;
    }
  }
  .panel-head {
    position: relative;
    z-index: 2;
    display: grid;
    gap: 10px;
    margin-bottom: 18px;
  }
  .panel-head.compact {
    margin-bottom: 14px;
  }
  .panel-title {
    margin: 0;
    font-family: var(--font-h);
    font-weight: var(--fw-black);
    font-size: clamp(1.35rem, 2.2vw, 2.15rem);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: transparent;
    background: linear-gradient(
      to bottom,
      oklch(100% 0 0) 0%,
      var(--gold-main) 50%,
      var(--flame-main) 120%
    );
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 22px var(--gold-glow));
  }
  .panel-sub {
    margin: 0;
    font-family: var(--font-b);
    color: var(--txt-dim);
    font-size: 1.05rem;
    line-height: 1.7;
    opacity: 0.92;
  }
  .prose {
    position: relative;
    z-index: 2;
    display: grid;
    gap: 12px;
    font-family: var(--font-b);
    font-size: 1.06rem;
    line-height: 1.85;
    color: var(--txt-pure);
  }
  .prose p {
    margin: 0;
    color: oklch(95% 0.02 85 / 0.7);
  }
  .glow {
    color: var(--gold-main);
    font-weight: var(--fw-black);
    text-shadow: 0 0 22px var(--gold-glow);
  }
  .warn {
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid oklch(70% 0.19 45 / 0.25);
    background: oklch(70% 0.19 45 / 0.08);
    color: oklch(98% 0.02 85 / 0.92);
    box-shadow:
      var(--shadow-stack-md),
      0 0 18px var(--flame-glow);
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 14px;
  }
  .step {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 14px;
    padding: 14px 14px;
    border-radius: 22px;
    border: 1px solid oklch(100% 0 0 / 0.12);
    background: oklch(0% 0 0 / 0.16);
    box-shadow: var(--shadow-stack-md);
    transition:
      transform var(--t-med) var(--ease-elastic),
      border-color var(--t-med) var(--ease-smooth),
      box-shadow var(--t-med) var(--ease-smooth),
      filter var(--t-med) var(--ease-smooth);
  }
  .step:hover {
    transform: translateY(-5px);
    border-color: var(--gold-main);
    box-shadow: var(--shadow-stack-lg), var(--glow-soft);
    filter: brightness(1.03) saturate(1.04);
  }
  .step-num {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-weight: var(--fw-black);
    letter-spacing: 0.14em;
    color: oklch(0% 0 0);
    background: linear-gradient(135deg, var(--gold-main), var(--flame-main));
    box-shadow:
      var(--shadow-stack-md),
      0 0 18px var(--gold-glow);
  }
  .step-body {
    display: grid;
    gap: 6px;
  }
  .step-title {
    font-family: var(--font-h);
    font-weight: var(--fw-black);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: oklch(100% 0 0);
  }
  .step-text {
    color: var(--txt-dim);
    line-height: 1.7;
  }
  .step-text b {
    color: var(--gold-main);
    text-shadow: 0 0 14px var(--gold-glow);
  }
  .step-glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
      circle at 20% 20%,
      var(--gold-glow),
      transparent 60%
    );
    transition: opacity var(--t-med) var(--ease-smooth);
  }
  .step:hover .step-glow {
    opacity: 0.85;
  }
  .subhead {
    margin: 8px 0 0;
    font-family: var(--font-h);
    font-weight: var(--fw-black);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--gold-main);
    text-shadow: 0 0 20px var(--gold-glow);
  }
  .fine {
    margin: 0;
    font-size: 0.98rem;
    color: var(--txt-dim);
    opacity: 0.92;
    line-height: 1.6;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border: 1px solid oklch(100% 0 0 / 0.12);
    background: oklch(0% 0 0 / 0.24);
    color: var(--txt-dim);
    vertical-align: middle;
    margin-left: 8px;
  }
  .tag.neutral {
    border-color: oklch(100% 0 0 / 0.12);
  }
  .tag.danger {
    border-color: oklch(55% 0.24 28 / 0.28);
    color: oklch(85% 0.08 55);
    text-shadow: 0 0 12px var(--blood-glow);
  }
  .tag.block {
    border-color: oklch(82% 0.1 125 / 0.28);
    color: var(--jade-main);
    text-shadow: 0 0 12px var(--jade-glow);
  }
  .tag.lethal {
    border-color: oklch(70% 0.19 45 / 0.28);
    color: var(--flame-main);
    text-shadow: 0 0 12px var(--flame-glow);
  }
  .action-grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .action-card {
    position: relative;
    overflow: hidden;
    padding: 14px 16px;
    border-radius: 20px;
    border: 1px solid oklch(100% 0 0 / 0.12);
    background: linear-gradient(180deg, oklch(100% 0 0 / 0.03), transparent),
      oklch(0% 0 0 / 0.2);
    box-shadow: var(--shadow-stack-md);
    transition:
      transform var(--t-med) var(--ease-elastic),
      border-color var(--t-med) var(--ease-smooth),
      box-shadow var(--t-med) var(--ease-smooth),
      filter var(--t-med) var(--ease-smooth);
  }
  .action-card:hover {
    transform: translateY(-5px);
    border-color: var(--gold-main);
    box-shadow: var(--shadow-stack-lg), var(--glow-soft);
    filter: brightness(1.03) saturate(1.04);
  }
  .action-card.blood:hover {
    border-color: var(--blood-vivid);
    box-shadow:
      var(--shadow-stack-lg),
      0 0 22px var(--blood-glow);
  }
  .action-card.jade:hover {
    border-color: var(--jade-main);
    box-shadow:
      var(--shadow-stack-lg),
      0 0 22px var(--jade-glow);
  }
  .action-card.cyan:hover {
    border-color: oklch(82% 0.13 210 / 0.55);
    box-shadow:
      var(--shadow-stack-lg),
      0 0 22px oklch(82% 0.13 210 / 0.22);
  }
  .action-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }
  .action-key {
    font-family: var(--font-h);
    font-weight: var(--fw-black);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: oklch(100% 0 0);
  }
  .action-card.gold .action-key {
    color: var(--gold-main);
    text-shadow: 0 0 14px var(--gold-glow);
  }
  .action-card.blood .action-key {
    color: var(--blood-vivid);
    text-shadow: 0 0 14px var(--blood-glow);
  }
  .action-card.jade .action-key {
    color: var(--jade-main);
    text-shadow: 0 0 14px var(--jade-glow);
  }
  .action-card.cyan .action-key {
    color: oklch(82% 0.13 210);
    text-shadow: 0 0 14px oklch(82% 0.13 210 / 0.22);
  }
  .cost {
    font-family: var(--font-mono);
    font-weight: var(--fw-black);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 0.86rem;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid oklch(100% 0 0 / 0.12);
    background: oklch(0% 0 0 / 0.22);
    color: var(--txt-dim);
  }
  .cost.gain {
    border-color: oklch(82% 0.1 125 / 0.28);
    color: var(--jade-main);
    text-shadow: 0 0 12px var(--jade-glow);
  }
  .cost.loss {
    border-color: oklch(55% 0.24 28 / 0.28);
    color: var(--blood-vivid);
    text-shadow: 0 0 12px var(--blood-glow);
  }
  .action-desc {
    color: var(--txt-dim);
    line-height: 1.7;
  }
  .action-fx {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
      circle at 30% 20%,
      var(--gold-glow),
      transparent 60%
    );
    transition: opacity var(--t-med) var(--ease-smooth);
  }
  .action-card:hover .action-fx {
    opacity: 0.75;
  }
  .action-card.blood:hover .action-fx {
    background: radial-gradient(
      circle at 30% 20%,
      var(--blood-glow),
      transparent 60%
    );
  }
  .action-card.jade:hover .action-fx {
    background: radial-gradient(
      circle at 30% 20%,
      var(--jade-glow),
      transparent 60%
    );
  }
  .counter-grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .counter-card {
    position: relative;
    overflow: hidden;
    padding: 14px 16px;
    border-radius: 20px;
    border: 1px solid oklch(100% 0 0 / 0.12);
    background: oklch(0% 0 0 / 0.18);
    box-shadow: var(--shadow-stack-md);
    transition:
      transform var(--t-med) var(--ease-elastic),
      border-color var(--t-med) var(--ease-smooth),
      box-shadow var(--t-med) var(--ease-smooth),
      filter var(--t-med) var(--ease-smooth);
  }
  .counter-card:hover {
    transform: translateY(-5px);
    border-color: var(--gold-main);
    box-shadow: var(--shadow-stack-lg), var(--glow-soft);
    filter: brightness(1.03) saturate(1.04);
  }
  .counter-card.violet:hover {
    border-color: oklch(78% 0.12 305);
    box-shadow:
      var(--shadow-stack-lg),
      0 0 22px oklch(78% 0.12 305 / 0.22);
  }
  .counter-card.cyan:hover {
    border-color: oklch(82% 0.13 210);
    box-shadow:
      var(--shadow-stack-lg),
      0 0 22px oklch(82% 0.13 210 / 0.22);
  }
  .counter-title {
    font-family: var(--font-h);
    font-weight: var(--fw-black);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: oklch(100% 0 0);
    margin-bottom: 8px;
  }
  .counter-text {
    color: var(--txt-dim);
    line-height: 1.65;
  }
  .counter-fx {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
      circle at 20% 20%,
      var(--gold-glow),
      transparent 60%
    );
    transition: opacity var(--t-med) var(--ease-smooth);
  }
  .counter-card:hover .counter-fx {
    opacity: 0.75;
  }
  .alert {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: 52px 1fr;
    gap: 12px;
    padding: 14px 14px;
    border-radius: 22px;
    border: 1px solid oklch(100% 0 0 / 0.12);
    background: oklch(0% 0 0 / 0.18);
    box-shadow: var(--shadow-stack-md);
  }
  .alert-ico {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: oklch(100% 0 0 / 0.03);
    border: 1px solid oklch(100% 0 0 / 0.1);
    color: var(--gold-main);
    filter: drop-shadow(0 0 14px var(--gold-glow));
  }
  .alert-body {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .alert-title {
    font-family: var(--font-h);
    font-weight: var(--fw-black);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: oklch(100% 0 0);
  }
  .alert-text {
    color: var(--txt-dim);
    line-height: 1.65;
  }
  .alert-glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.6;
    background: radial-gradient(
      circle at 20% 20%,
      var(--gold-glow),
      transparent 60%
    );
    mix-blend-mode: screen;
    filter: blur(0.2px);
  }
  .alert.warn {
    border-color: oklch(70% 0.19 45 / 0.25);
  }
  .alert.warn .alert-ico {
    color: var(--flame-main);
    filter: drop-shadow(0 0 14px var(--flame-glow));
  }
  .alert.warn .alert-glow {
    background: radial-gradient(
      circle at 20% 20%,
      var(--flame-glow),
      transparent 60%
    );
  }
  .alert.danger {
    border-color: oklch(55% 0.24 28 / 0.28);
  }
  .alert.danger .alert-ico {
    color: var(--blood-vivid);
    filter: drop-shadow(0 0 14px var(--blood-glow));
  }
  .alert.danger .alert-glow {
    background: radial-gradient(
      circle at 20% 20%,
      var(--blood-glow),
      transparent 60%
    );
  }
  @keyframes sealSpin {
    to {
      transform: rotate(360deg);
    }
  }
  .rules-footer {
    max-width: 1100px;
    margin: 18px auto 0;
    padding-bottom: 40px;
  }
  .footer-card {
    position: relative;
    overflow: hidden;
    border-radius: 34px;
    border: 1px solid oklch(100% 0 0 / 0.12);
    background: linear-gradient(
      160deg,
      oklch(12% 0.03 260 / 0.92),
      oklch(6% 0.02 20 / 0.95)
    );
    box-shadow: var(--shadow-stack-lg);
    padding: 20px 20px;
  }
  .footer-title {
    font-family: var(--font-mono);
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--gold-main);
    text-shadow: 0 0 18px var(--gold-glow);
    margin-bottom: 8px;
    padding-left: 0.28em;
  }
  .footer-text {
    color: var(--txt-dim);
    font-family: var(--font-b);
    line-height: 1.7;
    margin-bottom: 14px;
  }
  .footer-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }
  .footer-fx {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.22;
    background: radial-gradient(
        700px 260px at 10% 0%,
        var(--gold-glow),
        transparent 60%
      ),
      radial-gradient(
        700px 420px at 90% 120%,
        var(--flame-glow),
        transparent 70%
      );
    mix-blend-mode: screen;
    animation: bloomBreathe 5.2s var(--ease-smooth) infinite;
  }
  @media (max-width: 980px) {
    .action-grid {
      grid-template-columns: 1fr;
    }
    .counter-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 540px) {
    .hud-btn {
      width: 100%;
      justify-content: center;
    }
    .step {
      grid-template-columns: 56px 1fr;
    }
    .step-num {
      width: 56px;
      height: 56px;
      border-radius: 16px;
    }
    .panel {
      padding: 16px;
      border-radius: 26px;
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
    .panel-sheen,
    .fx-embers,
    .fx-bloom {
      animation: none !important;
    }
  }
  .rules-shell.visible {
    animation: crtFlicker 9s ease-in-out infinite;
  }
  @keyframes crtFlicker {
    0%,
    100% {
      filter: contrast(1) saturate(1);
    }
    48% {
      filter: contrast(1.01) saturate(1.03);
    }
    49% {
      filter: contrast(0.98) saturate(0.98);
    }
    50% {
      filter: contrast(1.02) saturate(1.05);
    }
    70% {
      filter: contrast(1) saturate(1);
    }
  }
  .panel:hover {
    transform: translateY(-2px);
  }
  .hud-btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-stack-md), var(--focus-ring);
  }
  .panel,
  .rules-footer {
    position: relative;
  }
</style>
