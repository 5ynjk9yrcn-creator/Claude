import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Share, StyleSheet, Text, View } from "react-native";
import { SetupFrame } from "../../components/SetupFrame";
import { Button, Card, ErrorNote, GhostButton } from "../../components/ui";
import { formatInviteCode, useStore } from "../../lib/store";
import { F, R, S, T, shadow, type as ty } from "../../lib/theme";

/* Final setup step: the circle is saved to the cloud here, and the real
   invite code comes back for the parent to join with. */
export default function Invite() {
  const router = useRouter();
  const { data, createCircles } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(true);
  const ran = useRef(false);

  const parentName = data?.parentName || "your parent";
  const primary = data?.contacts.find((c) => c.isPrimary)?.name || "your family";
  const code = data?.inviteCode ? formatInviteCode(data.inviteCode) : null;

  const save = async () => {
    setSaving(true);
    setError(null);
    const err = await createCircles();
    setSaving(false);
    if (err) setError(err);
  };

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message =
    `Hi ${parentName}! I set up OK Today so you can let me know you're OK each ` +
    `morning with one tap. Get the app, choose “I'm checking in”, and enter this ` +
    `code: ${code}. — ${primary}`;

  const finish = () => router.replace("/");

  return (
    <SetupFrame
      step={3}
      title={`Invite ${parentName}`}
      sub="Send the text now, or any time from Settings."
    >
      {saving && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.ink} />
          <Text style={[ty.body, { marginTop: S.md }]}>Saving your circle…</Text>
        </View>
      )}

      {!saving && error && (
        <View>
          <ErrorNote text={error} />
          <Button label="Try again" icon="refresh" onPress={save} />
        </View>
      )}

      {!saving && !error && code && (
        <>
          <View style={[styles.codeCard, shadow(2)]}>
            <Text style={styles.codeLabel}>{parentName.toUpperCase()}'S CODE</Text>
            <Text style={styles.code}>{code}</Text>
            <Text style={styles.codeHint}>They type this once — that's their whole setup.</Text>
          </View>

          <Text style={styles.previewLabel}>YOUR MESSAGE</Text>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{message}</Text>
          </View>

          <View style={{ height: S.xl }} />
          <Button label="Send the text" icon="send" onPress={async () => {
            try {
              await Share.share({ message });
            } catch {
              /* user closed the share sheet */
            }
            finish();
          }} />
          <View style={{ alignItems: "center", marginTop: S.xs }}>
            <GhostButton label="I'll invite them later" onPress={finish} />
          </View>
        </>
      )}
    </SetupFrame>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingVertical: S.xxxl },
  codeCard: {
    backgroundColor: T.paper,
    borderWidth: 2,
    borderColor: T.sun,
    borderRadius: R.xl,
    paddingVertical: S.xl,
    paddingHorizontal: S.lg,
    alignItems: "center",
    marginBottom: S.xl,
  },
  codeLabel: {
    fontFamily: F.extra,
    fontSize: 11,
    letterSpacing: 1.6,
    color: T.inkFaint,
  },
  code: {
    fontFamily: F.extra,
    fontSize: 36,
    letterSpacing: 4,
    color: T.ink,
    marginTop: S.sm,
  },
  codeHint: { ...ty.small, marginTop: S.sm, textAlign: "center" },
  previewLabel: {
    fontFamily: F.extra,
    fontSize: 11,
    letterSpacing: 1.5,
    color: T.inkFaint,
    marginBottom: S.sm,
    marginLeft: S.xs,
  },
  bubble: {
    backgroundColor: "#DCF3DC",
    borderRadius: 20,
    borderBottomRightRadius: 6,
    padding: S.lg,
  },
  bubbleText: {
    fontFamily: F.body,
    fontSize: 15.5,
    lineHeight: 22,
    color: "#1C3A21",
  },
});
