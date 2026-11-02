# Tangut Input UI

The design system behind the site. Plain CSS over native HTML elements, so a page, a Svelte
component or a static form shares one palette, one type scale and one set of states without a
runtime.

```
design/
  tokens.css     colour, type, space, shape, motion and layer tokens
  base.css       reset, document face, one focus ring, scrollbars, selection
  controls.css   buttons, chips, fields, checkbox, radio, switch, segmented, menu, toast
  patterns.css   page frame, index, tiles, rows, candidate bar, keys, formula, popover
  index.css      the four layers, in order
```

The reference page is `app/design.html`, served at `/design.html`: every token and pattern in both
schemes, with contrast measured from the rendered page. `scripts/check_design.mjs` operates it in
Chromium and visits every app page.

## Using it

Import the layer once, before the site's own CSS:

```css
@import 'tangut-input/design.css';
```

In this repository:

```css
@import '../design/index.css';
```

The palette follows the reader's system scheme. A site that offers a switch sets `data-theme` on
the root:

```html
<html data-theme="dark">
```

Every token is a `light-dark()` pair, so `color-scheme` picks the side. A host page points the
script tokens at its own faces; everything else is the system's:

```css
:root {
  --ui-font-script: 'Noto Serif Tangut', serif;
  --ui-font-ids: 'IDS Operators', var(--ui-font-script);
}
```

A site may override tokens on the root for its brand. It should leave the control classes and
states alone:

```css
:root {
  --ui-color-accent: light-dark(#8c2a13, #ffa387);
  --ui-font-sans: 'Inter', system-ui, sans-serif;
}
```

Use the classes rather than writing a local button or field:

```html
<button class="ui-button" data-variant="primary" data-size="sm">Add to text</button>
<input class="ui-input" data-size="xl" aria-label="Search" />
<span class="ui-select-wrap"><select class="ui-select">…</select></span>
<span class="ui-chip-row">
  <button class="ui-chip" aria-pressed="true">All</button>
  <button class="ui-chip">Level</button>
</span>
```

Variants are data attributes: `data-variant="primary" | "quiet" | "danger" | "toast"`, `data-size="sm" | "lg" | "icon" | "icon-sm"`. A toggle button takes `aria-pressed="true"`; a chip takes
the same. A disabled control takes the `disabled` attribute, never a class.

## Tokens

`tokens.css` is the source of values; this table is the contract.

### Colour

| Token | Role |
| --- | --- |
| `--ui-color-canvas` | The page |
| `--ui-color-surface` | A panel, the card, a menu |
| `--ui-color-surface-sunken` | An inset area, a read-only field, the candidate bar |
| `--ui-color-surface-hover` / `-active` | Hover and pressed fills |
| `--ui-color-ink` | Primary text |
| `--ui-color-ink-soft` | Secondary text, a result's gloss |
| `--ui-color-ink-muted` | Labels, hints, metadata |
| `--ui-color-border` / `-strong` | Decorative rules and edges |
| `--ui-color-control-border` / `-hover` | The 3:1 boundary of a field or an unchecked box |
| `--ui-color-accent` / `-hover` / `-active` | Selection, the primary action, the mark |
| `--ui-color-accent-soft` | A selected row, a checked chip, a matched tile |
| `--ui-color-accent-ink` | Text on `accent-soft` |
| `--ui-color-on-accent` | Text and marks on an accent fill |
| `--ui-color-focus` | The focus ring; ink in both schemes |
| `--ui-color-danger` / `-soft` / `-hover` / `-on-danger` | Errors and destructive actions |
| `--ui-color-inverse-surface` / `-ink` | The toast |
| `--ui-color-selection` / `-selection-ink` | Text selection |
| `--ui-color-scrollbar` / `-hover` | Scrollbars |

`--ui-shadow-1` is for a selected segment; `--ui-shadow-2` for a menu, a popover and a toast. The
page itself is flat.

### Type, space, shape and motion

| Token | Value |
| --- | --- |
| `--ui-text-2xs` … `--ui-text-3xl` | 11, 12, 13, 14, 16, 20, 26, 32 px |
| `--ui-leading-tight` / `-normal` / `-loose` | 1.25 / 1.5 / 1.65 |
| `--ui-weight-medium` / `-semibold` / `-bold` | 500 / 600 / 650 |
| `--ui-space-3xs` … `--ui-space-5xl` | 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40 px |
| `--ui-radius-xs` … `-2xl`, `-pill` | 4, 6, 8, 10, 12, 14, 999 px |
| `--ui-control-h-sm` / `-md` / `-lg` / `-xl` | 28, 32, 38, 50 px |
| `--ui-checkbox-size` / `--ui-radio-size` | 18 px |
| `--ui-switch-width` / `-height` / `-thumb` | 40 / 24 / 18 px |
| `--ui-target-min` | 24 px |
| `--ui-ring-width` / `-offset` | 2 px / 2 px |
| `--ui-duration-fast` / `--ui-duration` | 110 ms / 160 ms |
| `--ui-z-chrome` … `--ui-z-toast` | 30, 40, 50, 60, 70 |

Three surfaces, and only the accent as a colour of action: warm paper, ink and one vermilion. A
component reads semantic tokens, never a raw colour.

## Which control

| Need | Control | Why |
| --- | --- | --- |
| An action | `.ui-button` | A native button; `data-variant` names the weight |
| A filter, or a small on/off choice | `.ui-chip` with `aria-pressed` | One line high; a row of them wraps |
| One choice among two to four compact options | `.ui-segmented` | Native radios under the faces; one Tab stop |
| A free value | `.ui-input` or `.ui-textarea` | Native validation, autofill, input methods |
| One choice from a long list | `.ui-select` in `.ui-select-wrap` | The browser's list and typeahead |
| An immediate on/off setting | `.ui-switch` | `role="switch"` on a checkbox |
| One or more independent options | `.ui-checkbox` in `.ui-check-row` | Space toggles |
| One choice out of a few visible options | `.ui-radio` in a label | Arrow keys move the choice |

A card is a container: `.ui-card`, with `data-variant="sunken"` for an inset and `data-padding="sm"`
for a compact panel. A one-off statement about the records is `.ui-notice`.

Checkbox, radio and switch are native `<input>` elements restyled with `appearance: none`. The
browser keeps form submission, autofill, keyboard, screen readers and forced-colours mode working.

## Patterns

| Class | Use |
| --- | --- |
| `.ui-page`, `.ui-page-head`, `.ui-page-title`, `.ui-page-intro` | A finder page and its opening text |
| `.ui-section`, `.ui-section-head`, `.ui-count`, `.ui-more-link` | A block of results and its count |
| `.ui-index`, `.ui-index-link` | The ways into the site, as a list of rows |
| `.ui-tiles`, `.ui-tile`, `.ui-tile-glyph`, `.ui-tile-note` | A grid of characters |
| `.ui-rows`, `.ui-row`, `.ui-row-pick`, `.ui-row-glyph`, `.ui-row-body` | A list of results |
| `.ui-candidates`, `.ui-candidate` | The numbered bar of an input method |
| `.ui-keys`, `.ui-key` | A key chart |
| `.ui-table`, `.ui-table-wrap` | A data table with row rules and a sticky header |
| `.ui-formula` | An IDS description in the operator face |
| `.ui-popover` | A panel over the page |
| `.ui-tag`, `.ui-kbd` | A small code or key |

The `.ui-tiles` grid takes its size from `--ui-tile-size`. A page adds layout (columns of a result
row, width of a key) and nothing that repaints a control.

## States

| State | How it is expressed |
| --- | --- |
| Default | Surface fill, a `border` or `control-border` edge |
| Hover | The surface shifts; the boundary darkens |
| Pressed | `surface-active`, or `aria-pressed="true"` for a toggle |
| Selected | `accent-soft` fill; a check, thumb, dot or outline says it too |
| Focus | One 2px ink ring, 2px outside the control |
| Disabled | The `disabled` attribute and 45% opacity |
| Invalid | `aria-invalid="true"` or `:user-invalid`; a danger edge, a soft fill, an error sentence |
| Read-only | The sunken surface; still focusable and selectable |

## Accessibility

- Every control has a visible label, or an `aria-label` for an icon-only button.
- Tab reaches every control; Space toggles; arrows move within a segmented control or radio group.
- The ring stays visible on every surface in both schemes, at 3:1 or better.
- State is never colour alone: a mark, a thumb, a rule or a word carries it.
- Text clears 4.5:1 on its surface; a boundary that identifies a control clears 3:1.
- A control and its label meet the 24px target.
- A hint describes a control through `aria-describedby`; it never joins the control's name.
- `prefers-reduced-motion` collapses transitions; forced colours keep the shapes.

`scripts/check_design.mjs` checks all of this in Chromium. Start the dev server and run:

```sh
bun run dev
DESIGN_URL=http://localhost:5180/design.html bun run check:design
```

Pass `DESIGN_SHOTS=docs/design/check` to write screenshots of the reference page.

## References

- [WCAG 2.2 — Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG 2.2 — Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [ARIA Authoring Practices — Switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
