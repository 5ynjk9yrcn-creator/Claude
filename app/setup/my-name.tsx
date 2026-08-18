import { useRouter } from "expo-router";
import { useState } from "react";
import { SetupFrame } from "../../components/SetupFrame";
import { BigButton, Field } from "../../components/ui";
import { useStore } from "../../lib/store";

/* Only for "I'm doing both" accounts: their own check-in name,
   collected before the circle is saved to the server. */
export default function MyName() {
  const router = useRouter();
  const { data, update } = useStore();
  const [name, setName] = useState(data?.myName ?? "");
  const canGo = name.trim().length > 0;

  return (
    <SetupFrame
      step={3}
      title="And you check in too."
      sub="What should your own sun screen call you each morning?"
    >
      <Field
        label="Your first name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Austin"
        autoCapitalize="words"
        autoFocus
      />
      <BigButton
        label={canGo ? "Next: the invite" : "Type your name first"}
        tone={canGo ? "primary" : "secondary"}
        onPress={() => {
          if (!canGo) return;
          update({ myName: name.trim() });
          router.push("/setup/invite");
        }}
      />
    </SetupFrame>
  );
}
