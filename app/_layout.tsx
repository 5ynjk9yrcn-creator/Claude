import {
  Karla_400Regular,
  Karla_600SemiBold,
  Karla_700Bold,
  Karla_800ExtraBold,
} from "@expo-google-fonts/karla";
import { YoungSerif_400Regular } from "@expo-google-fonts/young-serif";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Splash } from "../components/Splash";
import { StoreProvider } from "../lib/store";
import { T } from "../lib/theme";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    YoungSerif_400Regular,
    Karla_400Regular,
    Karla_600SemiBold,
    Karla_700Bold,
    Karla_800ExtraBold,
  });

  if (!fontsLoaded) return <Splash fontsReady={false} />;

  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: T.sky },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="settings" options={{ animation: "slide_from_bottom" }} />
      </Stack>
    </StoreProvider>
  );
}
