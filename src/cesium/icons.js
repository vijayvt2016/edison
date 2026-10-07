// Inline SVG icons (white; tinted per-entity via billboard color).

const svg = (body, size = 64) =>
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${body}</svg>`
  );

export const ICONS = {
  satellite: svg(`
    <g fill="#fff">
      <rect x="25" y="25" width="14" height="14" rx="2"/>
      <rect x="4" y="27" width="17" height="10" rx="1" opacity="0.9"/>
      <rect x="43" y="27" width="17" height="10" rx="1" opacity="0.9"/>
      <rect x="21" y="31" width="4" height="2"/><rect x="39" y="31" width="4" height="2"/>
      <circle cx="32" cy="20" r="3"/><rect x="31" y="20" width="2" height="6"/>
    </g>`),

  // Generic top-down fighter silhouette, nose up.
  jet: svg(`
    <path fill="#fff" d="M32 3 L35 16 L35 24 L56 38 L56 42 L35 36 L34 50 L42 56 L42 59 L32 56 L22 59 L22 56 L30 50 L29 36 L8 42 L8 38 L29 24 L29 16 Z"/>`),

  battery: svg(`
    <g fill="none" stroke="#fff" stroke-width="4">
      <rect x="10" y="18" width="44" height="28" rx="3"/>
    </g>
    <g fill="#fff"><rect x="18" y="26" width="10" height="12"/><path d="M34 38 L50 22 L53 25 L37 41 Z"/></g>`),

  node: svg(`
    <polygon points="32,6 55,19 55,45 32,58 9,45 9,19" fill="none" stroke="#fff" stroke-width="4"/>
    <circle cx="32" cy="32" r="8" fill="#fff"/>`),

  command: svg(`
    <rect x="10" y="10" width="44" height="44" rx="4" fill="none" stroke="#fff" stroke-width="4"/>
    <polygon fill="#fff" points="32,17 36,28 47,28 38,35 41,46 32,39 23,46 26,35 17,28 28,28"/>`),

  hub: svg(`
    <circle cx="32" cy="32" r="26" fill="none" stroke="#fff" stroke-width="3" opacity="0.7"/>
    <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-width="3"/>
    <circle cx="32" cy="32" r="8" fill="#fff"/>`),

  ring: svg(`<circle cx="32" cy="32" r="28" fill="none" stroke="#fff" stroke-width="3"/>`),

  reticle: svg(`
    <g fill="none" stroke="#fff" stroke-width="3">
      <path d="M6 20 V6 H20"/><path d="M44 6 H58 V20"/><path d="M58 44 V58 H44"/><path d="M20 58 H6 V44"/>
      <circle cx="32" cy="32" r="12"/>
    </g>
    <g stroke="#fff" stroke-width="3"><line x1="32" y1="14" x2="32" y2="22"/><line x1="32" y1="42" x2="32" y2="50"/><line x1="14" y1="32" x2="22" y2="32"/><line x1="42" y1="32" x2="50" y2="32"/></g>`),

  diamond: svg(`<polygon points="32,4 60,32 32,60 4,32" fill="none" stroke="#fff" stroke-width="4"/>`),

  shield: svg(`
    <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="10 6"/>`),
};
