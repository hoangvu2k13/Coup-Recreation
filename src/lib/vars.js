export const Vars = {
  // Core Auth/navigation
  user: null,
  view: "menu",
  isLoading: true,
  loadingText: "INITIALIZING SECURE CONNECTION...",

  // Inputs
  inputName: "",
  inputCode: "",
  inputChat: "",
  selectedMode: "BASE",

  // Game data
  roomId: "",
  roomData: null,
  isHost: false,
  me: null,
  turnPlayerId: null,
  isMyTurn: false,
  publicLobbies: [],
  lobbyListenerOff: null,

  // UI/UX state
  isTargeting: false,
  selectedMove: null,
  inspectorCard: null,
  decryptedText: { role: "", desc: "" },
  showNotes: false,
  notes: "",
  warningMsg: null,
  warningTimer: null,
  winnerName: "",
  lastActionText: "AWAITING ORDERS...",

  exchangeSelection: [],
  inquisitorAction: null,

  // System References
  audioCtx: null,
  coinSys: null,
  coinCanvas: null,
  animFrame: 0,
  particles: [],
  particleCanvas: null,
  particleFrame: 0,
  canvasRef: null,
  roomListenerOff: null,

  treasuryBoxRef: null,
  roomListener: null,

  resizeHandler: null,
  mouseDownHandler: null,
  rectUpdateRaf: 0,
  lastRectUpdate: 0,

  decryptInterval: null,

  chatMessages: [],
  logEntries: [],

  particlesRAF: 0,

  deckHover: false,
  deckScatter: [],
};
