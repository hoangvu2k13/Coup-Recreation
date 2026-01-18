<script>
  import { push } from "svelte-spa-router";
  export let to = "/";
</script>

<button class="icon-btn" aria-label="Close" on:click={() => push(to)}>
  ✕
</button>

<style>
  .icon-btn {
    background: transparent;
    border: none;
    font-size: 24px;
    cursor: pointer;
    opacity: 0.85;
  }
  .icon-btn:hover {
    opacity: 1;
    transform: scale(1.05);
  }
</style>
