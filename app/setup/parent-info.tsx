import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SetupFrame } from "../../components/SetupFrame";
import { Button, Card, DeadlinePicker, Field } from "../../components/ui";
import { fmtDeadline, useStore } from "../../lib/store";
import { F, R, S, T, type as ty } from "../../lib/theme";

export default function ParentInfo() {
  const router = useRouter();
  const { data, update } = useStore();
  const [name, setName] = useState(data?.parentName ?? "");
  const [deadline, setDeadline] = useState(data?.deadline ?? "11:00");
  const timezone = data?.timezone ?? "";
  const canNext = name.trim().length > 0;
  const who = name.trim() || "they";

  return (
    <SetupFrame
      step={1}
      title="Who are you watching over?"
      sub="We'll greet them by name on their check-in screen each morning."
    >
      <Field
        label="Their first name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ruth"
        autoCapitalize="words"
        autoFocus
        returnKeyType="done"
      />

      <Card style={{ marginBottom: S.xl }}>
        <View style={styles.deadlineRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.deadlineLabel}>Daily check-in deadline</Text>
            <Text style={[ty.small, { marginTop: 2 }]}>
              A gentle reminder goes out an hour before.
            </Text>
          </View>
          <DeadlinePicker value={deadline} onChange={setDeadline} />
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Ionicons name="alert-circle-outline" size={17} color={T.sunDeep} />
          <Text style={styles.infoText}>
            If {who} hasn't tapped the sun by {fmtDeadline(deadline)}, you get a text
            straight away — and your backup contact 20 minutes later.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="globe-outline" size={17} color={T.inkSoft} />
          <Text style={styles.infoText}>
            Times follow <Text style={{ fontFamily: F.bold }}>{timezone}</Text> — this
            phone's timezone. If {who} lives in another one, you can change it in
            Settings.
          </Text>
        </View>
      </Card>

      <Button
        label={canNext ? "Next: who we alert" : "Enter their name to continue"}
        tone={canNext ? "primary" : "secondary"}
        icon={canNext ? "arrow-forward" : undefined}
        disabled={!canNext}
        onPress={() => {
          update({ parentName: name.trim(), deadline });
          router.push("/setup/contacts");
        }}
      />
    </SetupFrame>
  );
}

const styles = StyleSheet.create({
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: S.md },
  deadlineLabel: { fontFamily: F.bold, fontSize: 15.5, color: T.ink },
  divider: {
    height: 1,
    backgroundColor: T.lineSoft,
    marginVertical: S.lg,
  },
  infoRow: { flexDirection: "row", gap: S.sm, marginBottom: S.md },
  infoText: { ...ty.small, flex: 1, lineHeight: 20 },
});
