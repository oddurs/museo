<script>
  import { onMount } from 'svelte'
  import { M, LAND } from '$lib/city.js'
  import { BOROUGHS, select, counts as facet } from '$lib/filter.js'
  import { app } from '$lib/state.svelte.js'
  import * as map from '$lib/map.js'
  import Panel from '$lib/components/Panel.svelte'
  import Card from '$lib/components/Card.svelte'

  let stage = $state({})
  let panel = $state(null)
  let locating = $state(false)
  let cursor = 0

  const rows = $derived(select(app.query, app.borough, app.here))
  const counts = $derived(facet(app.query))
  const museum = $derived(app.chosen ? M.find((m) => m.i === app.chosen) : null)

  /* ── the view in the address bar ──────────────────────────────────
     A view you cannot send to someone, or reload, is not really a view.
     Where you are is deliberately not in it: that belongs to the device,
     and a shared link should not make someone else's browser ask. */
  function writeURL() {
    const q = new URLSearchParams()
    if (app.query) q.set('q', app.query)
    if (app.borough) q.set('b', app.borough)
    if (app.chosen) q.set('m', app.chosen)
    const target = q.toString() ? `${location.pathname}?${q}` : location.pathname
    if (target !== location.pathname + location.search) history.replaceState(null, '', target)
  }

  function readURL() {
    const q = new URLSearchParams(location.search)
    app.query = (q.get('q') || '').trim()
    const b = q.get('b')
    app.borough = BOROUGHS.includes(b) ? b : null
    const m = q.get('m')
    return M.some((x) => x.i === m) ? m : null
  }

  /* ── selection ─────────────────────────────────────────────────── */

  function pick(id, { fly = true } = {}) {
    app.chosen = id
    document.body.classList.toggle('picked', !!id)
    map.setChosen(id)
    if (!id) return
    cursor = rows.findIndex((m) => m.i === id)
    if (fly) map.flyTo(M.find((m) => m.i === id))
    else panel?.scrollTo(id)
  }

  function step(d) {
    if (!rows.length) return
    cursor = Math.min(rows.length - 1, Math.max(0, cursor + d))
    const m = rows[cursor]
    const inList = document.getElementById('list')?.contains(document.activeElement)
    pick(m.i, { fly: false })
    panel?.scrollTo(m.i)
    if (inList) document.querySelector(`.row[data-id="${CSS.escape(m.i)}"]`)?.focus({ preventScroll: true })
    map.flyTo(m, 640)
  }

  function clearAll() {
    app.query = ''
    app.borough = null
    pick(null)
    document.getElementById('q')?.focus()
  }

  function locate() {
    if (app.here) { app.here = null; map.setHere(null); return }
    if (!navigator.geolocation) return
    locating = true
    navigator.geolocation.getCurrentPosition(
      (p) => {
        locating = false
        const { latitude: lat, longitude: lng } = p.coords
        app.here = { lat, lng, ...map.projectPoint(lat, lng) }
        map.setHere(app.here)
      },
      () => { locating = false },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }

  /* ── wiring ────────────────────────────────────────────────────── */

  onMount(() => {
    const asked = readURL()
    map.mount({
      ...stage, land: LAND, panel: document.getElementById('panel'), card: document.getElementById('card'),
      onSelect: (id) => pick(id, { fly: false }),
      onPeek: (id, on) => {
        map.peek(id, on)
        document.querySelector(`.row[data-id="${CSS.escape(id)}"]`)?.classList.toggle('peek', on)
      },
    })
    // A link may have arrived already filtered, so open on what it asks
    // for rather than on the whole city.
    if (asked) { pick(asked, { fly: false }); map.jumpTo(M.find((m) => m.i === asked)) }
    else if (app.query || app.borough) map.fitTo(rows, 0)
  })

  // the pins show what the index shows
  $effect(() => { map.setVisible(new Set(rows.map((m) => m.i))) })
  $effect(() => { map.setLit(app.borough) })
  $effect(() => { app.query; app.borough; app.chosen; writeURL() })

  let firstRefit = true
  $effect(() => {
    app.query; app.borough
    if (firstRefit) { firstRefit = false; return }
    map.fitTo(rows)
  })

  function onkeydown(e) {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)
    if (e.key === '/' && !typing) { e.preventDefault(); document.getElementById('q')?.focus(); return }
    if (e.key === 'Escape') { app.chosen ? pick(null) : clearAll(); return }
    if (typing && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    if (e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    if (e.key === 'Enter' && museum?.u) window.open(museum.u, '_blank', 'noopener')
  }

  function onresize() {
    map.relayout()
    if (museum) map.flyTo(museum, 260)
    else map.fitTo(rows, 260)
  }
</script>

<svelte:head>
  <title>Museo — Museums of New York City</title>
  <meta name="description" content="An index of the 107 museums of the five boroughs, on a drawn map of the city after dark." />
</svelte:head>

<svelte:window {onkeydown} {onresize} />

<div id="stage">
  <canvas id="base" aria-hidden="true" bind:this={stage.canvas}></canvas>
  <svg id="map" role="img" aria-label="New York City, with a point at each museum" bind:this={stage.svg}>
    <g id="scene" bind:this={stage.scene}>
      <g id="pins" bind:this={stage.pins}>
        <g id="seps" bind:this={stage.seps}></g>
        <g id="dots" bind:this={stage.dots}></g>
        <g id="hits" bind:this={stage.hits}></g>
      </g>
    </g>
  </svg>
</div>

<div class="scale" aria-hidden="true">
  <div class="scale-bar"><i bind:this={stage.scaleBar}></i><b bind:this={stage.scaleTxt}>1 mile</b></div>
  <p class="scale-note">Zoom in for streets</p>
</div>

<Panel bind:this={panel} {rows} {counts} bind:query={app.query} borough={app.borough} chosen={app.chosen}
       {locating} located={!!app.here}
       onpick={(id) => pick(id)}
       onpeek={(id, on) => { map.peek(id, on) }}
       onborough={(b) => { app.borough = b }}
       onclear={clearAll}
       onlocate={locate} />

<Card {museum} onclose={() => pick(null)} />

<div id="zoom" class="glass">
  <button type="button" aria-label="Zoom in" onclick={() => map.zoomBy(1.6)}>
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </svg>
  </button>
  <button type="button" aria-label="Zoom out" onclick={() => map.zoomBy(1 / 1.6)}>
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true">
      <path d="M3 8h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </svg>
  </button>
</div>

<p class="credit">
  <span class="credit-long">Boroughs: </span>NYC Planning ·
  <span class="credit-long">Coordinates: </span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
</p>
