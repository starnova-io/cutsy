/* 2D chibi mascots — used in the focus vignette, companion cards and paywall */
/* eslint-disable */
function leaf(px: number, py: number, ang: number, len: number, col: string): string {
  return `<g transform="translate(${px},${py}) rotate(${ang})">
    <path d="M0,0 Q-1.5,-${len*.4} 0,-${len} Q ${len*.42},-${len*.62} 0,0" fill="${col}"/>
    <path d="M0,0 Q1.5,-${len*.4} 0,-${len} Q -${len*.42},-${len*.62} 0,0" fill="${col}" opacity=".75"/>
    <line x1="0" y1="0" x2="0" y2="-${len*.85}" stroke="#4E6E41" stroke-width="1.1"/></g>`;
}
export function catSVG(mode: string): string {
  /* Mochi — chibi orange cat. local coords, feet at (0,0). modes: idle | sleep | happy */
  const B = "#F5A15C", D = "#DE8038", C = "#FDECD4", INNER = "#F6C2AC", BLUSH = "#F2A98C";
  if (mode === "sleep") {
    return `<g class="cat-breathe">
      <ellipse cx="0" cy="-9" rx="15.5" ry="9.8" fill="${B}"/>
      <path d="M-1,-17.6 q2.2,2.4 5.2,2.2 M5,-15.8 q2,2 4.6,1.6" stroke="${D}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M13,-4.5 C15.5,.6 4,3 -5,1.8" stroke="${D}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="-7" cy="-12.5" rx="9.5" ry="8.8" fill="${B}"/>
      <path d="M-12.5,-18.5 C-14.8,-25 -10.5,-27.5 -6.5,-22.8 C-6,-20.8 -7,-19 -8,-18.2 Z" fill="${B}"/>
      <path d="M-11.6,-19.4 C-12.8,-23.4 -10.4,-24.9 -8.2,-22 Z" fill="${INNER}"/>
      <path d="M-12,-11.6 q1.8,1.7 3.6,0 M-5,-12 q1.8,1.7 3.6,0" stroke="#A06A3A" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="-13.2" cy="-8.6" rx="1.9" ry="1.2" fill="${BLUSH}" opacity=".6"/>
      </g>
      <text class="zz" x="8" y="-26" font-size="11">z</text>
      <text class="zz zz2" x="15" y="-32" font-size="9">z</text>`;
  }
  const eyes = mode === "happy"
    ? `<path d="M-8.3,-31 q2.1,-2.8 4.2,0 M4.1,-31 q2.1,-2.8 4.2,0" stroke="#33261F" stroke-width="1.9" fill="none" stroke-linecap="round"/>`
    : `<g class="cat-blink">
        <ellipse cx="-6.2" cy="-31" rx="2.1" ry="2.8" fill="#33261F"/><ellipse cx="6.2" cy="-31" rx="2.1" ry="2.8" fill="#33261F"/>
        <circle cx="-5.5" cy="-32" r=".9" fill="#FFF"/><circle cx="6.9" cy="-32" r=".9" fill="#FFF"/></g>`;
  const mouth = mode === "happy"
    ? `<path d="M-2.6,-27.2 Q0,-24 2.6,-27.2 Z" fill="#B4633C"/>`
    : `<path d="M0,-26.9 q-1.6,1.9 -3.8,1 M0,-26.9 q1.6,1.9 3.8,1" stroke="#C08A5A" stroke-width="1.15" fill="none" stroke-linecap="round"/>`;
  return `<g class="${mode === "happy" ? "cat-happy" : "cat-breathe"}">
    <g class="cat-tail"><path d="M10,-7 C20,-5 25,-15 19,-26" stroke="${D}" stroke-width="6" fill="none" stroke-linecap="round"/></g>
    <path d="M-11,-1.6 C-12.5,-12 -6,-18 0,-18 C6,-18 12.5,-12 11,-1.6 Q0,2.6 -11,-1.6 Z" fill="${B}"/>
    <ellipse cx="0" cy="-6.2" rx="6.5" ry="5.4" fill="${C}"/>
    <ellipse cx="-4.6" cy="-1.4" rx="3.5" ry="2.3" fill="${C}"/>
    <ellipse cx="4.6" cy="-1.4" rx="3.5" ry="2.3" fill="${C}"/>
    <path d="M-13,-35 C-15.2,-44 -12,-50 -5.8,-44.6 C-4,-42 -4.8,-38.5 -6,-36.4 Z" fill="${B}"/>
    <path d="M-11.6,-37 C-12.8,-43 -10.5,-46.6 -7.3,-43.4 C-6.5,-41.4 -7.1,-39.2 -7.9,-37.8 Z" fill="${INNER}"/>
    <path d="M13,-35 C15.2,-44 12,-50 5.8,-44.6 C4,-42 4.8,-38.5 6,-36.4 Z" fill="${B}"/>
    <path d="M11.6,-37 C12.8,-43 10.5,-46.6 7.3,-43.4 C6.5,-41.4 7.1,-39.2 7.9,-37.8 Z" fill="${INNER}"/>
    <ellipse cx="0" cy="-31" rx="13.5" ry="12.5" fill="${B}"/>
    <path d="M-5.6,-42.5 q1.7,2.8 .4,5 M0,-43.3 q1.2,3 0,5.3 M5.6,-42.5 q-1.7,2.8 -.4,5" stroke="${D}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="-26.4" rx="6.2" ry="4.4" fill="${C}"/>
    ${eyes}
    <path d="M-1.5,-28.7 L1.5,-28.7 L0,-27 Z" fill="#E0836F"/>
    ${mouth}
    <path d="M-13.2,-27.6 l-4.4,-.8 M-13.2,-25.5 l-4.4,.6 M13.2,-27.6 l4.4,-.8 M13.2,-25.5 l4.4,.6" stroke="#E8B98C" stroke-width="1" stroke-linecap="round" opacity=".85"/>
    <ellipse cx="-9.4" cy="-26.6" rx="2.5" ry="1.5" fill="${BLUSH}" opacity=".6"/>
    <ellipse cx="9.4" cy="-26.6" rx="2.5" ry="1.5" fill="${BLUSH}" opacity=".6"/>
    </g>`;
}
export function dogSVG(mode: string): string {
  /* Miso — chibi shiba pup. local coords, feet at (0,0). modes: idle | sleep | happy */
  const B = "#DFA05F", D = "#C08046", C = "#FBF0DC", INNER = "#EFC9A4", BLUSH = "#F0A98F";
  if (mode === "sleep") {
    return `<g class="cat-breathe">
      <ellipse cx="0" cy="-9" rx="15.5" ry="9.8" fill="${B}"/>
      <path d="M9.5,-14 C15,-16.5 15.5,-21.5 11,-21.5 C8,-21.5 7.5,-17.5 10.5,-16.5" stroke="${D}" stroke-width="4.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="-7" cy="-12.5" rx="9.5" ry="8.8" fill="${B}"/>
      <path d="M-13,-18.6 C-16,-23 -13,-27 -8.8,-24.2 C-8,-22 -9,-19.8 -10,-18.8 Z" fill="${D}"/>
      <ellipse cx="-10" cy="-10.5" rx="4.6" ry="3.4" fill="${C}"/>
      <ellipse cx="-13.4" cy="-11.6" rx="1.6" ry="1.3" fill="#33261F"/>
      <path d="M-7.6,-14.6 q1.8,1.6 3.6,0" stroke="#A06A3A" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="-4.6" cy="-10" rx="1.9" ry="1.2" fill="${BLUSH}" opacity=".6"/>
      </g>
      <text class="zz" x="8" y="-26" font-size="11">z</text>
      <text class="zz zz2" x="15" y="-32" font-size="9">z</text>`;
  }
  const eyes = mode === "happy"
    ? `<path d="M-8.3,-31 q2.1,-2.8 4.2,0 M4.1,-31 q2.1,-2.8 4.2,0" stroke="#33261F" stroke-width="1.9" fill="none" stroke-linecap="round"/>`
    : `<g class="cat-blink">
        <ellipse cx="-6.2" cy="-31" rx="2.1" ry="2.8" fill="#33261F"/><ellipse cx="6.2" cy="-31" rx="2.1" ry="2.8" fill="#33261F"/>
        <circle cx="-5.5" cy="-32" r=".9" fill="#FFF"/><circle cx="6.9" cy="-32" r=".9" fill="#FFF"/></g>`;
  const mouth = mode === "happy"
    ? `<path d="M-2.6,-27 Q0,-23.8 2.6,-27 Z" fill="#B4633C"/>
       <rect x="-1.6" y="-26.2" width="3.2" height="4.4" rx="1.6" fill="#F09D95"/>`
    : `<path d="M0,-27.2 q-1.6,1.9 -3.8,1 M0,-27.2 q1.6,1.9 3.8,1" stroke="#B07A48" stroke-width="1.15" fill="none" stroke-linecap="round"/>`;
  return `<g class="${mode === "happy" ? "cat-happy" : "cat-breathe"}">
    <g class="cat-tail"><path d="M10.5,-9.5 C17,-10.5 19.5,-17.5 14.5,-19.8 C11,-21.3 8.5,-17 11.5,-15.2" stroke="${D}" stroke-width="4.4" fill="none" stroke-linecap="round"/></g>
    <path d="M-11,-1.6 C-12.5,-12 -6,-18 0,-18 C6,-18 12.5,-12 11,-1.6 Q0,2.6 -11,-1.6 Z" fill="${B}"/>
    <ellipse cx="0" cy="-6.2" rx="6.5" ry="5.4" fill="${C}"/>
    <ellipse cx="-4.6" cy="-1.4" rx="3.5" ry="2.3" fill="${C}"/>
    <ellipse cx="4.6" cy="-1.4" rx="3.5" ry="2.3" fill="${C}"/>
    <path d="M-12.6,-35.5 C-15,-44.5 -11.5,-50 -5.6,-44.2 L-6.4,-36.2 Z" fill="${D}"/>
    <path d="M-11.2,-37.2 C-12.4,-43 -10.2,-46.3 -7.2,-42.6 L-7.8,-37.8 Z" fill="${INNER}"/>
    <path d="M12.6,-35.5 C15,-44.5 11.5,-50 5.6,-44.2 L6.4,-36.2 Z" fill="${D}"/>
    <path d="M11.2,-37.2 C12.4,-43 10.2,-46.3 7.2,-42.6 L7.8,-37.8 Z" fill="${INNER}"/>
    <ellipse cx="0" cy="-31" rx="13.5" ry="12.5" fill="${B}"/>
    <circle cx="-5" cy="-37.8" r="1.5" fill="${C}"/>
    <circle cx="5" cy="-37.8" r="1.5" fill="${C}"/>
    <ellipse cx="-8.2" cy="-27.4" rx="4.6" ry="3.9" fill="${C}"/>
    <ellipse cx="8.2" cy="-27.4" rx="4.6" ry="3.9" fill="${C}"/>
    <ellipse cx="0" cy="-27.4" rx="7.4" ry="5.4" fill="${C}"/>
    ${eyes}
    <ellipse cx="0" cy="-29.6" rx="2.3" ry="1.8" fill="#33261F"/>
    <circle cx="-.7" cy="-30.1" r=".6" fill="#FFF" opacity=".8"/>
    ${mouth}
    <ellipse cx="-10.4" cy="-25.4" rx="2.5" ry="1.5" fill="${BLUSH}" opacity=".55"/>
    <ellipse cx="10.4" cy="-25.4" rx="2.5" ry="1.5" fill="${BLUSH}" opacity=".55"/>
    </g>`;
}
export function focusSceneSVG(kind: string, mode: string): string {
  
  return `<defs><radialGradient id="glowF"><stop offset="0%" stop-color="rgba(255,199,102,.4)"/><stop offset="100%" stop-color="rgba(255,199,102,0)"/></radialGradient><radialGradient id="lampGlow"><stop offset="0%" stop-color="rgba(255,206,110,.55)"/><stop offset="100%" stop-color="rgba(255,206,110,0)"/></radialGradient></defs>
    <ellipse cx="150" cy="138" rx="104" ry="26" fill="rgba(0,0,0,.25)"/>
    <ellipse cx="150" cy="134" rx="96" ry="22" fill="#463A4A"/>
    <ellipse cx="150" cy="131" rx="84" ry="18" fill="#534459"/>
    <g transform="translate(206,120)">${leaf(0,0,-16,20,"#5F7A50")}${leaf(0,0,18,23,"#526B45")}${leaf(0,0,-48,16,"#5F7A50")}
      <path d="M-8,0 h16 l-2.5,12 h-11 Z" fill="#8A5A38"/></g>
    <ellipse class="glow-pulse" cx="96" cy="86" rx="40" ry="30" fill="url(#glowF)"/>
    <rect x="94" y="86" width="3" height="42" fill="#6B5638"/>
    <path d="M84,88 L89,74 L102,74 L107,88 Z" fill="#E8CFA4"/>
    <ellipse cx="95.5" cy="130" rx="14" ry="4.5" fill="#3A3040"/>
    <g transform="translate(152,128)">${kind === "dog" ? dogSVG(mode) : catSVG(mode)}</g>`;
}
