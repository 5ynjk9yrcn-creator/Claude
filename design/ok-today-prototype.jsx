import { useState, useEffect } from "react";

/* ——— OK Today — aging-parent daily check-in prototype ———
   Two demo devices: the parent's phone (one giant sun to tap)
   and the adult child's dashboard (status, history, escalation).
   Data persists via window.storage. */

const KEY = "oktoday-v1";

const T = {
  sky: "#EAF2F8",
  skyDeep: "#DCE9F4",
  ink: "#1D3557",
  inkSoft: "#5A7086",
  sun: "#F5B82E",
  sunDeep: "#E5A50A",
  leaf: "#4C956C",
  leafPale: "#E3F0E8",
  clay: "#C4553B",
  clayPale: "#F8E7E2",
  paper: "#FFFFFF",
  line: "#C9D9E6",
};

const todayKey = () => new Date().toLocaleDateString("en-CA");
const fmtTime = (d) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function seedData() {
  const checkins = {};
  for (let n = 13; n >= 1; n--) {
    if (n === 6) continue; // one realistic missed morning
    const d = dateNDaysAgo(n);
    const h = 7 + Math.floor(Math.random() * 2);
    const m = Math.floor(Math.random() * 60);
    d.setHours(h, m, 0, 0);
    const moods = ["good", "good", "good", "okay"];
    checkins[d.toLocaleDateString("en-CA")] = {
      t: fmtTime(d),
      iso: d.toISOString(),
      mood: moods[Math.floor(Math.random() * moods.length)],
    };
  }
  return {
    parentName: "Ruth",
    deadline: "11:00",
    contacts: ["You (primary)", "Sarah (backup)"],
    checkins,
  };
}

const MOODS = {
  good: { label: "Good", color: T.leaf, bg: T.leafPale },
  okay: { label: "Okay", color: T.sunDeep, bg: "#FBF0D4" },
  notgreat: { label: "Not great", color: T.clay, bg: T.clayPale },
};

function Sun({ size = 210, tapped, onTap }) {
  const rays = Array.from({ length: 12 });
  return (
    <button
      onClick={onTap}
      aria-label="Tap the sun to check in for today"
      className="sunbtn"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        position: "relative",
        background: `radial-gradient(circle at 38% 32%, #FFD966, ${T.sun} 62%, ${T.sunDeep})`,
        boxShadow: tapped
          ? `0 0 0 14px rgba(245,184,46,0.25), 0 10px 30px rgba(229,165,10,0.45)`
          : `0 12px 28px rgba(29,53,87,0.22)`,
        transition: "transform .15s ease, box-shadow .3s ease",
      }}
    >
      {rays.map((_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 7,
            height: 26,
            borderRadius: 4,
            background: T.sun,
            opacity: 0.85,
            transform: `rotate(${i * 30}deg) translateY(-${size / 2 + 22}px)`,
            transformOrigin: "center",
          }}
        />
      ))}
      <span
        style={{
          fontFamily: "'Young Serif', serif",
          fontSize: size * 0.155,
          color: "#5C4404",
          lineHeight: 1.15,
          display: "block",
          padding: "0 18px",
        }}
      >
        {tapped ? "Checked in ✓" : "I'm OK today"}
      </span>
    </button>
  );
}

function ParentPhone({ data, onCheckIn, onMood }) {
  const rec = data.checkins[todayKey()];
  const now = new Date();
  const dateLine = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const streak = calcStreak(data.checkins);
  return (
    <div
      style={{
        background: rec
          ? "linear-gradient(180deg,#FDF6E3 0%,#F6EFDA 100%)"
          : `linear-gradient(180deg,${T.sky} 0%,${T.skyDeep} 100%)`,
        borderRadius: 34,
        padding: "44px 26px 34px",
        maxWidth: 400,
        margin: "0 auto",
        minHeight: 620,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        border: `1px solid ${T.line}`,
        boxShadow: "0 18px 40px rgba(29,53,87,0.14)",
        transition: "background .6s ease",
      }}
    >
      <div style={{ fontSize: 21, color: T.inkSoft, letterSpacing: 0.3 }}>
        {dateLine}
      </div>
      <h1
        style={{
          fontFamily: "'Young Serif', serif",
          fontSize: 40,
          color: T.ink,
          margin: "10px 0 34px",
          lineHeight: 1.12,
        }}
      >
        Good morning,
        <br />
        {data.parentName}.
      </h1>

      <Sun tapped={!!rec} onTap={rec ? undefined : onCheckIn} />

      {!rec && (
        <p style={{ fontSize: 22, color: T.inkSoft, marginTop: 30 }}>
          Tap the sun once a day —<br />
          that's all there is to it.
        </p>
      )}

      {rec && (
        <div style={{ marginTop: 30, width: "100%" }}>
          <p style={{ fontSize: 24, color: T.ink, margin: 0 }}>
            You're all set — checked in at <b>{rec.t}</b>.
          </p>
          <p style={{ fontSize: 20, color: T.inkSoft, margin: "18px 0 12px" }}>
            How are you feeling?
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {Object.entries(MOODS).map(([k, m]) => (
              <button
                key={k}
                onClick={() => onMood(k)}
                style={{
                  fontSize: 20,
                  padding: "14px 18px",
                  borderRadius: 999,
                  border:
                    rec.mood === k
                      ? `3px solid ${m.color}`
                      : `2px solid ${T.line}`,
                  background: rec.mood === k ? m.bg : T.paper,
                  color: rec.mood === k ? m.color : T.ink,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          {streak > 1 && (
            <p style={{ fontSize: 20, color: T.leaf, marginTop: 22 }}>
              ☀ {streak} mornings in a row
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function calcStreak(checkins) {
  let s = 0;
  let n = checkins[todayKey()] ? 0 : 1;
  for (; ; n++) {
    const k = dateNDaysAgo(n).toLocaleDateString("en-CA");
    if (checkins[k]) s++;
    else break;
  }
  return s;
}

function usualTime(checkins) {
  const recs = Object.values(checkins).filter((r) => r.iso);
  if (!recs.length) return "—";
  const mins =
    recs.reduce((a, r) => {
      const d = new Date(r.iso);
      return a + d.getHours() * 60 + d.getMinutes();
    }, 0) / recs.length;
  const d = new Date();
  d.setHours(Math.floor(mins / 60), Math.round(mins % 60), 0, 0);
  return fmtTime(d);
}

function FamilyDash({ data, simMissed, setSimMissed, onSettings, onReset }) {
  const rec = simMissed ? null : data.checkins[todayKey()];
  const [dh, dm] = data.deadline.split(":").map(Number);
  const dl = new Date();
  dl.setHours(dh, dm, 0, 0);
  const pastDeadline = simMissed || new Date() > dl;
  const status = rec ? "in" : pastDeadline ? "missed" : "waiting";
  const streak = simMissed ? 0 : calcStreak(data.checkins);

  const days = [];
  for (let n = 13; n >= 0; n--) {
    const d = dateNDaysAgo(n);
    const k = d.toLocaleDateString("en-CA");
    days.push({
      k,
      letter: d.toLocaleDateString([], { weekday: "narrow" }),
      rec: n === 0 && simMissed ? null : data.checkins[k],
      isToday: n === 0,
    });
  }

  const statusCfg = {
    in: {
      bg: T.leafPale,
      border: T.leaf,
      title: `${data.parentName} checked in at ${rec?.t} ✓`,
      sub:
        rec?.mood && MOODS[rec.mood]
          ? `Feeling: ${MOODS[rec.mood].label.toLowerCase()}`
          : "All quiet — nothing you need to do.",
    },
    waiting: {
      bg: "#FBF0D4",
      border: T.sunDeep,
      title: `No check-in yet this morning`,
      sub: `Nothing to worry about until ${fmtTime(dl)} — her usual time is ${usualTime(
        data.checkins
      )}.`,
    },
    missed: {
      bg: T.clayPale,
      border: T.clay,
      title: `Missed check-in — past ${fmtTime(dl)}`,
      sub: "The escalation ladder below would now be running.",
    },
  }[status];

  const ladder = [
    { t: fmtTime(dl), txt: "Text you: “Ruth hasn’t checked in today.”" },
    { t: plus(dl, 20), txt: "Text Sarah (backup contact)." },
    { t: plus(dl, 40), txt: "Prompt: one-tap call to Ruth’s phone." },
  ];

  return (
    <div
      style={{
        background: T.paper,
        borderRadius: 30,
        padding: "30px 26px",
        maxWidth: 470,
        margin: "0 auto",
        border: `1px solid ${T.line}`,
        boxShadow: "0 18px 40px rgba(29,53,87,0.12)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: T.inkSoft,
          fontWeight: 700,
        }}
      >
        Your phone
      </div>
      <h2
        style={{
          fontFamily: "'Young Serif', serif",
          fontSize: 30,
          color: T.ink,
          margin: "6px 0 18px",
        }}
      >
        {data.parentName}’s mornings
      </h2>

      <div
        style={{
          background: statusCfg.bg,
          border: `2px solid ${statusCfg.border}`,
          borderRadius: 18,
          padding: "18px 18px",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 21, fontWeight: 800, color: T.ink }}>
          {statusCfg.title}
        </div>
        <div style={{ fontSize: 16, color: T.inkSoft, marginTop: 6 }}>
          {statusCfg.sub}
        </div>
      </div>

      {status === "missed" && (
        <div
          style={{
            border: `1px dashed ${T.clay}`,
            borderRadius: 14,
            padding: 14,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: T.clay,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Escalation ladder (simulated)
          </div>
          {ladder.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                fontSize: 15,
                color: T.ink,
                padding: "5px 0",
              }}
            >
              <b style={{ color: T.clay, minWidth: 74 }}>{s.t}</b>
              <span>{s.txt}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 6, fontSize: 14, color: T.inkSoft, fontWeight: 700 }}>
        LAST 14 MORNINGS
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          background: "#F4F8FB",
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          padding: "12px 10px",
          marginBottom: 20,
        }}
      >
        {days.map((d) => (
          <div key={d.k} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                height: 40,
                borderRadius: 8,
                border: d.isToday
                  ? `2px solid ${T.ink}`
                  : `1.5px solid ${T.line}`,
                background: d.rec
                  ? d.rec.mood && MOODS[d.rec.mood]
                    ? MOODS[d.rec.mood].bg
                    : T.leafPale
                  : d.isToday && !pastDeadline
                  ? T.paper
                  : T.clayPale,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Young Serif', serif",
                fontSize: 19,
                color: d.rec
                  ? d.rec.mood && MOODS[d.rec.mood]
                    ? MOODS[d.rec.mood].color
                    : T.leaf
                  : T.clay,
              }}
            >
              {d.rec ? "✓" : d.isToday && !pastDeadline ? "·" : "✕"}
            </div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>
              {d.letter}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        <Stat label="Streak" value={`${streak} days`} />
        <Stat label="Usual time" value={usualTime(data.checkins)} />
        <Stat label="Deadline" value={fmtTime(dl)} />
      </div>

      <Settings data={data} onSettings={onSettings} />

      <div
        style={{
          marginTop: 22,
          paddingTop: 16,
          borderTop: `1px solid ${T.line}`,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 700 }}>
          DEMO CONTROLS
        </span>
        <button className="ghost" onClick={() => setSimMissed(!simMissed)}>
          {simMissed ? "End simulation" : "Simulate a missed morning"}
        </button>
        <button className="ghost" onClick={onReset}>
          Reset demo data
        </button>
      </div>
    </div>
  );
}

function plus(d, mins) {
  const c = new Date(d);
  c.setMinutes(c.getMinutes() + mins);
  return fmtTime(c);
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#F4F8FB",
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 700 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 19, color: T.ink, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Settings({ data, onSettings }) {
  return (
    <div>
      <div style={{ fontSize: 14, color: T.inkSoft, fontWeight: 700, marginBottom: 8 }}>
        SETTINGS
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 14, color: T.ink }}>
          Parent’s name{" "}
          <input
            value={data.parentName}
            onChange={(e) => onSettings({ parentName: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 14, color: T.ink }}>
          Check-in deadline{" "}
          <input
            type="time"
            value={data.deadline}
            onChange={(e) => onSettings({ deadline: e.target.value || "11:00" })}
            style={inputStyle}
          />
        </label>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {data.contacts.map((c) => (
          <span
            key={c}
            style={{
              fontSize: 13,
              background: T.sky,
              border: `1px solid ${T.line}`,
              color: T.ink,
              borderRadius: 999,
              padding: "5px 12px",
              fontWeight: 600,
            }}
          >
            {c}
          </span>
        ))}
        <span style={{ fontSize: 13, color: T.inkSoft, alignSelf: "center" }}>
          alert contacts (demo)
        </span>
      </div>
    </div>
  );
}

const inputStyle = {
  border: `1.5px solid ${T.line}`,
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 15,
  color: T.ink,
  marginLeft: 6,
  width: 120,
};

export default function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("parent");
  const [simMissed, setSimMissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(KEY);
        setData(JSON.parse(r.value));
      } catch {
        const s = seedData();
        setData(s);
        try {
          await window.storage.set(KEY, JSON.stringify(s));
        } catch (e) {
          console.error("storage unavailable", e);
        }
      }
    })();
  }, []);

  const persist = async (next) => {
    setData(next);
    try {
      await window.storage.set(KEY, JSON.stringify(next));
    } catch (e) {
      console.error("save failed", e);
    }
  };

  if (!data)
    return (
      <div style={{ minHeight: "100vh", background: T.sky, display: "grid", placeItems: "center", color: T.inkSoft, fontFamily: "Karla, sans-serif", fontSize: 18 }}>
        Warming up the sun…
      </div>
    );

  const checkIn = () => {
    const now = new Date();
    persist({
      ...data,
      checkins: {
        ...data.checkins,
        [todayKey()]: { t: fmtTime(now), iso: now.toISOString(), mood: null },
      },
    });
  };

  const setMood = (mood) => {
    const rec = data.checkins[todayKey()];
    if (!rec) return;
    persist({
      ...data,
      checkins: { ...data.checkins, [todayKey()]: { ...rec, mood } },
    });
  };

  const onSettings = (patch) => persist({ ...data, ...patch });

  const onReset = async () => {
    try {
      await window.storage.delete(KEY);
    } catch (e) {}
    const s = seedData();
    setSimMissed(false);
    persist(s);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${T.sky}, #F6FAFD 40%)`,
        fontFamily: "'Karla', sans-serif",
        padding: "26px 16px 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Young+Serif&family=Karla:wght@400;600;700;800&display=swap');
        .sunbtn:hover { transform: scale(1.03); }
        .sunbtn:active { transform: scale(0.97); }
        .sunbtn:focus-visible, .ghost:focus-visible, .seg:focus-visible { outline: 3px solid ${T.ink}; outline-offset: 3px; }
        .ghost { font-size: 13px; font-weight: 700; color: ${T.ink}; background: ${T.paper}; border: 1.5px solid ${T.line}; border-radius: 999px; padding: 7px 14px; cursor: pointer; }
        .ghost:hover { border-color: ${T.ink}; }
        @media (prefers-reduced-motion: reduce) { .sunbtn, .sunbtn:hover, .sunbtn:active { transform: none; transition: none; } }
      `}</style>

      <div style={{ maxWidth: 470, margin: "0 auto 22px", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "'Young Serif', serif",
            fontSize: 24,
            color: T.ink,
          }}
        >
          ☀ OK Today
        </div>
        <div style={{ fontSize: 14, color: T.inkSoft, margin: "4px 0 14px" }}>
          One tap from Mom. One less worry for you. — prototype demo
        </div>
        <div
          role="tablist"
          style={{
            display: "inline-flex",
            background: T.paper,
            border: `1.5px solid ${T.line}`,
            borderRadius: 999,
            padding: 4,
            gap: 4,
          }}
        >
          {[
            ["parent", `${data.parentName}’s phone`],
            ["family", "Your phone"],
          ].map(([k, label]) => (
            <button
              key={k}
              className="seg"
              onClick={() => setView(k)}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "9px 18px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                background: view === k ? T.ink : "transparent",
                color: view === k ? "#fff" : T.ink,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "parent" ? (
        <ParentPhone data={data} onCheckIn={checkIn} onMood={setMood} />
      ) : (
        <FamilyDash
          data={data}
          simMissed={simMissed}
          setSimMissed={setSimMissed}
          onSettings={onSettings}
          onReset={onReset}
        />
      )}
    </div>
  );
}
