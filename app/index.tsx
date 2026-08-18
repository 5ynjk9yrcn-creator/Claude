import { Redirect } from "expo-router";
import { useStore } from "../lib/store";
import { Splash } from "../components/Splash";

/* Entry point: route to the right home for the saved role,
   or to the welcome screen on first launch. */
export default function Index() {
  const { data, sessionReady, hasSession } = useStore();

  if (!data || !sessionReady) return <Splash />;

  // Cloud accounts need a live sign-in; without one, start fresh.
  if (data.setupComplete && hasSession) {
    if (data.role === "family") return <Redirect href="/family" />;
    if (data.role === "parent" || data.role === "both")
      return <Redirect href="/parent-home" />;
  }
  return <Redirect href="/welcome" />;
}
