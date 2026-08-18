import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { t } from "../lib/i18n";
import { useStore } from "../lib/store";
import { F, R, S, T, shadow, type as ty } from "../lib/theme";

/* Parent-side entry. Arriving from the invite link (oktoday://parent-join?code=…)
   fills the code in and joins automatically — no typing at all. Typing it by
   hand still works for anyone who got the code another way. */
export default function ParentJoin() {
  const router = useRouter();
  const { claimInvite } = useStore();
  const params = useLocalSearchParams<{ code?: string }>();
  const linked = (params.code ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  const [code, setCode] = useState(linked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const autoTried = useRef(false);

  // The parent's phone language, since the circle's language isn't known yet.
  const L = t(deviceLanguage());

  const cleaned = code.replace(/[^a-zA-Z0-9]/g, "");
  const canGo = cleaned.length >= 8;

  const go = async (value = cleaned) => {
    if (value.length < 8 || busy) return;
    setBusy(true);
    setError(null);
    const err = await claimInvite(value);
    setBusy(false);
    if (err) {
      setError(err.includes("didn't match") ? L.joinBadCode : err);
      return;
    }
    router.replace("/parent-home");
  };

  // Straight through when the code arrived in the link.
  useEffect(() => {
    if (linked.length >= 8 && !autoTried.current) {
      autoTried.current = true;
      void go(linked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked]);

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
              <Text style={styles.title}>{L.joinTitle}</Text>
              <Text style={styles.sub}>{L.joinSub}</Text>
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
                placeholder={L.joinPlaceholder}
                placeholderTextColor={T.line}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
                returnKeyType="go"
                onSubmitEditing={() => void go()}
                style={[styles.codeInput, focused ? styles.codeInputFocused : null, shadow(1)]}
                accessibilityLabel="Invite code"
              />

              {error && (
                <View style={{ marginTop: S.lg }}>
                  <ErrorNote text={error} />
                </View>
              )}

              <View style={{ height: S.xl }} />
              <Button
                label={canGo ? L.joinButton : L.joinButtonWait}
                tone={canGo ? "sun" : "secondary"}
                icon={canGo ? "sunny" : undefined}
                disabled={!canGo}
                busy={busy}
                onPress={() => void go()}
              />

              <View style={styles.helpRow}>
                <Ionicons name="help-circle-outline" size={17} color={T.inkFaint} />
                <Text style={[ty.small, { flex: 1 }]}>{L.joinHelp}</Text>
              </View>
            </FadeIn>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function deviceLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? "en";
  } catch {
    return "en";
  }
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
