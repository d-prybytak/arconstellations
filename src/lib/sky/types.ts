export type SkyMode = "outdoor" | "indoor";

export type Star = {
  hip: number;
  ra: number;
  dec: number;
  mag: number;
  bv: number;
  name?: string;
  con?: string;
  bayer?: string;
};

export type Constellation = {
  id: string;
  name: string;
  gen: string;
  en: string;
  rank: number;
  ra: number;
  dec: number;
  paths: [number, number][][];
};

export type SkyCatalog = {
  stars: Star[];
  constellations: Constellation[];
};

export type SelectedObject =
  | {
      kind: "star";
      hip: number;
      name: string;
      con?: string;
      bayer?: string;
      mag: number;
      bv: number;
      ra: number;
      dec: number;
      alt?: number;
      az?: number;
    }
  | {
      kind: "constellation";
      id: string;
      name: string;
      gen: string;
      meaning: string;
      starCount: number;
      ra: number;
      dec: number;
    }
  | {
      kind: "body";
      id: string;
      name: string;
      mag: number;
      ra: number;
      dec: number;
      info: string;
      color: [number, number, number];
      phase?: number;
      alt?: number;
      az?: number;
    }
  | {
      kind: "dso";
      id: string;
      name: string;
      ra: number;
      dec: number;
      info: string;
      kindLabel: string;
    };

export type XrSupport = {
  ar: boolean;
  vr: boolean;
};

export type City = {
  name: string;
  lat: number;
  lon: number;
};
