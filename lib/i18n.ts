/* Translations for the parent-facing screens only — the family side stays in
   English. The circle carries `lang`, set by the family in Settings, so a
   parent who reads Portuguese sees Portuguese without changing any setting. */

export const LANGS = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "中文" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];

type Strings = {
  morning: string;
  afternoon: string;
  evening: string;
  sunLabel: string;
  sunDone: string;
  tapHint: string;
  thatsIt: string;
  checkedInAt: string;
  feeling: string;
  streak: string;
  mornings: string;
  seeYou: string;
  howFeeling: string;
  moodGood: string;
  moodOkay: string;
  moodNotGreat: string;
  changeMood: string;
  loveToday: string; // {name} sent love — today
  loveYesterday: string;
  streakRow: string; // "☀ {n} mornings in a row"
  joinTitle: string;
  joinSub: string;
  joinPlaceholder: string;
  joinButton: string;
  joinButtonWait: string;
  joinHelp: string;
  joinBadCode: string;
  offline: string;
};

const en: Strings = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  sunLabel: "I'm OK today",
  sunDone: "Checked in ✓",
  tapHint: "Tap the sun once a day —\nthat's all there is to it.",
  thatsIt: "That's it for today,",
  checkedInAt: "Checked in",
  feeling: "Feeling",
  streak: "Streak",
  mornings: "mornings",
  seeYou: "See you tomorrow\nmorning.",
  howFeeling: "How are you feeling?",
  moodGood: "Good",
  moodOkay: "Okay",
  moodNotGreat: "Not great",
  changeMood: "Change how I'm feeling",
  loveToday: "{name} saw you were OK and sent you love.",
  loveYesterday: "{name} saw you were OK yesterday and sent you love.",
  streakRow: "☀ {n} mornings in a row",
  joinTitle: "Welcome!",
  joinSub:
    "Your family sent you a text with a short code. Type it below — it's the only typing you'll ever do here.",
  joinPlaceholder: "ABCD-1234",
  joinButton: "Show me my sun",
  joinButtonWait: "Type the whole code first",
  joinHelp: "No code? Ask your family to open OK Today and look under Settings → Invite.",
  joinBadCode: "That code didn't match — double-check the letters and numbers.",
  offline: "Saved. It will send when you're back online.",
};

const fr: Strings = {
  morning: "Bonjour",
  afternoon: "Bon après-midi",
  evening: "Bonsoir",
  sunLabel: "Je vais bien",
  sunDone: "C'est fait ✓",
  tapHint: "Touchez le soleil une fois par jour —\nc'est tout.",
  thatsIt: "C'est tout pour aujourd'hui,",
  checkedInAt: "Confirmé à",
  feeling: "Humeur",
  streak: "Série",
  mornings: "matins",
  seeYou: "À demain\nmatin.",
  howFeeling: "Comment allez-vous ?",
  moodGood: "Bien",
  moodOkay: "Ça va",
  moodNotGreat: "Pas très bien",
  changeMood: "Modifier mon humeur",
  loveToday: "{name} a vu que vous alliez bien et vous envoie de l'affection.",
  loveYesterday: "{name} a vu hier que vous alliez bien et vous envoie de l'affection.",
  streakRow: "☀ {n} matins d'affilée",
  joinTitle: "Bienvenue !",
  joinSub:
    "Votre famille vous a envoyé un code par message. Tapez-le ci-dessous — c'est la seule fois que vous aurez à écrire.",
  joinPlaceholder: "ABCD-1234",
  joinButton: "Voir mon soleil",
  joinButtonWait: "Tapez le code en entier",
  joinHelp:
    "Pas de code ? Demandez à votre famille d'ouvrir OK Today, section Réglages → Invitation.",
  joinBadCode: "Ce code ne correspond pas — vérifiez les lettres et les chiffres.",
  offline: "Enregistré. L'envoi se fera dès le retour de la connexion.",
};

const es: Strings = {
  morning: "Buenos días",
  afternoon: "Buenas tardes",
  evening: "Buenas noches",
  sunLabel: "Hoy estoy bien",
  sunDone: "Listo ✓",
  tapHint: "Toque el sol una vez al día —\neso es todo.",
  thatsIt: "Eso es todo por hoy,",
  checkedInAt: "Confirmado a las",
  feeling: "Ánimo",
  streak: "Racha",
  mornings: "mañanas",
  seeYou: "Hasta mañana\npor la mañana.",
  howFeeling: "¿Cómo se siente?",
  moodGood: "Bien",
  moodOkay: "Regular",
  moodNotGreat: "No muy bien",
  changeMood: "Cambiar cómo me siento",
  loveToday: "{name} vio que está bien y le manda cariño.",
  loveYesterday: "{name} vio ayer que estaba bien y le manda cariño.",
  streakRow: "☀ {n} mañanas seguidas",
  joinTitle: "¡Bienvenido!",
  joinSub:
    "Su familia le envió un código por mensaje. Escríbalo abajo — es lo único que tendrá que escribir.",
  joinPlaceholder: "ABCD-1234",
  joinButton: "Ver mi sol",
  joinButtonWait: "Escriba el código completo",
  joinHelp:
    "¿Sin código? Pida a su familia que abra OK Today y vaya a Ajustes → Invitación.",
  joinBadCode: "Ese código no coincide — revise las letras y los números.",
  offline: "Guardado. Se enviará cuando vuelva la conexión.",
};

const pt: Strings = {
  morning: "Bom dia",
  afternoon: "Boa tarde",
  evening: "Boa noite",
  sunLabel: "Estou bem hoje",
  sunDone: "Confirmado ✓",
  tapHint: "Toque no sol uma vez por dia —\né só isso.",
  thatsIt: "É só isso por hoje,",
  checkedInAt: "Confirmado às",
  feeling: "Como está",
  streak: "Sequência",
  mornings: "manhãs",
  seeYou: "Até amanhã\nde manhã.",
  howFeeling: "Como está se sentindo?",
  moodGood: "Bem",
  moodOkay: "Mais ou menos",
  moodNotGreat: "Não muito bem",
  changeMood: "Mudar como me sinto",
  loveToday: "{name} viu que você está bem e mandou carinho.",
  loveYesterday: "{name} viu ontem que você estava bem e mandou carinho.",
  streakRow: "☀ {n} manhãs seguidas",
  joinTitle: "Bem-vindo!",
  joinSub:
    "Sua família enviou um código por mensagem. Digite-o abaixo — é a única vez que você vai digitar algo.",
  joinPlaceholder: "ABCD-1234",
  joinButton: "Ver o meu sol",
  joinButtonWait: "Digite o código inteiro",
  joinHelp:
    "Sem código? Peça à sua família para abrir o OK Today em Ajustes → Convite.",
  joinBadCode: "Esse código não confere — verifique as letras e os números.",
  offline: "Salvo. Será enviado quando a conexão voltar.",
};

const it: Strings = {
  morning: "Buongiorno",
  afternoon: "Buon pomeriggio",
  evening: "Buonasera",
  sunLabel: "Oggi sto bene",
  sunDone: "Fatto ✓",
  tapHint: "Tocca il sole una volta al giorno —\ntutto qui.",
  thatsIt: "Per oggi è tutto,",
  checkedInAt: "Confermato alle",
  feeling: "Umore",
  streak: "Serie",
  mornings: "mattine",
  seeYou: "A domani\nmattina.",
  howFeeling: "Come si sente?",
  moodGood: "Bene",
  moodOkay: "Così così",
  moodNotGreat: "Non molto bene",
  changeMood: "Cambia come mi sento",
  loveToday: "{name} ha visto che stai bene e ti manda un abbraccio.",
  loveYesterday: "{name} ieri ha visto che stavi bene e ti manda un abbraccio.",
  streakRow: "☀ {n} mattine di fila",
  joinTitle: "Benvenuto!",
  joinSub:
    "La tua famiglia ti ha mandato un codice per messaggio. Scrivilo qui sotto — è l'unica cosa che dovrai scrivere.",
  joinPlaceholder: "ABCD-1234",
  joinButton: "Mostrami il mio sole",
  joinButtonWait: "Scrivi il codice completo",
  joinHelp:
    "Nessun codice? Chiedi alla tua famiglia di aprire OK Today in Impostazioni → Invito.",
  joinBadCode: "Il codice non corrisponde — controlla lettere e numeri.",
  offline: "Salvato. Verrà inviato appena torna la connessione.",
};

const de: Strings = {
  morning: "Guten Morgen",
  afternoon: "Guten Tag",
  evening: "Guten Abend",
  sunLabel: "Mir geht es gut",
  sunDone: "Erledigt ✓",
  tapHint: "Tippen Sie einmal am Tag auf die Sonne —\nmehr ist es nicht.",
  thatsIt: "Das war's für heute,",
  checkedInAt: "Bestätigt um",
  feeling: "Befinden",
  streak: "Serie",
  mornings: "Morgen",
  seeYou: "Bis morgen\nfrüh.",
  howFeeling: "Wie geht es Ihnen?",
  moodGood: "Gut",
  moodOkay: "Geht so",
  moodNotGreat: "Nicht so gut",
  changeMood: "Befinden ändern",
  loveToday: "{name} hat gesehen, dass es Ihnen gut geht, und denkt an Sie.",
  loveYesterday:
    "{name} hat gestern gesehen, dass es Ihnen gut geht, und denkt an Sie.",
  streakRow: "☀ {n} Morgen in Folge",
  joinTitle: "Willkommen!",
  joinSub:
    "Ihre Familie hat Ihnen einen kurzen Code geschickt. Tippen Sie ihn unten ein — mehr müssen Sie nie eingeben.",
  joinPlaceholder: "ABCD-1234",
  joinButton: "Meine Sonne zeigen",
  joinButtonWait: "Bitte den ganzen Code eingeben",
  joinHelp:
    "Kein Code? Bitten Sie Ihre Familie, OK Today unter Einstellungen → Einladung zu öffnen.",
  joinBadCode: "Dieser Code passt nicht — prüfen Sie Buchstaben und Zahlen.",
  offline: "Gespeichert. Wird gesendet, sobald Sie wieder online sind.",
};

const zh: Strings = {
  morning: "早上好",
  afternoon: "下午好",
  evening: "晚上好",
  sunLabel: "我今天很好",
  sunDone: "已完成 ✓",
  tapHint: "每天点一次太阳 —\n就这么简单。",
  thatsIt: "今天就到这里，",
  checkedInAt: "签到时间",
  feeling: "心情",
  streak: "连续",
  mornings: "天",
  seeYou: "明天早上\n再见。",
  howFeeling: "今天感觉怎么样？",
  moodGood: "很好",
  moodOkay: "还行",
  moodNotGreat: "不太好",
  changeMood: "修改我的心情",
  loveToday: "{name} 看到您平安，送上关心。",
  loveYesterday: "{name} 昨天看到您平安，送上关心。",
  streakRow: "☀ 连续 {n} 天",
  joinTitle: "欢迎！",
  joinSub: "家人给您发了一个短代码。请在下面输入 — 这是您唯一需要输入的内容。",
  joinPlaceholder: "ABCD-1234",
  joinButton: "查看我的太阳",
  joinButtonWait: "请输入完整代码",
  joinHelp: "没有代码？请家人打开 OK Today，在「设置 → 邀请」中查看。",
  joinBadCode: "代码不匹配 — 请检查字母和数字。",
  offline: "已保存，联网后会自动发送。",
};

const TABLE: Record<string, Strings> = { en, fr, es, pt, it, de, zh };

export function t(lang: string | undefined): Strings {
  return TABLE[(lang ?? "en").slice(0, 2)] ?? en;
}

export const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/* Greeting that matches the clock, in the parent's language. */
export function greeting(lang: string | undefined, d = new Date()): string {
  const s = t(lang);
  const h = d.getHours();
  return h < 12 ? s.morning : h < 17 ? s.afternoon : s.evening;
}
