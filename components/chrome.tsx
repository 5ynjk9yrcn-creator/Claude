import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useStore } from "../lib/store";
import { F, T } from "../lib/theme";

/* Gear button shown top-right on the two home screens. */
export function SettingsButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/settings")}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      hitSlop={10}
      style={({ pressed }) => [styles.gear, pressed ? { opacity: 0.6 } : null]}
    >
      <Ionicons name="settings-outline" size={24} color={T.inkSoft} />
    </Pressable>
  );
}

/* Bottom switcher between "my sun" and the dashboard, shown only for
   accounts that both check in and watch over someone. */
export function RoleTabs() {
  const { data } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  if (data?.role !== "both") return null;

  const tabs = [
    { href: "/parent-home", label: "My sun", icon: "sunny" as const },
    {
      href: "/family",
      label: data.parentName || "Watching",
      icon: "heart" as const,
    },
  ];

  return (
    <View style={styles.tabs}>
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Pressable
            key={t.href}
            onPress={() => {
              if (!active) router.replace(t.href as "/parent-home" | "/family");
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active ? styles.tabActive : null]}
          >
            <Ionicons
              name={active ? t.icon : (`${t.icon}-outline` as const)}
              size={20}
              color={active ? T.paper : T.ink}
            />
            <Text style={[styles.tabText, { color: active ? T.paper : T.ink }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gear: {
    position: "absolute",
    top: 10,
    right: 18,
    zIndex: 10,
    padding: 8,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: T.paper,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 999,
    padding: 5,
    alignSelf: "center",
    marginBottom: 10,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  tabActive: { backgroundColor: T.ink },
  tabText: { fontFamily: F.bold, fontSize: 15 },
});
