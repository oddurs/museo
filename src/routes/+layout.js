// One page, drawn entirely in the browser: there is a canvas, a
// geolocation prompt and a megabyte of street geometry, none of which a
// server can usefully do first. Prerender the shell, hydrate the rest.
export const prerender = true
export const ssr = false
export const trailingSlash = 'always'
