import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SetupFrame } from "../../components/SetupFrame";
import { Button, Card, Field } from "../../components/ui";
import { useStore, type Contact } from "../../lib/store";
import { F, R, S, T, type as ty } from "../../lib/theme";

export default function Contacts() {
  const router = useRouter();
  const { data, update } = useStore();
  const existing = data?.contacts ?? [];
  const [primaryName, setPrimaryName] = useState(existing[0]?.name ?? "");
  const [primaryPhone, setPrimaryPhone] = useState(existing[0]?.phone ?? "");
  const [backupName, setBackupName] = useState(existing[1]?.name ?? "");
  const [backupPhone, setBackupPhone] = useState(existing[1]?.phone ?? "");

  const canNext = primaryName.trim().length > 0 && primaryPhone.trim().length >= 7;
  const parentName = data?.parentName || "your parent";

  return (
    <SetupFrame
      step={2}
      title="Who should we alert?"
      sub={`If ${parentName} misses the deadline, you hear about it first. A backup contact is texted 20 minutes later.`}
    >
      <Card style={{ marginBottom: S.lg }}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: T.clayPale }]}>
            <Text style={[styles.badgeNum, { color: T.clay }]}>1</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>You</Text>
            <Text style={ty.small}>Texted the moment a morning is missed</Text>
          </View>
        </View>
        <Field
          label="Your name"
          value={primaryName}
          onChangeText={setPrimaryName}
          placeholder="e.g. Austin"
          autoCapitalize="words"
        />
        <Field
          label="Your mobile number"
          value={primaryPhone}
          onChangeText={setPrimaryPhone}
          placeholder="e.g. 416 555 0123"
          keyboardType="phone-pad"
          style={{ marginBottom: 0 }}
        />
      </Card>

      <Card style={{ marginBottom: S.xl }}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: T.panel }]}>
            <Text style={[styles.badgeNum, { color: T.inkSoft }]}>2</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Backup contact</Text>
            <Text style={ty.small}>Optional — texted 20 minutes after you</Text>
          </View>
        </View>
        <Field
          label="Their name"
          value={backupName}
          onChangeText={setBackupName}
          placeholder="e.g. Sarah"
          autoCapitalize="words"
        />
        <Field
          label="Their mobile number"
          value={backupPhone}
          onChangeText={setBackupPhone}
          placeholder="e.g. 416 555 0456"
          keyboardType="phone-pad"
          style={{ marginBottom: 0 }}
        />
      </Card>

      <View style={styles.privacyRow}>
        <Ionicons name="lock-closed-outline" size={15} color={T.inkFaint} />
        <Text style={[ty.small, { flex: 1 }]}>
          Numbers are only ever used to send these alerts.
        </Text>
      </View>

      <Button
        label={canNext ? "Next: invite them" : "Add your name and number"}
        tone={canNext ? "primary" : "secondary"}
        icon={canNext ? "arrow-forward" : undefined}
        disabled={!canNext}
        onPress={() => {
          const contacts: Contact[] = [
            { name: primaryName.trim(), phone: primaryPhone.trim(), isPrimary: true },
          ];
          if (backupName.trim() && backupPhone.trim()) {
            contacts.push({
              name: backupName.trim(),
              phone: backupPhone.trim(),
              isPrimary: false,
            });
          }
          update({ contacts });
          router.push(data?.role === "both" ? "/setup/my-name" : "/setup/invite");
        }}
      />
    </SetupFrame>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    marginBottom: S.lg,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeNum: { fontFamily: F.extra, fontSize: 15 },
  cardTitle: { fontFamily: F.bold, fontSize: 16.5, color: T.ink },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    marginBottom: S.xl,
    paddingHorizontal: S.xs,
  },
});
