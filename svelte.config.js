import adapter from '@sveltejs/adapter-static'

/**
 * A static site: nothing is rendered on a server because there is no
 * server. GitHub Pages serves this project under /museo/, so the build
 * needs to know that; locally it is served from the root.
 *
 *   BASE_PATH=/museo npm run build
 */
const base = process.env.BASE_PATH ?? ''

export default {
  kit: {
    adapter: adapter({ pages: 'build', assets: 'build', fallback: null, strict: true }),
    paths: { base, relative: true },
    appDir: 'app',          // Pages refuses to serve a directory starting with _
  },
}
