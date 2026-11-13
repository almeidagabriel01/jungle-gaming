// Gera as 16 artes placeholder (SVG) usadas pelo seed até a entrada dos assets do Figma.
// Determinístico: mesma saída a cada execução. Uso: node scripts/generate-art.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const palettes = [
  ['#0f3d2e', '#1f8a5b', '#f2c14e'], ['#1b1b3a', '#693668', '#f49e4c'], ['#04395e', '#70a288', '#dab785'],
  ['#2b2d42', '#ef233c', '#edf2f4'], ['#0b132b', '#3a506b', '#5bc0be'], ['#3d0c11', '#d72638', '#f2e8cf'],
  ['#132a13', '#4f772d', '#ecf39e'], ['#22223b', '#9a8c98', '#f2e9e4'], ['#001219', '#0a9396', '#ee9b00'],
  ['#2d00f7', '#8900f2', '#f20089'], ['#283618', '#bc6c25', '#fefae0'], ['#03045e', '#0077b6', '#90e0ef'],
  ['#250902', '#a53860', '#ffa5ab'], ['#10002b', '#5a189a', '#e0aaff'], ['#081c15', '#2d6a4f', '#b7e4c7'],
  ['#1d3557', '#e63946', '#f1faee'],
]
mkdirSync('public/art', { recursive: true })
palettes.forEach(([bg, mid, hi], i) => {
  const r = 120 + ((i * 37) % 160)
  const cx = 200 + ((i * 53) % 400)
  const cy = 260 + ((i * 71) % 300)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#g)"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${hi}" opacity=".85"/>
<rect x="${(i * 97) % 500}" y="${420 + ((i * 29) % 200)}" width="${180 + (i % 4) * 40}" height="${180 + (i % 3) * 50}" rx="${i % 2 ? 24 : 0}" fill="${mid}" opacity=".7" transform="rotate(${(i * 23) % 45} 400 400)"/>
<path d="M0 ${600 + (i % 5) * 30} Q 400 ${480 + (i % 7) * 20} 800 ${620 - (i % 4) * 25} V800 H0Z" fill="${bg}" opacity=".6"/>
</svg>
`
  writeFileSync(`public/art/${String(i + 1).padStart(2, '0')}.svg`, svg)
})
