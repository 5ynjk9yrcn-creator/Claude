import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SetupFrame } from "../../components/SetupFrame";
import { BigButton, Field } from "../../components/ui";
import { useStore, type Contact } from "../../lib/store";
import { F, T } from "../../lib/theme";

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
      sub={`If ${parentName} misses the deadline, you get a text right away. A backup contact gets one 20 minutes later.`}
    >
      <Text style={styles.section}>You (first to be alerted)</Text>
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
      />

      <Text style={styles.section}>Backup contact (optional, alerted 20 min later)</Text>
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
      />

      <View style={{ height: 10 }} />
      <BigButton
        label={canNext ? "Next: invite them" : "Add your name and number to continue"}
        tone={canNext ? "primary" : "secondary"}
        onPress={() => {
          if (!canNext) return;
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
  section: {
    fontFamily: F.bold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: T.inkSoft,
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 8,
  },
});
