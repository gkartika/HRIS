// The SAPA mascot: a speech bubble ("menyapa") wearing a safety helmet and waving. Three moods: normal,
// happy (something worked) and oops (something went wrong). Colours are fixed for the sunrise login panel.
export type MascotMood = "normal" | "happy" | "oops";

const LINE = "#3d1f40";
const BODY = "#ffffff";
const HELMET = "#fdef0a";
const HELMET_SHADE = "#e8c800";
const PURPLE = "#552c59";

const BUBBLE =
  "M54 30 H116 a34 34 0 0 1 34 34 V136 a34 34 0 0 1 -34 34 H84 L44 199 L58 170 H54 a34 34 0 0 1 -34 -34 V64 a34 34 0 0 1 34 -34 Z";

function Face({ mood }: { mood: MascotMood }) {
  const lx = 65;
  const rx = 105;
  const ey = 96;
  const my = 120;
  const mid = 85;
  if (mood === "happy") {
    return (
      <g>
        <path d={`M${lx - 8} ${ey + 3} Q${lx} ${ey - 9} ${lx + 8} ${ey + 3}`} stroke={LINE} strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d={`M${rx - 8} ${ey + 3} Q${rx} ${ey - 9} ${rx + 8} ${ey + 3}`} stroke={LINE} strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d={`M${lx - 1} ${my - 3} Q${mid} ${my + 31} ${rx + 1} ${my - 3} Z`} fill={LINE} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
        <path d={`M${mid - 11} ${my + 11} Q${mid} ${my + 5} ${mid + 11} ${my + 11} Q${mid} ${my + 23} ${mid - 11} ${my + 11}Z`} fill="#f08a96" />
      </g>
    );
  }
  const dy = mood === "oops" ? 3 : 0;
  return (
    <g>
      <circle cx={lx} cy={ey + dy} r="7" fill={LINE} />
      <circle cx={rx} cy={ey + dy} r="7" fill={LINE} />
      <circle cx={lx + 2} cy={ey + dy - 2.5} r="2.2" fill="#fff" />
      <circle cx={rx + 2} cy={ey + dy - 2.5} r="2.2" fill="#fff" />
      {mood === "oops" ? (
        <>
          <path d={`M${lx - 10} ${ey - 12} L${lx + 10} ${ey - 6} M${rx + 10} ${ey - 12} L${rx - 10} ${ey - 6}`} stroke={LINE} strokeWidth="4.5" strokeLinecap="round" />
          <path d={`M${mid - 17} ${my + 9} q6 -8 12 0 q6 8 12 0 q6 -8 8 0`} stroke={LINE} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d={`M${rx + 30} ${ey - 4} q9 13 0 20 q-9 -7 0 -20Z`} fill="#7cc4f0" stroke={LINE} strokeWidth="2" />
        </>
      ) : (
        <path d={`M${lx + 2} ${my} Q${mid} ${my + 22} ${rx - 2} ${my}`} stroke={LINE} strokeWidth="5" strokeLinecap="round" fill="none" />
      )}
    </g>
  );
}

export function SapaMascot({ mood = "normal", className }: { mood?: MascotMood; className?: string }) {
  return (
    <svg viewBox="0 0 230 220" role="img" aria-label="Maskot SAPA: gelembung percakapan memakai helm safety yang menyapa" className={`sapa-mascot h-auto overflow-visible ${className ?? ""}`}>
      <ellipse cx="85" cy="209" rx="56" ry="7" fill="#000" opacity=".16" />
      <path d="M22 122 q-12 8 -10 26" stroke={LINE} strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M22 122 q-12 8 -10 26" stroke={BODY} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d={BUBBLE} fill={BODY} stroke={LINE} strokeWidth="5" strokeLinejoin="round" />
      <ellipse cx="52" cy="116" rx="9" ry="6" fill="#f4a3a8" opacity=".7" />
      <ellipse cx="118" cy="116" rx="9" ry="6" fill="#f4a3a8" opacity=".7" />
      <Face mood={mood} />
      {/* helmet: dome, side grooves, raised centre rib, shine, brim that dips at the front, CBP chevron */}
      <path d="M28 60 C28 20 54 4 85 4 C116 4 142 20 142 60 Z" fill={HELMET} stroke={LINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M46 56 Q42 30 58 14 M124 56 Q128 30 112 14" fill="none" stroke={LINE} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M71 6 Q85 1 99 6 L101 56 L69 56 Z" fill={HELMET_SHADE} stroke={LINE} strokeWidth="4" strokeLinejoin="round" />
      <path d="M36 42 Q40 24 58 14" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="5" strokeLinecap="round" />
      <path d="M77 42 L85 33 L93 42" fill="none" stroke={PURPLE} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 60 Q14 52 24 52 H146 Q156 52 156 60 Q156 68 146 68 Q128 70 116 75 Q85 84 54 75 Q42 70 24 68 Q14 68 14 60 Z" fill={HELMET} stroke={LINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M26 58 H144" stroke="rgba(255,255,255,.7)" strokeWidth="3" strokeLinecap="round" />
      {/* waving arm */}
      <g className={mood === "oops" ? undefined : "sapa-wave"} style={{ transformOrigin: "150px 118px" }}>
        <path d="M150 118 L184 86" stroke={LINE} strokeWidth="14" strokeLinecap="round" fill="none" />
        <path d="M150 118 L184 86" stroke={BODY} strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="191" cy="78" r="12" fill={BODY} stroke={LINE} strokeWidth="5" />
      </g>
    </svg>
  );
}

// The SAPA app icon (check mark and the word SAPA) next to the company name.
export function SapaMark({ size = 40 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/pwa/icon-192.png" alt="" width={size} height={size} className="block shrink-0" />;
}
