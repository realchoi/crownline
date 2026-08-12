# Offline world land basemap

`world-land.svg` is derived from **Natural Earth 1:110m Land**, pinned to Natural Earth Vector tag **v5.1.2**.

- Source: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson
- Natural Earth terms: https://www.naturalearthdata.com/about/terms-of-use/
- Accessed: 2026-08-12
- Status: Natural Earth data is in the public domain under the terms linked above.

The source GeoJSON and conversion tool are intentionally not application dependencies. The one-time conversion command was:

```bash
npx --yes mapshaper@0.6.113 /tmp/crownline-ne-110m-land.geojson \
  -proj wgs84 -simplify 12% keep-shapes \
  -style fill='#000000' stroke='none' \
  -o format=svg width=1000 margin=0 /tmp/crownline-world-land.svg
```

After conversion, the SVG root was normalized to `viewBox="0 0 1000 500"`; fixed dimensions and generated metadata were removed. The land group was vertically aligned to the full equirectangular latitude range. The asset contains land silhouettes only: no labels, scripts, external references, or modern political boundaries.
