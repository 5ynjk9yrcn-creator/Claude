import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BigButton, Field } from "../components/ui";
import { useStore } from "../lib/store";
import { F, T } from "../lib/theme";

/* Family-side account: create or sign in with email + password.
   Parents never see this screen — they join with an invite code. */
export default function Auth() {
  const router = useRouter();
  const { data, signUp, signIn, refresh } = useStore();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    if (mode === "signin") {
      // Existing account: pull their circle down, then land home.
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
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={T.ink} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.title}>
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </Text>
          <Text style={styles.sub}>
            {mode === "signup"
              ? "So your circle is saved safely and works across phones."
              : "Sign in to get back to your circle."}
          </Text>

          <View style={{ height: 26 }} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          {busy ? (
            <ActivityIndicator size="large" color={T.ink} style={{ marginVertical: 20 }} />
          ) : (
            <BigButton
              label={
                !canGo
                  ? "Enter email & password"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"
              }
              tone={canGo ? "primary" : "secondary"}
              onPress={go}
            />
          )}

          <Pressable
            onPress={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
            }}
            hitSlop={8}
            style={{ alignItems: "center", marginTop: 8 }}
          >
            <Text style={styles.switchLink}>
              {mode === "signup"
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </Text>
          </Pressable>

          {data?.role === "both" && (
            <Text style={styles.note}>
              After this you'll set up the person you're watching over, then your own
              daily check-in.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  wrap: { padding: 26, paddingTop: 18, paddingBottom: 60 },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backText: { fontFamily: F.bold, fontSize: 17, color: T.ink },
  title: { fontFamily: F.serif, fontSize: 32, color: T.ink },
  sub: {
    fontFamily: F.body,
    fontSize: 17,
    color: T.inkSoft,
    marginTop: 10,
    lineHeight: 24,
  },
  error: {
    fontFamily: F.semi,
    fontSize: 15,
    color: T.clay,
    backgroundColor: T.clayPale,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    lineHeight: 21,
  },
  switchLink: {
    fontFamily: F.bold,
    fontSize: 15,
    color: T.inkSoft,
    textDecorationLine: "underline",
  },
  note: {
    fontFamily: F.body,
    fontSize: 14,
    color: T.inkSoft,
    lineHeight: 20,
    marginTop: 24,
    textAlign: "center",
  },
});
