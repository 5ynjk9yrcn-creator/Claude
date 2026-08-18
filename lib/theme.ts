// Design tokens ported from design/ok-today-prototype.jsx — keep in sync with it.
export const T = {
  sky: "#EAF2F8",
  skyDeep: "#DCE9F4",
  ink: "#1D3557",
  inkSoft: "#5A7086",
  sun: "#F5B82E",
  sunDeep: "#E5A50A",
  sunHi: "#FFD966",
  leaf: "#4C956C",
  leafPale: "#E3F0E8",
  clay: "#C4553B",
  clayPale: "#F8E7E2",
  paper: "#FFFFFF",
  line: "#C9D9E6",
  warm: "#FDF6E3",
  warmDeep: "#F6EFDA",
  okayPale: "#FBF0D4",
  panel: "#F4F8FB",
} as const;

export const F = {
  serif: "YoungSerif_400Regular",
  body: "Karla_400Regular",
  semi: "Karla_600SemiBold",
  bold: "Karla_700Bold",
  extra: "Karla_800ExtraBold",
} as const;

export type Mood = "good" | "okay" | "notgreat";

export const MOODS: Record<Mood, { label: string; color: string; bg: string }> = {
  good: { label: "Good", color: T.leaf, bg: T.leafPale },
  okay: { label: "Okay", color: T.sunDeep, bg: T.okayPale },
  notgreat: { label: "Not great", color: T.clay, bg: T.clayPale },
};
