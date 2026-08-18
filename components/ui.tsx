import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { deadlineToday, fmtDeadline } from "../lib/store";
import { F, R, S, T, shadow, type as ty } from "../lib/theme";

/* ---------- motion ---------- */

/** Fades and lifts children in — used to stagger a screen's content on entry. */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Wraps any pressable content with a spring scale + optional haptic. */
export function Tappable({
  onPress,
  children,
  style,
  disabled,
  haptic = "light",
  accessibilityLabel,
  accessibilityRole = "button",
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: "light" | "medium" | "none";
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "tab";
}) {
  const v = useRef(new Animated.Value(0)).current;
  const spring = (to: number) =>
    Animated.spring(v, {
      toValue: to,
      friction: 7,
      tension: 300,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View
      style={{
        transform: [
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.968] }) },
        ],
      }}
    >
      <Pressable
        onPress={() => {
          if (disabled) return;
          if (haptic !== "none" && Platform.OS !== "web") {
            void Haptics.impactAsync(
              haptic === "medium"
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Light
            );
          }
          onPress?.();
        }}
        onPressIn={() => !disabled && spring(1)}
        onPressOut={() => spring(0)}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/* ---------- buttons ---------- */

type ButtonProps = {
  label: string;
  sub?: string;
  onPress?: () => void;
  tone?: "primary" | "secondary" | "sun" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  size?: "lg" | "md";
  busy?: boolean;
  disabled?: boolean;
  full?: boolean;
};

export function Button({
  label,
  sub,
  onPress,
  tone = "primary",
  icon,
  size = "lg",
  busy,
  disabled,
  full = true,
}: ButtonProps) {
  const off = disabled || busy;
  const palette = {
    primary: { bg: T.ink, fg: T.paper, sub: "#B9CBDC", border: "transparent" },
    sun: { bg: T.sun, fg: "#4A3503", sub: "#7A5A0B", border: "transparent" },
    secondary: { bg: T.paper, fg: T.ink, sub: T.inkSoft, border: T.line },
    danger: { bg: T.paper, fg: T.clay, sub: T.clay, border: T.clayLine },
  }[tone];

  return (
    <Tappable
      onPress={onPress}
      disabled={off}
      haptic={tone === "primary" || tone === "sun" ? "medium" : "light"}
      accessibilityLabel={label}
      style={[
        styles.btn,
        size === "md" ? styles.btnMd : styles.btnLg,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: tone === "secondary" || tone === "danger" ? 1.5 : 0,
          opacity: off ? 0.55 : 1,
          alignSelf: full ? "stretch" : "flex-start",
        },
        tone === "primary" || tone === "sun" ? shadow(2) : shadow(1),
      ]}
    >
      <View style={styles.btnInner}>
        {busy ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {icon && (
              <Ionicons
                name={icon}
                size={size === "lg" ? 21 : 18}
                color={palette.fg}
                style={{ marginRight: S.sm }}
              />
            )}
            <View style={{ flexShrink: 1 }}>
              <Text
                style={[
                  ty.button,
                  { color: palette.fg, fontSize: size === "lg" ? 18 : 16 },
                  sub ? null : { textAlign: "center" },
                ]}
              >
                {label}
              </Text>
              {sub ? (
                <Text style={[ty.small, { color: palette.sub, marginTop: 3 }]}>{sub}</Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </Tappable>
  );
}

/** Big, unmissable choice card — used on the welcome screen. */
export function ChoiceCard({
  title,
  sub,
  icon,
  onPress,
  accent = T.sun,
}: {
  title: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accent?: string;
}) {
  return (
    <Tappable onPress={onPress} haptic="medium" style={[styles.choice, shadow(2)]}>
      <View style={[styles.choiceIcon, { backgroundColor: accent + "22" }]}>
        <Ionicons name={icon} size={26} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={[ty.body, { marginTop: 3 }]}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={T.inkFaint} />
    </Tappable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  tone = "default",
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: "default" | "clay";
}) {
  const color = tone === "clay" ? T.clay : T.ink;
  return (
    <Tappable
      onPress={onPress}
      style={[
        styles.ghost,
        { borderColor: tone === "clay" ? T.clayLine : T.line },
      ]}
      accessibilityLabel={label}
    >
      <View style={styles.row}>
        {icon && <Ionicons name={icon} size={15} color={color} style={{ marginRight: 6 }} />}
        <Text style={{ fontFamily: F.bold, fontSize: 14, color }}>{label}</Text>
      </View>
    </Tappable>
  );
}

/* ---------- surfaces ---------- */

export function Card({
  children,
  style,
  level = 1,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  level?: 1 | 2 | 3;
  padded?: boolean;
}) {
  return (
    <View
      style={[styles.card, padded ? { padding: S.xl } : null, shadow(level), style]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({
  text,
  style,
}: {
  text: string;
  style?: StyleProp<ViewStyle>;
}) {
  return <Text style={[ty.label, styles.sectionLabel, style]}>{text.toUpperCase()}</Text>;
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={{ fontFamily: F.display, fontSize: size * 0.42, color: "#5A4104" }}>
        {letter}
      </Text>
    </View>
  );
}

export function Pill({
  text,
  tone = "sky",
  icon,
}: {
  text: string;
  tone?: "sky" | "leaf" | "clay" | "sun";
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const p = {
    sky: { bg: T.panel, fg: T.ink, bd: T.line },
    leaf: { bg: T.leafPale, fg: T.leaf, bd: "#B9DCC8" },
    clay: { bg: T.clayPale, fg: T.clay, bd: T.clayLine },
    sun: { bg: T.sunPale, fg: T.sunDeep, bd: "#EBCF8C" },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg, borderColor: p.bd }]}>
      {icon && <Ionicons name={icon} size={13} color={p.fg} style={{ marginRight: 5 }} />}
      <Text style={{ fontFamily: F.semi, fontSize: 13, color: p.fg }}>{text}</Text>
    </View>
  );
}

/* ---------- inputs ---------- */

export function Field(props: TextInputProps & { label: string; hint?: string }) {
  const { label, hint, style, ...rest } = props;
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: S.xl }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={T.inkFaint}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          focused ? styles.inputFocused : null,
          style,
        ]}
      />
      {hint ? <Text style={[ty.small, { marginTop: 6 }]}>{hint}</Text> : null}
    </View>
  );
}

/** Time-of-day picker for the daily deadline. */
export function DeadlinePicker({
  value,
  onChange,
}: {
  value: string; // "HH:MM"
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const asDate = deadlineToday(value);

  const handle = (_e: unknown, d?: Date) => {
    setOpen(false);
    if (d) {
      onChange(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      );
    }
  };

  if (Platform.OS === "ios") {
    return (
      <DateTimePicker
        mode="time"
        display="compact"
        value={asDate}
        onChange={handle}
        minuteInterval={5}
        accentColor={T.ink}
      />
    );
  }
  return (
    <>
      <Tappable onPress={() => setOpen(true)} style={styles.timeBtn}>
        <Text style={{ fontFamily: F.bold, fontSize: 17, color: T.ink }}>
          {fmtDeadline(value)}
        </Text>
      </Tappable>
      {open && (
        <DateTimePicker mode="time" value={asDate} onChange={handle} minuteInterval={5} />
      )}
    </>
  );
}

/* ---------- feedback ---------- */

export function ErrorNote({ text }: { text: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={18} color={T.clay} style={{ marginRight: 8 }} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },

  btn: { borderRadius: R.lg, justifyContent: "center" },
  btnLg: { paddingVertical: 18, paddingHorizontal: S.xl, marginBottom: S.md },
  btnMd: { paddingVertical: 13, paddingHorizontal: S.lg, marginBottom: S.sm },
  btnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center" },

  choice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.paper,
    borderRadius: R.xl,
    padding: S.xl,
    marginBottom: S.md,
    borderWidth: 1,
    borderColor: T.lineSoft,
  },
  choiceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginRight: S.lg,
  },
  choiceTitle: { fontFamily: F.bold, fontSize: 18, color: T.ink },

  ghost: {
    backgroundColor: T.paper,
    borderWidth: 1.5,
    borderRadius: R.pill,
    paddingVertical: 9,
    paddingHorizontal: S.lg,
  },

  card: {
    backgroundColor: T.paper,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: T.lineSoft,
  },
  sectionLabel: { marginBottom: S.sm, marginLeft: S.xs },

  avatar: {
    backgroundColor: T.sunHi,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: T.sun,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: R.pill,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },

  fieldLabel: {
    fontFamily: F.bold,
    fontSize: 14.5,
    color: T.ink,
    marginBottom: S.sm,
  },
  input: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: R.md,
    paddingVertical: 15,
    paddingHorizontal: S.lg,
    fontSize: 17,
    fontFamily: F.body,
    color: T.ink,
    backgroundColor: T.paper,
  },
  inputFocused: { borderColor: T.sunDeep, backgroundColor: "#FFFDF7" },
  timeBtn: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: R.md,
    paddingVertical: 12,
    paddingHorizontal: S.lg,
    backgroundColor: T.paper,
    alignSelf: "flex-start",
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: T.clayPale,
    borderWidth: 1,
    borderColor: T.clayLine,
    borderRadius: R.md,
    padding: S.md,
    marginBottom: S.lg,
  },
  errorText: {
    fontFamily: F.semi,
    fontSize: 14.5,
    color: T.clay,
    lineHeight: 20,
    flex: 1,
  },
});
