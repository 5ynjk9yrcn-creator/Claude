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
  Switch,
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
import { LANGS } from "../lib/i18n";
import {
  fmtDeadline,
  formatInviteCode,
  inviteLink,
  useStore,
  type Contact,
} from "../lib/store";
import { F, R, S, T, shadow, type as ty } from "../lib/theme";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Settings() {
  const router = useRouter();
  const { data, saveSettings, eraseEverything } = useStore();

  // Drafts commit on blur, so we don't hit the server on every keystroke.
  const [myName, setMyName] = useState(data?.myName ?? "");
  const [parentName, setParentName] = useState(data?.parentName ?? "");
  const [parentPhone, setParentPhone] = useState(data?.parentPhone ?? "");
  const [emergency, setEmergency] = useState(data?.emergencyNote ?? "");
  const [contacts, setContacts] = useState<Contact[]>([
    data?.contacts[0] ?? { name: "", phone: "", isPrimary: true },
    data?.contacts[1] ?? { name: "", phone: "", isPrimary: false },
  ]);
  if (!data) return null;

  const watches = data.role === "family" || data.role === "both";
  const checksIn = data.role === "parent" || data.role === "both";
  const displayParent = data.parentName || "your parent";
  const code = data.inviteCode ? formatInviteCode(data.inviteCode) : null;
  const perDay = data.deadlines !== null;

  const commitContacts = () =>
    saveSettings({
      contacts: contacts
        .filter((c) => c.name.trim() || c.phone.trim())
        .map((c, i) => ({ ...c, isPrimary: i === 0 })),
    });

  const togglePerDay = (on: boolean) => {
    if (on) {
      const seed: Record<string, string> = {};
      for (let i = 0; i < 7; i++) seed[String(i)] = data.deadline;
      saveSettings({ deadlines: seed });
    } else {
      saveSettings({ deadlines: null });
    }
  };

  const setDayDeadline = (day: number, value: string) => {
    const next = { ...(data.deadlines ?? {}) };
    next[String(day)] = value;
    saveSettings({ deadlines: next });
  };

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
          `each morning with one tap. Open this and you're all set: ` +
          `${inviteLink(data.inviteCode ?? "")}  (code: ${code}) — ${from}`,
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
                <Row icon="person-outline" label="My name" last>
                  <TextInput
                    value={myName}
                    onChangeText={setMyName}
                    onEndEditing={() => saveSettings({ myName: myName.trim() })}
                    style={styles.rowInput}
                    placeholder="First name"
                    placeholderTextColor={T.inkFaint}
                  />
                </Row>
              </Card>
            </FadeIn>
          )}

          {watches && (
            <>
              <FadeIn delay={50}>
                <SectionLabel
                  text={`Watching over ${displayParent}`}
                  style={{ marginTop: S.xxl }}
                />
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
                  <Row icon="call-outline" label="Their phone" last>
                    <TextInput
                      value={parentPhone}
                      onChangeText={setParentPhone}
                      onEndEditing={() => saveSettings({ parentPhone: parentPhone.trim() })}
                      style={styles.rowInput}
                      placeholder="For the Call button"
                      placeholderTextColor={T.inkFaint}
                      keyboardType="phone-pad"
                    />
                  </Row>
                </Card>
                <Text style={styles.note}>
                  Their number gives you a one-tap Call button when a morning is missed,
                  and is included in the alert texts.
                </Text>
              </FadeIn>

              <FadeIn delay={80}>
                <SectionLabel text="Deadline" style={{ marginTop: S.xxl }} />
                <Card padded={false} style={styles.group}>
                  {!perDay && (
                    <Row icon="flag-outline" label="Every day at">
                      <DeadlinePicker
                        value={data.deadline}
                        onChange={(v) => saveSettings({ deadline: v })}
                      />
                    </Row>
                  )}
                  <Row icon="calendar-outline" label="Different on some days" last={!perDay}>
                    <Switch
                      value={perDay}
                      onValueChange={togglePerDay}
                      trackColor={{ true: T.leaf, false: T.line }}
                    />
                  </Row>
                  {perDay &&
                    DAY_NAMES.map((dn, i) => (
                      <Row key={dn} icon="ellipse-outline" label={dn} last={i === 6}>
                        <DeadlinePicker
                          value={data.deadlines?.[String(i)] ?? data.deadline}
                          onChange={(v) => setDayDeadline(i, v)}
                        />
                      </Row>
                    ))}
                </Card>
                <Text style={styles.note}>
                  {perDay
                    ? "Weekends and church mornings are the usual reason to differ — a deadline that fits real life means far fewer false alarms."
                    : `Alerts begin if ${displayParent} hasn't checked in by ${fmtDeadline(data.deadline)}. Times follow ${data.timezone}.`}
                </Text>
              </FadeIn>

              <FadeIn delay={110}>
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

              <FadeIn delay={140}>
                <SectionLabel text="In case of emergency" style={{ marginTop: S.xxl }} />
                <Card>
                  <TextInput
                    value={emergency}
                    onChangeText={setEmergency}
                    onEndEditing={() => saveSettings({ emergencyNote: emergency.trim() })}
                    style={styles.areaInput}
                    placeholder={"e.g. 14 Elm St, apt 3B. Door code 4417.\nNeighbour Jane: 416 555 0199."}
                    placeholderTextColor={T.inkFaint}
                    multiline
                    maxLength={300}
                  />
                  <Text style={[ty.small, { marginTop: S.md }]}>
                    Shown on your dashboard the moment a morning is missed, and included
                    in the alert texts — so whoever gets one can actually help.
                  </Text>
                </Card>
              </FadeIn>

              <FadeIn delay={170}>
                <SectionLabel text={`${displayParent}'s language`} style={{ marginTop: S.xxl }} />
                <Card>
                  <View style={styles.langRow}>
                    {LANGS.map((l) => {
                      const on = (data.lang || "en") === l.code;
                      return (
                        <Tappable
                          key={l.code}
                          onPress={() => saveSettings({ lang: l.code })}
                          accessibilityLabel={l.label}
                          style={[styles.langPill, on ? styles.langPillOn : null]}
                        >
                          <Text style={[styles.langText, on ? { color: T.paper } : null]}>
                            {l.label}
                          </Text>
                        </Tappable>
                      );
                    })}
                  </View>
                  <Text style={[ty.small, { marginTop: S.md }]}>
                    Changes only {displayParent}'s screens — yours stay in English.
                  </Text>
                </Card>
              </FadeIn>

              <FadeIn delay={200}>
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
                    The link sets up their phone in one tap. The code is there too, in
                    case they'd rather type it.
                  </Text>
                </Card>
              </FadeIn>
            </>
          )}

          <FadeIn delay={230}>
            <SectionLabel text="Notifications" style={{ marginTop: S.xxl }} />
            <Card>
              <View style={styles.infoRow}>
                <Ionicons name="notifications-outline" size={18} color={T.inkSoft} />
                <Text style={[ty.small, { flex: 1 }]}>
                  Reminders{checksIn ? " for you" : ` for ${displayParent}`} an hour before
                  the deadline, and alert texts when a morning is missed, run from our
                  server — not from this phone. Text delivery switches on with Twilio;
                  phone alerts with the TestFlight build.
                </Text>
              </View>
            </Card>
          </FadeIn>

          <FadeIn delay={260}>
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
  rowInput: {
    fontFamily: F.bold,
    fontSize: 16,
    color: T.ink,
    textAlign: "right",
    minWidth: 130,
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
  areaInput: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: R.md,
    padding: S.md,
    minHeight: 88,
    fontSize: 15.5,
    fontFamily: F.body,
    color: T.ink,
    textAlignVertical: "top",
  },

  langRow: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  langPill: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: R.pill,
    paddingVertical: 8,
    paddingHorizontal: S.lg,
    backgroundColor: T.paper,
  },
  langPillOn: { backgroundColor: T.ink, borderColor: T.ink },
  langText: { fontFamily: F.bold, fontSize: 14, color: T.ink },

  codeCard: {
    backgroundColor: T.sunPale,
    borderWidth: 1.5,
    borderColor: "#EBCF8C",
    borderRadius: R.lg,
    paddingVertical: S.md,
    alignItems: "center",
    marginBottom: S.lg,
  },
  codeLabel: { fontFamily: F.extra, fontSize: 10, letterSpacing: 1.5, color: T.sunDeep },
  code: { fontFamily: F.extra, fontSize: 26, letterSpacing: 3, color: T.ink, marginTop: 3 },

  infoRow: { flexDirection: "row", gap: S.md, alignItems: "flex-start" },
  version: { ...ty.small, textAlign: "center", marginTop: S.xl, color: T.inkFaint },
});
