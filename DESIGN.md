# Design Guidelines

Read this before touching any page. The site has one visual system — warm
"boho print" with skeuomorphic blocks — and every element must belong to it.
All styles are inline in each HTML file (no shared stylesheet, no build step),
so consistency is maintained by following these rules, not by tooling.

## Concept

The homepage cube sets the language: flat warm colors, dark ink outlines,
visible 3D structure. Everything interactive on the site is a **block** —
a colored face with an ink outline sitting on a visible extruded side.
Think wooden toys and letterpress print, never glass, gradients, glows,
or neon.

## Palette

| Token | Hex | Use |
|---|---|---|
| Paper | `#F0EEE6` | Page background |
| Card | `#FAF9F5` | Card faces |
| Cream | `#F1EAD7` | Secondary button / chip faces |
| Ink | `#3D3929` | Outlines, code-chip text, button extrusion wrap |
| Text | `#191919` | Headings; `#3D3929` for body, `#6B675C` muted, `#A39E8F` faint |
| Accent | `#6F7D52` (olive sage) | Italic name/title words, primary buttons, links |
| Accent deep | `#5A6642` | Hover state of accent |
| Side (light) | `#CFC7B0` | Extruded side under cream/card blocks |
| Side (olive) | `#4F5A3A` | Extruded side under olive blocks |
| Code block | `#262420` bg, `#EDEAE0` text, `#161410` side | `pre` slabs |

Terracotta `#D97757`, brick `#B25438`, ochre `#DCAE54`, dusty teal `#7E9C99`,
sage `#9CA878` live **only inside the cube artwork** (and `INTERIOR #4B4538`).
Don't promote them to UI without being asked.

## Typography

- **Fraunces** (Google Fonts, variable 300–600, + italics): all headings and
  body text. Headings weight 500, tight `-0.01em` tracking. Body weight 300–340.
- One italic accent word per display heading, colored olive:
  `Hey, I'm <em>Palash</em>.` / `The <em>Blog</em>`.
- **Fragment Mono**: small uppercase labels (dates, button text, back-links,
  `letter-spacing: 0.15em`) and code. Never for headings or body.
- Captions (e.g. the cube's corner labels) are small *italic* Fraunces in
  faint `#A39E8F` — like figure captions in a book.

## The block recipe

**Extrusion means clickable.** Only interactive surfaces (buttons, post cards,
back-links) get the extruded side; static surfaces (code blocks, images,
inline code chips) get the ink outline alone, flat. If it doesn't respond to
a click, it must not look pressable.

Interactive blocks:

```css
background: <face color>;
border: 1.5px solid #3D3929;
border-radius: 10–14px;          /* slab, not pill */
box-shadow:
  0 5px 0 0 <side color>,        /* extruded side */
  0 5px 0 1.5px #3D3929;         /* ink wrap around the side */
transition: transform 0.12s ease, box-shadow 0.12s ease;
```

States: hover lifts (`translateY(-2px)`, side grows to 7px); active presses
flat (`translateY(3–4px)`, side collapses to 1px). Small elements (e.g.
back-links, 4px deep) scale the depth down proportionally.

Static outlined surfaces: `border: 1.5px solid #3D3929` (1px and a softer
`rgba(61, 57, 41, 0.35)` for inline code chips), matching radius, **no
box-shadow**.

No other shadows. No blurred drop shadows, no `backdrop-filter`, no gradients.

## Motion

Short and physical: 0.12–0.25s ease, movement only in Y (lift/press).
Nothing floats, pulses, or fades on its own. The cube is the only ambient
animation on the site.

## Cube artwork (index.html)

Canvas-rendered, anti-aliased polygons: face colors from the palette above,
continuous soft shading (`shade = 0.82 + 0.18 * dot`), `#3D3929` rounded
outlines, no wireframes, no dithering (the old Bayer-dither look is retired).
Note: `getFaceInfo` negates the cross product because the face winding is
inward; keep that if you touch the renderer, or culling silently inverts and
you'll render the cube's interior.

## When adding a page or element

1. Paper background, Fraunces + Fragment Mono via the same `@import`.
2. Copy the block recipe for anything clickable.
3. Olive for emphasis and links; ink for structure; cube colors stay in the cube.
4. Verify in a real browser before calling it done — several past bugs
   (inverted normals, sticker permutation) were invisible until looked at.
