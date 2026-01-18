<script>
  // --- 1. CORE IMPORTS ---
  import { onMount, tick, onDestroy } from "svelte";
  import { initializeApp } from "firebase/app";
  import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
  } from "firebase/auth";
  import {
    getDatabase,
    ref,
    set,
    get,
    onValue,
    update,
    runTransaction,
    onDisconnect,
    push,
    serverTimestamp,
    remove,
  } from "firebase/database";
  import Icon from "@iconify/svelte";

  // --- 2. ASSET & STYLE IMPORTS ---
  import Changelog from "./Changelog.svelte";
  import Rules from "./Rules.svelte";
  import About from "./About.svelte";
  import ICONS from "./lib/icons.json";
  import { WARN, LOG } from "./lib/messages.js";

  class CoinPhysics {
    constructor(ctx, w, h) {
      this.ctx = ctx;
      this.w = w;
      this.h = h;
      this.coins = [];
      // Physics Constants
      this.gravity = 0.6;
      this.friction = 0.92; // Slight air resistance
      this.wallDamp = 0.7; // Bounciness factor
      this.interactionRadius = 200;
      this.restitution = 0.6; // Bounciness

      // The Box Boundaries (Updated via updateBoxRect)
      this.box = { x: w / 2 - 100, y: h / 2, w: 200, h: 100 };
    }

    updateBoxRect(rect, canvasEl) {
      if (!rect || !canvasEl) return;

      const cRect = canvasEl.getBoundingClientRect();

      // Convert viewport coords -> canvas-local coords
      const x = rect.left - cRect.left;
      const y = rect.top - cRect.top;

      this.box = {
        x,
        y,
        w: rect.width,
        h: rect.height,
        bottom: y + rect.height,
      };
    }

    addCoin() {
      const startX = this.box.x + Math.random() * this.box.w;
      const startY = this.box.y - 100;
      this.coins.push({
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 5,
        r: 14,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.2,
        id: Math.random().toString(36).substr(2, 9),
        settled: false,
      });
    }

    removeCoin() {
      if (this.coins.length > 0) {
        // Find a coin, preferably one at the top
        const idx = Math.floor(Math.random() * this.coins.length);
        const coin = this.coins[idx];

        // Apply upward force to simulate taking it out
        coin.vy = -15;
        coin.vx = (Math.random() - 0.5) * 10;
        coin.isRemoving = true; // Mark for deletion when off screen
      }
    }

    /**
     * Applies a radial impulse force to all coins from a specific point.
     * Used for mouse interactions to "scatter" the wealth.
     * @param {number} x - Origin X
     * @param {number} y - Origin Y
     */
    impulse(x, y) {
      this.coins.forEach((c) => {
        const dx = c.x - x;
        const dy = c.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.0001) return;

        if (dist < this.interactionRadius) {
          const force = (this.interactionRadius - dist) / 8;
          const inv = 1 / dist;
          c.vx += dx * inv * force;
          c.vy += dy * inv * force;
        }
      });
    }

    /**
     * Main physics tick. Updates positions and handles collision resolution.
     */
    update() {
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];

        // Apply Gravity
        c.vy += this.gravity;
        c.x += c.vx;
        c.y += c.vy;
        c.angle += c.vAngle;

        // Remove coins that have flown out
        if (c.isRemoving && c.y > this.h + 50) {
          this.coins.splice(i, 1);
          continue;
        }

        // --- COLLISION WITH BOX ---
        if (!c.isRemoving) {
          // Floor of Box
          if (c.y + c.r > this.box.bottom - 5) {
            c.y = this.box.bottom - 5 - c.r;
            c.vy *= -this.restitution;
            c.vx *= this.friction;
          }

          // Left Wall of Box
          if (c.x - c.r < this.box.x) {
            c.x = this.box.x + c.r;
            c.vx *= -this.restitution;
          }

          // Right Wall of Box
          if (c.x + c.r > this.box.x + this.box.w) {
            c.x = this.box.x + this.box.w - c.r;
            c.vx *= -this.restitution;
          }
        }

        // Simple Coin-to-Coin collision (very basic to prevent total stacking)
        // We skip complex rigid body solving for performance, but add jitter if too close
        if (Math.abs(c.vx) < 0.1 && Math.abs(c.vy) < 0.1) {
          c.settled = true;
        }
      }
    }

    /**
     * Renders the coins with gradients, shadows, and text details.
     */
    draw() {
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.coins.forEach((c) => {
        this.ctx.save();
        this.ctx.translate(c.x, c.y);
        this.ctx.rotate(c.angle);

        // Outer Coin Ring
        this.ctx.beginPath();
        this.ctx.arc(0, 0, c.r, 0, Math.PI * 2);
        const grad = this.ctx.createRadialGradient(-5, -5, 2, 0, 0, c.r);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, "#ffd700");
        grad.addColorStop(1, "#b8860b");
        this.ctx.fillStyle = grad;

        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = "rgba(255, 215, 0, 0.4)";
        this.ctx.fill();
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeStyle = "#daa520";
        this.ctx.stroke();

        // Inner Symbol ($)
        this.ctx.fillStyle = "#8a6e08";
        this.ctx.font = 'bold 16px "Orbitron", sans-serif';
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("$", 0, 1);

        // Specular Highlight
        this.ctx.beginPath();
        this.ctx.arc(-4, -4, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = "rgba(255,255,255,0.7)";
        this.ctx.fill();

        this.ctx.restore();
      });
    }
  }

  class Particle {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.reset();
    }

    reset() {
      this.x = Math.random() * this.w;
      this.y = this.h + Math.random() * 100; // Start slightly below screen
      this.vx = (Math.random() - 0.5) * 0.5; // Slight horizontal drift
      this.vy = -(Math.random() * 1 + 0.5); // Upward float
      this.life = Math.random() * 0.8 + 0.2;
      this.r = Math.random() * 1.5;

      const hue = Math.random() > 0.9 ? 340 : 200;
      this.color = `hsla(${hue}, 80%, 70%, ${Math.random() * 0.5})`;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= 0.005; // Fade out
      // Reset if off-screen or invisible
      if (this.life <= 0 || this.y < -10) this.reset();
    }

    draw(ctx) {
      ctx.globalAlpha = this.life;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- 5. SYSTEM CONFIGURATION & FIREBASE INIT ---
  const ENV_CONFIG = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DB_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const app = initializeApp(ENV_CONFIG);
  const auth = getAuth(app);
  const db = getDatabase(app);

  const CONF = {
    TIMINGS: {
      ACTION_TIMEOUT: 60000,
      AUTO_PASS: 15000,
    },
    PATHS: {
      ROOMS: "rooms",
      LOBBIES: "public_lobbies",
    },
    ASSETS: {
      CARDS: {
        Duke: "/duke.png",
        Assassin: "/assassin.png",
        Captain: "/captain.png",
        Inquisitor: "/inquisitor.png",
        Contessa: "/contessa.png",
        Ambassador: "/ambassador.png",
      },
      ICONS,
    },
  };

  const CARD_DETAILS = {
    Duke: { role: "DUKE", desc: "Tax: Take 3 coins.\nBlocks Foreign Aid." },
    Assassin: { role: "ASSASSIN", desc: "Pay 3 coins to kill a character." },
    Captain: {
      role: "CAPTAIN",
      desc: "Steal 2 coins from a player.\nBlocks Stealing.",
    },
    Ambassador: {
      role: "AMBASSADOR",
      desc: "Swap 2 cards with the deck.\nBlocks Stealing.",
    },
    Inquisitor: {
      role: "INQUISITOR",
      desc: "Exchange 1 card OR Examine opponent.\nBlocks Stealing.",
    },
    Contessa: { role: "CONTESSA", desc: "Blocks Assassination." },
  };

  // --- GAME MODES DEFINITION ---
  const MODES = {
    BASE: {
      name: "COUP: CLASSIC",
      maxPlayers: 6,
      roles: ["Duke", "Assassin", "Captain", "Ambassador", "Contessa"],
      hasTeams: false,
      hasInquisitor: false,
      deckSize: 3,
    },
    REFORMATION: {
      name: "COUP: REFORMATION",
      maxPlayers: 10,
      roles: ["Duke", "Assassin", "Captain", "Inquisitor", "Contessa"],
      hasTeams: true,
      hasInquisitor: true,
      deckSize: 5,
    },
  };

  // --- MOVE SETS (The Tactical Options) ---
  const MOVES_BASE = [
    {
      id: "Income",
      n: "Income",
      d: "Take 1 Coin.",
      c: 0,
      g: 1,
      agg: false,
      icon: "Income",
    },
    {
      id: "Foreign Aid",
      n: "Foreign Aid",
      d: "Take 2 Coins.",
      c: 0,
      g: 2,
      agg: false,
      block: ["Duke"],
      icon: "ForeignAid",
    },
    {
      id: "Tax",
      n: "Tax",
      d: "Take 3 Coins.",
      c: 0,
      g: 3,
      agg: false,
      claim: "Duke",
      icon: "Tax",
    },
    {
      id: "Steal",
      n: "Steal",
      d: "Steal 2 Coins.",
      c: 0,
      g: 2,
      agg: true,
      target: true,
      claim: "Captain",
      block: ["Captain", "Ambassador"],
      icon: "Steal",
    },
    {
      id: "Assassinate",
      n: "Assassinate",
      d: "Pay 3 to Kill.",
      c: 3,
      agg: true,
      target: true,
      claim: "Assassin",
      block: ["Contessa"],
      icon: "Assassinate",
    },
    {
      id: "Exchange",
      n: "Exchange",
      d: "Draw 2, Keep 2.",
      c: 0,
      agg: false,
      claim: "Ambassador",
      icon: "Exchange",
    },
    {
      id: "Coup",
      n: "Coup",
      d: "Unblockable Kill.",
      c: 7,
      agg: true,
      target: true,
      icon: "Coup",
    },
  ];

  const MOVES_REF = [
    {
      id: "Income",
      n: "Income",
      d: "Take 1 Coin.",
      c: 0,
      g: 1,
      agg: false,
      icon: "Income",
    },
    {
      id: "Foreign Aid",
      n: "Foreign Aid",
      d: "Take 2 Coins.",
      c: 0,
      g: 2,
      agg: false,
      block: ["Duke"],
      icon: "ForeignAid",
    },
    {
      id: "Tax",
      n: "Tax",
      d: "Take 3 Coins.",
      c: 0,
      g: 3,
      agg: false,
      claim: "Duke",
      icon: "Tax",
    },
    {
      id: "Steal",
      n: "Steal",
      d: "Steal 2 Coins.",
      c: 0,
      g: 2,
      agg: true,
      target: true,
      claim: "Captain",
      block: ["Captain", "Inquisitor"],
      icon: "Steal",
    },
    {
      id: "Assassinate",
      n: "Assassinate",
      d: "Pay 3 to Kill.",
      c: 3,
      agg: true,
      target: true,
      claim: "Assassin",
      block: ["Contessa"],
      icon: "Assassinate",
    },
    {
      id: "Embezzle",
      n: "Embezzle",
      d: "Take all Treasury.",
      c: 0,
      agg: false,
      claim: "Duke",
      icon: "Embezzle",
    },
    {
      id: "Inquisitor",
      n: "Inquisitor",
      d: "Exchange or Examine.",
      c: 0,
      agg: true,
      target: true,
      claim: "Inquisitor",
      icon: "Examine",
    },
    {
      id: "Convert",
      n: "Convert",
      d: "Change Allegiance.",
      c: 1,
      agg: false,
      icon: "ConvertSelf",
    },
    {
      id: "Coup",
      n: "Coup",
      d: "Unblockable Kill.",
      c: 7,
      agg: true,
      target: true,
      icon: "Coup",
    },
  ];

  // --- 6. APPLICATION STATE ---
  // Core Auth & Navigation
  let user = null;
  let view = "menu";
  let isLoading = true;
  let loadingText = "INITIALIZING SECURE CONNECTION...";

  // Inputs
  let inputName = "";
  let inputCode = "";
  let inputChat = "";
  let selectedMode = "BASE";

  // Game Data
  let roomId = "";
  let roomData = null;
  let isHost = false;
  let me = null;
  let turnPlayerId = null;
  let isMyTurn = false;
  let publicLobbies = [];
  let lobbyListenerOff = null;

  // UI/UX State
  let isTargeting = false;
  let selectedMove = null;
  let inspectorCard = null;
  let decryptedText = { role: "", desc: "" };
  let showNotes = false;
  let notes = "";
  let warningMsg = null;
  let warningTimer = null;
  let winnerName = "";
  let lastActionText = "AWAITING ORDERS...";

  // Advanced Action States
  let exchangeSelection = []; // Stores indices of cards selected during Ambassador/Exchange
  let inquisitorAction = null; // Stores target info before subtype selection

  // System References
  let audioCtx;
  let coinSys, coinCanvas, animFrame;
  let particles = [],
    particleCanvas,
    particleFrame;
  let canvasRef; // Bound to particle canvas for resizing
  let roomListenerOff = null;

  let treasuryBoxRef;
  let roomListener = null;

  let resizeHandler = null;
  let mouseDownHandler = null;
  let rectUpdateRaf = 0;
  let lastRectUpdate = 0;

  let decryptInterval = null;

  let chatMessages = [];
  let logEntries = [];

  let particlesRAF = 0;

  let deckHover = false;
  let deckScatter = [];

  $: if (roomData?.deck?.length != null) {
    const n = Math.min(6, roomData.deck.length);
    if (deckScatter.length !== n) {
      deckScatter = Array.from({ length: n }, () => ({
        r: (Math.random() * 18 - 9).toFixed(2), // rotation: -9deg to +9deg
        x: (Math.random() * 10 - 5).toFixed(2), // slight x offset
        y: (Math.random() * 6 - 3).toFixed(2), // slight y offset
      }));
    }
  }

  $: chatMessages = roomData?.chat
    ? Object.values(roomData.chat).sort(
        (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
      )
    : [];

  $: logEntries = roomData?.log
    ? Object.values(roomData.log).sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      )
    : [];

  // --- 7. KEYBOARD ACCESSIBILITY HELPER ---
  /**
   * Enables keyboard activation (Enter/Space) for clickable divs/spans.
   */
  const handleKey = (e, cb) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cb();
    }
  };
  notes = localStorage.getItem("coup_notes") || "";
  $: if (notes !== null) {
    localStorage.setItem("coup_notes", notes);
  }

  // --- 8. LIFECYCLE HOOKS ---
  onMount(() => {
    // A. Initialize Particle System (Background)
    if (canvasRef) {
      const ctx = canvasRef.getContext("2d");
      let w = window.innerWidth,
        h = window.innerHeight;
      canvasRef.width = w;
      canvasRef.height = h;
      resizeHandler = () => {
        w = window.innerWidth;
        h = window.innerHeight;

        // Particle canvas resize
        canvasRef.width = w;
        canvasRef.height = h;

        // Coin canvas resize (keep your behavior, but correct height)
        if (coinCanvas) {
          coinCanvas.width = w;
          // IMPORTANT: Your coin canvas is intended to be 300 high
          coinCanvas.height = 300;
        }

        scheduleTreasuryRectUpdate();
      };

      window.addEventListener("resize", resizeHandler, { passive: true });

      particles = [];
      for (let i = 0; i < 80; i++) particles.push(new Particle(w, h));

      const animate = () => {
        ctx.clearRect(0, 0, w, h);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.update();
          p.draw(ctx);
        }

        particlesRAF = requestAnimationFrame(animate);
      };

      particlesRAF = requestAnimationFrame(animate);
    }

    // B. Initialize Physics Engine (Coins)
    if (coinCanvas) {
      const dpr = window.devicePixelRatio || 1;

      coinCanvas.style.width = "100vw";
      coinCanvas.style.height = "100vh";

      coinCanvas.width = Math.floor(window.innerWidth * dpr);
      coinCanvas.height = Math.floor(window.innerHeight * dpr);

      const ctx = coinCanvas.getContext("2d");

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      coinSys = new CoinPhysics(ctx, window.innerWidth, window.innerHeight);

      const loop = () => {
        coinSys.update();
        coinSys.draw();
        animFrame = requestAnimationFrame(loop);
      };
      loop();

      mouseDownHandler = (e) => {
        if (!coinSys || view !== "game") return;
        if (!coinCanvas) return;

        const rect = coinCanvas.getBoundingClientRect();
        coinSys.impulse(e.clientX - rect.left, e.clientY - rect.top);
      };

      window.addEventListener("mousedown", mouseDownHandler, { passive: true });
    }

    // C. Initialize Audio Context
    // Uses standard AudioContext as requested (no WebKit prefix)
    try {
      audioCtx = new window.AudioContext();
    } catch (e) {
      console.warn(LOG.AUDIO_BLOCKED);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (treasuryBoxRef && coinSys) {
        const rect = treasuryBoxRef.getBoundingClientRect();
        coinSys.updateBoxRect(rect, coinCanvas);
      }
    });

    setTimeout(() => {
      if (treasuryBoxRef) resizeObserver.observe(treasuryBoxRef);
    }, 1000);

    // D. Initialize Authentication
    onAuthStateChanged(auth, (u) => {
      if (u) {
        user = u;
        const urlParams = new URLSearchParams(window.location.search);
        const rid = urlParams.get("room");
        const saved = localStorage.getItem("coup_session");
        if (rid) {
          connectToRoom(rid);
        } else if (saved) {
          connectToRoom(saved);
        } else {
          fetchLobbies();
          view = "menu"; // explicitly set
          isLoading = false; // only now safe to show menu
        }
        isLoading = false;
      } else {
        signInAnonymously(auth).catch((e) => {
          console.error(LOG.AUTH_FAILED, e);
          showWarning(WARN.AUTH_FAIL);
        });
      }
    });

    // E. Load Notes
    notes = localStorage.getItem("coup_notes") || "";

    return () => {
      if (roomListenerOff) roomListenerOff();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (mouseDownHandler)
        window.removeEventListener("mousedown", mouseDownHandler);
      if (particlesRAF) cancelAnimationFrame(particlesRAF);
      if (animFrame) cancelAnimationFrame(animFrame);
      if (decryptInterval) clearInterval(decryptInterval);
      if (rectUpdateRaf) cancelAnimationFrame(rectUpdateRaf);
    };
  });

  // --- 9. AUDIO SYSTEM (Synthesized SFX) ---
  /**
   * Generates sound effects procedurally using oscillators.
   * Eliminates the need for external asset loading.
   * @param {string} type - 'click', 'turn', or 'error'
   */
  function playSound(type) {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "click") {
      // High-pitch blip
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "turn") {
      // Harmonious chime
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 1);
      osc.start(now);
      osc.stop(now + 1);
    } else if (type === "error") {
      // Harsh buzz
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(110, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  }

  function scheduleTreasuryRectUpdate() {
    if (!treasuryBoxRef || !coinSys) return;

    // throttle to avoid layout spam
    const now = performance.now();
    if (now - lastRectUpdate < 120) return;
    lastRectUpdate = now;

    if (rectUpdateRaf) cancelAnimationFrame(rectUpdateRaf);
    rectUpdateRaf = requestAnimationFrame(() => {
      if (!treasuryBoxRef || !coinSys) return;
      coinSys.updateBoxRect(treasuryBoxRef.getBoundingClientRect(), coinCanvas);
    });
  }

  // --- 10. NOTIFICATION SYSTEM ---
  function showWarning(text) {
    warningMsg = text;
    playSound("error");
    if (warningTimer) clearTimeout(warningTimer);
    warningTimer = setTimeout(() => (warningMsg = null), 3000);
  }

  // --- 11. VISUAL EFFECTS ---
  /**
   * "Decryption" text effect for the inspector.
   * Randomizes characters before settling on the target text.
   */
  function runDecryptionEffect(cardType) {
    if (decryptInterval) clearInterval(decryptInterval);
    const target = CARD_DETAILS[cardType] || {
      role: cardType,
      desc: "Unknown",
    };
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";
    let iter = 0;
    const roleName = cardType.toUpperCase();

    decryptInterval = setInterval(() => {
      decryptedText.role = roleName
        .split("")
        .map((l, i) => {
          if (i < iter) return roleName[i];
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join("");
      decryptedText.desc = target.desc;

      if (iter >= roleName.length) clearInterval(decryptInterval);
      iter += 1 / 2; // Speed of decryption
    }, 30);
  }

  // --- 12. LOBBY & MATCHMAKING LOGIC ---
  function fetchLobbies() {
    if (lobbyListenerOff) lobbyListenerOff();
    lobbyListenerOff = onValue(ref(db, CONF.PATHS.LOBBIES), (snap) => {
      const d = snap.val();
      publicLobbies = d
        ? Object.entries(d)
            .map(([k, v]) => ({ id: k, ...v }))
            .filter((x) => x.status === "LOBBY")
        : [];
    });
  }

  async function createGame() {
    if (!inputName) return showWarning(WARN.NEED_NAME);
    playSound("click");
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();

    const initData = {
      status: "LOBBY",
      host: user.uid,
      mode: selectedMode,
      players: {
        [user.uid]: { name: inputName, ready: true, presence: true, coins: 0 },
      },
      playerOrder: [user.uid],
      log: {
        [Date.now()]: {
          text: "Protocol Initiated.",
          type: "sys",
          timestamp: serverTimestamp(),
        },
      },
      treasury: 0,
    };

    // Atomically create room and lobby entry
    await update(ref(db), {
      [`rooms/${code}`]: initData,
      [`public_lobbies/${code}`]: {
        hostName: inputName,
        playerCount: 1,
        mode: selectedMode,
        status: "LOBBY",
      },
    });
    connectToRoom(code);
  }

  async function joinGame(codeOverride) {
    if (!inputName) return showWarning(WARN.NEED_NAME);
    const code = codeOverride || inputCode.toUpperCase();

    const updates = {};
    const rRef = ref(db, `rooms/${code}`);
    const snap = await get(rRef);
    const d = snap.val();

    updates[`/public_lobbies/${code}/playerCount`] = d.playerOrder.length + 1;

    if (!snap.exists()) return showWarning(WARN.INVALID_COORDINATES);

    if (d.status !== "LOBBY") return showWarning(WARN.OPERATION_ACTIVE);
    if (d.playerOrder.length >= MODES[d.mode].maxPlayers)
      return showWarning(WARN.SQUAD_FULL);

    // Register player
    await update(ref(db, `rooms/${code}/players/${user.uid}`), {
      name: inputName,
      ready: true,
      presence: true,
    });
    // Add to order list
    await runTransaction(ref(db, `rooms/${code}/playerOrder`), (l) =>
      l ? [...l, user.uid] : [user.uid]
    );
    // Update public count
    await update(ref(db, `public_lobbies/${code}/playerCount`), updates);

    connectToRoom(code);
  }

  function connectToRoom(code) {
    isLoading = true;
    loadingText = "LINKING TO ROOM...";

    if (roomListenerOff) roomListenerOff();

    roomId = code;

    // Update URL without reload
    window.history.replaceState(null, "", `?room=${code}`);
    localStorage.setItem("coup_session", code);

    // Presence System
    const pRef = ref(db, `rooms/${code}/players/${user.uid}/presence`);
    onDisconnect(pRef).set(false);
    set(pRef, true);

    let didFirstSnapshot = false;

    // Main Room Listener (✅ only ONE listener)
    roomListenerOff = onValue(ref(db, `rooms/${code}`), (snap) => {
      const d = snap.val();

      // Room deleted / connection lost
      if (!d) {
        leaveRoomLocalState();
        showWarning(WARN.CONNECTION_LOST);
        return;
      }

      if (!didFirstSnapshot) {
        didFirstSnapshot = true;
        isLoading = false;
      }

      // ---- CORE STATE ----
      roomData = d;
      isHost = d.host === user.uid;
      me = d.players?.[user.uid] || null;

      // --- FIX: VOTE COUNTING & AUTO-RESOLUTION ---
      // This checks if everyone has voted "ALLOW"
      if (d.pendingAction && d.pendingAction.status === "PENDING") {
        const act = d.pendingAction;

        // Get all living opponents (excluding the person who did the move)
        const opponents = d.playerOrder.filter(
          (pid) => pid !== act.source && d.players?.[pid]?.alive
        );

        const votes = act.votes || {};
        const voterIds = Object.keys(votes);

        // Check if everyone has voted
        const allVoted = opponents.every((pid) => voterIds.includes(pid));

        // Check if everyone voted ALLOW
        const allAllowed = Object.values(votes).every((v) => v === "ALLOW");

        // If I am the source (Active Player), and everyone allowed, EXECUTE IT.
        if (user.uid === act.source && allVoted && allAllowed) {
          resolveAction(act, false);
        }
      }

      // ---- GAME OVER ----
      if (d.status === "GAME_OVER") {
        view = "game_over";
        winnerName = d.winner;
        return;
      }

      // ---- VIEW MODE ----
      view = d.status === "LOBBY" ? "lobby" : "game";

      // ---- GAME VIEW LOGIC ----
      if (view === "game" && me) {
        // ✅ Optimized: don't spam getBoundingClientRect every snapshot
        // (Still updates the box exactly when needed)
        scheduleTreasuryRectUpdate();

        // ---- Treasury Coins Visual Sync (kept exactly as your original) ----
        if (coinSys) {
          if (d.treasury > coinSys.coins.length) {
            // Add coins (Falling In)
            const needed = d.treasury - coinSys.coins.length;
            for (let i = 0; i < needed; i++) coinSys.addCoin();
          } else if (d.treasury < coinSys.coins.length) {
            // Remove coins (Flying Out)
            const diff = coinSys.coins.length - d.treasury;
            for (let i = 0; i < diff; i++) coinSys.removeCoin();
          }
        }

        // ---- Turn Logic ----
        const tId = d.playerOrder[d.turnIndex % d.playerOrder.length];

        // Turn Change Alert
        if (tId !== turnPlayerId && tId === user.uid) playSound("turn");

        turnPlayerId = tId;
        isMyTurn = turnPlayerId === user.uid && !d.pendingAction && me.alive;

        // ---- Update Last Action Text ----
        if (d.pendingAction) {
          lastActionText = `${d.players[d.pendingAction.source].name}: ${d.pendingAction.name}`;

          // Auto-Select Cards for Exchange if I am the source
          if (
            d.pendingAction.status === "EXCHANGING" &&
            d.pendingAction.source === user.uid &&
            exchangeSelection.length === 0
          ) {
            // Pre-select cards that are ALIVE and NOT NEW (keep original hand by default)
            exchangeSelection = me.hand
              .map((c, i) => (c.alive && !c.isNew ? i : -1))
              .filter((i) => i !== -1);
          }
        }
      }
    });
  }

  function leaveRoomLocalState() {
    if (roomListenerOff) roomListenerOff();
    roomId = "";
    roomData = null;
    me = null;
    view = "menu";
    localStorage.removeItem("coup_session");
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function startGame() {
    if (roomData.playerOrder.length < 2) return showWarning(WARN.NEED_2P);
    playSound("click");
    const mode = MODES[roomData.mode];

    // Generate Deck
    const deck = [];
    mode.roles.forEach((r) => {
      for (let i = 0; i < mode.deckSize; i++) deck.push(r);
    });

    // Fisher-Yates Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const updates = {};
    const order = [...roomData.playerOrder];

    // Shuffle Player Order
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    // Distribute Initial State
    order.forEach((uid, i) => {
      updates[`players/${uid}/hand`] = [
        { type: deck.pop(), alive: true },
        { type: deck.pop(), alive: true },
      ];
      updates[`players/${uid}/coins`] = 2;
      updates[`players/${uid}/alive`] = true;

      // Assign Factions for Reformation
      if (mode.hasTeams) {
        updates[`players/${uid}/faction`] =
          i % 2 === 0 ? "loyalist" : "reformist";
      }
    });

    updates.status = "PLAYING";
    updates.deck = deck;
    updates.playerOrder = order;
    updates.turnIndex = 0;
    updates.treasury = 50 - order.length * 2;

    // Commit Game Start
    await update(ref(db, `rooms/${roomId}`), updates);
    // Remove from public lobby list
    remove(ref(db, `public_lobbies/${roomId}`));
  }

  async function exitGame() {
    if (!roomId || !user) return;
    playSound("click");
    const roomRef = ref(db, `rooms/${roomId}`);
    try {
      await runTransaction(roomRef, (room) => {
        if (!room || !room.players) return null;

        // Remove player
        delete room.players[user.uid];
        if (room.playerOrder)
          room.playerOrder = room.playerOrder.filter((id) => id !== user.uid);

        const remainingCount = room.playerOrder ? room.playerOrder.length : 0;

        // Clean up if empty
        if (remainingCount === 0) {
          remove(ref(db, `public_lobbies/${roomId}`));
          return null;
        }
        // End game if only 1 remains during play
        else if (remainingCount === 1 && room.status === "PLAYING") {
          const winnerId = room.playerOrder[0];
          room.status = "GAME_OVER";
          room.winner = room.players[winnerId].name;
          remove(ref(db, `public_lobbies/${roomId}`));
        }
        // Update lobby count if in lobby
        else if (room.status === "LOBBY") {
          if (room.host === user.uid) room.host = room.playerOrder[0];
          update(ref(db, `public_lobbies/${roomId}`), {
            playerCount: remainingCount,
          });
        }
        return room;
      });
    } catch (e) {
      console.error(e);
    } finally {
      leaveRoomLocalState();
    }
  }

  // --- 13. MOVE PREPARATION & VALIDATION ---
  function prepAction(m) {
    if (!isMyTurn) return showWarning(WARN.WAIT_TURN);
    if (me.coins < m.c) return showWarning(WARN.INSUFFICIENT_FUNDS);

    // Coup enforcement logic
    if (m.c === 0 && me.coins >= 10 && m.id !== "Coup")
      return showWarning(WARN.MUST_COUP);

    playSound("click");

    if (m.target) {
      isTargeting = true;
      selectedMove = m;
    } else {
      commitAction(m, null);
    }
  }

  function handleTarget(uid) {
    if (!isTargeting) return;
    if (uid === user.uid) return showWarning(WARN.CANNOT_TARGET_SELF);
    if (!roomData.players[uid].alive)
      return showWarning(WARN.TARGET_ELIMINATED);

    // Team / Faction Logic (Reformation)
    if (
      MODES[roomData.mode].hasTeams &&
      selectedMove.id !== "Convert" &&
      selectedMove.id !== "Inquisitor"
    ) {
      if (roomData.players[uid].faction === me.faction) {
        const mates = roomData.playerOrder.filter(
          (pid) =>
            roomData.players[pid].alive &&
            roomData.players[pid].faction === me.faction
        );
        const all = roomData.playerOrder.filter(
          (pid) => roomData.players[pid].alive
        ).length;
        // Can only attack ally if NO enemies exist (Cornwallis rule/Variant)
        if (mates.length !== all) return showWarning(WARN.CANNOT_ATTACK_ALLY);
      }
    }

    if (selectedMove.id === "Inquisitor") {
      // Staging for Inquisitor subtypes
      inquisitorAction = { target: uid, move: selectedMove };
      isTargeting = false;
    } else {
      commitAction(selectedMove, uid);
      isTargeting = false;
    }
  }

  function commitInquisitor(type) {
    const t = inquisitorAction.target;
    inquisitorAction = null;
    const act = {
      type: "Inquisitor",
      subType: type,
      name: "Inquisitor",
      source: user.uid,
      target: t,
      status: "PENDING",
      deadline: Date.now() + CONF.TIMINGS.ACTION_TIMEOUT,
      claim: "Inquisitor",
      votes: {},
    };
    update(ref(db, `rooms/${roomId}`), { pendingAction: act });
  }

  async function commitAction(m, tId) {
    const updates = {};

    // Optimistic Coin Update (Pay Cost)
    if (m.c > 0) updates[`players/${user.uid}/coins`] = me.coins - m.c;
    // Treasury Management
    if (m.id === "Income") updates["treasury"] = roomData.treasury - 1;

    const act = {
      type: m.id,
      name: m.n,
      source: user.uid,
      target: tId,
      status: "PENDING",
      deadline: Date.now() + CONF.TIMINGS.ACTION_TIMEOUT,
      claim: m.claim || null,
      votes: {},
    };
    updates.pendingAction = act;

    // Check for unblockable moves
    if (["Income", "Convert"].includes(m.id)) {
      await update(ref(db, `rooms/${roomId}`), updates);
      resolveAction(act, false); // Auto-resolve
    } else {
      await update(ref(db, `rooms/${roomId}`), updates);
    }
  }

  // --- 14. VOTING & COUNTERACTIONS ---
  /**
   * Handles player votes (Allow, Block, Challenge).
   * @param {string} type - Vote type
   */
  function vote(type) {
    if (!roomData.pendingAction) return;

    if (type === "ALLOW") {
      set(ref(db, `rooms/${roomId}/pendingAction/votes/${user.uid}`), "ALLOW");
    } else if (type === "BLOCK") {
      let claim = "";
      const at = roomData.pendingAction.type;

      // Determine blocking claim based on action
      if (at === "Foreign Aid") claim = "Duke";
      if (at === "Steal") claim = "Captain"; // Simplified for UI; logic handles others
      if (at === "Assassinate") claim = "Contessa";

      update(ref(db, `rooms/${roomId}/pendingAction`), {
        status: "BLOCKED",
        blocker: user.uid,
        blockerClaim: claim,
      });
    } else if (type === "CHALLENGE_MOVE") {
      update(ref(db, `rooms/${roomId}/pendingAction`), {
        status: "CHALLENGED",
        challenger: user.uid,
        challengeTarget: roomData.pendingAction.source,
        claimToProve: roomData.pendingAction.claim,
      });
    } else if (type === "CHALLENGE_BLOCK") {
      update(ref(db, `rooms/${roomId}/pendingAction`), {
        status: "CHALLENGED",
        challenger: user.uid,
        challengeTarget: roomData.pendingAction.blocker,
        claimToProve: roomData.pendingAction.blockerClaim,
      });
    }
  }

  // --- 15. COMPLEX CARD LOGIC & RESOLUTION ---
  async function handleCard(cIdx) {
    const act = roomData.pendingAction;
    if (!act) return openInspector(me.hand[cIdx].type);

    // CASE 1: PROVING A CLAIM (I was challenged)
    if (act.status === "CHALLENGED" && act.challengeTarget === user.uid) {
      const card = me.hand[cIdx];
      const claim = act.claimToProve;
      let valid = card.type === claim;

      // Special Block Steal Logic: Captain, Ambassador, Inquisitor can block Steal
      if (act.type === "Steal" && act.status === "BLOCKED") {
        if (
          claim === "Captain" &&
          ["Captain", "Ambassador", "Inquisitor"].includes(card.type)
        )
          valid = true;
      }

      await runTransaction(ref(db, `rooms/${roomId}`), (room) => {
        if (!room) return;
        if (valid) {
          // Success: Show card, shuffle back, draw new, Challenger dies
          room.deck.push(card.type);
          for (let i = room.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]];
          }
          room.players[user.uid].hand[cIdx].type = room.deck.pop();
          room.pendingAction.status = "RESOLVING_DEATH";
          room.pendingAction.target = room.pendingAction.challenger;
          room.pendingAction.proven = true;
        }
        return room;
      });

      // Fail: I lied, I must die
      if (!valid) resolveDeath(cIdx, true);
    }
    // CASE 2: CHOOSING DEATH (I am dying)
    else if (act.status === "RESOLVING_DEATH" && act.target === user.uid) {
      resolveDeath(cIdx, false);
    }
    // CASE 3: EXCHANGING CARDS (Ambassador/Inquisitor)
    else if (act.status === "EXCHANGING" && act.source === user.uid) {
      if (exchangeSelection.includes(cIdx))
        exchangeSelection = exchangeSelection.filter((i) => i !== cIdx);
      else {
        const max = me.hand.filter((c) => c.alive && !c.isNew).length;
        if (exchangeSelection.length < max)
          exchangeSelection = [...exchangeSelection, cIdx];
        else showWarning(WARN.SELECT_CARDS(max));
      }
    }
    // CASE 4: SHOWING CARD TO INQUISITOR
    else if (act.status === "INQ_SHOWING" && act.target === user.uid) {
      update(ref(db, `rooms/${roomId}/pendingAction`), {
        status: "INQ_LOOKING",
        cardShown: me.hand[cIdx].type,
        cardIndex: cIdx,
      });
    }
  }

  async function resolveDeath(cIdx, failedBluff) {
    await runTransaction(ref(db, `rooms/${roomId}`), (room) => {
      if (!room) return;
      const act = room.pendingAction;
      const p = room.players[user.uid];

      // Kill the card
      p.hand[cIdx].alive = false;
      if (!p.hand.some((c) => c.alive)) p.alive = false;

      let proceed = false;
      if (failedBluff) {
        // I failed a bluff
        if (act.blocker === user.uid) {
          // I failed to block -> Action proceeds
          applyEffect(room, act);
          proceed = true;
        } else {
          // I failed to act -> Action void, refund assassin if applicable
          if (act.type === "Assassinate") room.players[act.source].coins += 3;
          proceed = true;
        }
      } else if (act.proven) {
        // I proved my claim (Challenger died)
        if (act.blocker && act.challengeTarget === act.blocker) {
          // It was a Block that was proven -> Action blocked
          if (act.type === "Assassinate") room.players[act.source].coins += 3;
          proceed = true;
        } else {
          // It was an Action that was proven -> Action proceeds
          applyEffect(room, act);
          proceed = true;
        }
      } else {
        // Standard death (Coup/Assassin)
        proceed = true;
      }

      if (proceed) {
        // Don't advance if we are in a multi-stage action (Exchange/Inquisitor) and didn't fail
        if (
          (act.type === "Exchange" || act.type === "Inquisitor") &&
          !failedBluff &&
          !act.blocker &&
          !act.status?.includes("CHALLENGED")
        ) {
          // Logic handled elsewhere
        } else {
          room.pendingAction = null;
          advanceTurn(room);
        }
      }

      // Win Condition Check
      const alive = room.playerOrder.filter((id) => room.players[id].alive);
      if (alive.length === 1) {
        room.status = "GAME_OVER";
        room.winner = room.players[alive[0]].name;
      }
      return room;
    });
  }

  async function resolveAction(act, blocked) {
    await runTransaction(ref(db, `rooms/${roomId}`), (room) => {
      if (!room) return;
      if (!blocked) {
        applyEffect(room, act);
      } else {
        // Action was successfully blocked
        if (act.type === "Assassinate") room.players[act.source].coins += 3;
        room.pendingAction = null;
        advanceTurn(room);
      }
      return room;
    });
  }

  function applyEffect(room, act) {
    const s = room.players[act.source];
    const t = act.target ? room.players[act.target] : null;

    // Ambassador Logic
    if (act.type === "Exchange") {
      room.players[act.source].hand.push({
        type: room.deck.pop(),
        alive: true,
        isNew: true,
      });
      room.players[act.source].hand.push({
        type: room.deck.pop(),
        alive: true,
        isNew: true,
      });
      room.pendingAction.status = "EXCHANGING";
      return;
    }

    // Inquisitor Logic
    if (act.type === "Inquisitor") {
      if (act.subType === "EXCHANGE") {
        room.players[act.source].hand.push({
          type: room.deck.pop(),
          alive: true,
          isNew: true,
        });
        room.pendingAction.status = "EXCHANGING";
      } else {
        room.pendingAction.status = "INQ_SHOWING";
      }
      return;
    }

    // Standard Effects
    if (act.type === "Income") s.coins++;
    if (act.type === "Foreign Aid") s.coins += 2;
    if (act.type === "Tax") s.coins += 3;
    if (act.type === "Steal") {
      const v = Math.min(2, t.coins);
      s.coins += v;
      t.coins -= v;
    }
    if (act.type === "Embezzle") {
      s.coins += room.treasury;
      room.treasury = 0;
    }
    if (act.type === "Convert") {
      s.faction = s.faction === "loyalist" ? "reformist" : "loyalist";
      room.treasury++;
    }

    // Kill Effects
    if (act.type === "Assassinate" || act.type === "Coup") {
      room.pendingAction.status = "RESOLVING_DEATH";
    } else {
      room.pendingAction = null;
      advanceTurn(room);
    }
  }

  async function finalizeExchange() {
    const max = me.hand.filter((c) => c.alive && !c.isNew).length;
    if (exchangeSelection.length !== max)
      return showWarning(WARN.MUST_KEEP(max));

    await runTransaction(ref(db, `rooms/${roomId}`), (room) => {
      if (!room) return;
      const p = room.players[user.uid];
      const keep = [],
        ret = [];

      p.hand.forEach((c, i) => {
        if (exchangeSelection.includes(i)) {
          delete c.isNew;
          keep.push(c);
        } else {
          ret.push(c.type);
        }
      });

      p.hand = keep;
      room.deck.push(...ret);

      // Reshuffle Deck
      for (let i = room.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]];
      }

      room.pendingAction = null;
      advanceTurn(room);
      return room;
    });
    exchangeSelection = [];
  }

  // Inquisitor: Forced Exchange (Attacker forces victim to draw new card)
  async function inqForceSwap(doSwap) {
    await runTransaction(ref(db, `rooms/${roomId}`), (room) => {
      if (!room) return;
      const act = room.pendingAction;
      if (doSwap) {
        const targetP = room.players[act.target];
        room.deck.push(act.cardShown);
        for (let i = room.deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]];
        }
        targetP.hand[act.cardIndex].type = room.deck.pop();
      }
      room.pendingAction = null;
      advanceTurn(room);
      return room;
    });
  }

  function advanceTurn(room) {
    let i = room.turnIndex + 1;
    let k = 0;
    // Find next living player
    while (k < room.playerOrder.length + 2) {
      const uid = room.playerOrder[i % room.playerOrder.length];
      if (room.players[uid] && room.players[uid].alive) {
        room.turnIndex = i;
        break;
      }
      i++;
      k++;
    }
  }

  function sendChat() {
    if (inputChat) {
      push(ref(db, `rooms/${roomId}/chat`), {
        sender: me.name,
        text: inputChat,
        timestamp: serverTimestamp(),
      });
      inputChat = "";
      playSound("click");
    }
  }

  // --- 16. HELPERS ---
  const navTo = (v) => {
    playSound("click");
    view = v;
  };
  function openInspector(t) {
    inspectorCard = t;
    playSound("click");
    runDecryptionEffect(t);
  }
  function closeInspector() {
    inspectorCard = null;
  }
  function cancelTarget() {
    isTargeting = false;
    selectedMove = null;
  }

  function getThreatLevel(p) {
    const cards = p.hand.filter((c) => c.alive).length;
    const val = p.coins + cards * 3;
    if (val > 12) return "extreme";
    if (val > 7) return "high";
    return "low";
  }
</script>

<!-- ================================================================================================= -->
<!-- DOCUMENT TEMPLATE (STRUCTURE & UI) -->
<!-- ================================================================================================= -->

<!-- NOTIFICATION TOAST -->
<div id="warning-toast" class:visible={warningMsg}>
  <Icon icon={CONF.ASSETS.ICONS.Warning} style="font-size:1.5rem;"></Icon>
  <span>{warningMsg}</span>
</div>

<!-- ABORT BUTTON (Global Access) -->
{#if !isLoading && (view === "lobby" || view === "game")}
  <div class="exit-btn-container">
    <button class="btn-exit" on:click={exitGame}>
      <Icon icon={CONF.ASSETS.ICONS.Exit} style="font-size:1.5rem;"></Icon> ABORT
    </button>
  </div>
{/if}

<main class:ready={!isLoading}>
  <!-- RENDERING LAYERS -->
  <canvas bind:this={canvasRef} id="particle-bg"></canvas>
  <!-- Layer 1: Stars -->
  <canvas bind:this={coinCanvas} id="coin-canvas"></canvas>
  <!-- Layer 2: Physics -->
  <div class="vignette"></div>
  <!-- Layer 3: Atmosphere -->

  {#if isLoading}
    <div id="loader-screen">
      <div class="spinner"></div>
      <div class="loader-text">{loadingText}</div>
    </div>
  {/if}

  <!-- MAIN MENU SCENE -->
  {#if !isLoading && view === "menu"}
    <div id="scene-menu" class="scene">
      <div class="menu-container">
        <h1 class="game-title">COUP</h1>
        <p class="game-subtitle">JACK'S RECREATION</p>
        <div class="menu-card">
          <div class="input-group">
            <Icon
              icon={CONF.ASSETS.ICONS.User}
              style="color: var(--flame-main); font-size: 2rem"
            ></Icon>
            <input
              bind:value={inputName}
              type="text"
              placeholder="AGENT ID"
              maxlength="12"
            />
          </div>

          <div class="mode-select">
            <button
              class:selected={selectedMode === "BASE"}
              on:click={() => (selectedMode = "BASE")}>CLASSIC</button
            >
            <button
              class:selected={selectedMode === "REFORMATION"}
              on:click={() => (selectedMode = "REFORMATION")}
              >REFORMATION</button
            >
          </div>

          <button class="btn-main" on:click={createGame}
            >INITIATE OPERATION</button
          >

          <div class="divider"><span>OR</span></div>

          <div class="join-row">
            <input
              bind:value={inputCode}
              id="inp-code"
              type="text"
              placeholder="CODE"
              maxlength="6"
            />
            <button class="btn-secondary" on:click={() => joinGame(null)}
              >JOIN</button
            >
          </div>

          <button
            class="btn-secondary"
            style="margin-top:15px"
            on:click={() => navTo("browser")}>PUBLIC NETWORKS</button
          >

          <div class="menu-nav-row">
            <button class="btn-nav" on:click={() => navTo("rules")}
              >Rules</button
            >
            <button class="btn-nav" on:click={() => navTo("about")}
              >About</button
            >
            <button class="btn-nav" on:click={() => navTo("changelog")}
              >Log</button
            >
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- INFO PAGES -->
  {#if !isLoading && (view === "rules" || view === "about" || view === "changelog")}
    <div class="page-scene scene">
      <div class="page-container">
        {#if view === "rules"}<Rules on:close={() => navTo("menu")} />{/if}
        {#if view === "about"}<About on:close={() => navTo("menu")} />{/if}
        {#if view === "changelog"}<Changelog
            on:close={() => navTo("menu")}
          />{/if}
      </div>
    </div>
  {/if}

  <!-- LOBBY BROWSER -->
  {#if !isLoading && view === "browser"}
    <div id="scene-menu" class="scene">
      <div class="lobby-container">
        <div class="lobby-header">
          <h2>PUBLIC NETWORKS</h2>
          <button
            class="icon-btn"
            aria-label="Close"
            on:click={() => navTo("menu")}
          >
            <Icon icon={CONF.ASSETS.ICONS.Close} style="font-size:2rem;"></Icon>
          </button>
        </div>
        <div class="lobby-panel">
          <ul id="lobby-list">
            {#if publicLobbies && publicLobbies.length > 0}
              {#each publicLobbies as l}
                <li>
                  <span class="p-name">
                    <Icon icon={CONF.ASSETS.ICONS.Connect}></Icon>
                    {l.hostName} ({l.playerCount}/{MODES[l.mode].maxPlayers}) - {MODES[
                      l.mode
                    ].name}
                  </span>
                  <button
                    class="btn-secondary"
                    style="width:auto; padding:8px 15px;"
                    on:click={() => joinGame(l.id)}>JOIN</button
                  >
                </li>
              {/each}
            {:else}
              <li style="justify-content:center; opacity:0.5;">
                <Icon icon={CONF.ASSETS.ICONS.Warning}></Icon> NO SIGNALS DETECTED
              </li>
            {/if}
          </ul>
        </div>
      </div>
    </div>
  {/if}

  <!-- ACTIVE LOBBY -->
  {#if !isLoading && view === "lobby" && roomData}
    <div id="scene-lobby" class="scene">
      <div class="lobby-container">
        <div class="lobby-header">
          <h2>OPERATION CODE</h2>
          <h1>{roomId}</h1>
        </div>
        <div class="lobby-panel">
          <h3>ACTIVE AGENTS</h3>
          <ul id="lobby-list">
            {#each roomData.playerOrder as uid}
              <li class:host={uid === roomData.host}>
                <span class="p-name">{roomData.players[uid].name}</span>
                <span class="p-badges">
                  {#if uid === roomData.host}👑{/if}
                  {roomData.players[uid].presence ? "🟢" : "🔴"}
                </span>
              </li>
            {/each}
          </ul>
        </div>
        {#if isHost}
          <button class="btn-main" on:click={startGame}>EXECUTE</button>
        {:else}
          <div class="loader-text" style="font-size:1rem;">
            AWAITING HOST COMMAND...
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- GAMEPLAY SCENE -->
  {#if !isLoading && view === "game" && roomData && me}
    <div
      id="scene-game"
      class="scene"
      style={MODES[roomData.mode].hasTeams &&
      roomData.playerOrder.filter(
        (id) => roomData.players[id].faction === "loyalist"
      ).length >
        roomData.playerOrder.filter(
          (id) => roomData.players[id].faction === "reformist"
        ).length
        ? "--ambient: var(--jade-dim);"
        : "--ambient: var(--flame-dim);"}
    >
      <!-- TOP STATUS BAR -->
      <div class="top-bar">
        <div class="last-action">LAST: {lastActionText}</div>
        <div class="turn-ind" class:my-turn={isMyTurn}>
          {turnPlayerId === user.uid
            ? "YOUR TURN"
            : `${roomData.players[turnPlayerId].name}'S TURN`}
        </div>
        <div></div>
      </div>

      <!-- LEFT COLUMN: COMMUNICATIONS -->
      <div class="game-col left-col">
        <div class="panel comms-panel">
          <div class="panel-header">
            <Icon icon={CONF.ASSETS.ICONS.Chat}></Icon> COMMS
          </div>
          <div id="chat-feed">
            {#if chatMessages.length}
              {#each chatMessages as m}
                <div class="chat-msg">
                  <span
                    class="author"
                    style="color:{m.sender === me.name
                      ? 'var(--jade-main)'
                      : 'var(--gold-main)'}">{m.sender}:</span
                  >
                  {m.text}
                </div>
              {/each}{/if}
          </div>
          <div class="chat-input-wrapper">
            <input
              bind:value={inputChat}
              id="inp-chat"
              type="text"
              placeholder="Transmit..."
              on:keydown={(e) => e.key === "Enter" && sendChat()}
            />
            <button id="btn-chat-send" aria-label="Send" on:click={sendChat}>
              <Icon icon={CONF.ASSETS.ICONS.Send}></Icon>
            </button>
          </div>
        </div>
        <div class="panel log-panel">
          <div class="panel-header">
            <Icon icon={CONF.ASSETS.ICONS.Log}></Icon> LOGS
          </div>
          <div id="game-log">
            {#if logEntries.length}
              {#each logEntries as l}
                <div class="log-entry {l.type}">
                  <Icon
                    icon={CONF.ASSETS.ICONS.Check}
                    style="vertical-align:middle;"
                  ></Icon>
                  {l.text}
                </div>
              {/each}{/if}
          </div>
        </div>
      </div>

      <!-- CENTER COLUMN: THE BOARD -->
      <div class="game-col center-col">
        <!-- STATS -->
        <div class="table-stats">
          <div class="stat-box stat-vault" bind:this={treasuryBoxRef}>
            <!-- 3D Vault Shell -->
            <div class="vault-shell">
              <div class="vault-top-glass"></div>
              <div class="vault-inner-tray"></div>
              <div class="vault-depth"></div>
              <div class="vault-shine"></div>

              <!-- Treasury Content -->
              <div class="vault-content">
                <span class="label">TREASURY</span>
                <span class="value">{roomData.treasury}</span>
                <Icon icon={CONF.ASSETS.ICONS.Bank}></Icon>
              </div>
            </div>
          </div>

          <div class="stat-box">
            <span class="label">DECK</span>
            <span class="value">{roomData.deck ? roomData.deck.length : 0}</span
            >
            <Icon icon={CONF.ASSETS.ICONS.Deck}></Icon>
          </div>
        </div>

        <!-- OPPONENT GRID -->
        <div class="table-arena">
          <!-- CENTER DECK CORE -->
          <div
            class="deck-stack"
            on:mouseenter={() => (deckHover = true)}
            on:mouseleave={() => (deckHover = false)}
            aria-label="Deck"
            role="group"
          >
            {#each deckScatter as t, i (i)}
              <div
                class="deck-card"
                class:deck-hovered={deckHover}
                style="
          --rot: {t.r}deg;
          --dx: {t.x}px;
          --dy: {t.y}px;
          --lift: {i * 1.4}px;
          --z: {i};
        "
              ></div>
            {/each}
          </div>

          <!-- OPPONENTS ORBIT RING -->
          <div class="orbit-ring">
            {#each roomData.playerOrder.filter((id) => id !== user.uid && roomData.players[id].alive) as uid, i}
              <div
                class="orbit-seat"
                style="
          --i: {i};
          --count: {roomData.playerOrder.filter(
                  (id) => id !== user.uid && roomData.players[id].alive
                ).length};
        "
              >
                <div
                  class="opponent-plate threat-{getThreatLevel(
                    roomData.players[uid]
                  )}"
                  class:active-turn={turnPlayerId === uid}
                  role="button"
                  tabindex="0"
                  on:click={() => handleTarget(uid)}
                  on:keydown={(e) => handleKey(e, () => handleTarget(uid))}
                  style={isTargeting && selectedMove?.target
                    ? "cursor:crosshair; border-color:var(--blood-main); box-shadow:0 0 20px var(--blood-glow);"
                    : ""}
                >
                  <div class="opp-header">
                    {#if MODES[roomData.mode].hasTeams}
                      <div
                        class="opp-faction-dot {roomData.players[uid].faction}"
                      ></div>
                    {/if}
                    <div class="opp-name">{roomData.players[uid].name}</div>
                  </div>

                  <div class="opp-stats">
                    <Icon icon={CONF.ASSETS.ICONS.Income}></Icon>
                    {roomData.players[uid].coins}
                  </div>

                  <div class="opp-cards-row">
                    {#each roomData.players[uid].hand as c}
                      {#if c.alive}
                        <div class="mini-card-back"></div>
                      {/if}
                    {/each}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- DECISION CENTER (DYNAMIC UI) -->
        {#if inquisitorAction}
          <div id="decision-center">
            <div class="decision-title">INQUISITOR TACTICS</div>
            <div class="decision-desc">
              Target: {roomData.players[inquisitorAction.target].name}
            </div>
            <div class="decision-actions">
              <button
                class="btn-decision allow"
                on:click={() => commitInquisitor("EXCHANGE")}
                >EXCHANGE (Draw 1)</button
              >
              <button
                class="btn-decision challenge"
                on:click={() => commitInquisitor("EXAMINE")}
                >EXAMINE (Look)</button
              >
            </div>
            <button class="btn-decision block" on:click={cancelTarget}
              >CANCEL</button
            >
          </div>
        {:else if roomData.pendingAction}
          {@const act = roomData.pendingAction}
          {@const srcName = roomData.players[act.source].name}

          <div
            id="decision-center"
            class:danger={act.status.includes("CHALLENGE")}
          >
            <!-- A. AMBASSADOR / INQUISITOR EXCHANGE -->
            {#if act.status === "EXCHANGING" && act.source === user.uid}
              <div class="decision-title">EXCHANGE PROTOCOL</div>
              <div class="decision-desc">Select cards to KEEP.</div>
              <div class="exchange-area">
                {#each me.hand as c, i}
                  <div
                    role="button"
                    tabindex="0"
                    class="exchange-card-wrapper {exchangeSelection.includes(i)
                      ? 'selected'
                      : ''}"
                    on:click={() => handleCard(i)}
                    on:keydown={(e) => handleKey(e, () => handleCard(i))}
                  >
                    <img
                      src={CONF.ASSETS.CARDS[c.type]}
                      style="width:100px; border-radius:8px;"
                      alt={c.type}
                    />
                  </div>
                {/each}
              </div>
              <button class="btn-decision allow" on:click={finalizeExchange}
                >CONFIRM</button
              >

              <!-- B. INQUISITOR SHOWING (VICTIM) -->
            {:else if act.status === "INQ_SHOWING" && act.target === user.uid}
              <div class="decision-title">INQUISITION</div>
              <div class="decision-desc flash red">CLICK CARD TO REVEAL</div>

              <!-- C. INQUISITOR LOOKING (ATTACKER) -->
            {:else if act.status === "INQ_LOOKING" && act.source === user.uid}
              <div class="decision-title">EVIDENCE REVEALED</div>
              <div class="decision-desc">
                Opponent showed: <strong>{act.cardShown}</strong>
              </div>
              <div class="decision-actions">
                <button
                  class="btn-decision challenge"
                  on:click={() => inqForceSwap(true)}>FORCE EXCHANGE</button
                >
                <button
                  class="btn-decision allow"
                  on:click={() => inqForceSwap(false)}>RETURN</button
                >
              </div>

              <!-- D. INITIAL PENDING STATE -->
            {:else if act.status === "PENDING"}
              <div class="decision-title">{act.name} INITIATED</div>
              <div class="decision-desc">
                {srcName} targets {act.target
                  ? roomData.players[act.target].name
                  : "Treasury"}.
              </div>
              <div class="decision-actions">
                {#if act.source === user.uid}
                  <span>AWAITING RESPONSE...</span>
                {:else if act.votes?.[user.uid]}
                  <span>VOTED (WAITING FOR OTHERS)</span>
                {:else}
                  <button
                    class="btn-decision allow"
                    on:click={() => vote("ALLOW")}
                  >
                    <Icon icon={CONF.ASSETS.ICONS.Check}></Icon> ALLOW
                  </button>
                  {#if (roomData.mode === "BASE" ? MOVES_BASE : MOVES_REF).find((m) => m.id === act.type)?.block}
                    <button
                      class="btn-decision block"
                      on:click={() => vote("BLOCK")}
                    >
                      <Icon icon={CONF.ASSETS.ICONS.Block}></Icon> BLOCK
                    </button>
                  {/if}
                  {#if (roomData.mode === "BASE" ? MOVES_BASE : MOVES_REF).find((m) => m.id === act.type)?.claim}
                    <button
                      class="btn-decision challenge"
                      on:click={() => vote("CHALLENGE_MOVE")}
                    >
                      <Icon icon={CONF.ASSETS.ICONS.Challenge}></Icon> CHALLENGE
                    </button>
                  {/if}
                {/if}
              </div>

              <!-- E. ACTION BLOCKED -->
            {:else if act.status === "BLOCKED"}
              <div class="decision-title">ACTION BLOCKED</div>
              <div class="decision-desc">
                {roomData.players[act.blocker].name} claims {act.blockerClaim} to
                block!
              </div>
              <div class="decision-actions">
                {#if act.source === user.uid}
                  <button
                    class="btn-decision allow"
                    on:click={() => resolveAction(act, true)}
                  >
                    <Icon icon={CONF.ASSETS.ICONS.Cross}></Icon> CONCEDE
                  </button>
                  <button
                    class="btn-decision challenge"
                    on:click={() => vote("CHALLENGE_BLOCK")}
                  >
                    <Icon icon={CONF.ASSETS.ICONS.Challenge}></Icon> CHALLENGE CLAIM
                  </button>
                {:else}
                  <span>WAITING FOR ACTIVE AGENT...</span>
                {/if}
              </div>

              <!-- F. CHALLENGE IN PROGRESS -->
            {:else if act.status === "CHALLENGED"}
              <div class="decision-title">CHALLENGE ISSUED</div>
              <div class="decision-desc">
                {roomData.players[act.challenger].name} challenges {roomData
                  .players[act.challengeTarget].name}!
              </div>
              {#if act.challengeTarget === user.uid}
                <span class="flash gold"
                  >REVEAL A CARD BELOW TO PROVE CLAIM</span
                >
              {:else}
                <span>WITNESSING TRIBUNAL...</span>
              {/if}

              <!-- G. RESOLVING DEATH -->
            {:else if act.status === "RESOLVING_DEATH"}
              <div class="decision-title" style="color:var(--blood-vivid)">
                CASUALTY REPORT
              </div>
              <div class="decision-desc">
                {roomData.players[act.target].name} must lose an influence.
              </div>
              {#if act.target === user.uid}
                <span class="flash red">CLICK A CARD BELOW TO ELIMINATE</span>
              {/if}
            {/if}
          </div>
        {/if}

        <!-- MY DASHBOARD -->
        <div id="my-dashboard">
          {#if me.alive}
            <div id="my-hand">
              {#each me.hand as c, i}
                <div
                  role="button"
                  tabindex="0"
                  class="game-card {c.alive
                    ? ''
                    : 'dead'} {exchangeSelection.includes(i)
                    ? 'selected'
                    : ''} {(roomData.pendingAction?.status ===
                    'RESOLVING_DEATH' &&
                    roomData.pendingAction.target === user.uid &&
                    c.alive) ||
                  (roomData.pendingAction?.status === 'CHALLENGED' &&
                    roomData.pendingAction.challengeTarget === user.uid &&
                    c.alive) ||
                  (roomData.pendingAction?.status === 'EXCHANGING' &&
                    roomData.pendingAction.source === user.uid) ||
                  (roomData.pendingAction?.status === 'INQ_SHOWING' &&
                    roomData.pendingAction.target === user.uid)
                    ? 'selectable'
                    : ''}"
                  on:click={() => handleCard(i)}
                  on:keydown={(e) => handleKey(e, () => handleCard(i))}
                >
                  <img src={CONF.ASSETS.CARDS[c.type]} alt={c.type} />
                </div>
              {/each}
            </div>
            <div class="my-stats">
              <div id="my-name">{me.name}</div>
              <div class="coin-display">
                <Icon icon={CONF.ASSETS.ICONS.Income}></Icon>
                {me.coins}
              </div>
              {#if MODES[roomData.mode].hasTeams}
                <div
                  class="faction-badge {me.faction}"
                  style="background:{me.faction === 'loyalist'
                    ? 'var(--jade-main)'
                    : 'var(--flame-dim)'};"
                >
                  {me.faction}
                </div>
              {/if}
            </div>
          {:else}
            <div class="kia-panel" aria-label="Eliminated">
              <div class="kia-glow"></div>

              <div class="kia-title">
                <span class="kia-k">K</span><span class="kia-dot">•</span><span
                  class="kia-i">I</span
                ><span class="kia-dot">•</span><span class="kia-a">A</span>
              </div>

              <div class="kia-sub">
                <span class="kia-subline">AGENT STATUS:</span>
                <span class="kia-subtext">Monitoring encrypted channels…</span>
              </div>

              <div class="kia-pulsebar"></div>
            </div>
          {/if}
        </div>
      </div>

      <!-- RIGHT COLUMN: TACTICS -->
      <div class="game-col right-col">
        <div id="tactical-deck" class="panel">
          <div class="panel-header">
            <Icon icon={CONF.ASSETS.ICONS.Tactics}></Icon> TACTICS
          </div>
          <div class="scroller">
            {#if me.alive}
              {#each roomData.mode === "BASE" ? MOVES_BASE : MOVES_REF as m}
                <div
                  class="tac-item {m.agg ? 'aggressive' : ''} {isMyTurn &&
                  me.coins >= m.c
                    ? 'playable'
                    : 'disabled'}"
                  role="button"
                  tabindex="0"
                  aria-label={m.n}
                  on:click={() => prepAction(m)}
                  on:keydown={(e) => handleKey(e, () => prepAction(m))}
                >
                  <Icon class="tac-icon" icon={CONF.ASSETS.ICONS[m.icon]}
                  ></Icon>
                  <div class="tac-info">
                    <span class="tac-name">{m.n}</span>
                    <span class="tac-desc">{m.d}</span>
                  </div>
                  {#if m.c}<span class="tac-cost loss">-{m.c}</span
                    >{:else if m.g}<span class="tac-cost gain">+{m.g}</span
                    >{/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- GAME OVER SCENE -->
  {#if !isLoading && view === "game_over"}
    <div id="scene-gameover" class="scene">
      <div class="winner-container">
        <div class="winner-title">OPERATION COMPLETE. VICTOR:</div>
        <div class="winner-name">{winnerName}</div>
        <button class="btn-main btn-return" on:click={leaveRoomLocalState}
          >RETURN TO BASE</button
        >
      </div>
    </div>
  {/if}

  <!-- TARGETING OVERLAY -->
  {#if isTargeting}
    <div class="targeting-overlay">
      <div class="targeting-msg">SELECT TARGET AGENT</div>
      <button
        class="btn-decision"
        style="background:var(--blood-main); color:white"
        on:click={cancelTarget}>CANCEL</button
      >
    </div>
  {/if}

  <!-- INSPECTOR CARD (ZOOM) -->
  {#if inspectorCard}
    <div
      id="inspector-overlay"
      role="button"
      tabindex="0"
      on:click={closeInspector}
      on:keydown={(e) => handleKey(e, closeInspector)}
    >
      <button class="inspect-content" tabindex="0" on:click|stopPropagation>
        <div class="inspect-view">
          <img src={CONF.ASSETS.CARDS[inspectorCard]} alt="Inspect" />
        </div>
        <div class="inspect-text">
          <div class="inspect-role">{decryptedText.role}</div>
          <div class="inspect-desc">{decryptedText.desc}</div>
        </div>
      </button>
    </div>
  {/if}

  <!-- NOTES APP -->
  {#if showNotes && view === "game"}
    <div class="notes-app">
      <div class="notes-header">CLASSIFIED NOTES</div>
      <textarea bind:value={notes} placeholder="Record observations here..."
      ></textarea>
    </div>
  {/if}

  <!-- FLOATING ACTION BUTTON FOR NOTES -->
  {#if view === "game"}
    <button class="fab-notes" on:click={() => (showNotes = !showNotes)}>
      <Icon icon={CONF.ASSETS.ICONS.Notebook}></Icon>
    </button>
  {/if}
</main>
