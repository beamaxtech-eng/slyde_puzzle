# Slyde — UI/UX Specification
### Version 1.0 · Covers Phases 0–5 (MVP complete)

> **Purpose:** The complete design bible for every screen, component,
> interaction, animation, and flow in Slyde. Use it as:
> - implementation reference (what to build, with exact values)
> - testing checklist (does the built app match this document)
> - onboarding doc for any future designer/developer/AI agent
>
> Companion documents: `AGENT.md` (conventions + decision log),
> `PROJECT_DOCUMENTATION-3.md` (gameplay spec + level generation).

---

## 1. Design Language

Everything in Slyde is built to feel like **a physical wooden puzzle toy on a
craftsman's table**.

### 1.1 Materials

| Element | Design rule |
|---|---|
| Background | Dark wood (`#432a14`-`#5c3a1e`) — a table surface in lamplight |
| Panels | Recessed **glass slabs** carved into the wood: wood ramp under a milky film, dark shadow lip along the top — see §1.5 |
| Primary buttons | Polished **brass** under glass (`#f9e2a8`→`#a86f24` ramp), 4px dark bottom edge — physically **depress 3px** on press |
| Secondary buttons | Wood under glass with light text — quieter than brass |
| Text | Serif, warm cream (`#f0dcb8`); titles brass-gold (`#f5d9a8`); labels dim tan, uppercase, letterspaced |
| Numbers | Dark brown (`#4a2f14`) on light wood; timers use tabular figures |
| Status colors | Green `#3e9e52` = done · Gold `#ffd76e` = current · Dark = locked · Red `#ff9a80` = danger/fail |

### 1.2 The lighting model (the core 3D trick)

Light comes from the **top-left**. Every raised surface (tiles, buttons, map
nodes) has a light edge on top/left and a dark edge on bottom/right. Every
recessed surface (panels, tray, switches) has an inner shadow. This single
consistent rule makes flat rectangles read as 3D objects.

**Deliberate constraint:** no perspective/tilt transforms on the interactive
board — it distorts drag math. Fake-3D via lighting beats real-3D for precise
touch interaction. (Decision D14.)

### 1.3 Motion grammar

Nothing appears or disappears instantly. Everything fades (~500–550ms),
slides (~130–140ms), or glides (~900ms). The world moves like heavy wood,
not like software. Full timing values: §12.

### 1.4 Color tokens

All colors live in `src/theme.ts` (`C` object). Never hardcode colors in
components — extend the tokens.

### 1.5 The wood + glass material

Cards, panels, chips and buttons all share one finish, built in
`src/components/ui.tsx` (`SurfacePaint` / `WoodGlassSurface`) and painted
entirely with `react-native-svg` gradients (no `expo-linear-gradient` /
`expo-blur` in this project).

The wood ramp is **sampled from `assets/bg1.jpg`** — that file's pixels run
`#0d0600` → `#7c491e` — and becomes the four tokens
`C.woodLit/woodMid/woodDark/woodDeep`. Three layers stack inside one clipped,
rounded face:

1. **Wood body** — a top-left → bottom-right gradient through that ramp, plus
   vertical grain/plank-seam streaks (`C.woodGrainLight/woodGrainDark`).
2. **Liquid glass** — a milky film densest where the lamp hits (`C.glassFilmTop`),
   a diagonal specular streak (`C.glassSheen`), and light pooling along the
   bottom edge (`C.glassCaustic`). All translucent, all *on* the wood, so the
   slab reads as one object rather than a pane floating above it.
3. **The rim** — a gradient hairline, lit top-left (`C.glassRimLight`) and shaded
   bottom-right (`C.glassRimDark`), drawn **inside the SVG**. Never use
   `borderWidth` for it: React Native paints borders beneath children, so a child
   background swallows them.

**The 3D read** comes from one dark band on the face's own padding, painted in
`C.glassThickness`: a raised surface (cards, buttons) shows it *below* the face
as the slab's thickness; a carved surface (panels, plaques) shows it *above* as
the recess shadow.

`lite` swaps the SVG gradients for flat translucent bands — visually
near-identical at small sizes, but with no extra native views, so the
leaderboard's 200-row list stays smooth.

**Rule: never hand an `rgba()` token to an SVG paint attribute.** react-native-svg
resolves an `rgba()` string in `stopColor` / `fill` / `stroke` to its RGB and
*throws the alpha away*, so a "transparent" stop like `C.glassClear`
(`rgba(255,255,255,0)`) renders **opaque white**. Because the film, sheen and
caustic rects each cover the whole surface, doing this painted every card,
panel, chip and button in the app white. Always route tokens through
`svgPaint()` (`src/theme.ts`), which returns `{ color, alpha }` to pass as
`stopColor` + `stopOpacity` (or `fill` + `fillOpacity`). Plain `View`
`backgroundColor` styles are unaffected and still take `rgba()` directly.

---

## 2. Splash Screen

**Purpose:** brand moment + audio unlock (the OS requires one user gesture
before any sound can play).

### Layout (vertically centered)

```
        ┌───┬───┐
        │ 1 │ 2 │      ← mini 2×2 wooden puzzle mark
        ├───┼───┤        (tiles 1, 2, 3 + one empty dark slot)
        │ 3 │   │
        └───┴───┘
          slyde          ← 60pt serif logo, brass gradient
   SLIDE · SOLVE · REPEAT ← letterspaced dim caption
       tap to continue   ← pulsing opacity (100%→25%, 1.5s loop)
```

### Design notes
- The mini-puzzle mark is the brand promise in one image: *this is a sliding game*.
- The empty slot is bottom-right — exactly where the blank lives in gameplay.

### Interaction
- **Entire screen is one pressable.** Any tap → audio context unlocks →
  navigate to Home with the standard screen fade (~550ms) + whoosh sound.
  The tap is a *skip*: it jumps ahead of the auto-advance below.
- "tap to continue" pulses so the user never wonders if the app is frozen.
- **Auto-advance:** the brand moment holds for **3s** (`MOTION.splashAutoMs`),
  then Home takes over on its own — a passive player is never parked on a logo.

### Why the tap stays (even though the screen auto-advances)
The tap is **load-bearing for audio** — it unlocks the OS audio context, so a
tapping player hears sound from the first moment of Home. The 3s auto-advance
exists for the passive player; if it wins the race, audio simply unlocks on the
first tap in Home instead.

### Auto-advance and the cancellation law
The 3s hand-off is scheduled through the flow engine (`after()`, `src/flow.ts`),
so a tap calls `clearFlow()` and kills it — **both exits can never fire**, so no
double navigation — and leaving the screen clears any pending automation as a
safety net.

---

## 3. Home Screen

**Purpose:** the hub. Everything is one tap away; starting a game is *the*
primary action. Track selection is merged into Home (Decision D12) — there is
no separate difficulty screen.

### Layout (top → bottom)

```
┌──────────────────────────────────────┐
│ 👤                            ⚙      │ ← icon bar (46×46 dark wood buttons)
│                                      │
│               slyde                  │ ← 48pt logo
│           WELCOME BACK               │ ← letterspaced caption
│         "Ready to slide?"            │ ← italic gold — the invitation
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ █ Easy            [level 5]      │ │ ← track card
│ │   3×3 & 3×4 grid                 │ │   (█ = 5px colored left edge)
│ │   [ Numbers ]                    │ │   (brass pill = tile mode)
│ └──────────────────────────────────┘ │
│ ┌───── Medium … [Image + Numbers]──┐ │
│ ┌───── Hard … [Image only]─────────┘ │
│                                      │
│ [🏆 leader board][best time][solved] │ ← bottom stats bar
└──────────────────────────────────────┘
```

### Element spec

| Element | Spec |
|---|---|
| Icon buttons | 50×50, wood under glass, press-depress + click → Leaderboard / Settings |
| Logo block | 48pt logo, WELCOME BACK caption, italic gold "Ready to slide?" |
| Track cards | Wood slab under liquid glass (§1.5), 18px radius, 5px colored accent edge under the glass (Easy green / Medium gold / Hard red). Content order = decision importance: **name** (colored) → **current level** (right-aligned glass pill, "level 5") → **board sizes** ("3×3 & 3×4 grid") → **tile-mode pill** (brass: Numbers / Image + Numbers / Image only) |
| Stats bar | Leaderboard button (wider, wood under glass) + two glass stat slabs: best time, solved count. Live from the store; `—` when empty |

### Interactions & animations
- **Track card press:** card **sinks 3px + scales to 99%** (the whole card is
  the button — maximum tap target), click sound, then launches the
  **auto-play flow** (§9.1). *No confirmation screen — choosing a difficulty
  IS consent to play.*
- Icon buttons / leaderboard button: press-depress + click → target screen
  (fade + whoosh).

---

## 4. Level Map Screen

**Purpose:** progress visualization + level selection + the stage for the
auto-flow's marker animation. The most spatially designed screen in the app.

### Layout

```
┌──────────────────────────────────────┐
│ ‹  Easy · Image + Numbers            │ ← top bar
│ ┌──────────────────────────────────┐ │
│ │        (scrollable area)         │ │
│ │              ⬤ 200               │ │ ← TOP = level 200
│ │           ⬤                      │ │
│ │  ══ CHAPTER 2 GATE ══            │ │ ← plaque between 50 and 51
│ │      ⬤ 51                        │ │
│ │           ⬤                      │ │
│ │        🔒                        │ │ ← locked ahead, visible
│ │     ⬤ 3                          │ │ ← gold, glowing = current
│ │  ● 1                             │ │ ← BOTTOM = level 1
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Geometry (computed, not hand-laid)

- **200** nodes on a **vertical sine-wave path**:
  `x = centerX + sin(level × 0.55) × amplitude`, climbing **bottom to top** —
  level 1 at the bottom, 200 at the top. Progress = climbing. (Decision D11.)
- Node spacing 64px (200px row pitch); **extra 100px gap between nodes 100 and
  101** for the Chapter 2 plaque.
- The trail is **carved into the wood**: an 11px dark groove over a lit lower
  lip, with dashed footsteps riding inside (`1 11` dash, round caps) —
  brass where you've already climbed, dim on the road ahead.

### Scenery (the 3D stage)

The map is a **carved table in lamplight**, layered for depth:
- **Behind the scroll view (the room):** night-wood gradient, a lantern pool
  that **breathes** (7s loop) and **parallaxes against the climb** (scroll-
  linked), foreground dust motes (9s drift), and a vignette.
- **Inside the scroll content (the world):** vertical wood grain + plank
  seams, and world-anchored motes that climb with the nodes.
- **Nodes are 3D:** a carved socket with a raised disc — dark base
  peeking below the lit face (thickness), specular nick top-left (lighting
  §1.2). Every 10th level gets a **brass inlay ring**. Tapping presses
  the disc into its socket. Icons are drawn — padlock, paw print, check
  badge; no emoji. All scatter is seeded — the room never reshuffles.

### Node states

| State | Look | Meaning |
|---|---|---|
| **done** | Raised green disc in a carved socket, **brass check badge** | Completed — the conquered trail behind you |
| **current** | Raised gold disc, **paw print**, **breathing halo** (1.6s) + slow bob + orbiting shine | Next uncompleted level — the trailhead |
| **locked** | Recessed dark disc, **drawn padlock**, disabled | The road ahead — **always visible, never hidden** (creates pull) |

### Chapter 2 gate
Dark plaque, brass border: "CHAPTER 2 — bigger board above: 3×4". A signpost,
not a button. Breaks the 100-node climb into two arcs and announces the grid
change before the player hits it.

### The ★ marker (flow mode only)
42px brass star disc, `pointerEvents="none"` — a spirit, not a button. Exists
purely to show *the game moving you forward*. Sequence in §9.1. As it
glides it sheds a **sparkle wake** — four trailing sparks that each
land a beat after the marker.

### Interactions & animations
- **Entry (manual mode):** map **auto-scrolls instantly** (no animation) so
  the current level sits mid-screen, then **nodes rise into place** (420ms,
  45ms stagger rippling outward from the focused level) and the carved trail
  lights up (700ms fade). The map finds you; you never scroll to find
  yourself.
- **Tap done/current node:** the disc **presses into its socket** —
  click → PreLevel card.
- **Tap locked node:** nothing (disabled).
- **★ sequence (flow):** 400ms → pop-in (180ms) on the completed node →
  **glide up the path, 900ms, `inOut(cubic)`** → if auto-start armed: screen
  fades to black (550ms) at the 2000ms mark → navigation `replace` to Puzzle
  at 2600ms.

### Dual mode (the key design trick)
The same screen serves the calm manual explorer and the auto-play engine's
stage, switched purely by route params (`animateTo` / `autoStart`).

---

## 5. Pre-Level Card

**Purpose:** the breath before the level. Information + a deliberate pause.
**Manual entry only — the auto-play flow skips this screen entirely.**

### Layout (vertically centered)

```
┌──────────────────────────────────────┐
│ ‹  Easy Track                        │
│            Level 23                  │ ← 50pt gold display type
│      3×3 grid · Numbers              │ ← context line
│  ┌────────────────────────────────┐  │
│  │ Target moves         ~14       │  │ ← recessed info panel
│  │ Time limit           2:03      │  │
│  │ Your best      1:12 · 21 moves │  │
│  │ Streak                 4 🔥    │  │
│  │ Puzzle    ✓ solver-verified    │  │ ← verification badge
│  └────────────────────────────────┘  │
│         [ ▶ Play ]                   │ ← full-width brass button
│           dataset v2                 │ ← tiny dim footnote
└──────────────────────────────────────┘
```

### Design notes
- **"Level 23" at 50pt** is the moment of identity — big, celebratory.
- Level 51 context line: **"Chapter 2 · new board! 3×4 grid"** — milestone
  announced in text, echoing the map plaque.
- Info panel answers the four pre-game questions: *how hard* (target moves),
  *how long* (time limit), *how good am I* (best), *how hot am I* (streak).
- **Verification badge:** "✓ solver-verified (exact)" / "✓ solver-verified
  (band)" / "✓ certified (interval)" / "approximate (stub)".
- **"Your best: —"** for unplayed levels — the em-dash is an invitation.

### Interaction
- Play: brass press → `replace` (not `push`) → Puzzle. **Replace matters:**
  the back stack never accumulates dead pre-level cards; back from a puzzle
  always goes to the Map.
- The only screen with no automation timer — manual players chose to pause
  here; the game respects that.

---

## 6. Puzzle Screen

**Purpose:** the main event.

### Layout

```
┌──────────────────────────────────────┐
│ ‹  Level 23 · 3×3         [⟳ Restart]│ ← top bar
│ [1:48][moves 7][~14][▄goal▄]         │ ← HUD row (4 plaques + restart)
│         ┌───────────────┐            │
│         │ ╔═══╤═══╤═══╗ │            │
│         │ ║ 5 │ 1 │ 3 ║ │            │ ← carved wooden tray
│         │ ╟───┼───┼───╢ │            │   (10px wood border, deep
│         │ ║ 2 │   │ 6 ║ │            │    inner shadow)
│         │ ╟───┼───┼───╢ │            │
│         │ ║ 4 │ 7 │ 8 ║ │            │ ← 3D wooden tiles + blank
│         │ ╚═══╧═══╧═══╝ │            │
│         └───────────────┘            │
└──────────────────────────────────────┘
```

### 6.1 The board

- **Tray:** 10px solid wood border (`#6b4423`), near-black interior — tiles
  sit *in* the wood, not on it.
- **Tiles:** light wood face (`#e8c489`), light 2px top border / dark 3px
  bottom border (top-left lighting model), 9px corners, 2px margins so each
  reads as a discrete physical piece.
- **Tile content by track:**
  - Easy → dark number, centered, 40% of cell size
  - Medium → image slice + **brass number badge** (top-left corner)
  - Hard → image slice only — pure pattern recognition
- **Image slices:** each tile renders the same full image, position-offset to
  its home coordinates, clipped by the tile frame (implemented — 15-image pack
  in `assets/puzzles/`, see its README.md).
- Board adapts to grid: cells computed from screen dimensions, capped at
  110px. 3×3 tiles are huge; 5×6 compact.

### 6.2 The interaction model

**Drag:** tile adjacent to blank lifts (scale 1.06, 80ms), axis-locked toward
blank, release > 35% of a cell commits (glide home 140ms `out(cubic)`),
early release snaps back (130ms).
**Tap:** finger travel under gesture threshold → instant commit + 140ms settle.

### 6.3 The HUD

Four recessed plaques + restart: Time left / Moves / Target (~solve distance)
/ Goal (miniature solved state; **tap → enlarged peek overlay**). The HUD preview
and the peek both scale with the grid so the goal stays readable at 5×6.

Both previews are sized from the window, never from a fixed pixel budget: the
goal miniature is fitted to the goal chip's share of the HUD row (flex 1.5 of
4.5) and the peek to the card's inner width, each also capped in height so the
HUD stays a strip and the peek's title and hint stay on screen. A window change
(rotation, Android Display-size zoom) therefore re-lays them out instead of
clipping them — a chip's face clips its overflow, so a fixed board used to lose
an outer column on a narrow phone.

### 6.4 The timer drama

| Time remaining | What happens |
|---|---|
| > 15s | Normal — cream digits |
| **≤ 15s** | Digits turn red + plaque border red |
| **≤ 10s → 6s** | Each second: tick sound + haptic; music ducks to ~⅓ (Phase 4 audio) |
| **≤ 5s** | Urgent double-beep + medium haptic; red overlay pulses over the whole screen (0→30%→0, 320ms/cycle, infinite) |
| **0** | Fail |

### 6.5 Overlays

All overlays: dim wood-dark backdrop at 85%, centered card, fade 500ms.
Cards take their width from the window (20px side margins, capped at 360px), so
they never run edge-to-edge on a narrow phone or sit lost on a tablet.
**WIN:** "Solved! 🎉" + time·moves large + "🏆 New personal best!" in gold;
buttons: Next level → (brass) / Level map (dark).
**FAIL:** "Time's up! ⏰" red, "Tap anywhere to auto-retry…", moves made;
the whole overlay is pressable; idle-aware gate (Phase 3).

### 6.6 Restart

Restart **remounts the entire board** (`key={attemptId}`) from the same
`initialTiles` — identical puzzle, fresh timer, attempt counter increments.

---

## 7. Leaderboard Screen

**Purpose:** personal bests (local, until cloud arrives) + the "global coming
soon" promise.

- Tabs: Easy / Medium / Hard; active tab inverts to **brass-on-dark**.
- Rows: level number (gold, fixed width) + best time + best moves in tabular
  figures — the two independent records side by side.
- Summary line: ✅ solved/200 · 🔥 streak.
- The dashed-border **"Global leaderboard — coming soon"** placeholder is a
  design decision: the UI shape ships ready for a backend.
- Empty state: "No completed levels yet. Go solve something!"

---

## 8. Settings Screen

- **Toggles:** dark track, domed knob slides right and turns the track
  **green** — a physical switch; takes effect instantly, live.
- **Sound effects off also stops music** — a sound-off world is fully silent.
- **Button groups** (default track): selected = brass, others = dark.
- **Destructive rows visually quarantined:** red labels; both require
  confirmation via the themed **ConfirmDialog** (wood + brass card over a dimmed
  table — never a native `Alert`, which cannot be styled). Reset-track resets
  ask one track at a time (cross-platform — `Alert.prompt` doesn't exist on Android).

---

## 9. Flows

### 9.1 The auto-play engine

*The player only ever solves puzzles.*

**Session start:** tap Easy → Map (flow mode) → ★ pops in (400ms) → glides up
(900ms) → map fades (550ms, at 2000ms) → Puzzle replaces at 2600ms.

**After a win:** win overlay (2.2s) → overlay fades (500ms) → Map flow mode:
★ climbs N→N+1 (900ms) → map fades (550ms) → next level starts.

**After a fail:** "Tap anywhere to auto-retry…" — tapped within ~2.2–5s →
auto-retry SAME puzzle; silent 5s → fade → land on Map.

### 9.2 The cancellation law (sacrosanct)

Every manual action calls `clearFlow()` and kills all pending automation
instantly. Screens also clear on unmount as a safety net.

### 9.3 Edge cases

- **Level 200 win:** flow ends on the Map (no level 201); "Track complete! 🏆".
- **Fresh track:** ★ pops onto node 1 (no glide).
- **Quit mid-level:** confirmation → Map in manual mode; automation cleared.

---

## 10. Navigation Graph

```
Splash ──► Home ◄──────────┐
             │  ▲           │
   ▼ (card)  │  │ (back)    │
           Map ◄────────────┤   (all "Level map" buttons land here)
             │  ▲           │
   ▼ (node)  │  │ (back)    │
        PreLevel ◄──────┐   │
             │ ▲        │   │
   ▼ (Play)  │ │ (Next level, manual)
           Puzzle ──────┴───┘
```

**The `replace` pattern:** Puzzle → Map → Puzzle chains never stack.

---

## 11. Audio Choreography

| Event | Sound |
|---|---|
| Tile slide | woody thock |
| Any button/toggle/tab/card/node tap | soft click |
| Screen change | rising whoosh |
| Locked node | low buzz |
| Level start | 2-note rising chime |
| Timer ≤10s (10→6) | tick per second; music ducks to ~⅓ |
| Timer ≤5s (5→1) | urgent double-beep + haptic |
| Fail | loud falling tone |
| Win | 3-note rising chime |
| New personal best | 4-note fanfare (+600ms after win chime) |
| Marker glide | rising glide pop |
| Background music | gentle plucked loop, quiet bed, own gain node |

Rules: Music plays under everything. Warnings duck the music. Background →
everything suspends. `playsInSilentMode: true`. Three toggles; Sound=off also
stops music. (Phase 4 — expo-av.)

---

## 12. Animation Timing Sheet

| Animation | Duration | Easing |
|---|---|---|
| Screen fade (navigation) | 550ms | linear |
| Splash auto-advance → Home | 3000ms | — |
| Tile drag lift | 80ms → scale 1.06 | out |
| Tile slide settle | 140ms | `out(cubic)` |
| Tile snap-back | 130ms | `out(cubic)` |
| Overlay fade-out | 500ms | linear |
| ★ marker pop-in | 180ms | — |
| ★ marker glide | 900ms | `inOut(cubic)` |
| Current-node gold pulse | 1.6s loop | breathe |
| Map node rise (entry) | 420ms, 45ms stagger | `out(back)` |
| Current-node bob / shine orbit | 2.6s / 4.2s loops | breathe / linear |
| Map lantern breathe | 7s loop | inOut |
| Map dust motes | 9s loop | inOut |
| "tap to continue" pulse | 1.5s loop (100%→25%) | — |
| Red urgency pulse | 320ms/cycle, infinite | — |
| Win overlay hold | 2200ms | — |
| Fail ready / idle timeout | 2200ms / 5000ms | — |
| Fanfare delay after win chime | 600ms | — |

**Most likely tuning candidates:** 2200ms win hold · 900ms marker glide ·
140ms tile settle.

---

## Document Control

| Version | Date | Change |
|---|---|---|
| 1.0 | Phase 5 | Initial spec — MVP feature-complete state |
| 1.1 | bg1 restyle | Cards, panels, chips and buttons rebuilt as 3D wood under liquid glass (§1.1, §1.5). Buttons now depress 3px; HUD time plaque warns via a red accent edge instead of a red border. |
| 1.2 | Splash auto-advance | Splash hands off to Home on its own after 3s (`MOTION.splashAutoMs`); the tap still skips ahead early and still unlocks audio (§2, §12). |
| 1.3 | 200 levels/track + 50-image pack | Each grid ("matrix") now owns **100 levels** (chapter split moved 50→100, tracks run to 200); dataset + generator regenerated and the puzzle pack grew 15→50 (`PUZZLE_IMAGE_COUNT`). Map climbs 200 nodes with the gate between 100 and 101 (§4, §9.3). |

*Related: change any timing in this doc → change the constant in code in the
same commit. This document must never drift from the app.*
