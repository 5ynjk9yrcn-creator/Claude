import { useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { F, T } from "../lib/theme";
import { deadlineToday, fmtDeadline } from "../lib/store";

export function BigButton({
  label,
  sub,
  onPress,
  tone = "primary",
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  tone?: "primary" | "secondary";
}) {
  const primary = tone === "primary";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.bigBtn,
        primary ? styles.bigBtnPrimary : styles.bigBtnSecondary,
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <Text style={[styles.bigBtnLabel, { color: primary ? "#FFFFFF" : T.ink }]}>
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.bigBtnSub, { color: primary ? "#D7E3EE" : T.inkSoft }]}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={T.inkSoft}
        {...rest}
        style={[styles.input, style]}
      />
    </View>
  );
}

/* Time-of-day picker for the daily deadline. iOS shows Apple's compact
   control; Android opens the system clock dialog on tap. */
export function DeadlinePicker({
  value,
  onChange,
}: {
  value: string; // "HH:MM"
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const asDate = deadlineToday(value);

  const handle = (_e: unknown, d?: Date) => {
    setOpen(false);
    if (d) {
      onChange(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      );
    }
  };

  if (Platform.OS === "ios") {
    return (
      <DateTimePicker
        mode="time"
        display="compact"
        value={asDate}
        onChange={handle}
        minuteInterval={5}
      />
    );
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.timeBtn}>
        <Text style={styles.timeBtnText}>{fmtDeadline(value)}</Text>
      </Pressable>
      {open && (
        <DateTimePicker mode="time" value={asDate} onChange={handle} minuteInterval={5} />
      )}
    </>
  );
}

export function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.ghost, pressed ? { borderColor: T.ink } : null]}
    >
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

export function Kicker({ text }: { text: string }) {
  return <Text style={styles.kicker}>{text.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  bigBtn: {
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  bigBtnPrimary: { backgroundColor: T.ink },
  bigBtnSecondary: {
    backgroundColor: T.paper,
    borderWidth: 1.5,
    borderColor: T.line,
  },
  bigBtnLabel: { fontFamily: F.bold, fontSize: 22, textAlign: "center" },
  bigBtnSub: {
    fontFamily: F.body,
    fontSize: 15,
    textAlign: "center",
    marginTop: 6,
  },
  fieldLabel: {
    fontFamily: F.bold,
    fontSize: 15,
    color: T.ink,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 18,
    fontFamily: F.body,
    color: T.ink,
    backgroundColor: T.paper,
  },
  timeBtn: {
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: T.paper,
    alignSelf: "flex-start",
  },
  timeBtnText: { fontSize: 18, fontFamily: F.bold, color: T.ink },
  chip: {
    backgroundColor: T.sky,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  chipText: { fontFamily: F.semi, fontSize: 13, color: T.ink },
  ghost: {
    backgroundColor: T.paper,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  ghostText: { fontFamily: F.bold, fontSize: 13, color: T.ink },
  kicker: {
    fontFamily: F.bold,
    fontSize: 13,
    letterSpacing: 2,
    color: T.inkSoft,
  },
});
