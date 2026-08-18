import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { F, R, S, T, type as ty } from "../lib/theme";
import { FadeIn, Tappable } from "./ui";

const TOTAL = 3;

/* Shared frame for family onboarding: back arrow, animated progress bar,
   big display title. */
export function SetupFrame({
  step,
  title,
  sub,
  children,
}: {
  step: 1 | 2 | 3;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const p = useRef(new Animated.Value((step - 1) / TOTAL)).current;

  useEffect(() => {
    Animated.timing(p, {
      toValue: step / TOTAL,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [p, step]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topRow}>
          <Tappable
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={22} color={T.ink} />
          </Tappable>
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: p.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.stepText}>
            {step}/{TOTAL}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn>
            <Text style={styles.title}>{title}</Text>
            {sub ? <Text style={styles.sub}>{sub}</Text> : null}
          </FadeIn>
          <FadeIn delay={90} style={{ marginTop: S.xxl }}>
            {children}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    paddingHorizontal: S.xl,
    paddingTop: S.sm,
    paddingBottom: S.lg,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.lineSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.line,
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: T.sunDeep },
  stepText: { fontFamily: F.bold, fontSize: 13, color: T.inkFaint, width: 26 },

  wrap: { paddingHorizontal: S.xl, paddingBottom: S.xxxl },
  title: { ...ty.title, fontSize: 29 },
  sub: { ...ty.bodyLg, color: T.inkSoft, marginTop: S.md },
});
