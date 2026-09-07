# atelier design specification

Reference: `concept.png`, generated with the built-in Image Gen tool. Full prompt brief: a complete Japanese oil painting editor named atelier, ivory and sage, two sidebars, central linen canvas, named tools, numeric brush controls, pigment swatches, mixing palette, save/new/undo controls, reference image and zoom. No external raster image is used to simulate the painting result.

- Colors: panels #f7f5ef; workbench #e6e3dc; text #30332e; accent #626b51; border #d5d0c5.
- Typography: Georgia for the atelier wordmark, Japanese serif for the canvas invitation; system sans for controls. Body controls 13px, panel headings 14px, wordmark 42px.
- Structure: 76px toolbar, 32px status bar, left tool rail, centered landscape canvas, right pigment rail. Independent sidebar scrolling at shorter heights.
- Components: thin outline tool buttons, olive selected borders, circular pigment swatches, compact ranges with editable numeric values, flat section dividers, restrained dialog sheets.
- Canvas: 960 x 720, fitted within the workbench, native paint and linen rendering, soft edge shadow, floating zoom bar. Display zoom reports actual scale, not a decorative 100%.
- Required extensions: detailed medium/angle/light controls in disclosure sections; reversible scraper; project open/export dialog; original practice painting; keyboard brush positioning; mobile panel drawers. These serve the requested practical oil painting workflow and extend the same system.
- Mobile: keep canvas usable, expose tools and colors through bottom tabs and accessible dismissible drawers.
