import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DeadlinePicker, GhostButton } from "../components/ui";
import { fmtDeadline, seedCheckins, useStore, type Contact } from "../lib/store";
import { F, T } from "../lib/theme";

export default function Settings() {
  const router = useRouter();
  const { data, update, resetAll } = useStore();
  if (!data) return null;

  const watches = data.role === "family" || data.role === "both";
  const checksIn = data.role === "parent" || data.role === "both";
  const parentName = data.parentName || "your parent";

  const setContact = (index: number, patch: Partial<Contact>) => {
    const contacts = [...data.contacts];
    while (contacts.length <= index) {
      contacts.push({ name: "", phone: "", isPrimary: contacts.length === 0 });
    }
    contacts[index] = { ...contacts[index], ...patch };
    update({
      contacts: contacts.filter((c) => c.name.trim() || c.phone.trim()),
    });
  };

  const confirmReset = () => {
    Alert.alert(
      "Start over?",
      "This erases everything in the app on this phone — names, contacts, and check-in history. There's no undo.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Erase everything", style: "destructive", onPress: () => {
          resetAll();
          router.dismissAll();
          router.replace("/welcome");
        } },
      ]
    );
  };

  const inviteAgain = async () => {
    const from = data.contacts.find((c) => c.isPrimary)?.name || "your family";
    try {
      await Share.share({
        message:
          `Hi ${parentName}! I set up OK Today so you can let me know you're OK ` +
          `each morning with one tap. I'll help you get the app on your phone — ` +
          `it takes two minutes. — ${from}`,
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
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={T.ink} />
              <Text style={styles.backText}>Done</Text>
            </Pressable>
            <Text style={styles.title}>Settings</Text>
            <View style={{ width: 70 }} />
          </View>

          {checksIn && (
            <Section title="My check-in">
              <Row label="My name">
                <TextInput
                  value={data.myName}
                  onChangeText={(v) => update({ myName: v })}
                  style={styles.input}
                  placeholder="Your first name"
                  placeholderTextColor={T.inkSoft}
                />
              </Row>
            </Section>
          )}

          {watches && (
            <>
              <Section title={`Watching over ${parentName}`}>
                <Row label="Their name">
                  <TextInput
                    value={data.parentName}
                    onChangeText={(v) => update({ parentName: v })}
                    style={styles.input}
                    placeholder="First name"
                    placeholderTextColor={T.inkSoft}
                  />
                </Row>
                <Row label="Daily deadline">
                  <DeadlinePicker
                    value={data.deadline}
                    onChange={(v) => update({ deadline: v })}
                  />
                </Row>
                <Text style={styles.note}>
                  If {parentName} hasn't checked in by {fmtDeadline(data.deadline)},
                  alerts begin. The deadline follows {data.timezone} — {parentName}'s
                  timezone.
                </Text>
              </Section>

              <Section title="Alert contacts">
                {[0, 1].map((i) => (
                  <View key={i} style={styles.contactBlock}>
                    <Text style={styles.contactHead}>
                      {i === 0 ? "First alerted (you)" : "Backup — alerted 20 min later"}
                    </Text>
                    <View style={styles.contactRow}>
                      <TextInput
                        value={data.contacts[i]?.name ?? ""}
                        onChangeText={(v) => setContact(i, { name: v })}
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Name"
                        placeholderTextColor={T.inkSoft}
                      />
                      <TextInput
                        value={data.contacts[i]?.phone ?? ""}
                        onChangeText={(v) => setContact(i, { phone: v })}
                        style={[styles.input, { flex: 1.3 }]}
                        placeholder="Mobile number"
                        placeholderTextColor={T.inkSoft}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                ))}
              </Section>

              <Section title="Invite">
                <GhostButton label={`Text the invite to ${parentName} ✉`} onPress={inviteAgain} />
                <Text style={styles.note}>
                  The one-tap join link for {parentName}'s phone arrives in Phase 2 of
                  the build.
                </Text>
              </Section>
            </>
          )}

          <Section title="Notifications">
            <Text style={styles.note}>
              Gentle reminders{checksIn ? " for you" : ` for ${parentName}`} an hour
              before the deadline, and alert texts when a morning is missed, switch on
              in Phase 4 of the build — they run from our server, not this phone.
            </Text>
          </Section>

          <Section title="Data & testing">
            {watches && (
              <View style={{ marginBottom: 10 }}>
                <GhostButton
                  label="Re-seed demo history"
                  onPress={() => update({ watchedCheckins: seedCheckins() })}
                />
              </View>
            )}
            <Pressable onPress={confirmReset} style={styles.dangerBtn}>
              <Text style={styles.dangerText}>Erase everything & start over</Text>
            </Pressable>
          </Section>

          <Text style={styles.version}>OK Today — Phase 1 preview</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  wrap: { padding: 20, paddingBottom: 60 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backBtn: { flexDirection: "row", alignItems: "center", width: 70 },
  backText: { fontFamily: F.bold, fontSize: 17, color: T.ink },
  title: { fontFamily: F.serif, fontSize: 24, color: T.ink },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontFamily: F.bold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: T.inkSoft,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 16,
    padding: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  rowLabel: { fontFamily: F.bold, fontSize: 16, color: T.ink, flex: 1 },
  rowControl: { flex: 1.4, alignItems: "flex-end" },
  input: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: F.body,
    color: T.ink,
    backgroundColor: T.paper,
    minWidth: 140,
  },
  note: { fontFamily: F.body, fontSize: 14, color: T.inkSoft, lineHeight: 20, marginTop: 4 },
  contactBlock: { marginBottom: 14 },
  contactHead: { fontFamily: F.bold, fontSize: 13, color: T.inkSoft, marginBottom: 7 },
  contactRow: { flexDirection: "row", gap: 8 },
  dangerBtn: {
    borderWidth: 1.5,
    borderColor: T.clay,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  dangerText: { fontFamily: F.bold, fontSize: 15, color: T.clay },
  version: {
    fontFamily: F.body,
    fontSize: 13,
    color: T.inkSoft,
    textAlign: "center",
    marginTop: 6,
  },
});
