export const CONSTELLATION_BLURB: Record<string, string> = {
  Ori: "The hunter. A belt of three, Betelgeuse at the shoulder, Rigel at the foot. Follow the belt to Sirius, or the other way to Aldebaran.",
  UMa: "The great bear. Its plough — the Dipper — points toward Polaris, a northern compass drawn in seven stars.",
  UMi: "The little bear. Polaris sits at the tip of its tail and holds the north while the rest of the sky turns.",
  Cas: "The queen on her throne. A sharp W, easy even in a bright sky, and a companion of the pole.",
  Cyg: "The swan, wings open down the Milky Way. Deneb is the tail; the body is the Northern Cross.",
  Lyr: "A small parallelogram. Vega is its lantern, one vertex of the Summer Triangle, almost overhead in July.",
  Sco: "The scorpion. Antares burns like a heart, the stinger curling south toward the galactic centre.",
  Sgr: "The archer. The teapot sits in the densest star-clouds of the Milky Way, pouring toward the core.",
  Leo: "The lion. Regulus at the heart, a sickle for a mane — a backwards question mark in the spring.",
  Tau: "The bull. Aldebaran is the angry eye; the Pleiades rest on its shoulder like a breath of frost.",
  Gem: "The twins. Castor and Pollux stand side by side, a winter pair above Orion’s raised arm.",
  Cru: "The southern cross. Four bright stars, a pointer toward the pole that Europe never sees.",
  Cen: "The centaur. Rigil Kentaurus is the nearest bright star to the Sun, a southern lantern.",
  And: "The chained princess. The Andromeda Galaxy sits just off her knee — the farthest thing the eye can take.",
  Peg: "The winged horse. A great square, the autumn’s landmark, with Andromeda walking off one corner.",
  Aql: "The eagle. Altair is the head, another vertex of the Summer Triangle, striped by dark dust lanes.",
  Boo: "The herdsman. Arcturus follows the Dipper’s handle in a long arc — spike it, and you have him.",
  Her: "The kneeling hero. A keystone of four stars marks the torso, high in the summer vault.",
  Dra: "The dragon, coiled between the bears, wrapping the north and guarding the pole it once held.",
  CMa: "The greater dog. Sirius — the brightest star of the night — is in its mouth, at Orion’s heel.",
  Aur: "The charioteer. Capella is a pair of yellow suns, too close to split by eye, a winter capstone.",
  Vir: "The maiden. Spica is the ear of wheat in her hand, a blue-white spike of the spring.",
  Per: "The hero. The Double Cluster sits on his sword-hand, a knot of light between Cassiopeia and him.",
  Car: "The keel of the old ship Argo. Canopus is its lantern in the south, second only to Sirius.",
  Cep: "The king. A house-shaped figure, home to Delta Cephei — the star that taught us distance.",
  CMi: "The lesser dog. Procyon is almost all you need; it completes the winter triangle with Sirius and Betelgeuse.",
  CrB: "Ariadne’s crown. A circlet of the northern spring, easy once you have found Arcturus.",
  Lib: "The scales, once the claws of Scorpius, now a quiet figure between the scorpion and the maiden.",
  Aqr: "The water-bearer. A faint autumn stream, pouring toward Fomalhaut in the south.",
  Psc: "The fishes, tied at the tails. The vernal equinox now rests among them.",
  Cet: "The sea-monster. Mira, in its neck, swells and fades over months — a star that breathes.",
  Eri: "The river. A long meander from near Rigel down to Achernar in the far south.",
  Hya: "The water snake. The longest figure in the sky, a spring creature under Leo and Virgo.",
  Oph: "The serpent-bearer. A large summer figure standing on the ecliptic, holding Serpens in both hands.",
  Cap: "The sea-goat. A bent triangle of autumn, where the Sun stands at the northern winter solstice.",
  PsA: "The southern fish. Fomalhaut is its lonely first-magnitude eye, autumn’s southern lamp.",
  Cnc: "The crab. Faint, but it holds the Beehive — a cluster the eye can take on a dark night.",
};

export function constellationBlurb(id: string, fallback: string) {
  return CONSTELLATION_BLURB[id] ?? fallback;
}

export const FEATURED_IDS = [
  "Ori",
  "UMa",
  "Cas",
  "Cyg",
  "Sco",
  "Leo",
  "Lyr",
  "Sgr",
  "Cru",
  "Tau",
];

export type Asterism = {
  id: string;
  name: string;
  cons: string[];
  blurb: string;
};

export const ASTERISMS: Asterism[] = [
  {
    id: "summer-triangle",
    name: "Summer Triangle",
    cons: ["Lyr", "Cyg", "Aql"],
    blurb: "Vega, Deneb and Altair — three first-magnitude lanterns of the northern summer.",
  },
  {
    id: "winter-hexagon",
    name: "Winter Hexagon",
    cons: ["Aur", "Tau", "Ori", "CMa", "Gem"],
    blurb: "A great ring of winter lanterns. Capella, Aldebaran, Rigel, Sirius, and the twins.",
  },
  {
    id: "northern-cross",
    name: "Northern Cross",
    cons: ["Cyg"],
    blurb: "The swan’s body, standing down the Milky Way.",
  },
  {
    id: "plough",
    name: "The Plough",
    cons: ["UMa"],
    blurb: "Seven stars of the great bear. The bowl points at Polaris.",
  },
  {
    id: "teapot",
    name: "The Teapot",
    cons: ["Sgr"],
    blurb: "Sagittarius as a kettle, pouring into the galactic centre.",
  },
  {
    id: "sickle",
    name: "The Sickle",
    cons: ["Leo"],
    blurb: "A backwards question mark — the lion’s mane, Regulus at the handle.",
  },
  {
    id: "great-square",
    name: "Great Square",
    cons: ["Peg", "And"],
    blurb: "The autumn’s landmark. Andromeda walks off one corner.",
  },
  {
    id: "belt",
    name: "Orion’s Belt",
    cons: ["Ori"],
    blurb: "Three in a line. Follow them to Sirius, or the other way to Aldebaran.",
  },
];

export function asterismsFor(conId: string): Asterism[] {
  return ASTERISMS.filter((a) => a.cons.includes(conId));
}

export function spectralLine(sp: string): string {
  const short: Record<string, string> = {
    O: "rare blue-white",
    B: "hot blue",
    A: "white",
    F: "pale yellow-white",
    G: "Sun-like",
    K: "orange",
    M: "red ember",
  };
  return `${sp} · ${short[sp] ?? "starlight"}`;
}

export type SeasonName = "Winter" | "Spring" | "Summer" | "Autumn";

export const SEASON_ORDER: SeasonName[] = ["Winter", "Spring", "Summer", "Autumn"];

/** Northern-sky season from right ascension (the figure that transits in that season). */
export function seasonFromRa(raDeg: number): SeasonName {
  const h = ((raDeg / 15) % 24 + 24) % 24;
  if (h >= 3 && h < 9) return "Winter";
  if (h >= 9 && h < 15) return "Spring";
  if (h >= 15 && h < 21) return "Summer";
  return "Autumn";
}

export const MAG_NOTES = [
  { mag: 1.5, label: "Lanterns", body: "The first-magnitude few — Sirius, Canopus, Vega." },
  { mag: 2.5, label: "City", body: "Figures still read under streetlight." },
  { mag: 4.0, label: "Suburban", body: "The chart fills; the Milky Way is a rumour." },
  { mag: 6.0, label: "Dark", body: "The eye’s limit. Thousands of points." },
];
