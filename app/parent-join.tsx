import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BigButton, Field } from "../components/ui";
import { useStore } from "../lib/store";
import { F, T } from "../lib/theme";

/* Parent-side entry. In the finished app the parent arrives via the invite
   text and never types anything; this screen is the Phase 1 stand-in. */
export default function ParentJoin() {
  const router = useRouter();
  const { data, update } = useStore();
  const [name, setName] = useState(data?.myName ?? "");
  const canGo = name.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.wrap}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.sub}>
            What should we call you? This is the only typing you'll ever do here.
          </Text>
          <View style={{ height: 24 }} />
          <Field
            label="Your first name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ruth"
            autoCapitalize="words"
            autoFocus
            style={{ fontSize: 22, paddingVertical: 16 }}
          />
          <BigButton
            label={canGo ? "Show me my sun ☀" : "Type your name first"}
            tone={canGo ? "primary" : "secondary"}
            onPress={() => {
              if (!canGo) return;
              update({ myName: name.trim(), setupComplete: true });
              router.replace("/parent-home");
            }}
          />
          <Text style={styles.note}>
            Usually you'd get here from a text your family sends you — one tap and
            everything is filled in already. That arrives in the next phase of the
            build.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  wrap: { flex: 1, padding: 26, paddingTop: 18 },
  back: { fontFamily: F.bold, fontSize: 17, color: T.inkSoft, marginBottom: 20 },
  title: { fontFamily: F.serif, fontSize: 36, color: T.ink },
  sub: {
    fontFamily: F.body,
    fontSize: 19,
    color: T.inkSoft,
    marginTop: 10,
    lineHeight: 27,
  },
  note: {
    fontFamily: F.body,
    fontSize: 14,
    color: T.inkSoft,
    lineHeight: 20,
    marginTop: 16,
  },
});
