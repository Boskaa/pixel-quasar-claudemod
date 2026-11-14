import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

const PLUGIN = 'pixel-quasar'
const SCENE_NAME = 'quasar'

// The scene is drawn on a 320x180 grid, so one cell is a fat screen pixel.
// The quasar sits up and to the right, clear of the words and the message box.
const W = 320
const H = 180
const CX = 226
const CY = 66
const R = 62
const TILT = -0.42
const SQUASH = 0.32
const COS = Math.cos(TILT)
const SIN = Math.sin(TILT)
// The disk turns in this many drawn frames, shown one after the other.
const FRAMES = 6
const FRAME_SECONDS = 0.42

// Deep-space violet, made for the dark: the scene has no daytime version.
const { theme, problems } = makeColors({
  label: 'Pixel quasar',
  only: 'dark',
  roles: { accent: '#b06cff', danger: '#ff5f6e', success: '#4fd18b', warning: '#ffb454', pro: '#5ab8ff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a0718',
        'surface-1': '#100c22',
        'surface-2': '#15102b',
        'surface-3': '#1a1433',
        'text-primary': '#ece8ff',
        'text-secondary': '#c5bfe6',
        'text-muted': '#a39cc8',
      },
    },
  },
})

const THEME: ThemeSetArgs = {
  colors: theme,
  backdrop: {
    scene: SCENE_NAME,
    // No blur, so the pixels stay crisp under the panels; a dark veil keeps
    // the text readable.
    glass: { blur: 0, tint: '#0a0718', opacity: 0.5 },
  },
}

type Pixel = readonly [number, number]

/** A small deterministic generator: the sky is the same on every load. */
const random = (seed: number) => {
  let s = seed >>> 0

  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0

    return s / 4294967296
  }
}

const n2 = (value: number) => String(Math.round(value * 100) / 100)

/**
 * Pixels as one path of 1-high strokes, in rows: far shorter than a rect each.
 * The group that holds it is shifted half a cell down, so a stroke fills a row.
 */
const strokes = (pixels: readonly Pixel[], color: string, extra = '') => {
  const sorted = [...pixels].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  let d = ''
  let penX = 0
  let penY = Number.NaN
  let i = 0

  while (i < sorted.length) {
    const first = sorted[i]

    if (first === undefined) break
    const [x, y] = first
    let run = 1

    for (;;) {
      const following = sorted[i + run]

      if (following === undefined || following[1] !== y || following[0] > x + run) break
      // A pixel listed twice is drawn once.
      if (following[0] === x + run) run++
      else i++
    }
    d += y === penY ? `m${x - penX} 0h${run}` : `M${x} ${y}h${run}`
    penX = x + run
    penY = y
    i += run
  }

  return d === '' ? '' : `<path d="${d}" stroke="${color}"${extra}/>`
}

const filledCircle = (cx: number, cy: number, radius: number): Pixel[] => {
  const out: Pixel[] = []

  for (let dy = -radius; dy <= radius; dy++) {
    const half = Math.floor(Math.sqrt(radius * radius - dy * dy))

    for (let dx = -half; dx <= half; dx++) out.push([cx + dx, cy + dy])
  }

  return out
}

const TWINKLES = 5
const BIG_STARS = 11

const stars = () => {
  const r = random(7)
  const tints = ['#ffffff', '#cfe3ff', '#ffe9c4', '#c9b8ff']
  let out = ''

  // Small ones: a pixel each, about a third of them twinkling.
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(r() * W)
    const y = Math.floor(r() * H)
    const fill = tints[Math.floor(r() * tints.length)] ?? '#ffffff'
    const opacity = n2(0.4 + r() * 0.6)
    const twinkle = r() < 0.38 ? ` class="t t${Math.floor(r() * TWINKLES)}"` : ''
    out += `<path d="M${x} ${y}h1" stroke="${fill}" opacity="${opacity}"${twinkle}/>`
  }

  // Big ones: a core, short arms that brighten, and long arms that flash out.
  let placed = 0

  while (placed < BIG_STARS) {
    const x = 6 + Math.floor(r() * (W - 12))
    const y = 6 + Math.floor(r() * (H - 12))

    if (Math.hypot(x - CX, y - CY) < 46) continue
    const fill = tints[Math.floor(r() * tints.length)] ?? '#ffffff'
    const reach = placed % 3 === 0 ? 5 : 4
    const short: Pixel[] = []
    const long: Pixel[] = []

    for (let d = 1; d <= reach; d++) {
      const arm = d <= 2 ? short : long
      arm.push([x + d, y], [x - d, y], [x, y + d], [x, y - d])
    }
    long.push([x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1])

    if (reach === 5) {
      long.push([x + 2, y + 2], [x - 2, y - 2], [x + 2, y - 2], [x - 2, y + 2])
    }
    out +=
      `<g class="b b${placed}">` +
      strokes([[x, y]], '#ffffff') +
      strokes(short, fill, ' class="r1"') +
      strokes(long, fill, ' class="r2"') +
      `</g>`
    placed++
  }

  return out
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const RAMP = ['#fff6d8', '#ffd76b', '#ff9a3c', '#ff5fb8', '#b44dff', '#6a3cff']

/**
 * One drawn frame of the accretion disk: a tilted ring, dithered, with two
 * spiral arms whose angle is `phase`.
 */
const diskFrame = (phase: number) => {
  const shades: Pixel[][] = RAMP.map(() => [])

  for (let y = CY - R; y <= CY + R; y++) {
    for (let x = CX - R; x <= CX + R; x++) {
      const dx = x - CX
      const dy = y - CY
      // Back to the disk's own plane, where it is a circle.
      const ex = dx * COS + dy * SIN
      const ey = (-dx * SIN + dy * COS) / SQUASH
      const rho = Math.hypot(ex, ey) / R

      if (rho > 1 || rho < 0.09) continue
      const arm = 0.5 + 0.5 * Math.cos(2 * (Math.atan2(ey, ex) - phase) + 7 * Math.log(rho + 0.08))
      const density = (1.02 - 0.74 * rho) * (0.28 + 0.72 * arm)
      const threshold = ((BAYER[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16

      if (density <= threshold) continue
      const shade = Math.max(0, Math.min(RAMP.length - 1, Math.floor(rho * RAMP.length - arm * 0.9 + 0.45)))
      shades[shade]?.push([x, y])
    }
  }

  return shades.map((pixels, shade) => strokes(pixels, RAMP[shade] ?? '#b44dff')).join('')
}

const disk = () => {
  let out = ''

  for (let f = 0; f < FRAMES; f++) {
    // Two arms: the picture repeats after half a turn.
    out += `<g class="f f${f}">${diskFrame((Math.PI * f) / FRAMES)}</g>`
  }

  return out
}

const ORBITERS = 54

/** Bright clumps riding the disk, each on its own orbit, inner ones faster. */
const orbit = () => {
  const r = random(42)
  let marks = ''
  let rules = ''

  for (let i = 0; i < ORBITERS; i++) {
    const radius = 8 + r() * 56
    const shade = Math.max(0, Math.min(RAMP.length - 1, Math.floor((radius / R) * RAMP.length - 1 + r() * 1.4)))
    const size = r() < 0.2 ? 2 : 1
    // The animation runs one way across and back: half an orbit each way.
    const half = (7 + Math.pow(radius / R, 1.5) * 44) / 2
    const delay = r() * half * 2
    marks +=
      `<g class="o o${i}"><rect x="${CX}" y="${CY}" width="${size}" height="${size}" ` +
      `fill="${RAMP[shade] ?? '#ffd76b'}" opacity="${n2(0.7 + r() * 0.3)}"/></g>`
    rules +=
      `.o${i}{--a:${n2(radius)};animation-duration:${n2(half)}s;animation-delay:-${n2(delay)}s}` +
      `.o${i}>rect{--b:${n2(radius * SQUASH)};animation-duration:${n2(half)}s;animation-delay:-${n2(delay + half / 2)}s}`
  }

  return { marks, rules }
}

const ORBIT = orbit()

const JET_SPARKS = 16

/** Two jets along the disk's axis: a fading beam and pixels racing outwards. */
const jets = () => {
  const r = random(99)
  // The axis is perpendicular to the disk's long side.
  const ux = -SIN
  const uy = COS
  const tints = ['#ffffff', '#9fe8ff', '#5ab8ff', '#7c8cff']
  const bands: { from: number; to: number; half: number; opacity: number; color: string }[] = [
    { from: 3, to: 16, half: 1.6, opacity: 0.75, color: '#d6f4ff' },
    { from: 16, to: 34, half: 1.1, opacity: 0.5, color: '#9fe8ff' },
    { from: 34, to: 58, half: 0.6, opacity: 0.32, color: '#5ab8ff' },
    { from: 58, to: 92, half: 0.6, opacity: 0.16, color: '#7c8cff' },
  ]
  let out = ''

  for (const band of bands) {
    const pixels: Pixel[] = []

    for (const side of [1, -1]) {
      for (let d = band.from; d < band.to; d += 0.5) {
        for (let across = -band.half; across <= band.half; across += 0.5) {
          pixels.push([
            Math.round(CX + (ux * d + uy * across) * side),
            Math.round(CY + (uy * d - ux * across) * side),
          ])
        }
      }
    }
    out += strokes(pixels, band.color, ` opacity="${band.opacity}"`)
  }

  for (let i = 0; i < JET_SPARKS * 2; i++) {
    const side = i % 2 === 0 ? 'ja' : 'jb'
    const across = (r() - 0.5) * 3
    const size = r() < 0.25 ? 2 : 1
    const fill = tints[Math.floor(r() * tints.length)] ?? '#9fe8ff'
    out +=
      `<rect class="${side} j${i}" x="${Math.round(CX + uy * across)}" y="${Math.round(CY - ux * across)}" ` +
      `width="${size}" height="${size}" fill="${fill}"/>`
  }

  return out
}

const jetRules = () => {
  const r = random(9999)
  let out = ''

  for (let i = 0; i < JET_SPARKS * 2; i++) {
    const duration = 2.2 + r() * 3.2
    out += `.j${i}{--l:${Math.round(62 + r() * 44)};animation-duration:${n2(duration)}s;animation-delay:-${n2(r() * duration)}s}`
  }

  return out
}

const core = () => {
  const spikes: Pixel[] = []
  const faint: Pixel[] = []

  for (let d = 4; d <= 30; d++) {
    const row = d <= 16 ? spikes : faint
    row.push([CX + d, CY], [CX - d, CY])

    if (d <= 15) {
      const column = d <= 9 ? spikes : faint
      column.push([CX, CY + d], [CX, CY - d])
    }
  }

  return (
    `<g class="halo">` +
    strokes(filledCircle(CX, CY, 17), '#b44dff', ' opacity=".08"') +
    strokes(filledCircle(CX, CY, 12), '#ff5fb8', ' opacity=".12"') +
    strokes(filledCircle(CX, CY, 8), '#ffb86b', ' opacity=".22"') +
    `</g>` +
    `<g class="spikes">${strokes(faint, '#fff2c0', ' opacity=".3"')}${strokes(spikes, '#fff2c0', ' opacity=".7"')}</g>` +
    strokes(filledCircle(CX, CY, 5), '#ffe7a8') +
    strokes(filledCircle(CX, CY, 3), '#fff6d8') +
    strokes(filledCircle(CX, CY, 2), '#ffffff')
  )
}

const starRules = () => {
  const r = random(31)
  let out = ''

  for (let i = 0; i < TWINKLES; i++) {
    const duration = 1.6 + r() * 3
    out += `.t${i}{animation-duration:${n2(duration)}s;animation-delay:-${n2(r() * duration)}s}`
  }

  for (let i = 0; i < BIG_STARS; i++) {
    const duration = 2.6 + r() * 4.4
    out += `.b${i} .r1,.b${i} .r2{animation-duration:${n2(duration)}s;animation-delay:-${n2(r() * duration)}s}`
  }

  return out
}

const frameRules = () => {
  const turn = FRAMES * FRAME_SECONDS
  let out = `.f{opacity:0;animation:fr ${n2(turn)}s steps(1) infinite}`

  for (let f = 1; f < FRAMES; f++) {
    out += `.f${f}{animation-delay:-${n2(turn - f * FRAME_SECONDS)}s}`
  }

  return out
}

const major = `${n2(COS)}px`
const majorY = `${n2(SIN)}px`
const minor = `${n2(-SIN)}px`
const minorY = `${n2(COS)}px`
const SINE = 'cubic-bezier(.37,0,.63,1)'

const STYLE =
  // On a tall screen the sides are cropped, so the quasar moves to the middle top.
  `@media (max-aspect-ratio:1/1){#q{transform:translate(-66px,-10px)}}` +
  `path{fill:none}` +
  // The disk's frames, one at a time.
  `@keyframes fr{0%{opacity:1}${n2(100 / FRAMES)}%,100%{opacity:0}}` +
  frameRules() +
  // An orbit is two swings a quarter turn apart, along the disk's two axes.
  `@keyframes ox{from{transform:translate(calc(var(--a)*-${major}),calc(var(--a)*${n2(-SIN)}px))}` +
  `to{transform:translate(calc(var(--a)*${major}),calc(var(--a)*${majorY}))}}` +
  `@keyframes oy{from{transform:translate(calc(var(--b)*-${minor}),calc(var(--b)*-${minorY}))}` +
  `to{transform:translate(calc(var(--b)*${minor}),calc(var(--b)*${minorY}))}}` +
  `.o{animation:ox 9s ${SINE} infinite alternate}.o>rect{animation:oy 9s ${SINE} infinite alternate}` +
  ORBIT.rules +
  // The jets' pixels step outwards and fade.
  `@keyframes ja{from{transform:translate(0,0);opacity:1}60%{opacity:.85}` +
  `to{transform:translate(calc(var(--l)*${minor}),calc(var(--l)*${minorY}));opacity:0}}` +
  `@keyframes jb{from{transform:translate(0,0);opacity:1}60%{opacity:.85}` +
  `to{transform:translate(calc(var(--l)*-${minor}),calc(var(--l)*-${minorY}));opacity:0}}` +
  `.ja{animation:ja 3s steps(26) infinite}.jb{animation:jb 3s steps(26) infinite}` +
  jetRules() +
  // The core breathes.
  `@keyframes pu{0%,100%{opacity:1}50%{opacity:.45}}` +
  `.halo{animation:pu 3.4s steps(5) infinite}.spikes{animation:pu 1.7s steps(4) infinite}` +
  // Small stars twinkle; big ones flash their arms out to shine.
  `@keyframes tw{0%,100%{opacity:1}35%{opacity:.15}55%{opacity:.8}75%{opacity:.4}}` +
  `.t{animation:tw 3s steps(6) infinite}` +
  `@keyframes s1{0%,50%,100%{opacity:.25}62%,88%{opacity:1}}` +
  `@keyframes s2{0%,64%,96%,100%{opacity:0}72%,84%{opacity:1}}` +
  `.b .r1{opacity:.25;animation:s1 4s linear infinite}.b .r2{opacity:0;animation:s2 4s linear infinite}` +
  starRules() +
  // Now and then, a shooting star.
  `@keyframes sh{0%,88%{opacity:0;transform:translate(0,0)}89%{opacity:1}` +
  `100%{opacity:0;transform:translate(-110px,52px)}}` +
  `.sh{opacity:0;animation:sh 17s linear infinite}`

const SCENE =
  `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">` +
  `<style>${STYLE}</style>` +
  `<defs>` +
  `<pattern id="n1" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#6a3cff"/><rect x="1" y="1" width="1" height="1" fill="#6a3cff"/></pattern>` +
  `<pattern id="n2" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#2f6bff"/><rect x="2" y="2" width="1" height="1" fill="#2f6bff"/></pattern>` +
  `</defs>` +
  `<rect width="${W}" height="${H}" fill="#05030f"/>` +
  // A dithered nebula behind everything.
  `<ellipse cx="${CX - 20}" cy="${CY + 14}" rx="120" ry="64" fill="url(#n2)" opacity=".2"/>` +
  `<ellipse cx="60" cy="140" rx="70" ry="34" fill="url(#n2)" opacity=".12"/>` +
  // Every path below is a row of strokes, shifted half a cell to fill its row.
  `<g transform="translate(0 .5)">` +
  stars() +
  `<path class="sh" d="M150 14h3m0 1h2m0 1h1" stroke="#ffffff"/>` +
  `</g>` +
  `<g id="q">` +
  `<ellipse cx="${CX}" cy="${CY}" rx="84" ry="40" transform="rotate(${n2((TILT * 180) / Math.PI)} ${CX} ${CY})" fill="url(#n1)" opacity=".13"/>` +
  `<g transform="translate(0 .5)">` +
  jets().replace(/<rect[^]*$/, '') +
  disk() +
  `</g>` +
  ORBIT.marks +
  (jets().match(/<rect[^]*$/)?.[0] ?? '') +
  `<g transform="translate(0 .5)">${core()}</g>` +
  `</g></svg>`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'quasar',
      description: 'Accende il tema quasar; "/quasar off" lo spegne',
      argumentHint: '[off]',
    })
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await $.theme.set(THEME)

    return next(e)
  })

  on('command.run', { command: 'quasar' }, async ($, e) => {
    if (String(e.args ?? '').trim().toLowerCase() === 'off') {
      await $.theme.clear()

      return { text: 'Tema quasar spento.' }
    }

    const set = await $.theme.set(THEME)

    return {
      text: set.isDrawn
        ? 'Tema quasar acceso.'
        : `Tema quasar impostato, ma qui non viene disegnato: ${set.reason}`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    // Another mod's backdrop is left to that mod.
    if (e.props.plugin !== PLUGIN || e.props.scene !== SCENE_NAME) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)

    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={SCENE}
        alt="Un quasar in pixel art con disco di accrescimento a spirale e getti, su un cielo di stelle che brillano"
        isInteractive
      />
    )
  })
}
