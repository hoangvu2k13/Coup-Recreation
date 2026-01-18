<script>
  import { onMount, onDestroy } from "svelte";
  import { initializeApp } from "firebase/app";
  import { location, push as routerPush } from "svelte-spa-router";
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

  let RulesComp = null;
  let AboutComp = null;

  async function openLazyPage(which) {
    // load only when needed
    if (which === "rules" && !RulesComp) {
      RulesComp = (await import("../Rules.svelte")).default;
    }
    if (which === "about" && !AboutComp) {
      AboutComp = (await import("../About.svelte")).default;
    }
  }

  import ICONS from "../lib/icons.json";
  import { WARN, LOG } from "../lib/messages.js";
  import SOUNDS from "../lib/sounds.json";

  class AmbienceEngine {
    constructor() {
      this.enabled = true;
      this.started = false;
      this.rain = null;
      this.fire = null;
      this.volume = 0.35;
      this._fading = 0;
    }

    setRefs({ rain, fire }) {
      this.rain = rain;
      this.fire = fire;
    }

    setEnabled(v) {
      this.enabled = !!v;
      this.applyVolumes(true);
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      this.applyVolumes(true);
    }

    applyVolumes(immediate = false) {
      if (!this.rain || !this.fire) return;

      const targetRain = this.enabled ? this.volume : 0;
      const targetFire = this.enabled ? this.volume * 0.85 : 0;

      if (immediate) {
        this.rain.volume = targetRain;
        this.fire.volume = targetFire;
        return;
      }
    }

    async start() {
      if (this.started) return true;
      if (!this.rain || !this.fire) return false;

      try {
        this.rain.load();
        this.fire.load();

        this.rain.loop = true;
        this.fire.loop = true;

        // start from 0 (fade in)
        this.rain.volume = 0;
        this.fire.volume = 0;

        await Promise.all([this.rain.play(), this.fire.play()]);

        this.started = true;
        this.fadeTo(this.enabled ? this.volume : 0, 650);
        return true;
      } catch (e) {
        this.started = false;
        return false;
      }
    }

    fadeTo(vol, ms = 500) {
      if (!this.rain || !this.fire) return;

      if (this._fading) cancelAnimationFrame(this._fading);

      const fromRain = this.rain.volume || 0;
      const fromFire = this.fire.volume || 0;

      const toRain = this.enabled ? vol : 0;
      const toFire = this.enabled ? vol * 0.85 : 0;

      const start = performance.now();
      const tick = () => {
        const t = Math.max(0, Math.min(1, (performance.now() - start) / ms));
        this.rain.volume = fromRain + (toRain - fromRain) * t;
        this.fire.volume = fromFire + (toFire - fromFire) * t;
        if (t < 1) this._fading = requestAnimationFrame(tick);
      };
      this._fading = requestAnimationFrame(tick);
    }

    stop() {
      if (this._fading) cancelAnimationFrame(this._fading);
      this._fading = 0;

      if (this.rain) {
        this.rain.pause();
        this.rain.currentTime = 0;
      }
      if (this.fire) {
        this.fire.pause();
        this.fire.currentTime = 0;
      }
      this.started = false;
    }
  }

  // Coin physics
  class CoinPhysics {
    constructor(w, h) {
      this.w = w;
      this.h = h;

      this.coins = [];

      this.gravity = 1;
      this.airDrag = 0.8;
      this.groundFriction = 0.4;
      this.restitution = 0.03;

      this.angularDamping = 0.2;
      this.maxSpin = 0.01;

      this.sleepVel = 0.01;
      this.sleepFrames = 12;

      this.baumgarte = 0.22;

      this.restAngularFriction = 0.78;

      this.player = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };

      this.box = {
        x: w / 2 - 100,
        y: h / 2,
        w: 200,
        h: 100,
        bottom: h / 2 + 100,
      };

      this.MAX_COINS = 140;

      this._lastPlayerRectUpdate = 0;
      this.canvasEl = null;
      this.playerEl = null;

      this._cellSize = 34;
      this._grid = new Map();

      this.stack = {
        perLayer: 5, // coins per row
        layerHeight: 8.5, // vertical spacing between layers
        spacingX: 9.2, // horizontal spacing inside one layer
        jitterX: 1.6,
        jitterY: 0.8,
      };
    }

    updatePlayerRect(rect, canvasEl) {
      if (!rect || !canvasEl) return;

      const cRect = canvasEl.getBoundingClientRect();
      const x = rect.left - cRect.left;
      const y = rect.top - cRect.top;

      this.player = {
        x,
        y,
        w: rect.width,
        h: rect.height,
        cx: x + rect.width * 0.5,
        cy: y + rect.height * 0.5,
      };
    }

    setDomRefs({ canvasEl, playerEl }) {
      this.canvasEl = canvasEl || null;
      this.playerEl = playerEl || null;
    }

    updateBoxRect(rect) {
      if (!rect) return;

      const nw = rect.width;
      const nh = rect.height;

      if (
        this.box &&
        Math.abs(this.box.w - nw) < 0.5 &&
        Math.abs(this.box.h - nh) < 0.5
      ) {
        return;
      }

      this.box = {
        x: 0,
        y: 0,
        w: nw,
        h: nh,
        bottom: nh,
      };

      // wake coins when box changes
      for (let i = 0; i < this.coins.length; i++) {
        const c = this.coins[i];
        if (!c) continue;
        c.sleeping = false;
        c.sleep = 0;
      }
    }

    getTowerSpawn(i = 0) {
      const box = this.box;
      const { perLayer, layerHeight, spacingX, jitterX, jitterY } = this.stack;

      const baseX = box.x + box.w * 0.76;
      const baseY = box.bottom - 14;

      const layer = Math.floor(i / perLayer);
      const idx = i % perLayer;

      const offset = idx - (perLayer - 1) / 2;

      return {
        x: baseX + offset * spacingX + (Math.random() - 0.5) * jitterX,
        y: baseY - layer * layerHeight + (Math.random() - 0.5) * jitterY,
      };
    }

    sendCoinToPlayer() {
      if (!this.coins.length) return;

      const idxFromEnd = [...this.coins]
        .reverse()
        .findIndex((c) => !c.isRemoving && c.mode === "physics");
      if (idxFromEnd === -1) return;

      const realIndex = this.coins.length - 1 - idxFromEnd;
      const coin = this.coins[realIndex];

      coin.mode = "toPlayer";
      coin.t = 0;

      coin.fromX = coin.x;
      coin.fromY = coin.y;

      coin.toX = this.box.w * 0.5;
      coin.toY = this.box.h + 40;

      coin.vx = 0;
      coin.vy = 0;
    }

    spawnCoinFromPlayer() {
      if (this.coins.length >= this.MAX_COINS) return;

      const towerIndex = this.coins.filter(
        (c) => c.mode === "physics" && !c.isRemoving
      ).length;
      const target = this.getTowerSpawn(towerIndex);

      const startX = this.box.w * 0.5;
      const startY = -40;

      this.coins.push({
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        r: 10,
        angle: (Math.random() - 0.5) * 0.25,
        vAngle: (Math.random() - 0.5) * 0.015,

        mode: "toTreasury",
        t: 0,
        fromX: startX,
        fromY: startY,
        toX: target.x,
        toY: target.y,

        sleep: 0,
        sleeping: false,
        id: crypto.randomUUID(),
        opacity: 1,
        scale: 1,
      });
    }

    addCoin() {
      if (this.coins.length >= this.MAX_COINS) return;

      const towerIndex = this.coins.filter(
        (c) => c.mode === "physics" && !c.isRemoving
      ).length;
      const target = this.getTowerSpawn(towerIndex);

      const startX = target.x + (Math.random() - 0.5) * 10;
      const startY = this.box.y - 60;

      this.coins.push({
        id: crypto.randomUUID(),

        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0,
        r: 10,

        angle: (Math.random() - 0.5) * 0.2,
        vAngle: (Math.random() - 0.5) * 0.02,

        settled: false,
        mode: "physics",

        opacity: 1,
        scale: 1,

        sleep: 0,
        sleeping: false,
      });
    }

    removeCoin() {
      if (!this.coins.length) return;

      const idx = Math.floor(Math.random() * this.coins.length);
      const coin = this.coins[idx];

      coin.vy = -15;
      coin.vx = (Math.random() - 0.5) * 10;
      coin.isRemoving = true;
    }

    buildSpatialGrid() {
      const grid = this._grid;
      grid.clear();

      const cellSize = this._cellSize;
      const coins = this.coins;

      for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (!c) continue;
        if (c.isRemoving) continue;
        if (c.mode && c.mode !== "physics") continue;
        if (c.sleeping) continue;

        const gx = (c.x / cellSize) | 0;
        const gy = (c.y / cellSize) | 0;
        const key = gx + "," + gy;

        let bucket = grid.get(key);
        if (!bucket) grid.set(key, (bucket = []));
        bucket.push(i);
      }
    }

    resolveCoinCollisionsSpatial() {
      const grid = this._grid;
      const coins = this.coins;

      const neighbors = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];

      const iters = 2;

      for (let k = 0; k < iters; k++) {
        for (const [key, ids] of grid) {
          const comma = key.indexOf(",");
          const gx = parseInt(key.slice(0, comma), 10);
          const gy = parseInt(key.slice(comma + 1), 10);

          for (let a = 0; a < ids.length; a++) {
            const i = ids[a];
            const A = coins[i];
            if (!A || A.isRemoving) continue;

            for (let n = 0; n < neighbors.length; n++) {
              const nx = gx + neighbors[n][0];
              const ny = gy + neighbors[n][1];
              const list = grid.get(nx + "," + ny);

              if (!list) continue;

              for (let b = 0; b < list.length; b++) {
                const j = list[b];
                if (j <= i) continue;
                if (j === i) continue;

                const B = coins[j];
                if (!B || B.isRemoving) continue;

                const dx = B.x - A.x;
                const dy = B.y - A.y;
                const r = A.r + B.r;

                const d2 = dx * dx + dy * dy;
                if (d2 <= 0 || d2 >= r * r) continue;

                const dist = Math.sqrt(d2);
                const overlap = (r - dist) * 0.5;
                const nxn = dx / dist;
                const nyn = dy / dist;

                A.x -= nxn * overlap;
                A.y -= nyn * overlap;
                B.x += nxn * overlap;
                B.y += nyn * overlap;

                const rvx = B.vx - A.vx;
                const rvy = B.vy - A.vy;
                const sepVel = rvx * nxn + rvy * nyn;

                if (sepVel < 0) {
                  let impulse = -(1 + this.restitution) * sepVel * 0.5;
                  impulse += overlap * this.baumgarte;
                  const ix = impulse * nxn;
                  const iy = impulse * nyn;

                  A.vx -= ix;
                  A.vy -= iy;
                  B.vx += ix;
                  B.vy += iy;

                  A.vAngle = (A.vAngle || 0) * 0.85;
                  B.vAngle = (B.vAngle || 0) * 0.85;

                  A.sleeping = false;
                  B.sleeping = false;
                  A.sleep = 0;
                  B.sleep = 0;
                }
              }
            }
          }
        }
      }
    }

    /*
    Main physics tick
     */
    update() {
      const now = performance.now();

      if (now - this._lastPlayerRectUpdate > 120) {
        this._lastPlayerRectUpdate = now;
        const canvasEl = this.canvasEl;
        const playerEl = this.playerEl;

        if (!playerEl || !canvasEl) {
          this.player.cx = this.w * 0.5;
          this.player.cy = this.h * 0.78;
        } else {
          this.updatePlayerRect(playerEl.getBoundingClientRect(), {
            getBoundingClientRect: () => ({ left: 0, top: 0 }),
          });
        }
      }

      const box = this.box;

      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];

        if (c.mode === "toTreasury") {
          c.t += 0.06;
          const tt = Math.min(1, c.t);

          const ease = 1 - Math.pow(1 - tt, 3);
          const arc = Math.sin(tt * Math.PI) * -60;

          c.x = c.fromX + (c.toX - c.fromX) * ease;
          c.y = c.fromY + (c.toY - c.fromY) * ease + arc;

          c.vAngle *= this.angularDamping;
          c.vAngle = Math.max(-this.maxSpin, Math.min(this.maxSpin, c.vAngle));
          c.angle += c.vAngle;

          if (tt >= 1) {
            c.mode = "physics";
            c.vx = (Math.random() - 0.5) * 2;
            c.vy = 2 + Math.random() * 2;
          }
          continue;
        }

        if (c.mode === "toPlayer") {
          c.t += 0.06;
          const tt = Math.min(1, c.t);

          const ease = 1 - Math.pow(1 - tt, 3);
          const arc = Math.sin(tt * Math.PI) * -80;

          c.x = c.fromX + (c.toX - c.fromX) * ease;
          c.y = c.fromY + (c.toY - c.fromY) * ease + arc;

          c.vAngle *= this.angularDamping;
          c.vAngle = Math.max(-this.maxSpin, Math.min(this.maxSpin, c.vAngle));
          c.angle += c.vAngle;

          if (tt >= 1) this.coins.splice(i, 1);
          continue;
        }

        if (c.isRemoving && c.y > this.h + 50) {
          this.coins.splice(i, 1);
          continue;
        }

        if (c.sleeping) continue;

        c.vy += this.gravity;

        c.vx *= this.airDrag;
        c.vy *= this.airDrag;

        c.vAngle = (c.vAngle || 0) * this.angularDamping;
        c.vAngle = Math.max(-this.maxSpin, Math.min(this.maxSpin, c.vAngle));

        c.x += c.vx;
        c.y += c.vy;
        c.angle += c.vAngle;

        if (!c.isRemoving) {
          const pad = 14;
          const top = box.y + pad;
          const bottom = box.bottom - pad;
          const left = box.x + pad;
          const right = box.x + box.w - pad;

          if (c.y - c.r < top) {
            c.y = top + c.r;
            c.vy *= -this.restitution;
          }

          if (c.y + c.r > bottom) {
            c.y = bottom - c.r;

            // bounce
            c.vy *= -this.restitution;

            if (Math.abs(c.vy) < 0.16) c.vy = 0;

            c.vx *= this.groundFriction;

            const resting = Math.abs(c.vy) === 0 && Math.abs(c.vx) < 0.12;
            if (resting) {
              c.vAngle = (c.vAngle || 0) * this.restAngularFriction;
              if (Math.abs(c.vAngle) < 0.004) c.vAngle = 0;
            }
          }

          if (c.x - c.r < left) {
            c.x = left + c.r;
            c.vx *= -this.restitution;
          }

          if (c.x + c.r > right) {
            c.x = right - c.r;
            c.vx *= -this.restitution;
          }
        }

        c.settled = Math.abs(c.vx) < 0.1 && Math.abs(c.vy) < 0.1;

        const stable =
          Math.abs(c.vx) < this.sleepVel &&
          Math.abs(c.vy) < this.sleepVel &&
          Math.abs(c.vAngle || 0) < this.sleepVel;

        if (stable) {
          c.sleep = (c.sleep || 0) + 1;
          if (c.sleep > this.sleepFrames) {
            c.sleeping = true;
            c.vx = 0;
            c.vy = 0;
            c.vAngle = 0;

            c.angle = +c.angle.toFixed(2);
          }
        } else {
          c.sleep = 0;
          c.sleeping = false;
        }
      }

      //spatial collisions
      this.buildSpatialGrid();
      this.resolveCoinCollisionsSpatial();
    }
  }

  // Bg particles
  class Particle {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.reset();
    }

    reset() {
      this.x = Math.random() * this.w;
      this.y = this.h + Math.random() * 100;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = -(Math.random() * 1 + 0.5);
      this.life = Math.random() * 0.8 + 0.2;
      this.r = Math.random() * 1.5;

      const hue = Math.random() > 0.9 ? 340 : 200;
      this.color = `hsla(${hue}, 80%, 70%, ${Math.random() * 0.5})`;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= 0.005;
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

  // Firebase
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

  // Game constants
  const CONF = {
    TIMINGS: {
      ACTION_TIMEOUT: 60000,
      AUTO_PASS: 120000,
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

  // Moves
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

  const SFX_PROFILE = {
    master: 0.92,

    perKey: {
      click: 0.65,
      toast: 0.75,
      deny: 0.8,
      ready: 0.85,
      turn: 0.85,

      coin_gain: 0.65,
      coin_spend: 0.65,

      challenge: 0.9,
      assassinate: 0.9,
      coup: 1.0,
      kick: 0.95,
    },

    limiterMax: 0.85,

    jitter: 0.04, // 4%
  };

  // State
  let user = null;
  let view = "menu";
  let isLoading = true;
  let loadingText = "INITIALIZING SECURE CONNECTION...";
  let playerCoinRef;
  let treasuryVisual = null;
  let showTutorial = false;
  let showSettings = false;
  let currentSkin = localStorage.getItem("coup_skin") || "CLASSIC";
  let winCount = parseInt(localStorage.getItem("coup_wins") || "0", 10);
  let heartbeatInterval;
  let inputName = "";
  let inputCode = "";
  let inputChat = "";
  let selectedMode = "BASE";
  let roomId = "";
  let roomData = null;
  let isHost = false;
  let me = null;
  let turnPlayerId = null;
  let isMyTurn = false;
  let publicLobbies = [];
  let lobbyListenerOff = null;
  let isTargeting = false;
  let selectedMove = null;
  let inspectorCard = null;
  let decryptedText = { role: "", desc: "" };
  let showNotes = false;
  let notes = localStorage.getItem("coup_notes") || "";
  let warningMsg = null;
  let warningTimer = null;
  let winnerName = "";
  let lastActionText = "AWAITING ORDERS...";
  let exchangeSelection = [];
  let inquisitorAction = null;
  let audioCtx;
  let coinSys, animFrame;
  let particles = [],
    particleFrame;
  let canvasRef;
  let coinLayerEl;
  let roomListenerOff = null;
  let rainAudio;
  let fireAudio;
  let ambienceEnabled = true;
  let ambienceVolume = 0.35;
  let ambienceStarted = false;
  let treasuryBoxRef;
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
  let currentPath = "/";
  let sfxEnabled = true;
  let sfxVolume = 0.55;
  let kickTargetId = null;
  let kickTargetName = "";
  let showKickConfirm = false;
  let allReady = false;
  let lastActivityAt = Date.now();
  let afkTimer = null;
  let vaultCoins = [];
  let realTreasury = 0;
  let visualTreasury = 0;
  let ambienceEngine = new AmbienceEngine();
  let opponentAliveIds = [];
  let loyalistAliveCount = 0;
  let reformistAliveCount = 0;
  let opponentAliveCount = 0;
  let lastCoinSync = 0;

  onMount(() => {
    sfxEnabled = localStorage.getItem("coup_sfx_enabled") !== "0";
    ambienceEnabled = localStorage.getItem("coup_amb_enabled") !== "0";

    const sv = parseFloat(localStorage.getItem("coup_sfx_vol") || "0.55");
    const av = parseFloat(localStorage.getItem("coup_amb_vol") || "0.35");

    sfxVolume = Number.isFinite(sv) ? sv : 0.55;
    ambienceVolume = Number.isFinite(av) ? av : 0.35;
  });

  $: allReady =
    roomData?.status === "LOBBY" &&
    roomData?.playerOrder?.length > 0 &&
    roomData.playerOrder.every((uid) => roomData.ready?.[uid]);

  $: if (roomData?.deck?.length != null) {
    const n = Math.min(6, roomData.deck.length);
    if (deckScatter.length !== n) {
      deckScatter = Array.from({ length: n }, () => ({
        r: (Math.random() * 18 - 9).toFixed(2),
        x: (Math.random() * 10 - 5).toFixed(2),
        y: (Math.random() * 6 - 3).toFixed(2),
      }));
    }
  }

  let _lastChatObj = null;
  let _lastLogObj = null;

  function rebuildChatAndLog(data) {
    const chatObj = data?.chat || null;
    const logObj = data?.log || null;

    if (chatObj !== _lastChatObj) {
      _lastChatObj = chatObj;
      chatMessages = chatObj
        ? Object.values(chatObj)
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
            .slice(-80)
        : [];
    }

    if (logObj !== _lastLogObj) {
      _lastLogObj = logObj;
      logEntries = logObj
        ? Object.values(logObj)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 80)
        : [];
    }
  }

  $: if (notes !== null) localStorage.setItem("coup_notes", notes);

  $: if (coinSys && playerCoinRef) {
    coinSys.setDomRefs({ canvasEl: null, playerEl: playerCoinRef });
  }

  $: if (view === "game" && coinSys && treasuryBoxRef) {
    const rect = treasuryBoxRef.getBoundingClientRect();
    coinSys.updateBoxRect({ width: rect.width, height: rect.height });
  }

  $: currentPath = $location || "/";

  $: if (!isLoading && user) applyRoute(currentPath);

  // Cache opponent list+team counts
  $: {
    const data = roomData;
    const currentUserId = user?.uid;
    if (!data || !data.playerOrder || !data.players || !currentUserId) {
      opponentAliveIds = [];
      loyalistAliveCount = 0;
      reformistAliveCount = 0;
      opponentAliveCount = 0;
    } else {
      const nextOpponentIds = [];
      let nextLoyalist = 0;
      let nextReformist = 0;

      for (let i = 0; i < data.playerOrder.length; i++) {
        const playerId = data.playerOrder[i];
        const playerObj = data.players[playerId];
        if (!playerObj) continue;

        if (playerObj.alive) {
          if (data.mode && MODES[data.mode]?.hasTeams) {
            if (playerObj.faction === "loyalist") nextLoyalist++;
            if (playerObj.faction === "reformist") nextReformist++;
          }
        }

        if (playerId === currentUserId) continue;
        if (!playerObj.alive) continue;
        nextOpponentIds.push(playerId);
      }

      opponentAliveIds = nextOpponentIds;
      loyalistAliveCount = nextLoyalist;
      reformistAliveCount = nextReformist;
      opponentAliveCount = nextOpponentIds.length;
    }
  }

  const handleKey = (e, cb) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cb();
    }
  };

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function showToast(text, ms = 3000) {
    warningMsg = text;
    playSound("toast");
    if (warningTimer) clearTimeout(warningTimer);
    warningTimer = setTimeout(() => (warningMsg = null), ms);
  }

  const showWarning = (t) => showToast(t);
  const showError = (t) => showToast(t);

  function scheduleTreasuryRectUpdate() {
    if (!treasuryBoxRef || !coinSys) return;

    const now = performance.now();
    if (now - lastRectUpdate < 120) return;
    lastRectUpdate = now;

    if (rectUpdateRaf) cancelAnimationFrame(rectUpdateRaf);
    rectUpdateRaf = requestAnimationFrame(() => {
      if (!treasuryBoxRef || !coinSys) return;
      const rect = treasuryBoxRef.getBoundingClientRect();
      coinSys.updateBoxRect({ width: rect.width, height: rect.height });
    });
  }

  //Audio
  function setAmbienceVolume(v) {
    ambienceVolume = clamp01(v);
    localStorage.setItem("coup_amb_vol", String(ambienceVolume));
    ambienceEngine.setVolume(ambienceVolume);
    ambienceEngine.fadeTo(ambienceVolume, 220);
  }

  function toggleSfx() {
    sfxEnabled = !sfxEnabled;
    localStorage.setItem("coup_sfx_enabled", sfxEnabled ? "1" : "0");
    playSound("click");
  }

  function setSfxVolume(v) {
    sfxVolume = clamp01(v);
    localStorage.setItem("coup_sfx_vol", String(sfxVolume));
  }

  async function startAmbience() {
    if (ambienceStarted) return;
    ambienceStarted = true;

    if (!rainAudio || !fireAudio) return;

    rainAudio.loop = true;
    fireAudio.loop = true;

    rainAudio.volume = 0;
    fireAudio.volume = 0;

    setAmbienceVolume(ambienceVolume);

    try {
      await rainAudio.play();
      await fireAudio.play();

      const targetRain = ambienceEnabled ? ambienceVolume : 0;
      const targetFire = ambienceEnabled ? ambienceVolume * 0.85 : 0;

      const fadeMs = 700;
      const start = performance.now();

      const tick = () => {
        const t = clamp01((performance.now() - start) / fadeMs);
        rainAudio.volume = targetRain * t;
        fireAudio.volume = targetFire * t;
        if (t < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    } catch {
      ambienceStarted = false;
    }
  }

  function toggleAmbience() {
    ambienceEnabled = !ambienceEnabled;
    localStorage.setItem("coup_amb_enabled", ambienceEnabled ? "1" : "0");
    ambienceEngine.setEnabled(ambienceEnabled);
    ambienceEngine.fadeTo(ambienceEngine.volume, 420);
  }

  const _sfxPool = new Map();

  function playSound(key) {
    if (!sfxEnabled) return;

    const src = SOUNDS[key];
    if (!src) return;

    try {
      let arr = _sfxPool.get(src);
      if (!arr) _sfxPool.set(src, (arr = []));

      let a = arr.find((x) => x.paused || x.ended);
      if (!a) {
        a = new Audio(src);
        a.preload = "auto";
        arr.push(a);
        if (arr.length > 6) arr.shift();
      }

      //Normalized gain
      const perKey = SFX_PROFILE.perKey?.[key] ?? 0.85;
      const jitter = 1 + (Math.random() * 2 - 1) * (SFX_PROFILE.jitter ?? 0);
      const target = sfxVolume * (SFX_PROFILE.master ?? 1) * perKey * jitter;

      // limiter
      a.volume = Math.max(0, Math.min(SFX_PROFILE.limiterMax ?? 1, target));
      a.currentTime = 0;

      a.play().catch(() => {});
    } catch {}
  }

  // Routing
  function applyRoute(path) {
    if (path === "/") return (view = "menu");

    if (path === "/browser") {
      view = "browser";
      fetchLobbies();
      return;
    }

    if (path === "/rules") {
      view = "rules";
      openLazyPage("rules");
      return;
    }
    if (path === "/about") {
      view = "about";
      openLazyPage("about");
      return;
    }
    if (path === "/changelog") return (view = "changelog");

    if (path === "/join") return (view = "menu");
    if (path === "/create") return (view = "menu");

    const m = path.match(/^\/room\/([A-Za-z0-9]+)$/);
    if (m) return connectToRoom(m[1].toUpperCase());

    view = "menu";
  }

  async function copyRoomCode() {
    if (!roomId) return;

    playSound?.("click");

    try {
      await navigator.clipboard.writeText(roomId);
      showWarning?.(`COPIED: ${roomId}`);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = roomId;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);

      showWarning?.(`COPIED: ${roomId}`);
    }
  }

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
        .map((_, i) =>
          i < iter ? roleName[i] : chars[(Math.random() * chars.length) | 0]
        )
        .join("");

      decryptedText.desc = target.desc;

      if (iter >= roleName.length) clearInterval(decryptInterval);
      iter += 0.5;
    }, 30);
  }

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

  function toggleReady() {
    if (!roomId || !user) return;
    playSound("ready");

    const current = !!roomData?.ready?.[user.uid];
    set(ref(db, `rooms/${roomId}/ready/${user.uid}`), !current);
  }

  async function createGame() {
    if (!inputName) return showWarning(WARN.NEED_NAME);

    playSound("click");

    const code = Math.random().toString(36).slice(2, 8).toUpperCase();

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
      ready: {
        [user.uid]: true,
      },
    };

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

    const code = (codeOverride || inputCode).toUpperCase();
    const rRef = ref(db, `rooms/${code}`);
    const snap = await get(rRef);

    if (!snap.exists()) return showWarning(WARN.INVALID_COORDINATES);

    const d = snap.val();
    if (d.status !== "LOBBY") return showWarning(WARN.OPERATION_ACTIVE);
    if (d.playerOrder.length >= MODES[d.mode].maxPlayers)
      return showWarning(WARN.SQUAD_FULL);

    await update(ref(db, `rooms/${code}/players/${user.uid}`), {
      name: inputName,
      ready: true,
      presence: true,
    });

    await set(ref(db, `rooms/${code}/ready/${user.uid}`), false);

    await runTransaction(ref(db, `rooms/${code}/playerOrder`), (l) =>
      l ? [...l, user.uid] : [user.uid]
    );

    await update(ref(db, `public_lobbies/${code}`), {
      playerCount: d.playerOrder.length + 1,
    });

    connectToRoom(code);
  }

  function connectToRoom(code) {
    if (!code) return;
    code = code.toUpperCase();

    if (roomId === code && roomData) return;

    isLoading = true;
    loadingText = "LINKING TO ROOM...";

    if (roomListenerOff) roomListenerOff();

    roomId = code;

    const target = `/room/${code}`;
    if (currentPath !== target) routerPush(target);

    localStorage.setItem("coup_session", code);

    const pRef = ref(db, `rooms/${code}/players/${user.uid}/presence`);
    onDisconnect(pRef).set(false);
    set(pRef, true);

    let didFirstSnapshot = false;

    roomListenerOff = onValue(ref(db, `rooms/${code}`), (snap) => {
      const d = snap.val();

      if (!d) {
        leaveRoomLocalState();
        showWarning(WARN.CONNECTION_LOST);
        return;
      }

      if (!didFirstSnapshot) {
        didFirstSnapshot = true;
        isLoading = false;
      }

      roomData = d;
      rebuildChatAndLog(d);
      isHost = d.host === user.uid;
      me = d.players?.[user.uid] || null;

      realTreasury = d.treasury ?? 0;
      if (visualTreasury === null || visualTreasury === undefined)
        visualTreasury = realTreasury;

      if (d.pendingAction && d.pendingAction.status === "PENDING") {
        const act = d.pendingAction;

        const opponents = d.playerOrder.filter(
          (pid) => pid !== act.source && d.players?.[pid]?.alive
        );
        const votes = act.votes || {};
        const voterIds = Object.keys(votes);

        const allVoted = opponents.every((pid) => voterIds.includes(pid));
        const allAllowed = Object.values(votes).every((v) => v === "ALLOW");

        if (user.uid === act.source && allVoted && allAllowed) {
          resolveAction(act, false);
        }
      }

      if (d.status === "GAME_OVER") {
        view = "game_over";
        winnerName = d.winner;
        return;
      }

      view = d.status === "LOBBY" ? "lobby" : "game";

      if (view === "game" && me) {
        scheduleTreasuryRectUpdate();

        const tId = d.playerOrder[d.turnIndex % d.playerOrder.length];

        if (tId !== turnPlayerId && tId === user.uid) playSound("turn");

        turnPlayerId = tId;
        isMyTurn = turnPlayerId === user.uid && !d.pendingAction && me.alive;

        if (d.pendingAction) {
          lastActionText = `${d.players[d.pendingAction.source].name}: ${d.pendingAction.name}`;

          if (
            d.pendingAction.status === "EXCHANGING" &&
            d.pendingAction.source === user.uid &&
            exchangeSelection.length === 0
          ) {
            exchangeSelection = me.hand
              .map((c, i) => (c.alive && !c.isNew ? i : -1))
              .filter((i) => i !== -1);
          }
        }
      }
    });
  }

  function leaveRoomLocalState() {
    treasuryVisual = null;
    if (roomListenerOff) roomListenerOff();

    roomId = "";
    roomData = null;
    me = null;
    view = "menu";

    localStorage.removeItem("coup_session");
    routerPush("/");
  }

  async function startGame() {
    if (roomData.playerOrder.length < 2) return showWarning(WARN.NEED_2P);
    if (!allReady) return showWarning("ALL PLAYERS MUST BE READY.");

    playSound("click");

    const mode = MODES[roomData.mode];

    const deck = [];
    mode.roles.forEach((r) => {
      for (let i = 0; i < mode.deckSize; i++) deck.push(r);
    });

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const updates = {};
    const order = [...roomData.playerOrder];

    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    order.forEach((uid, i) => {
      updates[`players/${uid}/hand`] = [
        { type: deck.pop(), alive: true },
        { type: deck.pop(), alive: true },
      ];
      updates[`players/${uid}/coins`] = 2;
      updates[`players/${uid}/alive`] = true;

      if (mode.hasTeams)
        updates[`players/${uid}/faction`] =
          i % 2 === 0 ? "loyalist" : "reformist";
    });

    updates.status = "PLAYING";
    updates.deck = deck;
    updates.playerOrder = order;
    updates.turnIndex = 0;
    updates.treasury = 50 - order.length * 2;

    await update(ref(db, `rooms/${roomId}`), updates);
    remove(ref(db, `public_lobbies/${roomId}`));
  }

  function requestKick(uid, name) {
    if (!isHost) return;
    if (uid === user.uid) return;
    playSound("click");

    kickTargetId = uid;
    kickTargetName = name;
    showKickConfirm = true;
  }

  async function confirmKick() {
    if (!isHost) return;
    if (!kickTargetId) return;

    playSound("kick");

    const uid = kickTargetId;

    showKickConfirm = false;
    kickTargetId = null;

    await runTransaction(ref(db, `rooms/${roomId}`), (room) => {
      if (!room || !room.players) return room;
      if (room.status !== "LOBBY") return room;

      delete room.players[uid];
      room.playerOrder = (room.playerOrder || []).filter((id) => id !== uid);

      if (room.ready) delete room.ready[uid];

      if (room.host === uid) {
        room.host = room.playerOrder?.[0] || room.host;
      }

      return room;
    });

    showWarning?.(`REMOVED: ${kickTargetName}`);
  }

  function cancelKick() {
    playSound("click");
    showKickConfirm = false;
    kickTargetId = null;
    kickTargetName = "";
  }

  async function exitGame() {
    if (!roomId || !user) return;

    playSound("click");

    const roomRef = ref(db, `rooms/${roomId}`);

    try {
      await runTransaction(roomRef, (room) => {
        if (!room || !room.players) return null;

        delete room.players[user.uid];
        if (room.playerOrder)
          room.playerOrder = room.playerOrder.filter((id) => id !== user.uid);

        const remainingCount = room.playerOrder ? room.playerOrder.length : 0;

        if (remainingCount === 0) {
          remove(ref(db, `public_lobbies/${roomId}`));
          return null;
        }

        if (remainingCount === 1 && room.status === "PLAYING") {
          const winnerId = room.playerOrder[0];
          room.status = "GAME_OVER";
          room.winner = room.players[winnerId].name;
          remove(ref(db, `public_lobbies/${roomId}`));
          return room;
        }

        if (room.status === "LOBBY") {
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

  function prepAction(m) {
    if (!isMyTurn) {
      playSound("deny");
      return showWarning(WARN.WAIT_TURN);
    }

    if (me.coins < m.c) {
      playSound("deny");
      return showWarning(WARN.INSUFFICIENT_FUNDS);
    }

    if (m.c === 0 && me.coins >= 10 && m.id !== "Coup")
      return showWarning(WARN.MUST_COUP);

    playSound("click");

    if (m.target) {
      isTargeting = true;
      selectedMove = m;
      return;
    }

    commitAction(m, null);
  }

  function handleTarget(uid) {
    if (!isTargeting) return;
    if (uid === user.uid) return showWarning(WARN.CANNOT_TARGET_SELF);
    if (!roomData.players[uid].alive)
      return showWarning(WARN.TARGET_ELIMINATED);

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
        if (mates.length !== all) return showWarning(WARN.CANNOT_ATTACK_ALLY);
      }
    }

    if (selectedMove.id === "Inquisitor") {
      inquisitorAction = { target: uid, move: selectedMove };
      isTargeting = false;
      return;
    }

    commitAction(selectedMove, uid);
    isTargeting = false;
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

    if (m.c > 0) updates[`players/${user.uid}/coins`] = me.coins - m.c;
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

    await update(ref(db, `rooms/${roomId}`), updates);

    if (m.id === "Income" || m.id === "Convert") resolveAction(act, false);
  }

  //Voting / counteractions
  function vote(type) {
    if (!roomData.pendingAction) return;

    if (type === "ALLOW") {
      set(ref(db, `rooms/${roomId}/pendingAction/votes/${user.uid}`), "ALLOW");
      return;
    }

    if (type === "BLOCK") {
      let claim = "";
      const at = roomData.pendingAction.type;

      if (at === "Foreign Aid") claim = "Duke";
      if (at === "Steal") claim = "Captain";
      if (at === "Assassinate") claim = "Contessa";

      update(ref(db, `rooms/${roomId}/pendingAction`), {
        status: "BLOCKED",
        blocker: user.uid,
        blockerClaim: claim,
      });
      return;
    }

    if (type === "CHALLENGE_MOVE") {
      update(ref(db, `rooms/${roomId}/pendingAction`), {
        status: "CHALLENGED",
        challenger: user.uid,
        challengeTarget: roomData.pendingAction.source,
        claimToProve: roomData.pendingAction.claim,
      });
      return;
    }

    if (type === "CHALLENGE_BLOCK") {
      update(ref(db, `rooms/${roomId}/pendingAction`), {
        status: "CHALLENGED",
        challenger: user.uid,
        challengeTarget: roomData.pendingAction.blocker,
        claimToProve: roomData.pendingAction.blockerClaim,
      });
    }
  }

  // Cards/resolution
  async function handleCard(cIdx) {
    const act = roomData.pendingAction;

    if (!act) return openInspector(me.hand[cIdx].type);

    if (act.status === "CHALLENGED" && act.challengeTarget === user.uid) {
      const card = me.hand[cIdx];
      const claim = act.claimToProve;

      let valid = card.type === claim;

      if (act.type === "Steal" && claim === "Captain") {
        if (["Captain", "Ambassador", "Inquisitor"].includes(card.type))
          valid = true;
      }

      await runTransaction(ref(db, `rooms/${roomId}`), (room) => {
        if (!room) return;

        if (valid) {
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

      if (!valid) resolveDeath(cIdx, true);
      return;
    }

    if (act.status === "RESOLVING_DEATH" && act.target === user.uid) {
      resolveDeath(cIdx, false);
      return;
    }

    if (act.status === "EXCHANGING" && act.source === user.uid) {
      if (exchangeSelection.includes(cIdx)) {
        exchangeSelection = exchangeSelection.filter((i) => i !== cIdx);
        return;
      }

      const max = me.hand.filter((c) => c.alive && !c.isNew).length;
      if (exchangeSelection.length < max)
        exchangeSelection = [...exchangeSelection, cIdx];
      else showWarning(WARN.SELECT_CARDS(max));

      return;
    }

    if (act.status === "INQ_SHOWING" && act.target === user.uid) {
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

      p.hand[cIdx].alive = false;
      if (!p.hand.some((c) => c.alive)) p.alive = false;

      let proceed = false;

      if (failedBluff) {
        if (act.blocker === user.uid) {
          applyEffect(room, act);
          proceed = true;
        } else {
          if (act.type === "Assassinate") room.players[act.source].coins += 3;
          proceed = true;
        }
      } else if (act.proven) {
        if (act.blocker && act.challengeTarget === act.blocker) {
          if (act.type === "Assassinate") room.players[act.source].coins += 3;
          proceed = true;
        } else {
          applyEffect(room, act);
          proceed = true;
        }
      } else {
        proceed = true;
      }

      if (proceed) {
        if (
          (act.type === "Exchange" || act.type === "Inquisitor") &&
          !failedBluff &&
          !act.blocker
        ) {
        } else {
          room.pendingAction = null;
          advanceTurn(room);
        }
      }

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

    try {
      if (act.type === "Income") playSound("coin_gain");
      if (act.type === "Foreign Aid") playSound("coin_gain");
      if (act.type === "Tax") playSound("coin_gain");

      if (act.type === "Assassinate") playSound("assassinate");
      if (act.type === "Coup") playSound("coup");

      if (act.type === "Challenge") playSound("challenge");
      if (act.type === "Steal") playSound("coin_spend");
      if (act.type === "Convert") playSound("coin_spend");
    } catch {}

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

    if (act.type === "Assassinate" || act.type === "Coup") {
      room.pendingAction.status = "RESOLVING_DEATH";
      return;
    }

    room.pendingAction = null;
    advanceTurn(room);
  }

  async function finalizeExchange() {
    const max = me.hand.filter((c) => c.alive && !c.isNew).length;
    if (exchangeSelection.length !== max)
      return showWarning(WARN.MUST_KEEP(max));

    await runTransaction(ref(db, `rooms/${roomId}`), (room) => {
      if (!room) return;

      const p = room.players[user.uid];
      const keep = [];
      const ret = [];

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
    let idx = room.turnIndex;
    let attempts = 0;
    const len = room.playerOrder.length;

    while (attempts < len + 1) {
      idx = (idx + 1) % len;
      const uid = room.playerOrder[idx];
      if (room.players[uid] && room.players[uid].alive) {
        room.turnIndex = idx;
        break;
      }
      attempts++;
    }
  }

  function sendChat() {
    if (!inputChat) return;

    push(ref(db, `rooms/${roomId}/chat`), {
      sender: me.name,
      text: inputChat,
      timestamp: serverTimestamp(),
    });

    inputChat = "";
    playSound("click");
  }

  const navTo = (v) => {
    playSound("click");

    if (v === "menu") return routerPush("/");
    if (v === "browser") return routerPush("/browser");
    if (v === "rules") return routerPush("/rules");
    if (v === "about") return routerPush("/about");
    if (v === "changelog") return routerPush("/changelog");

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

  onMount(() => {
    if (!localStorage.getItem("coup_tutorial_seen")) showTutorial = true;

    document.documentElement.setAttribute("data-skin", currentSkin);

    if (canvasRef) {
      const ctx = canvasRef.getContext("2d");
      let w = window.innerWidth;
      let h = window.innerHeight;

      canvasRef.width = w;
      canvasRef.height = h;

      resizeHandler = () => {
        w = window.innerWidth;
        h = window.innerHeight;

        canvasRef.width = w;
        canvasRef.height = h;

        if (coinSys) {
          coinSys.w = window.innerWidth;
          coinSys.h = window.innerHeight;
        }

        scheduleTreasuryRectUpdate();
      };

      window.addEventListener("resize", resizeHandler, { passive: true });

      particles = [];
      for (let i = 0; i < 50; i++) particles.push(new Particle(w, h));

      let lastT = 0;

      const animate = (t) => {
        if (view === "rules" || view === "about" || view === "changelog") {
          particlesRAF = requestAnimationFrame(animate);
          return;
        }
        const frameCap = view === "game" ? 66 : 33;

        if (t - lastT < frameCap) {
          particlesRAF = requestAnimationFrame(animate);
          return;
        }

        lastT = t;

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

    coinSys = new CoinPhysics(window.innerWidth, window.innerHeight);
    coinSys.setDomRefs({ canvasEl: null, playerEl: playerCoinRef });

    const loop = () => {
      if (view === "game") {
        if (coinSys) {
          if (realTreasury !== visualTreasury) {
            const diff = realTreasury - visualTreasury;
            const step = Math.sign(diff) * Math.min(Math.abs(diff), 3);

            if (step > 0) {
              for (let k = 0; k < step; k++) coinSys.spawnCoinFromPlayer();
            } else if (step < 0) {
              for (let k = 0; k < -step; k++) coinSys.sendCoinToPlayer();
            }
            visualTreasury += step;
          }

          coinSys.update();
          const now = performance.now();
          if (now - lastCoinSync > 50) {
            lastCoinSync = now;
            vaultCoins = coinSys.coins;
          }
        }
      }

      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);

    const resizeObserver = new ResizeObserver(() => {
      if (treasuryBoxRef && coinSys) {
        const rect = treasuryBoxRef.getBoundingClientRect();
        coinSys.updateBoxRect({ width: rect.width, height: rect.height });
      }
    });

    const delayedObserverTimer = setTimeout(() => {
      if (treasuryBoxRef) resizeObserver.observe(treasuryBoxRef);
    }, 1000);

    onAuthStateChanged(auth, (u) => {
      if (u) {
        user = u;

        const saved = localStorage.getItem("coup_session");
        const hashPath = window.location.hash.replace(/^#/, "") || "/";

        isLoading = false;

        const match = hashPath.match(/^\/room\/([A-Za-z0-9]+)$/);
        const rid = match ? match[1].toUpperCase() : null;

        if (rid) return connectToRoom(rid);
        if (saved) return connectToRoom(saved.toUpperCase());

        applyRoute(hashPath);
        fetchLobbies();
        view = "menu";
        return;
      }

      signInAnonymously(auth).catch((e) => {
        console.error(LOG.AUTH_FAILED, e);
        showWarning(WARN.AUTH_FAIL);
      });
    });

    notes = localStorage.getItem("coup_notes") || "";

    const unlock = async () => {
      ambienceEngine.setRefs({ rain: rainAudio, fire: fireAudio });
      ambienceEngine.setEnabled(ambienceEnabled);
      ambienceEngine.setVolume(ambienceVolume);

      const ok = await ambienceEngine.start();

      if (ok) {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      }
    };

    const markActive = () => {
      lastActivityAt = Date.now();
    };

    window.addEventListener("pointermove", markActive, { passive: true });
    window.addEventListener("keydown", markActive, { passive: true });
    window.addEventListener("pointerdown", markActive, { passive: true });

    afkTimer = setInterval(() => {
      if (!roomData || view !== "game") return;
      if (!me?.alive) return;

      const now = Date.now();
      const idleMs = now - lastActivityAt;

      if (isMyTurn && idleMs > 10000 && idleMs < 12000) {
        showWarning("AFK WARNING - AUTO ACTION SOON.");
        playSound("toast");
      }

      if (isMyTurn && idleMs > 60000) {
        showWarning("AFK - AUTO PASS.");
        playSound("deny");
        const m = (roomData.mode === "BASE" ? MOVES_BASE : MOVES_REF).find(
          (x) => x.id === "Income"
        );
        if (m) prepAction(m);
        lastActivityAt = Date.now();
      }
    }, 2000);

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    const onVis = async () => {
      if (document.visibilityState === "visible") {
        if (ambienceEnabled) await ambienceEngine.start();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (roomListenerOff) roomListenerOff();
      if (lobbyListenerOff) lobbyListenerOff();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (mouseDownHandler)
        window.removeEventListener("mousedown", mouseDownHandler);

      if (particlesRAF) cancelAnimationFrame(particlesRAF);
      if (animFrame) cancelAnimationFrame(animFrame);

      if (decryptInterval) clearInterval(decryptInterval);
      if (rectUpdateRaf) cancelAnimationFrame(rectUpdateRaf);
      document.removeEventListener("visibilitychange", onVis);

      clearTimeout(delayedObserverTimer);

      if (rainAudio) {
        rainAudio.pause();
        rainAudio.currentTime = 0;
      }

      if (fireAudio) {
        fireAudio.pause();
        fireAudio.currentTime = 0;
      }

      try {
        resizeObserver.disconnect();
      } catch {}

      if (afkTimer) clearInterval(afkTimer);

      window.removeEventListener("pointermove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("pointerdown", markActive);

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  });
</script>

<div id="warning-toast" class:visible={warningMsg}>
  <Icon icon={CONF.ASSETS.ICONS.Warning} style="font-size:1.5rem;"></Icon>
  <span>{warningMsg}</span>
</div>

{#if !isLoading && (view === "lobby" || view === "game")}
  <div class="exit-btn-container">
    <button class="btn-exit" on:click={exitGame}>
      <Icon icon={CONF.ASSETS.ICONS.Exit} style="font-size:1.5rem;"></Icon>
      ABORT
    </button>

    <div class="sound-controls">
      <button
        class="btn-sound {sfxEnabled ? '' : 'off'}"
        aria-label="Toggle sound effects"
        on:click={toggleSfx}
      >
        {#if sfxEnabled}
          <Icon icon={ICONS.SoundOn}></Icon>
        {:else}
          <Icon icon={ICONS.SoundOff}></Icon>
        {/if}
      </button>

      <input
        class="sound-slider"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={sfxVolume}
        on:input={(e) => setSfxVolume(parseFloat(e.currentTarget.value))}
      />
    </div>
  </div>
{/if}

<main class:ready={!isLoading}>
  <audio
    bind:this={rainAudio}
    preload="auto"
    src={SOUNDS.rain_bg}
    loop
    playsinline
  ></audio>

  <audio
    bind:this={fireAudio}
    preload="auto"
    src={SOUNDS.fire_bg}
    loop
    playsinline
  ></audio>

  <canvas bind:this={canvasRef} id="particle-bg"></canvas>

  <div class="vignette"></div>

  {#if isLoading}
    <div id="loader-screen">
      <div class="spinner"></div>
      <div class="loader-text">{loadingText}</div>
    </div>
  {/if}

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
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if !isLoading && (view === "rules" || view === "about" || view === "changelog")}
    <div class="page-scene scene">
      {#if view === "rules" && RulesComp}
        <svelte:component this={RulesComp} on:close={() => navTo("menu")} />
      {/if}
      {#if view === "about" && AboutComp}
        <svelte:component this={AboutComp} on:close={() => navTo("menu")} />
      {/if}
    </div>
  {/if}

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

        <div class="panel comms-panel" style="margin-bottom: 1.5rem;">
          <div class="panel-header">
            <Icon icon={CONF.ASSETS.ICONS.Chat}></Icon> COMMS
          </div>

          <div id="chat-feed" style="max-height:240px;">
            {#if chatMessages.length}
              {#each chatMessages as m}
                <div class="chat-msg">
                  <span
                    class="author"
                    style="color:{m.sender === inputName
                      ? 'var(--jade-main)'
                      : 'var(--gold-main)'}">{m.sender}:</span
                  >
                  {m.text}
                </div>
              {/each}
            {:else}
              <div class="chat-msg" style="opacity:0.5;">
                <span class="author">SYS:</span> Lobby channel open.
              </div>
            {/if}
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

  {#if !isLoading && view === "lobby" && roomData}
    <div id="scene-lobby" class="scene">
      <div class="lobby-container">
        <div class="lobby-header">
          <h2>OPERATION CODE</h2>
          <button
            class="room-code"
            tabindex="0"
            title="Click to copy"
            on:click={copyRoomCode}
            on:keydown={(e) => handleKey(e, copyRoomCode)}
          >
            {roomId}
            <span class="copy-hint"
              ><Icon icon={CONF.ASSETS.ICONS.Copy}></Icon></span
            >
          </button>
        </div>

        <div class="lobby-panel">
          <h3>ACTIVE AGENTS</h3>
          <ul id="lobby-list">
            {#each roomData.playerOrder as uid}
              <li class:host={uid === roomData.host}>
                <span class="p-name">{roomData.players[uid].name}</span>

                <span class="p-badges">
                  {#if uid === roomData.host}
                    <Icon icon={CONF.ASSETS.ICONS.User}></Icon>
                  {/if}

                  {#if roomData.players[uid].presence}
                    <div class="circle-presence green"></div>
                  {:else}
                    <div class="circle-presence red"></div>
                  {/if}
                  {#if isHost && uid !== user.uid}
                    <button
                      class="icon-btn"
                      style="width:42px; height:42px;"
                      title="Remove player"
                      on:click={() =>
                        requestKick(uid, roomData.players[uid].name)}
                    >
                      <Icon icon={CONF.ASSETS.ICONS.Kick}></Icon>
                    </button>
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
        </div>

        <button
          class="btn-secondary"
          style="margin-bottom: 14px;"
          on:click={toggleReady}
        >
          {#if roomData.ready?.[user.uid]}
            <div class="ready">READY</div>
          {:else}
            <div class="not-ready">NOT READY</div>
          {/if}
        </button>

        {#if isHost}
          <button class="btn-main" on:click={startGame} disabled={!allReady}>
            {allReady ? "EXECUTE" : "WAITING FOR ALL READY"}
          </button>
        {:else}
          <div class="loader-text" style="font-size:1rem;">
            {allReady ? "AWAITING HOST COMMAND..." : "READY UP TO START..."}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if !isLoading && view === "game" && roomData && me}
    {@const playerCount = roomData?.playerOrder?.length || 0}
    {@const oppCount = opponentAliveCount}
    <div
      id="scene-game"
      class="scene"
      class:targeting-active={isTargeting}
      style:--ambient={MODES[roomData.mode].hasTeams &&
      loyalistAliveCount > reformistAliveCount
        ? "var(--jade-dim)"
        : "var(--flame-dim)"}
      style="--pcount: {playerCount};
    --handScale: {playerCount >= 7 ? 0.78 : playerCount >= 6 ? 0.84 : 1};
    --handCardW: {playerCount >= 7 ? 108 : playerCount >= 6 ? 122 : 140}px;"
    >
      <div class="top-bar">
        <div class="last-action">LAST: {lastActionText}</div>
        <div class="turn-ind" class:my-turn={isMyTurn}>
          {turnPlayerId === user.uid
            ? "YOUR TURN"
            : `${roomData.players[turnPlayerId].name}'S TURN`}
        </div>
        <div></div>
      </div>

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
              {/each}
            {/if}
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
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <div class="game-col center-col">
        <div class="table-stats">
          <div class="stat-box stat-vault" bind:this={treasuryBoxRef}>
            <div class="vault-shell">
              <div class="vault-coin-layer">
                {#if coinSys}
                  {#each vaultCoins as c (c.id)}
                    <div
                      class="coin"
                      style="
              left: {c.x}px;
              top: {c.y}px;
              transform: translate(-50%, -50%) rotate({c.angle ||
                        0}rad) scale({c.scale || 1});
              opacity: {c.opacity ?? 1};
            "
                    ></div>
                  {/each}
                {/if}
              </div>

              <div class="vault-top-glass"></div>
              <div class="vault-inner-tray"></div>
              <div class="vault-depth"></div>
              <div class="vault-shine"></div>

              <div class="vault-content">
                <span class="label">TREASURY</span>
                <span class="value">{visualTreasury}</span>
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

        <div class="table-arena">
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

          <div
            class="opponent-grid"
            data-count={oppCount}
            class:compact={oppCount >= 6}
            class:ultra={oppCount >= 8}
          >
            {#each opponentAliveIds as uid (uid)}
              {@const p = roomData.players[uid]}

              <button
                class="opponent-plate threat-{getThreatLevel(p)}"
                class:active-turn={turnPlayerId === uid}
                class:is-targetable={isTargeting && selectedMove?.target}
                on:click={() => handleTarget(uid)}
                on:keydown={(e) => handleKey(e, () => handleTarget(uid))}
                aria-label={"Target " + p.name}
                type="button"
              >
                <div class="opp-header">
                  {#if MODES[roomData.mode].hasTeams}
                    <div class="opp-faction-dot {p.faction}"></div>
                  {/if}
                  <div class="opp-name">{p.name}</div>
                </div>

                <div class="opp-stats">
                  <Icon icon={CONF.ASSETS.ICONS.Income}></Icon>
                  {p.coins}
                </div>

                <div class="opp-cards-row">
                  {#each p.hand as c}
                    {#if c.alive}
                      <div class="mini-card-back"></div>
                    {/if}
                  {/each}
                </div>
              </button>
            {/each}
          </div>
        </div>

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
            {:else if act.status === "INQ_SHOWING" && act.target === user.uid}
              <div class="decision-title">INQUISITION</div>
              <div class="decision-desc flash red">CLICK CARD TO REVEAL</div>
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
            {:else if act.status === "CHALLENGED"}
              <div class="decision-title">CHALLENGE ISSUED</div>
              <div class="decision-desc">
                {roomData.players[act.challenger].name} challenges {roomData
                  .players[act.challengeTarget].name}!
              </div>
              {#if act.challengeTarget === user.uid}
                <span class="flash gold">REVEAL A CARD</span>
              {:else}
                <span>WITNESSING TRIBUNAL...</span>
              {/if}
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

        {#if isTargeting && selectedMove && !inquisitorAction}
          <div id="decision-center" class="danger">
            <div class="decision-title">TARGETING MODE</div>
            <div class="decision-desc">
              Selected: <strong>{selectedMove.n}</strong> - choose a target.
            </div>

            <div class="decision-actions">
              <button class="btn-decision block" on:click={cancelTarget}>
                <Icon icon={CONF.ASSETS.ICONS.Cross}></Icon>
                UNDO
              </button>
            </div>
          </div>
        {/if}

        <div id="my-dashboard">
          {#if me.alive}
            <div class="hand-dock">
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
                <div class="coin-display" bind:this={playerCoinRef}>
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
                  {#if m.c}
                    <span class="tac-cost loss">-{m.c}</span>
                  {:else if m.g}
                    <span class="tac-cost gain">+{m.g}</span>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

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

  {#if showNotes && view === "game"}
    <div class="notes-app">
      <div class="notes-header">CLASSIFIED NOTES</div>
      <textarea bind:value={notes} placeholder="Record observations here..."
      ></textarea>
    </div>
  {/if}

  {#if view === "game"}
    <button class="fab-notes" on:click={() => (showNotes = !showNotes)}>
      <Icon icon={CONF.ASSETS.ICONS.Notebook}></Icon>
    </button>
  {/if}

  {#if showKickConfirm}
    <div class="modal-overlay" on:click={cancelKick} aria-hidden="true">
      <div
        class="modal-card"
        role="button"
        tabindex="0"
        on:click|stopPropagation
        on:keydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.currentTarget.click();
          }
        }}
      >
        <div class="modal-title">CONFIRM EXTRACTION</div>
        <div class="modal-text">
          Remove <strong>{kickTargetName}</strong> from the lobby?
          <br />
          They will be disconnected instantly.
        </div>

        <div class="modal-actions">
          <button class="btn-decision allow" on:click={cancelKick}>
            <Icon icon={CONF.ASSETS.ICONS.Cross}></Icon>
            CANCEL
          </button>

          <button class="btn-decision block" on:click={confirmKick}>
            REMOVE
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>
