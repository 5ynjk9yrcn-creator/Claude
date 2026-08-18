import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { SunMark } from "./Sun";
import { F, S, T } from "../lib/theme";

/* Shown while fonts load and the saved session is read from disk.
   `fontsReady` is false on the very first frame, before the custom
   families exist — fall back to the system face rather than risk a blank. */
export function Splash({ fontsReady = true }: { fontsReady?: boolean }) {
  return (
    <LinearGradient colors={[T.skyMist, T.skyDeep]} style={styles.wrap}>
      <View style={{ alignItems: "center" }}>
        <SunMark size={64} />
        <Text style={[styles.logo, fontsReady ? { fontFamily: F.display } : null]}>
          OK Today
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { fontSize: 26, color: T.ink, marginTop: S.md },
});
