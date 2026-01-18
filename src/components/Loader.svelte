<script>
  export let text = "LOADING...";
</script>

<div class="loader-wrap">
  <div class="spinner"></div>
  <div class="loader-text">{text}</div>
</div>

<style>
  .loader-wrap {
    display: grid;
    place-items: center;
    min-height: 50vh;
    gap: 16px;
  }
  .spinner {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.95);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .loader-text {
    opacity: 0.8;
    letter-spacing: 0.08em;
  }
</style>
