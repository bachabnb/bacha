/**
 * The Bacha art catalogue.
 *
 * One entry per generated asset: where it lives, what it is for, and the
 * subject half of its prompt. Every request is built from the SAME style base
 * below, which is what keeps twenty separate renders reading as one hardware
 * universe rather than twenty unrelated images.
 *
 * `.mjs` rather than `.ts` so the generation script can import it directly
 * without a build step.
 */

/**
 * BACHA ART STYLE — prepended to every single prompt. Do not vary this per
 * asset. If the look needs to change, change it here and regenerate the set.
 */
export const BACHA_STYLE =
  'Premium industrial isometric product visualization for the Bacha ecosystem. ' +
  'Matte graphite anodized aluminium, black machined metal, brushed dark steel, clear acrylic ' +
  'chambers, smoked transparent glass, soft yellow polymer, and warm BNB-yellow internal ' +
  'illumination. Precise rounded bevels, machined panels, small rounded-square ventilation ' +
  'patterns, physical switches and large circular yellow interaction buttons. ' +
  'Japanese premium consumer hardware design in the spirit of Teenage Engineering and Nothing. ' +
  'Orthographic three-quarter camera at 30 to 45 degrees elevation, soft studio lighting, ' +
  'controlled reflections and bloom, soft contact shadow, minimal technical geometry. ' +
  'Premium fintech hardware aesthetic.'

export const CAMERA =
  'True isometric projection, camera at 30 degrees elevation and 45 degrees azimuth, ' +
  'orthographic, no perspective distortion, object centred in frame.'

export const MATERIALS =
  'Materials strictly limited to the Bacha palette: matte graphite, deep near-black anodised ' +
  'metal, brushed aluminium, clear acrylic, smoked glass, and one saturated warm yellow ' +
  '(#F0B90B) used as emissive light and accent only. Polished chrome only for rare variants. ' +
  'No gold plating, no casino gold, no rainbow materials, no chrome overload.'

export const LIGHTING =
  'Soft studio key light from the upper left, gentle neutral fill from the right, and warm ' +
  'yellow illumination emanating from inside the object. Contained lighting with no large glow ' +
  'spill. Crisp edges, restrained specular highlights, soft contact shadow beneath the object. ' +
  'No dramatic neon, no cyberpunk rim lighting, no coloured haze.'

export const REFERENCES =
  'Reads as a real manufactured product from a single hardware company: minimal, technical, ' +
  'precisely machined, expensive. Physically based rendering, high detail, clean topology, ' +
  'product-catalogue quality.'

export const ISOLATED =
  'Fully transparent background. The object is completely isolated with no backdrop, ' +
  'no ground plane, no environment, no room, no vignette and no painted background of any kind.'

export const NEGATIVE =
  'Not a pharmaceutical pill, not a medicine capsule, not an elongated lozenge shape, ' +
  'not a battery, not a cylinder. ' +
  'Absolutely no text, no letters, no words, no numbers, no typography, no logos, ' +
  'no brand marks, no token symbols, no watermarks, no signage, no labels, no UI screens, ' +
  'no percentages, no prices. ' +
  'No people, no hands, no faces, no photography, no photographic realism of real rooms, ' +
  'no cartoon or anime style, no casino imagery, no playing cards, no poker chips, no roulette, ' +
  'no slot machines, no coins with symbols, no neon cyberpunk, no purple, no rainbow gradients, ' +
  'no fantasy elements, no clutter.'

export function composePrompt(subject, opts = {}) {
  return [
    BACHA_STYLE,
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

/** The machine itself, described identically wherever it appears. */
const MACHINE_BODY =
  'a tall capsule-dispenser machine with a machined matte-graphite chassis, crisp chamfered ' +
  'edges and fine brushed-metal front panels. The upper half is a clear acrylic chamber packed ' +
  'with smooth two-part capsules in matte black, graphite and saturated warm yellow, lit from ' +
  'within by soft warm yellow light. Below the chamber sits a control deck with a single ' +
  'recessed circular yellow-illuminated button, and beneath that a dark recessed dispensing tray'

export const CATALOGUE = [
  // ---------------------------------------------------------------- hero
  {
    id: 'hero-machine',
    dir: 'hero',
    section: 'Homepage hero',
    aspect: '3:4',
    size: '1024x1536',
    themes: 'both',
    subject:
      `The signature hero object of the brand, rendered at maximum fidelity: ${MACHINE_BODY}. ` +
      'The acrylic chamber is generously sized and holds roughly ten smooth two-part capsules in ' +
      'matte black, graphite and warm yellow, suspended at varied heights with space between them ' +
      'rather than packed solid. A continuous thin yellow light seam traces the chamber edges. ' +
      'The lower body carries a brushed aluminium faceplate with a large recessed circular ' +
      'yellow-illuminated button, a small rounded-square ventilation grille, and a deep machined ' +
      'dispensing tray beneath it. Every surface is clean and unlabelled.',
  },
  {
    id: 'hero-environment',
    dir: 'hero',
    section: 'Homepage hero backdrop',
    aspect: '16:9',
    size: '1536x1024',
    themes: 'both',
    isolated: true,
    subject:
      'Isometric 3D render of a sparse arrangement of low extruded geometric platforms and thin ' +
      'floating frames — squares, crosses and chamfered slabs — scattered across an implied grid ' +
      'at varying heights. Matte graphite surfaces with a few thin warm yellow light seams tracing ' +
      'edges. Deliberately sparse and almost empty, built to sit behind content without competing.',
  },

  // ------------------------------------------------------------- machine
  {
    id: 'machine-exploded',
    dir: 'machine',
    section: 'How it works / fairness',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      `Isometric 3D exploded technical view of ${MACHINE_BODY}. The components are separated ` +
      'vertically along a single axis with even gaps between them, floating in order: the acrylic ' +
      'capsule chamber at the top, then an internal rotating selector wheel, then a machined ' +
      'routing block, then the dispensing tray at the bottom. Thin yellow alignment lines connect ' +
      'the separated parts. Reads as an engineering drawing rendered in three dimensions.',
  },
  {
    id: 'machine-menu',
    dir: 'menu',
    section: 'Desktop mega menu panel',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      `Isometric 3D render of a compact desk-sized version of ${MACHINE_BODY}. Squatter and ` +
      'smaller than the hero machine, simplified detail, designed to read clearly at small size.',
  },

  // ------------------------------------------------------------- tiers
  {
    id: 'tier-quick',
    dir: 'machine',
    section: 'Machine tiers — QUICK',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a compact single-column capsule dispenser module in plain matte ' +
      'graphite. A small clear acrylic chamber holding a handful of black and graphite capsules, ' +
      'one small unlit button, a narrow tray. The most basic model in a product family: ' +
      'restrained, minimal illumination, no chrome.',
  },
  {
    id: 'tier-boost',
    dir: 'machine',
    section: 'Machine tiers — BOOST',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a mid-range capsule dispenser module in matte graphite with ' +
      'brushed aluminium side panels. A taller clear acrylic chamber holding black, graphite and ' +
      'yellow capsules, warm yellow light strips tracing the chamber base and a lit circular ' +
      'button. Visibly a step up from the most basic model in the same product family.',
  },
  {
    id: 'tier-max',
    dir: 'machine',
    section: 'Machine tiers — MAX',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of the flagship capsule dispenser module in matte graphite with ' +
      'polished chrome trim and machined yellow accents. A large clear acrylic chamber holding ' +
      'black, yellow and mirror-chrome capsules, strong warm yellow internal illumination, and a ' +
      'prominent lit control button. The premium model in the same product family.',
  },

  // ------------------------------------------------------------ capsules
  {
    id: 'capsule-yellow',
    dir: 'capsules',
    section: 'Decorative / rarity',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a single a gachapon capsule: a hollow SPHERE, perfectly round like a ball, split into two hemispherical halves along its equator with a fine seam where they meet. The upper hemisphere is translucent tinted ' +
      'acrylic, the lower hemisphere is solid matte saturated warm yellow. Spherical silhouette, ' +
      'as wide as it is tall. One object, floating.',
  },
  {
    id: 'capsule-black',
    dir: 'capsules',
    section: 'Decorative / rarity',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a single a gachapon capsule: a hollow SPHERE, perfectly round like a ball, split into two hemispherical halves along its equator with a fine seam where they meet. Matte graphite-black shell with a thin warm ' +
      'yellow accent line along the equatorial seam. Soft-touch finish that absorbs light. ' +
      'Spherical silhouette, as wide as it is tall. One object, floating.',
  },
  {
    id: 'capsule-chrome',
    dir: 'capsules',
    section: 'Epic rarity',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a single a gachapon capsule: a hollow SPHERE, perfectly round like a ball, split into two hemispherical halves along its equator with a fine seam where they meet, in mirror-polished chrome with warm gold ' +
      'reflections. Sharp caustic highlights, visibly heavier and colder than a matte one. ' +
      'Spherical silhouette, as wide as it is tall. One object, floating.',
  },
  {
    id: 'capsule-cluster',
    dir: 'capsules',
    section: 'Section transitions',
    aspect: '16:9',
    size: '1536x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a loose cluster of eight spherical gachapon capsules — hollow BALLS, ' +
      'each split into two hemispheres along its equator — floating at different heights and ' +
      'rotations, arranged diagonally. A mix of matte black, graphite, warm yellow and one ' +
      'mirror-chrome sphere. Even spacing, no overlap crowding.',
  },
  {
    id: 'cta-capsule',
    dir: 'cta',
    section: 'Final call to action',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D hero render of one large a gachapon capsule: a hollow SPHERE, perfectly round like a ball, split into two hemispherical halves along its equator with a fine seam where they meet. The upper hemisphere is matte black and ' +
      'the lower is saturated warm yellow. The top half is lifted and floating slightly apart from ' +
      'the bottom half, with warm yellow light escaping from the gap between them. Nothing visible ' +
      'inside. Spherical silhouette. The single most refined capsule render in the set.',
  },

  // ---------------------------------------------------------------- steps
  {
    id: 'step-connect',
    dir: 'steps',
    section: 'How it works — 01 Connect',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a slim matte-graphite handheld device lying flat, with a thin warm ' +
      'yellow light path arcing from its edge toward a small machined docking block. The device ' +
      'screen is a plain dark unlit surface with nothing displayed on it. Reads as two objects ' +
      'establishing a connection.',
  },
  {
    id: 'step-spin',
    dir: 'steps',
    section: 'How it works — 02 Spin',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a precision machined control mechanism: a large circular recessed ' +
      'button in warm yellow set into a brushed aluminium faceplate, with a segmented rotating ' +
      'selector ring around it caught mid-rotation, motion implied by the ring segments. ' +
      'No hands, no fingers.',
  },
  {
    id: 'step-reveal',
    dir: 'steps',
    section: 'How it works — 03 Reveal',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a a gachapon capsule: a hollow SPHERE, perfectly round like a ball, split into two hemispherical halves along its equator with a fine seam where they meet, split open: the upper hemisphere is lifted and tilted ' +
      'away, and a plain blank circular metal disc rises out of the lower hemisphere on a column ' +
      'of soft warm yellow light. The disc is completely featureless with no markings, symbols or ' +
      'engraving of any kind. The capsule halves are hemispherical, not elongated.',
  },

  // ------------------------------------------------------------- fairness
  {
    id: 'fairness-verify',
    dir: 'fairness',
    section: 'Fairness section',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a clear acrylic cube containing a single suspended warm yellow ' +
      'geometric core, mounted on a machined graphite base. A thin beam of warm yellow light passes ' +
      'through the cube and emerges as three precise parallel rays. Beside it, three small ' +
      'chamfered graphite blocks are linked in a row by thin yellow connecting rods. ' +
      'Calm, precise and scientific — an instrument, not a computer.',
  },
  {
    id: 'activity-rail',
    dir: 'isometric',
    section: 'Activity feed',
    aspect: '16:9',
    size: '1536x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a short machined conveyor rail in matte graphite with brushed ' +
      'aluminium supports, carrying four two-part capsules spaced evenly along it in black, ' +
      'graphite and yellow. Thin warm yellow light strips run along both edges of the rail. ' +
      'Clean industrial automation hardware.',
  },
  {
    id: 'token-orbit',
    dir: 'isometric',
    section: 'Token discovery',
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a central machined graphite core with a warm yellow illuminated ' +
      'centre, surrounded by three concentric thin metal orbital rings at different inclinations. ' +
      'Spaced evenly around the rings are eight small empty circular mounting plates in brushed ' +
      'aluminium, each one completely blank and featureless with nothing on its surface. ' +
      'The plates are empty sockets waiting to be filled.',
  },
  {
    id: 'gacha-rebuilt',
    dir: 'isometric',
    section: 'Story — an old idea, moved onchain',
    aspect: '16:9',
    size: '1536x1024',
    themes: 'both',
    subject:
      'A single wide isometric scene reading left to right as one continuous machine. ' +
      'On the left, a simplified antique capsule dispenser rendered in the same matte graphite ' +
      'and brushed metal as the rest of the family: a round glass globe on a cast metal column ' +
      'with a mechanical crank handle. In the centre, that machine dissolves into an exploded ' +
      'mechanical transition — separated gears, a rotating selector drum, and a clear acrylic ' +
      'block containing a glowing yellow core — arranged along a horizontal machined rail with ' +
      'thin yellow light running through it. On the right, the modern Bacha machine: a tall ' +
      'graphite chassis with a clear acrylic capsule chamber lit from within, a circular yellow ' +
      'button and a dispensing tray. The three stages sit on one shared baseline and are linked ' +
      'by the rail, so the eye travels from the old mechanism to the new one. Completely ' +
      'unlabelled — no plaques, no markings, no engraving of any kind.',
  },
  {
    id: 'proof-core',
    dir: 'fairness',
    section: 'Fairness — reproduce the result',
    aspect: '16:9',
    size: '1536x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of a transparent mechanical verification core: a clear acrylic housing ' +
      'with machined graphite end caps, containing a single suspended cube of glowing warm yellow ' +
      'light at its centre. A machined input rail enters the housing from the left and a second ' +
      'rail exits to the right, both traced by a thin continuous yellow light line that passes ' +
      'straight through the core. Directly behind the housing, three small chamfered graphite ' +
      'blocks sit locked in a row on a shared mount, each with a fine yellow seam. ' +
      'Precise, instrument-like and completely unlabelled — no markings or engraving of any kind.',
  },
  {
    id: 'reward-vault',
    dir: 'isometric',
    section: "What's in the machine",
    aspect: '1:1',
    size: '1024x1024',
    themes: 'both',
    subject:
      'Isometric 3D render of an open machined storage vault in matte graphite: a heavy chamfered ' +
      'case with a thick door swung open on precision hinges, revealing an internal grid of square ' +
      'compartments. Each compartment holds one two-part capsule in black, graphite, yellow or ' +
      'chrome. Warm yellow light washes the interior. The door face is smooth and completely blank.',
  },
]
