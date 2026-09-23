<script>
  import { M } from '$lib/city.js'
  import { BOROUGHS, mark, howFar } from '$lib/filter.js'

  let { rows, counts, query = $bindable(), borough, chosen, onpick, onpeek,
        onborough, onclear, onlocate, locating, located } = $props()

  let segs = $state([])
  let thumb = $state(null)
  let listEl = $state(null)

  const label = (b) => (b === 'Staten Island' ? 'Staten Is.' : b)
  const chips = [{ key: null, text: 'All' }, ...BOROUGHS.map((b) => ({ key: b, text: label(b) }))]

  /* One pill slides between the chips, in both directions. */
  $effect(() => {
    borough
    const i = chips.findIndex((c) => c.key === borough)
    const el = segs[i]
    if (!el || !thumb) return
    thumb.style.width = el.offsetWidth + 'px'
    thumb.style.height = el.offsetHeight + 'px'
    thumb.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`
  })

  /* Exactly one row is reachable by Tab: the chosen one, or the first. */
  $effect(() => {
    rows
    chosen
    if (!listEl) return
    const all = listEl.querySelectorAll('.row')
    for (const r of all) r.tabIndex = -1
    const one = listEl.querySelector('.row.on') || all[0]
    if (one) one.tabIndex = 0
  })

  export function scrollTo(id) {
    listEl?.querySelector(`.row[data-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
</script>

<aside id="panel" class="glass">
  <header class="masthead">
    <div>
      <h1 class="wordmark display"><svg class="mark" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7.4" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".42" />
        <circle cx="10" cy="10" r="2.9" fill="currentColor" />
      </svg>Museo</h1>
      <p class="sub">The five boroughs</p>
    </div>
    <div class="tally">
      <span class="tally-n display tnum">{rows.length}</span>
      <span class="micro tally-l">{rows.length === M.length ? 'Museums' : `of ${M.length}`}</span>
    </div>
  </header>

  <div class="controls">
    <div class="seek">
      <label class="search" class:has-text={query}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <input id="q" type="search" placeholder="Search museums, neighborhoods" autocomplete="off"
               spellcheck="false" aria-label="Search museums" bind:value={query} />
        <button type="button" id="clear" aria-label="Clear search" onclick={onclear}>
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="currentColor" opacity=".28" />
            <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </label>
      <button type="button" id="near" class="near" aria-pressed={located} data-busy={locating || undefined}
              aria-label="Sort by distance from where I am" onclick={onlocate}>
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M8 1.6v1.5M8 12.9v1.5M14.4 8h-1.5M3.1 8H1.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="8" cy="8" r="4" stroke="currentColor" stroke-width="1.5" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        </svg>
      </button>
    </div>

    <div class="segmented" role="tablist" aria-label="Filter by borough">
      <span class="thumb" bind:this={thumb}></span>
      {#each chips as c, i (c.text)}
        <button type="button" class="seg" role="tab" data-b={c.key}
                aria-selected={borough === c.key}
                disabled={counts[c.key ?? 'All'] === 0 && borough !== c.key}
                style:opacity={counts[c.key ?? 'All'] === 0 && borough !== c.key ? 0.35 : undefined}
                bind:this={segs[i]} onclick={() => onborough(c.key)}>
          {c.text}<span class="n">{counts[c.key ?? 'All']}</span>
        </button>
      {/each}
    </div>
  </div>

  <div id="list" role="listbox" aria-label="Museums" tabindex="-1" bind:this={listEl}>
    {#if rows.length === 0}
      <div class="empty">
        Nothing matches.
        <button type="button" onclick={onclear}>Clear filters</button>
      </div>
    {:else}
      {#each rows as m (m.i)}
        <button type="button" class="row" class:on={m.i === chosen} data-id={m.i}
                role="option" aria-selected={m.i === chosen} tabindex="-1"
                onclick={() => onpick(m.i)}
                onpointerenter={() => onpeek(m.i, true)}
                onpointerleave={() => onpeek(m.i, false)}>
          <div class="row-n">{@html mark(m.n, query)}</div>
          <div class="row-m"><span class="row-h">{@html mark(m.h || m.b, query)}</span> · {@html mark(m.a, query)}</div>
          {#if located}<div class="row-d">{howFar(m._mi)}</div>{/if}
        </button>
      {/each}
    {/if}
  </div>

  <div class="hint">
    <span><kbd>/</kbd> search</span>
    <span><kbd>↑</kbd><kbd>↓</kbd> browse</span>
    <span><kbd>esc</kbd> clear</span>
  </div>
</aside>
