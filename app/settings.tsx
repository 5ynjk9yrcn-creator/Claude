import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Card,
  DeadlinePicker,
  FadeIn,
  GhostButton,
  SectionLabel,
  Tappable,
} from "../components/ui";
import { fmtDeadline, formatInviteCode, useStore, type Contact } from "../lib/store";
import { F, R, S, T, shadow, type as ty } from "../lib/theme";

export default function Settings() {
  const router = useRouter();
  const { data, saveSettings, eraseEverything } = useStore();

  // Drafts commit on blur, so we don't hit the server on every keystroke.
  const [myName, setMyName] = useState(data?.myName ?? "");
  const [parentName, setParentName] = useState(data?.parentName ?? "");
  const [contacts, setContacts] = useState<Contact[]>([
    data?.contacts[0] ?? { name: "", phone: "", isPrimary: true },
    data?.contacts[1] ?? { name: "", phone: "", isPrimary: false },
  ]);
  if (!data) return null;

  const watches = data.role === "family" || data.role === "both";
  const checksIn = data.role === "parent" || data.role === "both";
  const displayParent = data.parentName || "your parent";
  const code = data.inviteCode ? formatInviteCode(data.inviteCode) : null;

  const commitContacts = () =>
    saveSettings({
      contacts: contacts
        .filter((c) => c.name.trim() || c.phone.trim())
        .map((c, i) => ({ ...c, isPrimary: i === 0 })),
    });

  const confirmReset = () =>
    Alert.alert(
      "Sign out & reset this phone?",
      "This signs you out and clears the app on this phone. Your circle stays safe in the cloud — sign back in to get it back.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out & reset",
          style: "destructive",
          onPress: () =>
            void eraseEverything().then(() => {
              router.dismissAll();
              router.replace("/welcome");
            }),
        },
      ]
    );

  const inviteAgain = async () => {
    const from = data.contacts.find((c) => c.isPrimary)?.name || "your family";
    try {
      await Share.share({
        message:
          `Hi ${displayParent}! I set up OK Today so you can let me know you're OK ` +
          `each morning with one tap. Get the app, choose “I'm checking in”, and ` +
          `enter this code: ${code}. — ${from}`,
      });
    } catch {
      /* user closed the share sheet */
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Tappable
            onPress={() => router.back()}
            accessibilityLabel="Close settings"
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={22} color={T.ink} />
          </Tappable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {checksIn && (
            <FadeIn>
              <SectionLabel text="My check-in" />
              <Card padded={false} style={styles.group}>
                <Row icon="person-outline" label="My name">
                  <TextInput
                    value={myName}
                    onChangeText={setMyName}
                    onEndEditing={() => saveSettings({ myName: myName.trim() })}
                    style={styles.rowInput}
                    placeholder="First name"
                    placeholderTextColor={T.inkFaint}
                  />
                </Row>
                {data.role === "parent" && (
                  <Row icon="flag-outline" label="Deadline" last>
                    <Text style={styles.rowValue}>{fmtDeadline(data.deadline)}</Text>
                  </Row>
                )}
              </Card>
              {data.role === "parent" && (
                <Text style={styles.note}>
                  Your family sets the deadline from their phone.
                </Text>
              )}
            </FadeIn>
          )}

          {watches && (
            <>
              <FadeIn delay={50}>
                <SectionLabel text={`Watching over ${displayParent}`} style={{ marginTop: S.xxl }} />
                <Card padded={false} style={styles.group}>
                  <Row icon="person-outline" label="Their name">
                    <TextInput
                      value={parentName}
                      onChangeText={setParentName}
                      onEndEditing={() => saveSettings({ parentName: parentName.trim() })}
                      style={styles.rowInput}
                      placeholder="First name"
                      placeholderTextColor={T.inkFaint}
                    />
                  </Row>
                  <Row icon="flag-outline" label="Daily deadline" last>
                    <DeadlinePicker
                      value={data.deadline}
                      onChange={(v) => saveSettings({ deadline: v })}
                    />
                  </Row>
                </Card>
                <Text style={styles.note}>
                  Alerts begin if {displayParent} hasn't checked in by{" "}
                  {fmtDeadline(data.deadline)}. Times follow {data.timezone}.
                </Text>
              </FadeIn>

              <FadeIn delay={90}>
                <SectionLabel text="Alert contacts" style={{ marginTop: S.xxl }} />
                <Card>
                  {[0, 1].map((i) => (
                    <View key={i} style={i === 0 ? styles.contactBlock : null}>
                      <Text style={styles.contactHead}>
                        {i === 0 ? "FIRST ALERTED (YOU)" : "BACKUP — 20 MIN LATER"}
                      </Text>
                      <View style={styles.contactRow}>
                        <TextInput
                          value={contacts[i].name}
                          onChangeText={(v) =>
                            setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, name: v } : c)))
                          }
                          onEndEditing={commitContacts}
                          style={[styles.boxInput, { flex: 1 }]}
                          placeholder="Name"
                          placeholderTextColor={T.inkFaint}
                        />
                        <TextInput
                          value={contacts[i].phone}
                          onChangeText={(v) =>
                            setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, phone: v } : c)))
                          }
                          onEndEditing={commitContacts}
                          style={[styles.boxInput, { flex: 1.35 }]}
                          placeholder="Mobile number"
                          placeholderTextColor={T.inkFaint}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>
                  ))}
                </Card>
              </FadeIn>

              <FadeIn delay={130}>
                <SectionLabel text="Invite" style={{ marginTop: S.xxl }} />
                <Card>
                  {code && (
                    <View style={styles.codeCard}>
                      <Text style={styles.codeLabel}>{displayParent.toUpperCase()}'S CODE</Text>
                      <Text style={styles.code}>{code}</Text>
                    </View>
                  )}
                  <GhostButton
                    label={`Text the invite to ${displayParent}`}
                    icon="send-outline"
                    onPress={inviteAgain}
                  />
                  <Text style={[styles.note, { marginTop: S.md, marginLeft: 0 }]}>
                    They enter this code once under “I'm checking in” and their phone
                    is fully set up.
                  </Text>
                </Card>
              </FadeIn>
            </>
          )}

          <FadeIn delay={170}>
            <SectionLabel text="Notifications" style={{ marginTop: S.xxl }} />
            <Card>
              <View style={styles.infoRow}>
                <Ionicons name="notifications-outline" size={18} color={T.inkSoft} />
                <Text style={[ty.small, { flex: 1 }]}>
                  Reminders{checksIn ? " for you" : ` for ${displayParent}`} an hour
                  before the deadline, and alert texts when a morning is missed, run
                  from our server — not from this phone. Text delivery switches on
                  with Twilio; phone alerts with the TestFlight build.
                </Text>
              </View>
            </Card>
          </FadeIn>

          <FadeIn delay={200}>
            <SectionLabel text="Account" style={{ marginTop: S.xxl }} />
            <Card>
              <GhostButton
                label="Sign out & reset this phone"
                icon="log-out-outline"
                tone="clay"
                onPress={confirmReset}
              />
            </Card>
            <Text style={styles.version}>OK Today — preview build</Text>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  children,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last ? null : styles.rowBorder]}>
      <Ionicons name={icon} size={19} color={T.inkSoft} style={{ marginRight: S.md }} />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: S.xl,
    paddingTop: S.sm,
    paddingBottom: S.md,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.lineSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: F.display, fontSize: 23, color: T.ink },
  wrap: { paddingHorizontal: S.xl, paddingBottom: S.xxxl },

  group: { overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: S.lg,
    paddingHorizontal: S.xl,
    minHeight: 60,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: T.lineSoft },
  rowLabel: { fontFamily: F.semi, fontSize: 16, color: T.ink, flex: 1 },
  rowRight: { alignItems: "flex-end", flex: 1.1 },
  rowValue: { fontFamily: F.bold, fontSize: 16, color: T.inkSoft },
  rowInput: {
    fontFamily: F.bold,
    fontSize: 16,
    color: T.ink,
    textAlign: "right",
    minWidth: 120,
    paddingVertical: 2,
  },

  note: { ...ty.small, marginTop: S.sm, marginLeft: S.xs },

  contactBlock: { marginBottom: S.xl },
  contactHead: {
    fontFamily: F.extra,
    fontSize: 10.5,
    letterSpacing: 1.3,
    color: T.inkFaint,
    marginBottom: S.sm,
  },
  contactRow: { flexDirection: "row", gap: S.sm },
  boxInput: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: R.md,
    paddingVertical: 11,
    paddingHorizontal: S.md,
    fontSize: 15.5,
    fontFamily: F.body,
    color: T.ink,
    backgroundColor: T.paper,
  },

  codeCard: {
    backgroundColor: T.sunPale,
    borderWidth: 1.5,
    borderColor: "#EBCF8C",
    borderRadius: R.lg,
    paddingVertical: S.md,
    alignItems: "center",
    marginBottom: S.lg,
  },
  codeLabel: {
    fontFamily: F.extra,
    fontSize: 10,
    letterSpacing: 1.5,
    color: T.sunDeep,
  },
  code: {
    fontFamily: F.extra,
    fontSize: 26,
    letterSpacing: 3,
    color: T.ink,
    marginTop: 3,
  },

  infoRow: { flexDirection: "row", gap: S.md, alignItems: "flex-start" },
  version: {
    ...ty.small,
    textAlign: "center",
    marginTop: S.xl,
    color: T.inkFaint,
  },
});
