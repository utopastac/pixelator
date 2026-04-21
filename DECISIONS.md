# Decision Log

An evolving record of UX design decisions, in chronological order.

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-19 | Alt-click on a layer's visibility icon toggles "solo" for that layer across the stack | Matches the Photoshop/Krita industry pattern; one click surfaces a single layer's contribution without manually toggling every other row, and a second alt-click restores the prior "all visible" state. Implemented as a single undo step. |
| 2026-04-19 | Dark mode affects app chrome only — the pixel canvas stays white | Keeps drawings and PNG/SVG exports bit-for-bit identical regardless of theme; users don't see a "different" drawing at night. |
| 2026-04-19 | Theme toggle sits in the LayersPanel utilities bar, immediately left of the Keyboard-shortcuts button | Co-locates infrequently-used app-chrome affordances in one corner rather than scattering them; keeps the toolbar and file menu focused on drawing actions. |
| 2026-04-19 | Simple two-state light/dark toggle with OS preference only as the first-load default | Avoids a three-state "system / light / dark" control that would add UI complexity for a rarely-changed setting; explicit choice is persisted thereafter in `localStorage['pixelator.theme']`. |
| 2026-04-19 | Dark palette uses neutral greys (surface #1a1a1a, subtle #262626, secondary text #a3a3a3) rather than inverting the light tokens | Pure-black surfaces feel harsh and hide the hard-edged offset shadows that give the UI its pixel-art character; a soft near-black lets shadows and borders still read. |
| 2026-04-21 | TitlePanel organised into four semantic clusters: [title \| size] \| [zoom \| tiling] \| [sym \| wrap \| alpha lock] \| [undo \| redo] | Tiling is a view modifier (how the canvas looks), so it groups with zoom. Draw modifiers (symmetry, wrap, alpha lock) need individual visibility since all three can be active simultaneously — a single collapsed popover was rejected for this reason. |
