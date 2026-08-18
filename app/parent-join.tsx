import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BigButton } from "../components/ui";
import { useStore } from "../lib/store";
import { F, T } from "../lib/theme";

/* Parent-side entry: type the short code from the family's text message.
   Everything else — name, deadline, timezone — comes with the code. */
export default function ParentJoin() {
  const router = useRouter();
  const { claimInvite } = useStore();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.wrap}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={T.ink} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.sub}>
            Your family sent you a text with a short code. Type it here — that's the
            only typing you'll ever do in this app.
          </Text>
          <View style={{ height: 28 }} />
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase());
              setError(null);
            }}
            placeholder="ABCD-1234"
            placeholderTextColor={T.line}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={9}
            style={styles.codeInput}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={{ height: 18 }} />
          {busy ? (
            <ActivityIndicator size="large" color={T.ink} style={{ marginVertical: 18 }} />
          ) : (
            <BigButton
              label={canGo ? "Show me my sun ☀" : "Type the whole code first"}
              tone={canGo ? "primary" : "secondary"}
              onPress={go}
            />
          )}
          <Text style={styles.note}>
            No code? Ask your family to open OK Today and look under Settings → Invite.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  wrap: { flex: 1, padding: 26, paddingTop: 18 },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backText: { fontFamily: F.bold, fontSize: 17, color: T.ink },
  title: { fontFamily: F.serif, fontSize: 36, color: T.ink },
  sub: {
    fontFamily: F.body,
    fontSize: 19,
    color: T.inkSoft,
    marginTop: 10,
    lineHeight: 27,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: T.line,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    fontSize: 32,
    fontFamily: F.extra,
    color: T.ink,
    backgroundColor: T.paper,
    textAlign: "center",
    letterSpacing: 4,
  },
  error: {
    fontFamily: F.semi,
    fontSize: 16,
    color: T.clay,
    backgroundColor: T.clayPale,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    lineHeight: 22,
  },
  note: {
    fontFamily: F.body,
    fontSize: 15,
    color: T.inkSoft,
    lineHeight: 21,
    marginTop: 16,
    textAlign: "center",
  },
});
