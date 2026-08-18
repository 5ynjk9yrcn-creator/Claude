import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { F, T } from "../lib/theme";

const RAY_GAP = 20;
const RAY_LEN = 26;
const RAY_W = 7;
const RAY_COUNT = 12;

type Props = {
  size?: number; // diameter of the sun disc
  tapped: boolean;
  onTap?: () => void;
  labelIdle?: string; // localised — the parent may not read English
  labelDone?: string;
};

/* The one-tap sun. Idle it breathes softly so the screen feels alive;
   pressing springs it; checking in fires a halo burst and a haptic thump. */
export function Sun({
  size = 236,
  tapped,
  onTap,
  labelIdle = "I'm OK today",
  labelDone = "Checked in ✓",
}: Props) {
  const canvas = size + 2 * (RAY_GAP + RAY_LEN) + 10;
  const c = canvas / 2;

  const press = useRef(new Animated.Value(0)).current; // 0 idle, 1 pressed
  const breathe = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(tapped ? 1 : 0)).current;
  const reduceMotion = useRef(false);
  const wasTapped = useRef(tapped);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotion.current = on;
      if (on || tapped) {
        breathe.setValue(0); // settle at rest instead of mid-breath
        return;
      }
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, {
            toValue: 1,
            duration: 2600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(breathe, {
            toValue: 0,
            duration: 2600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [breathe, tapped]);

  // Celebrate the moment of checking in.
  useEffect(() => {
    if (tapped && !wasTapped.current) {
      burst.setValue(0);
      Animated.parallel([
        Animated.timing(burst, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(glow, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
    wasTapped.current = tapped;
  }, [tapped, burst, glow]);

  const scale = Animated.multiply(
    press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.955] }),
    breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.022] })
  );

  const handlePressIn = () => {
    if (tapped) return;
    Animated.spring(press, {
      toValue: 1,
      friction: 7,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(press, {
      toValue: 0,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };
  const handlePress = () => {
    if (tapped || !onTap) return;
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onTap();
  };

  return (
    <View style={{ width: canvas, height: canvas, alignItems: "center", justifyContent: "center" }}>
      {/* Burst ring on the moment of check-in */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          {
            opacity: burst.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0, 0.55, 0],
            }),
            transform: [
              { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.35] }) },
            ],
          },
        ]}
      >
        <View
          style={{
            width: size + 40,
            height: size + 40,
            borderRadius: (size + 40) / 2,
            backgroundColor: T.sun,
          }}
        />
      </Animated.View>

      {/* Resting glow once checked in */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
          },
        ]}
      >
        <View
          style={{
            width: size + 30,
            height: size + 30,
            borderRadius: (size + 30) / 2,
            backgroundColor: T.sun,
          }}
        />
      </Animated.View>

      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={tapped}
          accessibilityRole="button"
          accessibilityLabel={
            tapped ? "Checked in for today" : "Tap the sun to check in for today"
          }
          accessibilityHint={tapped ? undefined : "One tap tells your family you are OK"}
          style={styles.hit}
        >
          <View style={styles.sunShadow}>
            <Svg width={canvas} height={canvas}>
              <Defs>
                <RadialGradient id="sunFill" cx="38%" cy="30%" r="78%">
                  <Stop offset="0%" stopColor={T.sunHi} />
                  <Stop offset="58%" stopColor={T.sun} />
                  <Stop offset="100%" stopColor={T.sunDeep} />
                </RadialGradient>
              </Defs>
              {Array.from({ length: RAY_COUNT }).map((_, i) => (
                <Rect
                  key={i}
                  x={c - RAY_W / 2}
                  y={c - size / 2 - RAY_GAP - RAY_LEN}
                  width={RAY_W}
                  height={RAY_LEN}
                  rx={RAY_W / 2}
                  fill={T.sun}
                  opacity={0.9}
                  transform={`rotate(${i * (360 / RAY_COUNT)} ${c} ${c})`}
                />
              ))}
              <Circle cx={c} cy={c} r={size / 2} fill="url(#sunFill)" />
            </Svg>
          </View>
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
            <Text
              style={[styles.label, { fontSize: size * 0.15, maxWidth: size - 40 }]}
              maxFontSizeMultiplier={1.3}
            >
              {tapped ? labelDone : labelIdle}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* Decorative, non-interactive sun for branding moments. */
export function SunMark({ size = 76 }: { size?: number }) {
  const gap = size * 0.13;
  const len = size * 0.2;
  const w = Math.max(3, size * 0.05);
  const canvas = size + 2 * (gap + len) + 4;
  const c = canvas / 2;
  return (
    <Svg width={canvas} height={canvas}>
      <Defs>
        <RadialGradient id="markFill" cx="38%" cy="30%" r="78%">
          <Stop offset="0%" stopColor={T.sunHi} />
          <Stop offset="58%" stopColor={T.sun} />
          <Stop offset="100%" stopColor={T.sunDeep} />
        </RadialGradient>
      </Defs>
      {Array.from({ length: RAY_COUNT }).map((_, i) => (
        <Rect
          key={i}
          x={c - w / 2}
          y={c - size / 2 - gap - len}
          width={w}
          height={len}
          rx={w / 2}
          fill={T.sun}
          opacity={0.9}
          transform={`rotate(${i * (360 / RAY_COUNT)} ${c} ${c})`}
        />
      ))}
      <Circle cx={c} cy={c} r={size / 2} fill="url(#markFill)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  hit: { alignItems: "center", justifyContent: "center" },
  sunShadow: {
    shadowColor: "#B47C09",
    shadowOpacity: 0.32,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  label: {
    fontFamily: F.display,
    color: "#5A4104",
    textAlign: "center",
  },
});
