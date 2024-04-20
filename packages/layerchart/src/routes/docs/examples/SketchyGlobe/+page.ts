import pageSource from './+page.svelte?raw';

export async function load({ fetch }) {
  return {
    geojson: await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(
      (r) => r.json()
    ),
    meta: {
      pageSource,
    },
  };
}