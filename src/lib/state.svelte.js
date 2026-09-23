/** What the page is showing. Everything here changes when you do
 *  something; the view of the map does not live here, because it changes
 *  sixty times a second. */

export const app = $state({
  query: '',
  borough: null,
  chosen: null,
  here: null,      // {lat, lng, x, y} once you have said where
})
