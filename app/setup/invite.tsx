import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SetupFrame } from "../../components/SetupFrame";
import { BigButton, GhostButton } from "../../components/ui";
import { formatInviteCode, useStore } from "../../lib/store";
import { F, T } from "../../lib/theme";

/* Final setup step: everything is saved to the cloud here, and the real
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
      sub="Send them a text now, or do it later from Settings."
    >
      {saving && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.ink} />
          <Text style={styles.savingText}>Saving your circle…</Text>
        </View>
      )}

      {!saving && error && (
        <View>
          <Text style={styles.error}>{error}</Text>
          <BigButton label="Try again" onPress={save} />
        </View>
      )}

      {!saving && !error && code && (
        <>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>{parentName.toUpperCase()}'S CODE</Text>
            <Text style={styles.code}>{code}</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{message}</Text>
          </View>
          <Text style={styles.note}>
            {parentName} installs the app, taps “I'm checking in”, and types this
            code once. That's their whole setup.
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
        </>
      )}
    </SetupFrame>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingVertical: 40 },
  savingText: { fontFamily: F.body, fontSize: 16, color: T.inkSoft, marginTop: 14 },
  error: {
    fontFamily: F.semi,
    fontSize: 15,
    color: T.clay,
    backgroundColor: T.clayPale,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    lineHeight: 21,
  },
  codeCard: {
    backgroundColor: T.paper,
    borderWidth: 2,
    borderColor: T.sunDeep,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 14,
  },
  codeLabel: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 2,
    color: T.inkSoft,
    marginBottom: 6,
  },
  code: { fontFamily: F.extra, fontSize: 34, color: T.ink, letterSpacing: 3 },
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
