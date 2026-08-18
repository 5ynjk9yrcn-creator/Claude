import { Platform, type TextStyle, type ViewStyle } from "react-native";

/* OK Today design system.
   Palette grows out of design/ok-today-prototype.jsx: sky blue + sun yellow,
   deep navy ink, with warm cream for the "checked in" state. */

export const T = {
  // Sky (default background family)
  sky: "#EAF2F8",
  skyDeep: "#DCE9F4",
  skyMist: "#F5F9FC",

  // Ink (text)
  ink: "#132C4B",
  inkSoft: "#5A7086",
  inkFaint: "#8FA3B5",

  // Sun (primary accent)
  sun: "#F5B82E",
  sunDeep: "#E5A50A",
  sunHi: "#FFD966",
  sunPale: "#FDF1D6",

  // Warm (checked-in background family)
  warm: "#FEF8EC",
  warmDeep: "#F8EEDA",

  // Semantic
  leaf: "#3E8E64",
  leafPale: "#E4F1E9",
  clay: "#C4553B",
  clayPale: "#FAE8E3",
  clayLine: "#E8BFB3",

  // Surfaces
  paper: "#FFFFFF",
  panel: "#F3F7FB",
  line: "#DCE6EF",
  lineSoft: "#EAF0F6",
} as const;

export const F = {
  display: "YoungSerif_400Regular",
  body: "Karla_400Regular",
  semi: "Karla_600SemiBold",
  bold: "Karla_700Bold",
  extra: "Karla_800ExtraBold",
} as const;

/* 4pt spacing rhythm */
export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const R = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

/* Soft, layered elevation — iOS-style rather than a hard drop shadow. */
export const shadow = (level: 1 | 2 | 3 = 1): ViewStyle => {
  const cfg = {
    1: { o: 0.06, r: 10, y: 3, e: 2 },
    2: { o: 0.09, r: 20, y: 8, e: 6 },
    3: { o: 0.14, r: 30, y: 14, e: 12 },
  }[level];
  return Platform.select({
    ios: {
      shadowColor: "#123152",
      shadowOpacity: cfg.o,
      shadowRadius: cfg.r,
      shadowOffset: { width: 0, height: cfg.y },
    },
    default: { elevation: cfg.e },
  }) as ViewStyle;
};

/* Type scale. Parent-facing screens use `parent*` sizes: deliberately huge. */
export const type = {
  hero: { fontFamily: F.display, fontSize: 40, lineHeight: 46, color: T.ink },
  title: { fontFamily: F.display, fontSize: 30, lineHeight: 37, color: T.ink },
  section: { fontFamily: F.display, fontSize: 22, lineHeight: 28, color: T.ink },
  bodyLg: { fontFamily: F.body, fontSize: 17, lineHeight: 25, color: T.ink },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: T.inkSoft },
  small: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: T.inkSoft },
  label: {
    fontFamily: F.extra,
    fontSize: 11.5,
    letterSpacing: 1.4,
    color: T.inkFaint,
  },
  button: { fontFamily: F.bold, fontSize: 17 },

  parentHero: { fontFamily: F.display, fontSize: 42, lineHeight: 49, color: T.ink },
  parentBody: { fontFamily: F.body, fontSize: 21, lineHeight: 30, color: T.inkSoft },
} satisfies Record<string, TextStyle>;

export type Mood = "good" | "okay" | "notgreat";

export const MOODS: Record<
  Mood,
  { label: string; emoji: string; color: string; bg: string; border: string }
> = {
  good: {
    label: "Good",
    emoji: "😊",
    color: T.leaf,
    bg: T.leafPale,
    border: "#A9D3BC",
  },
  okay: {
    label: "Okay",
    emoji: "🙂",
    color: T.sunDeep,
    bg: T.sunPale,
    border: "#EBCF8C",
  },
  notgreat: {
    label: "Not great",
    emoji: "😕",
    color: T.clay,
    bg: T.clayPale,
    border: T.clayLine,
  },
};

/* Greeting that matches the clock, like the apps people use daily. */
export function greetingFor(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export const initialsOf = (name: string) =>
  (name.trim()[0] ?? "?").toUpperCase();
