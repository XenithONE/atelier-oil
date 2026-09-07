# Verification — 2026-09-07

## Functional verification

15 automated tests passed on the release build. They cover pigment/thickness/wetness deposition, exact undo/redo restoration, reversible drying, dry paint remaining fixed under blending, no pigment from blending empty linen, impasto versus glaze, dry-brush coverage, scraping, lighting without material mutation, redo branch invalidation, wet yellow pickup by blue paint, spectral blue/yellow mixing, mixture ratios, binary project round trip, truncated input and invalid dimensions/float data.

TypeScript checking and the Vite production build passed. The production JavaScript is approximately 255kB (85kB gzip), plus CSS and locally served fonts.

The Codex in-app browser was used throughout; no Playwright Chromium fallback was needed. Verified through actual UI actions:

- Drawing with flat and knife tools; switching pigments and changing numeric inputs.
- Yellow plus ultramarine in the palette produced `#3D933E` through the actual mix control, including on the mobile drawer.
- Keyboard-only painting with Enter and Shift+arrow keys, followed by Ctrl+Z and redo.
- Glaze preset updated paint load, mixing, dryness and medium together; returning to standard restored their standard values.
- Drying and the resulting status message; fit and zoom controls.
- PNG export produced a real 960×720 PNG file (1,524,441 bytes for the tested study).
- Project export produced a 6,221,100-byte `.atelier` file. Reopening that file through the browser restored the study, title and settings and reported successful material restoration.
- Reloading restored the autosaved painting; history is intentionally not persisted.
- A local PNG reference loaded through the file chooser and appeared in the reference panel; its close button worked.
- The original editable practice study opens through New Work.
- No browser console errors or warnings were reported during the inspected workflow.

The in-app browser's download-event wait timed out, but the actual exported PNG was verified in the browser's Downloads location. The project download and file chooser restore were verified independently. This is a browser automation event limitation, not an app export failure.

## Visual verification

Reference: `design/concept.png`, built-in Image Gen, 1536×1024. Screenshot: `design/implementation.png`, captured from the in-app browser at 1536×1024. Both files were opened with `view_image` in the same comparison pass. A screenshot containing the actual editable practice study is saved as `docs/preview.png` and is used by the portfolio.

The native concept size, the default 1280×720 viewport, and a 390×844 mobile viewport were inspected. At 1536×1024, the browser reported no horizontal document overflow. The actual painting canvas occupies an 841×631 display rectangle and preserves its 960×720 document aspect ratio. Tool label typography was confirmed as locally served Noto Sans JP at 14px.

| Comparison point | Reference and implementation | Resolution |
| --- | --- | --- |
| Primary layout | Ivory header, two side rails, large central canvas, bottom status strip | Same architecture and hierarchy retained; shorter rails scroll independently |
| Palette | Warm ivory, taupe workspace, sage actions, charcoal text | Shared tokens used consistently; no accent or background gradients added |
| Typography | Serif atelier wordmark and canvas invitation; readable Japanese controls | Bundled Noto Sans JP to fix the initial small, weak system-font labels |
| Tool anatomy | Six named brushes in a two-column grid, selected outline, four range controls | Same controls and order; consistent native SVG silhouettes and pressed states |
| Painting assets | Linen, oil stroke preview, 16 pigment daubs and three mixing daubs | Actual paint engine generates these so each responds to color and brush settings; photographic reference marks are intentionally not embedded as fake painting output |
| Spacing and scale | Flat divided sections and floating zoom control | Removed first-pass swatch undersizing; compacted the right rail so the reference button fits at the native concept viewport |
| Copy | atelier, 油彩のアトリエ, 道具, 筆の調整, 絵具, 調色パレット, キャンバス, 作品を保存, 新しい作品 | Core visible copy and ordering match. Necessary additions are the palette + button and collapsed medium/light controls |
| Responsive behavior | Same studio system extended to small screens | Mobile canvas stays visible; tool and pigment drawers tested at 390×844, with explicit accessible names for compact new/save buttons |

The implementation was compared directly against the concept and follows its primary layout, color system, control families and copy. Intentional functional differences are the truthful fitted zoom percentage (88% in the native-size test rather than a decorative 100%), an undistorted 4:3 document canvas, native simulated pigment daubs instead of photographic assets, compact tool typography, and additional collapsed oil/material controls. These extensions are listed in the design system before final handoff. There is no clipping of the primary drawing surface and no unimplemented visible control.

## Scope of the result

Oil appearance and handling are approximations; measured manufacturer pigments and full fluid dynamics are outside this implementation. Drying is explicit, not time based. There is one physical painting surface rather than an editable digital layer stack. Pen pressure logic is implemented; actual pressure-sensitive hardware was not available for this browser test. The 390×844 check validates the responsive layout using the desktop browser, not physical mobile hardware.
