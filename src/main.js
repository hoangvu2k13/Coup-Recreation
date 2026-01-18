import { mount } from "svelte";
import "./app.css";
import App from "./pages/GameShell.svelte";

const target = document.getElementById("app");

if (!target) {
  throw new Error(
    "[main.js] Missing #app root element. Check index.html for <div id='app'></div>."
  );
}

const app = mount(App, { target });

export default app;
