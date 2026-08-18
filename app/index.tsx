import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { useStore } from "../lib/store";
import { F, T } from "../lib/theme";

/* Entry point: route to the right home for the saved role,
   or to the welcome screen on first launch. */
export default function Index() {
  const { data, sessionReady, hasSession } = useStore();

  if (!data || !sessionReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: T.sky,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: T.inkSoft, fontSize: 18, fontFamily: F.body }}>
          Warming up the sun…
        </Text>
      </View>
    );
  }

  // Cloud accounts need a live sign-in; without one, start fresh.
  if (data.setupComplete && hasSession) {
    if (data.role === "family") return <Redirect href="/family" />;
    if (data.role === "parent" || data.role === "both")
      return <Redirect href="/parent-home" />;
  }
  return <Redirect href="/welcome" />;
}
