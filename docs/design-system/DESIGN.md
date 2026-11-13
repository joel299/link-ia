---
version: alpha
name: aurum-lex-liquid-glass
description: Identidade jurídica escura em preto/carvão, bege/creme e dourado com material Liquid Glass controlado. A paleta existente é preservada.
colors:
  primary: "oklch(0.78 0.12 82)"
  secondary: "oklch(0.22 0.006 80)"
  tertiary: "oklch(0.86 0.08 88)"
  neutral: "oklch(0.13 0.004 80)"
typography:
  heading:
    fontFamily: Cormorant Garamond
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: Manrope
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
spacing:
  unit: "0.25rem"
components:
  panel:
    backgroundColor: "{colors.neutral}"
    textColor: "oklch(0.94 0.012 85)"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
---

## Overview

Design System Registry V1. Existing black/beige/gold palette stays intact. Liquid Glass is a layered material for selected surfaces, not a palette replacement.

## Colors

The actual application tokens remain the source of truth in src/styles.css and foundations/COLORS.md. The values above identify existing primitives; contrast has not yet been measured on the proposed translucent compositions.

## Typography

Cormorant Garamond is the display family; Manrope is the interface/body family. Preserve imports and existing hierarchy. Readable body and legal copy take precedence over translucency.

## Layout

Keep current AppShell and responsive TanStack routes. Use semantic groups, stable spacing, and dense surfaces for forms/tables/long legal copy. Avoid excessive pills and mini-cards.

## Elevation & Depth

Glass uses a shell, defined edge, directional highlight, inner plate, content, and shadow cue. CSS blur is secondary. Numeric tiers are proposed in materials/GLASS_TIERS.md.

## Shapes

Use the existing radius scale from src/styles.css. Do not turn all controls into pills or invent per-component radius.

## Components

Each actual shared feature and route has a registry ficha in components/. Reuse existing wrappers and preserve functionality.

## Do's and Don'ts

- Do preserve the black, beige and gold values.
- Do put text and icons on a stabilized plate.
- Do test background, interaction states, density and fallback.
- Do use CSS filter only where it is useful and bounded.
- Do not treat a reference image's blue surface as brand color.
- Do not rely on blur alone, raw opacity, or text shadows for contrast.
- Do not claim visual tests passed without screenshots and measurements.
