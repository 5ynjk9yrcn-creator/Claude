import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useStore } from "../lib/store";
import { F, R, S, T, shadow } from "../lib/theme";
import { Tappable } from "./ui";

/* Floating gear, top-right of the two home screens. */
export function SettingsButton() {
  const router = useRouter();
  return (
    <View style={styles.gearWrap}>
      <Tappable
        onPress={() => router.push("/settings")}
        accessibilityLabel="Open settings"
        style={[styles.gear, shadow(1)]}
      >
        <Ionicons name="settings-outline" size={21} color={T.inkSoft} />
      </Tappable>
    </View>
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
    <View style={styles.tabsWrap}>
      <View style={[styles.tabs, shadow(2)]}>
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Tappable
              key={t.href}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              onPress={() => {
                if (!active) router.replace(t.href as "/parent-home" | "/family");
              }}
              style={[styles.tab, active ? styles.tabActive : null]}
            >
              <View style={styles.tabInner}>
                <Ionicons
                  name={active ? t.icon : (`${t.icon}-outline` as const)}
                  size={18}
                  color={active ? T.paper : T.inkSoft}
                />
                <Text
                  style={[styles.tabText, { color: active ? T.paper : T.inkSoft }]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </View>
            </Tappable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gearWrap: { position: "absolute", top: S.sm, right: S.xl, zIndex: 20 },
  gear: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: T.lineSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  tabsWrap: { alignItems: "center", paddingBottom: S.md, paddingTop: S.xs },
  tabs: {
    flexDirection: "row",
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.lineSoft,
    borderRadius: R.pill,
    padding: 5,
    gap: 4,
  },
  tab: { borderRadius: R.pill, paddingVertical: 10, paddingHorizontal: S.xl },
  tabActive: { backgroundColor: T.ink },
  tabInner: { flexDirection: "row", alignItems: "center", gap: 7 },
  tabText: { fontFamily: F.bold, fontSize: 14.5, maxWidth: 120 },
});
