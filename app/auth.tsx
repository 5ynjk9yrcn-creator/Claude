import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, ErrorNote, FadeIn, Field, Tappable } from "../components/ui";
import { useStore } from "../lib/store";
import { F, S, T, type as ty } from "../lib/theme";

/* Family-side account: create or sign in with email + password.
   Parents never see this screen — they join with an invite code. */
export default function Auth() {
  const router = useRouter();
  const { data, signUp, signIn, refresh, rememberedEmail, rememberEmail } = useStore();
  // A remembered email means they've been here before — start on Sign in.
  const [mode, setMode] = useState<"signup" | "signin">(
    rememberedEmail ? "signin" : "signup"
  );
  const [email, setEmail] = useState(rememberedEmail ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGo = email.trim().includes("@") && password.length >= 6;

  const go = async () => {
    if (!canGo || busy) return;
    setBusy(true);
    setError(null);
    const err =
      mode === "signup"
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    rememberEmail(remember ? email.trim() : null);
    if (mode === "signin") {
      await refresh();
      router.replace("/");
    } else {
      router.push("/setup/parent-info");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topRow}>
          <Tappable onPress={() => router.back()} accessibilityLabel="Go back" style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={T.ink} />
          </Tappable>
        </View>

        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn>
            <Text style={styles.title}>
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </Text>
            <Text style={styles.sub}>
              {mode === "signup"
                ? "So your circle is saved safely and works across phones."
                : "Sign in to get back to your circle."}
            </Text>
          </FadeIn>

          <FadeIn delay={90} style={{ marginTop: S.xxl }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />

            <Tappable
              onPress={() => setRemember(!remember)}
              style={styles.rememberRow}
              accessibilityLabel="Remember my email"
              accessibilityRole="button"
            >
              <View style={[styles.checkbox, remember ? styles.checkboxOn : null]}>
                {remember && <Ionicons name="checkmark" size={15} color={T.paper} />}
              </View>
              <Text style={styles.rememberText}>Remember my email on this phone</Text>
            </Tappable>

            {error && <ErrorNote text={error} />}

            <Button
              label={
                !canGo
                  ? "Enter email & password"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"
              }
              tone={canGo ? "primary" : "secondary"}
              disabled={!canGo}
              busy={busy}
              onPress={go}
            />

            <Tappable
              onPress={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError(null);
              }}
              style={styles.switchBtn}
              accessibilityLabel={
                mode === "signup" ? "Switch to sign in" : "Switch to create account"
              }
            >
              <Text style={styles.switchText}>
                {mode === "signup"
                  ? "Already have an account?  Sign in"
                  : "New here?  Create an account"}
              </Text>
            </Tappable>

            {data?.role === "both" && (
              <Text style={styles.note}>
                Next you'll set up the person you're watching over, then your own
                daily check-in.
              </Text>
            )}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  topRow: { paddingHorizontal: S.xl, paddingTop: S.sm, paddingBottom: S.sm },
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
  wrap: { paddingHorizontal: S.xl, paddingBottom: S.xxxl, paddingTop: S.lg },
  title: { ...ty.title, fontSize: 30 },
  sub: { ...ty.bodyLg, color: T.inkSoft, marginTop: S.md },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    paddingVertical: S.sm,
    marginBottom: S.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: T.line,
    backgroundColor: T.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: T.ink, borderColor: T.ink },
  rememberText: { fontFamily: F.semi, fontSize: 15, color: T.inkSoft },
  switchBtn: { alignItems: "center", paddingVertical: S.md },
  switchText: { fontFamily: F.semi, fontSize: 15, color: T.inkSoft },
  note: { ...ty.small, textAlign: "center", marginTop: S.xl },
});
