import { sveltekit } from '@sveltejs/kit/vite'

/** Port 2241, and only 2241 — a dev server that silently moves is a
 *  dev server you end up looking at the wrong copy of. */
const PORT = 2241

export default {
  plugins: [sveltekit()],
  server: { port: PORT, strictPort: true, host: '127.0.0.1' },
  preview: { port: PORT, strictPort: true, host: '127.0.0.1' },
  build: {
    // The street network is a megabyte of encoded geometry that the page
    // asks for only after its first paint. Keep it out of the entry chunk.
    chunkSizeWarningLimit: 1600,
  },
}
