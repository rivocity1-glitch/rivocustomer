export const Fonts = {
  mono: "monospace",
};

export const Spacing = {
  zero: 0,
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  seven: 28,
  eight: 32,
};

export type ThemeColor =
  | "text"
  | "textSecondary"
  | "background"
  | "backgroundElement"
  | "backgroundSelected"
  | "primary"
  | "secondary";

export const Theme = {
  light: {
    text: "#0D0D0D",
    textSecondary: "#64748B",
    background: "#FFFFFF",
    backgroundElement: "#F7F8FA",
    backgroundSelected: "#E8FBF0",
    primary: "#16A34A",
    secondary: "#64748B",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#94A3B8",
    background: "#000000",
    backgroundElement: "#171717",
    backgroundSelected: "#12351F",
    primary: "#16A34A",
    secondary: "#94A3B8",
  },
};

export const Colors = {
  light: Theme.light,
  dark: Theme.dark,
};

export const MaxContentWidth = 1200;

export const BottomTabInset = 90;