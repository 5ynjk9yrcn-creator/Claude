import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SunMark } from "../components/Sun";
import { Button, ErrorNote, FadeIn, Tappable } from "../components/ui";
import { useStore } from "../lib/store";
import { F, R, S, T, shadow, type as ty } from "../lib/theme";

/* Parent-side entry: type the short code from the family's text message.
   Everything else — name, deadline, timezone — arrives with the code. */
export default function ParentJoin() {
  const router = useRouter();
  const { claimInvite } = useStore();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const cleaned = code.replace(/[^a-zA-Z0-9]/g, "");
  const canGo = cleaned.length >= 8;

  const go = async () => {
    if (!canGo || busy) return;
    setBusy(true);
    setError(null);
    const err = await claimInvite(cleaned);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace("/parent-home");
  };

  return (
    <LinearGradient colors={[T.skyMist, T.skyDeep]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
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
          </View>

          <ScrollView
            contentContainerStyle={styles.wrap}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FadeIn style={{ alignItems: "center" }}>
              <SunMark size={58} />
              <Text style={styles.title}>Welcome!</Text>
              <Text style={styles.sub}>
                Your family sent you a text with a short code. Type it below — it's
                the only typing you'll ever do here.
              </Text>
            </FadeIn>

            <FadeIn delay={100} style={{ width: "100%", marginTop: S.xxl }}>
              <TextInput
                value={code}
                onChangeText={(v) => {
                  setCode(v.toUpperCase());
                  setError(null);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="ABCD-1234"
                placeholderTextColor={T.line}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
                returnKeyType="go"
                onSubmitEditing={go}
                style={[styles.codeInput, focused ? styles.codeInputFocused : null, shadow(1)]}
                accessibilityLabel="Invite code"
              />

              {error && <View style={{ marginTop: S.lg }}><ErrorNote text={error} /></View>}

              <View style={{ height: S.xl }} />
              <Button
                label={canGo ? "Show me my sun" : "Type the whole code first"}
                tone={canGo ? "sun" : "secondary"}
                icon={canGo ? "sunny" : undefined}
                disabled={!canGo}
                busy={busy}
                onPress={go}
              />

              <View style={styles.helpRow}>
                <Ionicons name="help-circle-outline" size={17} color={T.inkFaint} />
                <Text style={[ty.small, { flex: 1 }]}>
                  No code? Ask your family to open OK Today and look under Settings →
                  Invite.
                </Text>
              </View>
            </FadeIn>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topRow: { paddingHorizontal: S.xl, paddingTop: S.sm },
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
  wrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: S.xxl,
    paddingVertical: S.xl,
  },
  title: { ...ty.parentHero, fontSize: 38, marginTop: S.lg },
  sub: { ...ty.parentBody, fontSize: 19, textAlign: "center", marginTop: S.md },
  codeInput: {
    borderWidth: 2,
    borderColor: T.line,
    borderRadius: R.lg,
    paddingVertical: S.xl,
    paddingHorizontal: S.lg,
    fontSize: 32,
    fontFamily: F.extra,
    color: T.ink,
    backgroundColor: T.paper,
    textAlign: "center",
    letterSpacing: 5,
  },
  codeInputFocused: { borderColor: T.sunDeep, backgroundColor: "#FFFDF7" },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    marginTop: S.lg,
    paddingHorizontal: S.xs,
  },
});
