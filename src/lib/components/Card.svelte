<script>
  let { museum, onclose } = $props()
  const maps = (m) => `https://maps.apple.com/?q=${encodeURIComponent(m.n)}&ll=${m.lat},${m.lng}`
</script>

<section id="card" class="glass" class:show={!!museum} aria-live="polite">
  {#if museum}
    <div class="card-top">
      <h2 class="card-n display">{museum.n}</h2>
      <button class="card-x" type="button" aria-label="Close" onclick={onclose}>
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <div class="card-tags">
      <span class="tag accent">{museum.c}</span>
      <span class="tag">{museum.b}</span>
      {#if museum.h}<span class="tag">{museum.h}</span>{/if}
    </div>
    <p class="card-a">{museum.f}</p>
    <div class="card-do">
      {#if museum.u}
        <a class="btn btn-1" href={museum.u} target="_blank" rel="noopener noreferrer">Visit site</a>
      {:else}
        <span class="btn btn-1" aria-disabled="true">No website</span>
      {/if}
      <a class="btn btn-2" href={maps(museum)} target="_blank" rel="noopener noreferrer">Directions</a>
    </div>
  {/if}
</section>
