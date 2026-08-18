import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { F, T } from "../lib/theme";

/* Shared frame for the 3-step family onboarding: back arrow,
   step dots, big serif title. */
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
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
            >
              <Text style={styles.back}>‹ Back</Text>
            </Pressable>
            <View style={styles.dots}>
              {[1, 2, 3].map((n) => (
                <View
                  key={n}
                  style={[
                    styles.dot,
                    { backgroundColor: n <= step ? T.ink : T.line },
                  ]}
                />
              ))}
            </View>
            <View style={{ width: 54 }} />
          </View>
          <Text style={styles.title}>{title}</Text>
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
          <View style={{ marginTop: 24 }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  wrap: { padding: 26, paddingBottom: 60 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  back: { fontFamily: F.bold, fontSize: 17, color: T.inkSoft, width: 54 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: {
    fontFamily: F.serif,
    fontSize: 30,
    color: T.ink,
    lineHeight: 38,
  },
  sub: {
    fontFamily: F.body,
    fontSize: 16,
    color: T.inkSoft,
    marginTop: 10,
    lineHeight: 23,
  },
});
