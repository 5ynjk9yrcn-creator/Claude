import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { F, T } from "../lib/theme";

const RAY_GAP = 22;
const RAY_LEN = 26;
const RAY_W = 7;

type Props = {
  size?: number; // diameter of the sun disc
  tapped: boolean;
  onTap?: () => void;
};

/* The giant one-tap sun, ported from the prototype: a radial-gradient disc
   with 12 rounded rays and the check-in label in the middle. */
export function Sun({ size = 230, tapped, onTap }: Props) {
  const canvas = size + 2 * (RAY_GAP + RAY_LEN) + 8;
  const c = canvas / 2;
  const rays = Array.from({ length: 12 });

  return (
    <Pressable
      onPress={tapped ? undefined : onTap}
      disabled={tapped}
      accessibilityRole="button"
      accessibilityLabel={
        tapped ? "Checked in for today" : "Tap the sun to check in for today"
      }
      style={({ pressed }) => [
        styles.wrap,
        { width: canvas, height: canvas },
        pressed && !tapped ? { transform: [{ scale: 0.97 }] } : null,
      ]}
    >
      <Svg width={canvas} height={canvas}>
        <Defs>
          <RadialGradient id="sun" cx="38%" cy="32%" r="75%">
            <Stop offset="0%" stopColor={T.sunHi} />
            <Stop offset="62%" stopColor={T.sun} />
            <Stop offset="100%" stopColor={T.sunDeep} />
          </RadialGradient>
        </Defs>
        {rays.map((_, i) => (
          <Rect
            key={i}
            x={c - RAY_W / 2}
            y={c - size / 2 - RAY_GAP - RAY_LEN}
            width={RAY_W}
            height={RAY_LEN}
            rx={4}
            fill={T.sun}
            opacity={0.85}
            transform={`rotate(${i * 30} ${c} ${c})`}
          />
        ))}
        {tapped && (
          <Circle cx={c} cy={c} r={size / 2 + 13} fill={T.sun} opacity={0.25} />
        )}
        <Circle cx={c} cy={c} r={size / 2} fill="url(#sun)" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.labelWrap]}>
        <Text style={[styles.label, { fontSize: size * 0.155, maxWidth: size - 36 }]}>
          {tapped ? "Checked in ✓" : "I'm OK today"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: T.ink,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  labelWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: F.serif,
    color: "#5C4404",
    textAlign: "center",
    lineHeight: undefined,
  },
});
