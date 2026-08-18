import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BigButton } from "../components/ui";
import { useStore } from "../lib/store";
import { F, T } from "../lib/theme";

export default function Welcome() {
  const router = useRouter();
  const { update } = useStore();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.logo}>☀ OK Today</Text>
        <Text style={styles.tagline}>One tap from Mom.{"\n"}One less worry for you.</Text>

        <View style={{ flex: 1 }} />

        <Text style={styles.prompt}>Who's using this phone?</Text>
        <BigButton
          label="I'm watching over someone"
          sub="Set up daily check-ins for a parent"
          onPress={() => {
            update({ role: "family" });
            router.push("/setup/parent-info");
          }}
        />
        <BigButton
          label="I'm checking in"
          sub="I'll tap the sun each morning"
          tone="secondary"
          onPress={() => {
            update({ role: "parent" });
            router.push("/parent-join");
          }}
        />
        <BigButton
          label="I'm doing both"
          sub="I check in, and I watch over someone too"
          tone="secondary"
          onPress={() => {
            update({ role: "both" });
            router.push("/setup/parent-info");
          }}
        />
        <View style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  wrap: { flex: 1, padding: 26, paddingTop: 40 },
  logo: {
    fontFamily: F.serif,
    fontSize: 34,
    color: T.ink,
    textAlign: "center",
  },
  tagline: {
    fontFamily: F.body,
    fontSize: 18,
    color: T.inkSoft,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 26,
  },
  prompt: {
    fontFamily: F.serif,
    fontSize: 24,
    color: T.ink,
    textAlign: "center",
    marginBottom: 22,
  },
});
