/**
 * The Bacha art direction, in one place.
 *
 * Every generated asset is built from these fragments so the whole set reads
 * as one universe rather than fifteen unrelated renders. Changing the house
 * style here and regenerating is how the look evolves — never by editing an
 * individual prompt into a different aesthetic.
 *
 * This module is imported by the generation script only. It is never bundled
 * into the client and contains no credentials.
 */

/** Isometric projection, stated the same way every time. */
export const CAMERA =
  'True isometric projection, camera at 30 degrees elevation and 45 degrees azimuth, ' +
  'orthographic, no perspective distortion, object centred in frame.'

/** The material palette. Nothing outside this list may appear. */
export const MATERIALS =
  'Materials strictly limited to: matte graphite, deep near-black anodised metal, ' +
  'brushed aluminium, clear acrylic, and one saturated warm yellow (#F0B90B) used as ' +
  'emissive light and accent only. Optional polished chrome for rare variants. ' +
  'No other hues, no colour gradients outside this palette.'

/** Lighting recipe — contained, so the asset works on light and dark pages. */
export const LIGHTING =
  'Soft studio key light from the upper left, gentle fill from the right, subtle warm ' +
  'yellow internal illumination emanating from inside the object. Contained lighting with ' +
  'no large glow spill into the background. Crisp edges, restrained specular highlights, ' +
  'soft contact shadow directly beneath the object only.'

/** Industrial design references, to keep it away from toy/casino territory. */
export const REFERENCES =
  'Industrial design language of Teenage Engineering, Nothing and high-end audio hardware: ' +
  'minimal, technical, precisely machined, expensive. Physically based rendering, high detail, ' +
  'clean topology, product-catalogue quality.'

/** Transparency, requested explicitly because it is load-bearing for theming. */
export const ISOLATED =
  'Fully transparent background. The object is completely isolated with no backdrop, ' +
  'no ground plane, no environment, no vignette and no painted background of any kind.'

/**
 * Negative constraints.
 *
 * Text and logos are the important ones: real token marks and real copy are
 * composited in HTML where they stay accurate, so a model must never attempt
 * either. The rest keeps the set out of aesthetics the brand rejects.
 */
export const NEGATIVE =
  'Absolutely no text, no letters, no words, no numbers, no typography, no logos, ' +
  'no brand marks, no token symbols, no watermarks, no signage, no labels, no UI screens. ' +
  'No people, no hands, no faces, no cartoon or anime style, no casino imagery, ' +
  'no playing cards, no poker chips, no roulette, no slot machines, no coins with symbols, ' +
  'no neon cyberpunk, no purple, no rainbow gradients, no fantasy elements, no clutter.'

/** Assembles one complete prompt from a subject description. */
export function composePrompt(subject: string, opts: { isolated?: boolean } = {}): string {
  return [
    subject.trim(),
    CAMERA,
    MATERIALS,
    LIGHTING,
    REFERENCES,
    opts.isolated === false ? '' : ISOLATED,
    NEGATIVE,
  ]
    .filter(Boolean)
    .join(' ')
}
