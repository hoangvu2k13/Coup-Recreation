import {
  ref,
  get,
  update,
  onValue,
  runTransaction,
  remove,
  onDisconnect,
  set,
} from "firebase/database";
import { db } from "./firebase";

export const CONF = {
  PATHS: {
    ROOMS: "rooms",
    LOBBIES: "public_lobbies",
  },
  TIMINGS: {
    ACTION_TIMEOUT: 60000,
  },
};

export async function createRoom({ userId, name, mode }) {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  const initData = {
    status: "LOBBY",
    host: userId,
    mode,
    players: {
      [userId]: { name, ready: true, presence: true, coins: 0 },
    },
    playerOrder: [userId],
    treasury: 0,
    createdAt: Date.now(),
  };

  await update(ref(db), {
    [`${CONF.PATHS.ROOMS}/${code}`]: initData,
    [`${CONF.PATHS.LOBBIES}/${code}`]: {
      hostName: name,
      playerCount: 1,
      mode,
      status: "LOBBY",
    },
  });

  return code;
}

export async function joinRoom({ userId, name, code }) {
  const roomRef = ref(db, `${CONF.PATHS.ROOMS}/${code}`);
  const snap = await get(roomRef);

  if (!snap.exists()) throw new Error("Room not found");
  const d = snap.val();

  if (d.status !== "LOBBY") throw new Error("Room already started");

  await update(ref(db, `${CONF.PATHS.ROOMS}/${code}/players/${userId}`), {
    name,
    ready: true,
    presence: true,
  });

  await runTransaction(ref(db, `${CONF.PATHS.ROOMS}/${code}/playerOrder`), (l) =>
    l ? [...l, userId] : [userId]
  );

  await update(ref(db, `${CONF.PATHS.LOBBIES}/${code}`), {
    playerCount: (d.playerOrder?.length || 0) + 1,
  });

  return true;
}

export function listenRoom(code, callback) {
  const roomRef = ref(db, `${CONF.PATHS.ROOMS}/${code}`);
  const off = onValue(roomRef, (snap) => callback(snap.val()));
  return off;
}

export function setupPresence(code, userId) {
  const pRef = ref(db, `${CONF.PATHS.ROOMS}/${code}/players/${userId}/presence`);
  onDisconnect(pRef).set(false);
  set(pRef, true);
}

export async function leaveRoom({ code, userId }) {
  const roomRef = ref(db, `${CONF.PATHS.ROOMS}/${code}`);

  await runTransaction(roomRef, (room) => {
    if (!room || !room.players) return null;

    delete room.players[userId];

    if (room.playerOrder) {
      room.playerOrder = room.playerOrder.filter((id) => id !== userId);
    }

    const remaining = room.playerOrder?.length || 0;

    if (remaining === 0) {
      remove(ref(db, `${CONF.PATHS.LOBBIES}/${code}`));
      return null;
    }

    if (room.host === userId) {
      room.host = room.playerOrder[0];
    }

    return room;
  });
}
