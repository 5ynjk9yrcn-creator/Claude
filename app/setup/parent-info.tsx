import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SetupFrame } from "../../components/SetupFrame";
import { BigButton, DeadlinePicker, Field } from "../../components/ui";
import { fmtDeadline, useStore } from "../../lib/store";
import { F, T } from "../../lib/theme";

export default function ParentInfo() {
  const router = useRouter();
  const { data, update } = useStore();
  const [name, setName] = useState(data?.parentName ?? "");
  const [deadline, setDeadline] = useState(data?.deadline ?? "11:00");
  const timezone = data?.timezone ?? "";

  const canNext = name.trim().length > 0;

  return (
    <SetupFrame
      step={1}
      title="Who are you watching over?"
      sub="We'll use their first name on their check-in screen each morning."
    >
      <Field
        label="Their first name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ruth"
        autoCapitalize="words"
        autoFocus
      />

      <Text style={styles.fieldLabel}>Daily check-in deadline</Text>
      <View style={styles.deadlineRow}>
        <DeadlinePicker value={deadline} onChange={setDeadline} />
      </View>
      <Text style={styles.hint}>
        If they haven't tapped the sun by {fmtDeadline(deadline)}, we'll start
        alerting people. They'll get a gentle reminder an hour before.
      </Text>

      <View style={styles.tzBox}>
        <Text style={styles.tzText}>
          Deadline is in <Text style={{ fontFamily: F.bold }}>{timezone}</Text> — this
          phone's timezone. If {name.trim() || "your parent"} lives somewhere with a
          different clock, you'll be able to change it in settings.
        </Text>
      </View>

      <View style={{ height: 26 }} />
      <BigButton
        label={canNext ? "Next: who should we alert?" : "Enter their name to continue"}
        onPress={() => {
          if (!canNext) return;
          update({ parentName: name.trim(), deadline });
          router.push("/setup/contacts");
        }}
        tone={canNext ? "primary" : "secondary"}
      />
    </SetupFrame>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontFamily: F.bold, fontSize: 15, color: T.ink, marginBottom: 7 },
  deadlineRow: { alignItems: "flex-start", marginBottom: 10 },
  hint: { fontFamily: F.body, fontSize: 14, color: T.inkSoft, lineHeight: 20 },
  tzBox: {
    backgroundColor: T.panel,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },
  tzText: { fontFamily: F.body, fontSize: 14, color: T.ink, lineHeight: 20 },
});
