import { useRouter } from "expo-router";
import { Share, StyleSheet, Text, View } from "react-native";
import { SetupFrame } from "../../components/SetupFrame";
import { BigButton, GhostButton } from "../../components/ui";
import { seedCheckins, useStore } from "../../lib/store";
import { F, T } from "../../lib/theme";

export default function Invite() {
  const router = useRouter();
  const { data, update } = useStore();
  const parentName = data?.parentName || "your parent";
  const primary = data?.contacts.find((c) => c.isPrimary)?.name || "your family";

  /* Phase 2 will generate a real one-tap join link here. */
  const message =
    `Hi ${parentName}! I set up OK Today so you can let me know you're OK ` +
    `each morning with one tap. I'll help you get the app on your phone — ` +
    `it takes two minutes. — ${primary}`;

  const finish = () => {
    update({
      // Demo history so the dashboard looks real during Phase 1 testing.
      watchedCheckins: Object.keys(data?.watchedCheckins ?? {}).length
        ? data!.watchedCheckins
        : seedCheckins(),
      ...(data?.role === "both" ? {} : { setupComplete: true }),
    });
    // A "both" account still needs its own check-in name before landing home.
    if (data?.role === "both") router.push("/parent-join");
    else router.replace("/family");
  };

  return (
    <SetupFrame
      step={3}
      title={`Invite ${parentName}`}
      sub="Send them a text now, or do it later from your dashboard."
    >
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{message}</Text>
      </View>
      <Text style={styles.note}>
        In the finished app this text will include a link that sets up{" "}
        {parentName}'s phone in one tap — no typing for them. The link arrives in
        Phase 2 of the build.
      </Text>

      <View style={{ height: 22 }} />
      <BigButton
        label="Send the text ✉"
        onPress={async () => {
          try {
            await Share.share({ message });
          } catch {
            /* user closed the share sheet */
          }
          finish();
        }}
      />
      <View style={{ alignItems: "center", marginTop: 4 }}>
        <GhostButton label="I'll invite them later" onPress={finish} />
      </View>
    </SetupFrame>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: "#D9EFD9",
    borderRadius: 18,
    borderBottomRightRadius: 6,
    padding: 16,
    marginBottom: 14,
  },
  bubbleText: { fontFamily: F.body, fontSize: 16, color: "#1E3A22", lineHeight: 23 },
  note: { fontFamily: F.body, fontSize: 14, color: T.inkSoft, lineHeight: 20 },
});
