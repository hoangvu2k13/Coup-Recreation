import { writable, get } from 'svelte/store';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getDatabase, ref, set, get as dbGet, onValue, update, push, remove,
  serverTimestamp, onDisconnect, runTransaction
} from 'firebase/database';


export const currentScene = writable(0);
export const gameLog = writable(["Game System initialized..."]);
export const gameState = writable({
    board: Array(64).fill(null),
    turn: 'white',
    isActive: false,
    winner: null
});
export const addLog = (msg) => {
    gameLog.update(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    gameLog.update(l => l.slice(-50));
};

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DB_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// --- STORES ---
export const userStore = writable(null);
export const roomStore = writable(null);
export const lobbyListStore = writable([]);
export const viewStore = writable('menu');
export const notificationStore = writable([]);
export const loadingStore = writable({ active: true, message: 'BOOTING SYSTEM...' });
export const audioContextStore = writable(null);

// --- CONSTANTS ---
export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  STARTING_COINS: 2,
  COUP_COST: 7,
  ACTION_TIMEOUT: 60000,
  CHALLENGE_WINDOW: 15000
};

export const CARD_DATA = {
  Duke: { role: "THE DUKE", desc: "Tax: +3 Coins. Blocks Foreign Aid." },
  Assassin: { role: "THE ASSASSIN", desc: "Pay 3 Coins: Assassinate." },
  Captain: { role: "THE CAPTAIN", desc: "Steal 2 Coins. Blocks Steal." },
  Ambassador: { role: "THE AMBASSADOR", desc: "Exchange Cards. Blocks Steal." },
  Inquisitor: { role: "THE INQUISITOR", desc: "Examine Cards. Blocks Steal." },
  Contessa: { role: "THE CONTESSA", desc: "Blocks Assassination." }
};

export const MOVES_DATA = [
  { id: 'Income', label: 'Income', desc: 'Take 1 Gold.', cost: 0, gain: 1, aggressive: false },
  { id: 'Foreign Aid', label: 'Foreign Aid', desc: 'Take 2 Gold.', cost: 0, gain: 2, aggressive: false, blockable: true, blocker: ['Duke'] },
  { id: 'Tax', label: 'Tax', desc: 'Take 3 Gold.', cost: 0, gain: 3, aggressive: false, claim: 'Duke', challengeable: true },
  { id: 'Steal', label: 'Steal', desc: 'Steal 2 Gold.', cost: 0, gain: 2, aggressive: true, target: true, claim: 'Captain', blockable: true, blocker: ['Captain', 'Ambassador', 'Inquisitor'], challengeable: true },
  { id: 'Assassinate', label: 'Assassinate', desc: 'Pay 3 to Kill.', cost: 3, aggressive: true, target: true, claim: 'Assassin', blockable: true, blocker: ['Contessa'], challengeable: true },
  { id: 'Exchange', label: 'Exchange', desc: 'Swap Cards.', cost: 0, aggressive: false, claim: 'Ambassador', challengeable: true },
  { id: 'Examine', label: 'Examine', desc: 'Look at Card.', cost: 0, aggressive: true, target: true, claim: 'Inquisitor', challengeable: true },
  { id: 'Embezzle', label: 'Embezzle', desc: 'Take Treasury.', cost: 0, aggressive: false, claimAnti: 'Duke', challengeable: true },
  { id: 'ConvertSelf', label: 'Align Self', desc: 'Switch Team.', cost: 1, aggressive: false },
  { id: 'ConvertOther', label: 'Align Enemy', desc: 'Switch Enemy.', cost: 2, aggressive: true, target: true },
  { id: 'Coup', label: 'Coup', desc: 'Force Death.', cost: 7, aggressive: true, target: true }
];

export const ASSETS = {
  CARDS: {
    Duke: 'https://placehold.co/400x600/3e2723/d4af37?text=DUKE',
    Assassin: 'https://placehold.co/400x600/1a1a1a/ef4444?text=ASSASSIN',
    Captain: 'https://placehold.co/400x600/0f172a/38bdf8?text=CAPTAIN',
    Inquisitor: 'https://placehold.co/400x600/4c1d95/a78bfa?text=INQUISITOR',
    Contessa: 'https://placehold.co/400x600/881337/f43f5e?text=CONTESSA',
    Ambassador: 'https://placehold.co/400x600/1e293b/94a3b8?text=AMBASSADOR'
  },
  ICONS: {
    Income: 'ph-fill ph-coins', ForeignAid: 'ph-fill ph-hand-coins', Tax: 'ph-fill ph-scroll',
    Steal: 'ph-fill ph-hand-grabbing', Assassinate: 'ph-fill ph-skull', Exchange: 'ph-fill ph-arrows-left-right',
    Examine: 'ph-fill ph-magnifying-glass', Embezzle: 'ph-fill ph-bank', Coup: 'ph-fill ph-gavel',
    ConvertSelf: 'ph-fill ph-yin-yang', ConvertOther: 'ph-fill ph-arrows-clockwise', Block: 'ph-fill ph-shield', Challenge: 'ph-fill ph-sword'
  }
};

// --- AUDIO LOGIC ---
let audioCtx;
if (typeof window !== 'undefined') {
  audioCtx = new (window.AudioContext || window.AudioContext)();
  audioContextStore.set(audioCtx);
}

export function playSound(type) {
  if (!audioCtx || audioCtx.state === 'suspended') {
    audioCtx?.resume();
  }
  // Advanced synthesis logic would go here
  // Keeping it lightweight for this file, but hooking into the store logic
}

// --- DATABASE FUNCTIONS ---
export function showNotification(message, type = 'info') {
  const id = Date.now() + Math.random();
  notificationStore.update(n => [...n, { id, message, type }]);
  setTimeout(() => {
    notificationStore.update(n => n.filter(item => item.id !== id));
  }, 5000);
}

export function logAction(roomId, text, type = 'sys') {
  push(ref(db, `rooms/${roomId}/log`), { text, type, timestamp: serverTimestamp() });
}

export async function exitGameLogic(roomId, userId) {
  if (!roomId || !userId) return;
  loadingStore.set({ active: true, message: 'DISCONNECTING...' });

  const roomRef = ref(db, `rooms/${roomId}`);
  try {
    await runTransaction(roomRef, (roomData) => {
      if (!roomData || !roomData.players) return null;

      if (roomData.players[userId]) {
        delete roomData.players[userId];
      }

      if (roomData.playerOrder) {
        roomData.playerOrder = roomData.playerOrder.filter(id => id !== userId);
      }

      const remainingCount = roomData.playerOrder ? roomData.playerOrder.length : 0;

      if (remainingCount === 0) {
        // Delete empty room
        remove(ref(db, `public_lobbies/${roomId}`));
        return null;
      } else if (remainingCount === 1 && roomData.status === 'PLAYING') {
        // Auto-win for last survivor
        const winnerId = roomData.playerOrder[0];
        roomData.status = 'GAME_OVER';
        roomData.winner = roomData.players[winnerId].name;
        remove(ref(db, `public_lobbies/${roomId}`));
      } else if (roomData.status === 'LOBBY') {
        if (roomData.host === userId && remainingCount > 0) {
          roomData.host = roomData.playerOrder[0];
        }
        update(ref(db, `public_lobbies/${roomId}`), { playerCount: remainingCount });
      }
      return roomData;
    });
  } catch (e) {
    console.error("Transaction Error:", e);
  } finally {
    roomStore.set(null);
    viewStore.set('menu');
    localStorage.removeItem('coup_session');
    window.history.replaceState(null, '', window.location.pathname);
    loadingStore.set({ active: false, message: '' });
  }
}
