import GameShell from "../pages/GameShell.svelte";
import NotFound from "../pages/NotFound.svelte";

export default {
  "/": GameShell,

  "/create": GameShell,
  "/join": GameShell,
  "/browser": GameShell,

  "/room/:code": GameShell,

  "/rules": GameShell,
  "/about": GameShell,
  "/changelog": GameShell,

  "*": NotFound,
};
