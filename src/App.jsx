import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────
const C = {
  DIESEL_LB_PER_GAL: 8,
  STEER_PCT: 0.2,
  DRIVE_PCT: 0.8,
  STEER_LIMIT: 12000,
  DRIVE_LIMIT: 34000,
  TRAILER_TANDEM_LIMIT: 34000,
  TRAILER_SPREAD_LIMIT: 40000,
  GROSS_LIMIT: 80000,
  FUEL_BUFFER_LB: 50,
  LBS_PER_HOLE: { 2: 125, 4: 250, 6: 375 },
};

const ls = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const fmt = (n) => Math.round(n).toLocaleString("en-US");

const fmtTs = (ts) => {
  const d = new Date(ts);
  const timeStr = d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
  const dayDiff = Math.floor((Date.now() - ts) / 86400000);
  if (dayDiff === 0) return `Today, ${timeStr}`;
  if (dayDiff === 1) return `Yesterday, ${timeStr}`;
  return `${d.toLocaleDateString("en-US", { month:"short", day:"numeric" })}, ${timeStr}`;
};

// ─── Theme ────────────────────────────────────────────────────
const themes = {
  dark: {
    bg: "linear-gradient(160deg,#0d0d1a 0%,#0a0f1e 60%,#0d1a0f 100%)",
    surface: "rgba(255,255,255,0.04)",
    surfaceHover: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.15)",
    text: "#f0f0f0",
    textSub: "#aaa",
    textMuted: "#8b909a",
    textFaint: "#6b7280",
    headerBg: "rgba(255,255,255,0.03)",
    gaugeBg: "#1a1a2e",
    inputBg: "rgba(255,255,255,0.07)",
    divider: "rgba(255,255,255,0.07)",
    flashSafe: "rgba(74,222,128,0.18)",
    flashDanger: "rgba(255,68,68,0.18)",
    shadow: "0 2px 12px rgba(0,0,0,0.4)",
    sectionLabel: "#8b909a",
    textSecondary: "#8b909a",
  },
  light: {
    bg: "linear-gradient(160deg,#f0f4f0 0%,#eef2f8 60%,#f0f4ee 100%)",
    surface: "rgba(0,0,0,0.04)",
    surfaceHover: "rgba(0,0,0,0.07)",
    border: "rgba(0,0,0,0.1)",
    borderStrong: "rgba(0,0,0,0.2)",
    text: "#111827",
    textSub: "#374151",
    textMuted: "#6b7280",
    textFaint: "#9ca3af",
    headerBg: "rgba(255,255,255,0.7)",
    gaugeBg: "#d1d5db",
    inputBg: "rgba(0,0,0,0.05)",
    divider: "rgba(0,0,0,0.08)",
    flashSafe: "rgba(22,163,74,0.2)",
    flashDanger: "rgba(220,38,38,0.2)",
    shadow: "0 2px 12px rgba(0,0,0,0.1)",
    accentGreen:  "#15803d",
    accentBlue:   "#1d4ed8",
    accentYellow: "#d97706",
    accentOrange: "#d97706",
    accentPurple: "#5b21b6",
    accentRed:    "#dc2626",
    accentGreenBanner: "#166534",
    accentYellowBanner: "#d97706",
    sectionLabel: "#1a202c",
    textSecondary: "#374151",
  },
};

// ─── Sub-components ───────────────────────────────────────────
function RingGauge({ value, limit, color, t, a, trafficLight }) {
  const over = value > limit;
  const headroom = limit - value;
  let arcColor = color;
  if (trafficLight) {
    if (over || headroom <= 100) arcColor = a.red;
    else if (headroom <= 500)    arcColor = a.yellow;
    else                         arcColor = a.green;
  } else if (over) {
    arcColor = a.red;
  }
  const cx = 40, cy = 44, r = 34;
  const arcLen = Math.PI * r;
  const fillLen = Math.min(value / limit, 1) * arcLen;

  const tf = (limit - 500) / limit;
  const tAngle = Math.PI * tf;
  const tx = cx - r * Math.cos(tAngle);
  const ty = cy - r * Math.sin(tAngle);
  const nx = -Math.cos(tAngle);
  const ny = -Math.sin(tAngle);
  const HALF = 4;

  return (
    <svg width={80} height={44} viewBox="0 0 80 44" style={{ overflow:"visible", display:"block" }}>
      <path d="M 6,44 A 34,34 0 0,1 74,44"
        fill="none" stroke={t.gaugeBg} strokeWidth={8} strokeLinecap="round" />
      <path d="M 6,44 A 34,34 0 0,1 74,44"
        fill="none" stroke={arcColor} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${fillLen} ${arcLen}`}
        style={{ transition:"stroke-dasharray 0.4s cubic-bezier(.4,0,.2,1), stroke 0.3s" }}
      />
      {limit > 500 && (
        <line x1={tx - HALF * nx} y1={ty - HALF * ny} x2={tx + HALF * nx} y2={ty + HALF * ny}
          stroke={t.textFaint} strokeWidth={1.5} strokeLinecap="round" />
      )}
    </svg>
  );
}

function AxleCard({ label, current, limit, color, t, a, trafficLight, minVal }) {
  const over = current > limit;
  const tooLight = minVal !== undefined && current > 0 && current < minVal;
  const remaining = limit - current;
  const headroom = limit - current;
  let badgeColor = a.green;
  if (tooLight) {
    badgeColor = a.red;
  } else if (trafficLight) {
    if (over || headroom <= 100) badgeColor = a.red;
    else if (headroom <= 500)    badgeColor = a.yellow;
    else                         badgeColor = a.green;
  } else {
    badgeColor = over ? a.red : a.green;
  }
  const badgeText = tooLight
    ? `${fmt(minVal - current)} low`
    : over
    ? `+${fmt(Math.abs(remaining))} over`
    : `-${fmt(remaining)} left`;

  return (
    <div style={{ background: t.surface, border:`1px solid ${over||tooLight?a.red:t.border}`, borderRadius:16, padding:"12px 8px", flex:1, minWidth:0, boxShadow: t.shadow, display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", paddingLeft:4, paddingRight:4, marginBottom:8 }}>
        <span style={{ fontSize:10, color:t.textSecondary, letterSpacing:1, textTransform:"uppercase", fontFamily:"'DM Sans',sans-serif" }}>{label}</span>
        <span style={{ fontSize:9, color: badgeColor, fontWeight:700, fontFamily:"'Space Mono',monospace" }}>{badgeText}</span>
      </div>
      <RingGauge value={current} limit={limit} color={color} t={t} a={a} trafficLight={trafficLight} />
      <div style={{ marginTop:10, display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:800, color: over||tooLight?a.redText:t.text, lineHeight:1 }}>
          {fmt(current)}
        </div>
        <div style={{ fontSize:10, fontWeight:400, color:t.textFaint, fontFamily:"'DM Sans',sans-serif", marginTop:2, alignSelf:"flex-end", marginRight:4 }}>lb</div>
      </div>
      <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color: tooLight?a.red:t.textFaint, marginTop:4 }}>
        {tooLight ? `min ${fmt(minVal)}` : `lim ${fmt(limit)}`}
      </div>
      {tooLight && <div style={{ fontSize:9, color:a.red, marginTop:4, fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>STEERING RISK</div>}
    </div>
  );
}

function Toggle({ on, leftLabel, rightLabel, onColor="#4ade80", t }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      {leftLabel && <span style={{ fontSize:11, color: on ? t.textFaint : onColor, fontWeight:700 }}>{leftLabel}</span>}
      <div style={{ width:44, height:26, background: on?onColor:"rgba(128,128,128,0.2)", borderRadius:99, position:"relative", transition:"background 0.2s", flexShrink:0 }}>
        <div style={{ position:"absolute", top:3, left: on?21:3, width:20, height:20, background:"#fff", borderRadius:"50%", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }} />
      </div>
      {rightLabel && <span style={{ fontSize:11, color: on?onColor:t.textFaint, fontWeight:700 }}>{rightLabel}</span>}
    </div>
  );
}

function SettingRow({ label, sub, value, onChange, placeholder, t }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div>
        <div style={{ fontSize:13, color:t.textSub, fontWeight:600 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:t.textSecondary }}>{sub}</div>}
      </div>
      <input type="number" inputMode="decimal" value={value} placeholder={placeholder}
        onChange={e=>onChange(e.target.value)}
        style={{ width:80, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:16, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"8px" }}
      />
    </div>
  );
}

function Divider({ t }) {
  return <div style={{ height:1, background:t.divider }} />;
}

function ModeButton({ active, label, color, onClick }) {
  return (
    <button onClick={onClick} style={{ flex:1, padding:"8px 4px", borderRadius:8,
      border: active?`1.5px solid ${color}`:"1.5px solid rgba(128,128,128,0.15)",
      background: active?`${color}1a`:"transparent",
      color: active?color:"#888", fontSize:11, fontWeight:700,
      fontFamily:"'DM Sans',sans-serif", letterSpacing:0.3, cursor:"pointer", transition:"all 0.18s" }}>
      {label}
    </button>
  );
}

function FuelGauge({ fraction, color, t, isDark }) {
  const cx = 100, cy = 100, r = 72;
  const arcLen = Math.PI * r;
  const clampedF = Math.max(0, Math.min(1, isNaN(fraction) ? 0 : fraction));
  const fillLen = clampedF * arcLen;
  const needleR = 54;
  const rotation = clampedF * 180 - 180;

  const tickFracs = [0, 0.25, 0.5, 0.75, 1.0];
  const tickLabels = ["E", "¼", "½", "¾", "F"];

  const fuelLow = clampedF < 0.13;
  const fuelMed = clampedF < 0.26;
  const gaugeColor = fuelLow ? "#ff4444" : fuelMed ? "#facc15" : color;

  return (
    <svg width="100%" viewBox="0 0 200 108" style={{ display:"block", maxWidth:280, margin:"0 auto", overflow:"visible" }}>
      <path d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
        fill="none" stroke={t.gaugeBg} strokeWidth={10} strokeLinecap="round" />
      <path d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
        fill="none" stroke={gaugeColor} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${fillLen} ${arcLen}`}
        style={{ transition:"stroke-dasharray 0.45s cubic-bezier(.4,0,.2,1), stroke 0.3s" }}
      />
      {tickFracs.map((f, i) => {
        const angle = Math.PI * (1 - f);
        const innerR = r - 14;
        const outerR = r - 7;
        const x1 = cx + innerR * Math.cos(angle);
        const y1 = cy - innerR * Math.sin(angle);
        const x2 = cx + outerR * Math.cos(angle);
        const y2 = cy - outerR * Math.sin(angle);
        const labelR = r - 22;
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy - labelR * Math.sin(angle);
        const isE = i === 0;
        const isF = i === 4;
        return (
          <g key={f}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isE ? "#ff4444" : isF ? gaugeColor : t.textFaint}
              strokeWidth={isE || isF ? 2 : 1.5} strokeLinecap="round" />
            <text x={lx} y={ly + 3} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: isE || isF ? 10 : 9, fontWeight: isE || isF ? 700 : 400,
                fontFamily:"'DM Sans',sans-serif", fill: isE ? "#ff4444" : isF ? gaugeColor : t.textFaint }}>
              {tickLabels[i]}
            </text>
          </g>
        );
      })}
      <g style={{ transformOrigin:`${cx}px ${cy}px`, transform:`rotate(${rotation}deg)`, transition:"transform 0.45s cubic-bezier(.4,0,.2,1)" }}>
        <line x1={cx - 10} y1={cy} x2={cx + needleR} y2={cy}
          stroke={gaugeColor} strokeWidth={2.5} strokeLinecap="round"
          style={{ transition:"stroke 0.3s" }} />
        <line x1={cx - 10} y1={cy} x2={cx - 4} y2={cy}
          stroke={t.textFaint} strokeWidth={2.5} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={7} fill={gaugeColor} style={{ transition:"fill 0.3s" }} />
      <circle cx={cx} cy={cy} r={4} fill={isDark ? "#0a0f1e" : "#f0f4f0"} />
    </svg>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const [themeMode, setThemeMode] = useState(() => ls.get("qf_theme","system"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => ls.get("qf_activeTab", "main"));
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => ls.get("qf_disclaimer_accepted", false));
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [warningExpanded, setWarningExpanded] = useState(false);

  const [orientationComplete, setOrientationComplete] = useState(() => ls.get("qf_orientation_complete", false));
  const [orientationStep, setOrientationStep] = useState(1);
  const [isOnboardingProfile, setIsOnboardingProfile] = useState(false);

  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = themeMode === "system" ? systemDark : themeMode === "dark";
  const t = isDark ? themes.dark : themes.light;
  const saveTheme = (v) => { setThemeMode(v); ls.set("qf_theme",v); };
  const switchTab = (tab) => { setActiveTab(tab); ls.set("qf_activeTab", tab); };

  const A = {
    green:  isDark ? "#4ade80" : t.accentGreen,
    blue:   isDark ? "#60a5fa" : t.accentBlue,
    yellow: isDark ? "#facc15" : t.accentYellow,
    orange: isDark ? "#fb923c" : t.accentOrange,
    purple: isDark ? "#a78bfa" : t.accentPurple,
    red:    isDark ? "#ff4444" : t.accentRed,
    redText:isDark ? "#ff6b6b" : t.accentRed,
    greenBanner:  isDark ? "#4ade80" : t.accentGreenBanner,
    yellowBanner: isDark ? "#facc15" : t.accentYellowBanner,
  };

  const [steer, setSteer]           = useState("");
  const [drives, setDrives]         = useState("");
  const [trailer, setTrailer]       = useState("");
  const [gallonsNow, setGallonsNow] = useState("");
  const [gallonsToAdd, setGallonsToAdd] = useState("");

  const [spreadAxle, _setSpreadAxle]     = useState(() => ls.get("qf_spreadAxle", false));
  const [fuelCapacity, _setFuelCapacity] = useState(() => ls.get("qf_fuelCapacity","150"));
  const [mpg, _setMpg]                   = useState(() => ls.get("qf_mpg","7.5"));
  const [fuelMode, _setFuelMode]         = useState(() => ls.get("qf_fuelMode","safe"));
  const [holeSpacing, _setHoleSpacing]   = useState(() => ls.get("qf_holeSpacing", 4));
  const [slideGoal, _setSlideGoal]       = useState(() => ls.get("qf_slideGoal","legal"));
  const [currentHole, _setCurrentHole]   = useState(() => ls.get("qf_currentHole",""));
  const [totalHoles, _setTotalHoles]     = useState(() => ls.get("qf_totalHoles", 10));
  const [steerMin, _setSteerMin]         = useState(() => ls.get("qf_steerMin", "10000"));
  const [trailerType, _setTrailerType]   = useState(() => ls.get("qf_trailerType", "Dry Van"));

  const setSpreadAxle   = (val) => { _setSpreadAxle(val);   ls.set("qf_spreadAxle",   val); };
  const setFuelCapacity = (val) => { _setFuelCapacity(val); ls.set("qf_fuelCapacity", val); };
  const setMpg          = (val) => { _setMpg(val);          ls.set("qf_mpg",          val); };
  const setFuelMode     = (val) => { _setFuelMode(val);     ls.set("qf_fuelMode",     val); };
  const setHoleSpacing  = (val) => { _setHoleSpacing(val);  ls.set("qf_holeSpacing",  val); };
  const setSlideGoal    = (val) => { _setSlideGoal(val);    ls.set("qf_slideGoal",    val); };
  const setCurrentHole  = (val) => { _setCurrentHole(val);  ls.set("qf_currentHole",  val); };
  const setTotalHoles   = (val) => { _setTotalHoles(val);   ls.set("qf_totalHoles",   val); };
  const setSteerMin     = (val) => { _setSteerMin(val);     ls.set("qf_steerMin",     val); };
  const setTrailerType    = (val) => { _setTrailerType(val);    ls.set("qf_trailerType",    val); };
  const setScaleSession   = (val) => { _setScaleSession(val);   ls.set("qf_scale_session",  val); };
  const setCurrentOdometer= (val) => { _setCurrentOdometer(val);ls.set("qf_current_odometer",val); };

  const [profiles, setProfiles]             = useState(() => ls.get("qf_profiles", []));
  const [activeProfile, _setActiveProfile]  = useState(() => ls.get("qf_activeProfile", null));
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const setActiveProfile = (v) => { _setActiveProfile(v); ls.set("qf_activeProfile", v); };

  const [resetConfirm, setResetConfirm] = useState(false);
  const [flash, setFlash]               = useState(null);

  // ── Scale tab state ───────────────────────────────────────
  const [scaleSession, _setScaleSession]         = useState(() => ls.get("qf_scale_session", null));
  const [scanning, setScanning]                  = useState(false);
  const [scanResult, setScanResult]              = useState(null);
  const [scanError, setScanError]                = useState(null);
  const [scanReviewSteer, setScanReviewSteer]    = useState("");
  const [scanReviewDrives, setScanReviewDrives]  = useState("");
  const [scanReviewTrailer, setScanReviewTrailer]= useState("");
  const [currentOdometer, _setCurrentOdometer]  = useState(() => ls.get("qf_current_odometer", ""));
  const [scaleClearConfirm, setScaleClearConfirm] = useState(false);
  const [scaleApplyMsg, setScaleApplyMsg]         = useState(false);

  // ── Scale wizard state ────────────────────────────────────
  const [scaleStep, setScaleStep]               = useState(0);   // 0=type, 1=weights, 2=conditions, 3=complete
  const [sessionType, setSessionType]           = useState(null); // "scale" | "fuel"
  const [wizardSteer, setWizardSteer]           = useState("");
  const [wizardDrives, setWizardDrives]         = useState("");
  const [wizardTrailer, setWizardTrailer]       = useState("");
  const [wizardFuelAtScale, setWizardFuelAtScale] = useState("");
  const [wizardOdoAtScale, setWizardOdoAtScale]   = useState("");
  const [fuelAtPump, setFuelAtPump]             = useState("");
  const [estimatedApplied, setEstimatedApplied] = useState(false);
  const odoChangedByUser = useRef(false);
  const prevSafe        = useRef(null);
  const sliderResultRef = useRef(null);
  const fileInputRef    = useRef(null);

  // ── Derived ───────────────────────────────────────────────
  const fuelCapNum  = Number(fuelCapacity) || 150;
  const mpgNum      = Number(mpg) || 7.5;
  const STEER_MIN   = Number(steerMin) || 10000;
  const trailerLim  = spreadAxle ? C.TRAILER_SPREAD_LIMIT : C.TRAILER_TANDEM_LIMIT;
  const steerNum    = Number(steer)    || 0;
  const drivesNum   = Number(drives)   || 0;
  const trailerNum  = Number(trailer)  || 0;
  const galNowNum   = Number(gallonsNow) || 0;

  const hasSteer   = steer !== "";
  const hasDrives  = drives !== "";
  const hasTrailer = trailer !== "";
  const weightsOK  = hasSteer && hasDrives && hasTrailer;
  const fuelOK     = gallonsNow !== "";
  const readyToCalculate = weightsOK && fuelOK;
  const steerTooLight = weightsOK && steerNum < STEER_MIN && steerNum > 0;

  const estLevel = hasSteer ? (hasDrives ? (hasTrailer ? 3 : 2) : 1) : 0;

  const progressiveEst = estLevel === 1
    ? Math.max(0, Math.floor(
        (C.STEER_LIMIT - C.FUEL_BUFFER_LB - steerNum) / (C.DIESEL_LB_PER_GAL * C.STEER_PCT)
      ))
    : estLevel === 2
    ? Math.max(0, Math.floor(Math.min(
        (C.STEER_LIMIT - C.FUEL_BUFFER_LB - steerNum)  / (C.DIESEL_LB_PER_GAL * C.STEER_PCT),
        (C.DRIVE_LIMIT - C.FUEL_BUFFER_LB - drivesNum) / (C.DIESEL_LB_PER_GAL * C.DRIVE_PCT)
      )))
    : null;

  const steerWarning   = hasSteer   && steerNum  > 0 && (steerNum  < 6000  || steerNum  > 12500);
  const drivesWarning  = hasDrives  && drivesNum > 0 && (drivesNum < 10000 || drivesNum > 35000);
  const trailerWarning = hasTrailer && trailerNum > 0 && (trailerNum < 5000 || trailerNum > 41000);

  const maxBySteer  = (C.STEER_LIMIT  - C.FUEL_BUFFER_LB - steerNum)  / (C.DIESEL_LB_PER_GAL * C.STEER_PCT);
  const maxByDrives = (C.DRIVE_LIMIT  - C.FUEL_BUFFER_LB - drivesNum) / (C.DIESEL_LB_PER_GAL * C.DRIVE_PCT);
  const maxByGross  = (C.GROSS_LIMIT  - C.FUEL_BUFFER_LB - steerNum - drivesNum - trailerNum) / C.DIESEL_LB_PER_GAL;
  const maxSafeGal  = Math.max(0, Math.floor(Math.min(maxBySteer, maxByDrives, maxByGross, fuelCapNum - galNowNum)));

  const maxLegalFromCurrent = Math.max(0, Math.floor(Math.min(
    (C.STEER_LIMIT  - C.FUEL_BUFFER_LB - steerNum)  / (C.DIESEL_LB_PER_GAL * C.STEER_PCT),
    (C.DRIVE_LIMIT  - C.FUEL_BUFFER_LB - drivesNum) / (C.DIESEL_LB_PER_GAL * C.DRIVE_PCT),
    (C.GROSS_LIMIT  - C.FUEL_BUFFER_LB - steerNum - drivesNum - trailerNum) / C.DIESEL_LB_PER_GAL,
    fuelCapNum - galNowNum
  )));

  const effectiveGal =
    fuelMode === "full" ? Math.max(0, fuelCapNum - galNowNum) :
    fuelMode === "safe" ? maxSafeGal :
    Number(gallonsToAdd) || 0;

  const totalAfter   = galNowNum + effectiveGal;
  const addedWeight  = effectiveGal * C.DIESEL_LB_PER_GAL;
  const addedSteer   = addedWeight * C.STEER_PCT;
  const addedDrive   = addedWeight * C.DRIVE_PCT;
  const newSteer     = steerNum  + addedSteer;
  const newDrives    = drivesNum + addedDrive;
  const newTrailer   = trailerNum;
  const newGross     = newSteer + newDrives + newTrailer;
  const rangeCurrent = Math.round(galNowNum * mpgNum);
  const rangeAfter   = Math.round(totalAfter * mpgNum);

  const safe = weightsOK && fuelOK &&
    newSteer <= C.STEER_LIMIT && newDrives <= C.DRIVE_LIMIT &&
    newTrailer <= trailerLim  && newGross  <= C.GROSS_LIMIT &&
    !steerTooLight;
  const grossOver = newGross > C.GROSS_LIMIT;
  const grossRem  = C.GROSS_LIMIT - newGross;

  // ── Tandem slider ─────────────────────────────────────────
  const lbsPerHole   = C.LBS_PER_HOLE[holeSpacing] || 250;
  const currentHoleN = Number(currentHole) || 0;
  let slideHoles = 0, slideReason = "";
  let slideResultDrives = drivesNum, slideResultTrailer = trailerNum;

  if (weightsOK && !spreadAxle) {
    const driveOver   = drivesNum  > C.DRIVE_LIMIT;
    const trailerOver = trailerNum > C.TRAILER_TANDEM_LIMIT;
    if (slideGoal === "balance") {
      const diff = drivesNum - (drivesNum + trailerNum) / 2;
      slideHoles = -Math.round(diff / lbsPerHole);
      slideReason = "Balance drives & trailer evenly";
    } else if (slideGoal === "legal") {
      if (trailerOver && !driveOver) {
        slideHoles = Math.ceil((trailerNum - C.TRAILER_TANDEM_LIMIT) / lbsPerHole);
        slideReason = "Reduce trailer to legal limit";
      } else if (driveOver && !trailerOver) {
        slideHoles = -Math.ceil((drivesNum - C.DRIVE_LIMIT) / lbsPerHole);
        slideReason = "Reduce drives to legal limit";
      } else if (driveOver && trailerOver) {
        slideHoles = Math.ceil(((trailerNum - C.TRAILER_TANDEM_LIMIT) - (drivesNum - C.DRIVE_LIMIT)) / (2 * lbsPerHole));
        slideReason = "Reduce both axles toward legal";
      } else {
        slideReason = "Both axles within legal limits";
      }
    } else {
      const totalOver = Math.max(0, drivesNum - C.DRIVE_LIMIT) + Math.max(0, trailerNum - C.TRAILER_TANDEM_LIMIT);
      if (totalOver === 0) {
        slideReason = "No adjustment needed";
      } else {
        slideHoles = Math.ceil(((trailerNum - C.TRAILER_TANDEM_LIMIT) - (drivesNum - C.DRIVE_LIMIT)) / (2 * lbsPerHole));
        slideReason = "Minimize total over-limit weight";
      }
    }
    slideResultDrives  = drivesNum  - slideHoles * lbsPerHole;
    slideResultTrailer = trailerNum + slideHoles * lbsPerHole;
  }

  const newHole  = currentHoleN + slideHoles;
  const slideDir = slideHoles > 0 ? "forward" : slideHoles < 0 ? "back" : "none";
  const absHoles = Math.abs(slideHoles);
  const showSliderBadge = activeTab !== "slider" && weightsOK && !spreadAxle && slideHoles !== 0;

  // ── Handlers ──────────────────────────────────────────────
  const acceptDisclaimer = () => {
    if (!disclaimerChecked) return;
    setDisclaimerAccepted(true);
    ls.set("qf_disclaimer_accepted", true);
  };

  const advanceOrientation = () => {
    if (orientationStep < 3) {
      setOrientationStep(s => s + 1);
    } else {
      ls.set("qf_orientation_complete", true);
      setOrientationComplete(true);
      setIsOnboardingProfile(true);
      setNewProfileName("");
      setShowSavePrompt(true);
    }
  };

  const dismissOrientation = () => {
    ls.set("qf_orientation_complete", true);
    setOrientationComplete(true);
  };

  const doReset = () => {
    if (steer !== "" || drives !== "" || trailer !== "" || gallonsNow !== "") {
      const snapshot = { steer, drives, trailer, gallonsNow, fuelMode, gallonsAdded: effectiveGal, ts: Date.now() };
      ls.set("qf_last_session", snapshot);
    }
    setSteer(""); setDrives(""); setTrailer(""); setGallonsNow(""); setGallonsToAdd("");
    setResetConfirm(false);
    setResultsOpen(false);
  };

  const saveProfile = () => {
    const name = newProfileName.trim();
    if (!name) return;
    const profile = { id: Date.now(), name, fuelCapacity, mpg, spreadAxle, holeSpacing, steerMin, trailerType };
    const updated = [...profiles, profile];
    setProfiles(updated); ls.set("qf_profiles", updated);
    setActiveProfile(profile.id);
    setShowSavePrompt(false); setNewProfileName(""); setIsOnboardingProfile(false);
  };

  const loadProfile = (profile) => {
    setFuelCapacity(profile.fuelCapacity);
    setMpg(profile.mpg);
    setSpreadAxle(profile.spreadAxle);
    setHoleSpacing(profile.holeSpacing);
    if (profile.steerMin !== undefined) setSteerMin(String(profile.steerMin));
    if (profile.trailerType !== undefined) setTrailerType(profile.trailerType);
    setActiveProfile(profile.id);
    setShowProfileMenu(false);
  };

  const deleteProfile = (id) => {
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated); ls.set("qf_profiles", updated);
    if (activeProfile === id) setActiveProfile(null);
  };

  // ── Scale tab handlers ─────────────────────────────────────
  const scanTicket = (file) => {
    if (!file) return;
    setScanning(true); setScanResult(null); setScanError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      const mimeType = file.type || "image/jpeg";
      try {
        const resp = await fetch("/.netlify/functions/scan-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mimeType }),
        });
        if (!resp.ok) throw new Error("Server error");
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        setScanResult(data);
        setScanReviewSteer(data.steer?.value != null ? String(data.steer.value) : "");
        setScanReviewDrives(data.drives?.value != null ? String(data.drives.value) : "");
        setScanReviewTrailer(data.trailer?.value != null ? String(data.trailer.value) : "");
      } catch {
        setScanError("Could not read ticket — please try again or enter weights manually.");
      } finally {
        setScanning(false);
      }
    };
    reader.onerror = () => { setScanError("Could not read image file."); setScanning(false); };
    reader.readAsDataURL(file);
  };

  const applyScannedWeights = () => {
    // Wizard Step 1: populate wizard inputs from scan, don't save session yet
    if (scanReviewSteer)  setWizardSteer(scanReviewSteer);
    if (scanReviewDrives) setWizardDrives(scanReviewDrives);
    if (scanReviewTrailer)setWizardTrailer(scanReviewTrailer);
    setScanResult(null); setScanError(null);
  };

  const resetScaleWizard = () => {
    setScaleStep(0); setSessionType(null);
    setWizardSteer(""); setWizardDrives(""); setWizardTrailer("");
    setWizardFuelAtScale(""); setWizardOdoAtScale("");
    setFuelAtPump("");
    setScanResult(null); setScanError(null); setScaleApplyMsg(false);
  };

  const completeScaleSession = () => {
    const session = {
      timestamp: Date.now(),
      steer: Number(wizardSteer) || 0,
      drives: Number(wizardDrives) || 0,
      trailer: Number(wizardTrailer) || 0,
      fuelAtScale: Number(wizardFuelAtScale) || 0,
      odometerAtScale: Number(wizardOdoAtScale) || null,
      sessionType,
    };
    setScaleSession(session);
    setSteer(wizardSteer);
    setDrives(wizardDrives);
    setTrailer(wizardTrailer);
    if (sessionType === "fuel" && fuelAtPump) setGallonsNow(fuelAtPump);
    setScaleApplyMsg(true);
    setTimeout(() => {
      setScaleApplyMsg(false);
      switchTab("main");
    }, 1300);
  };

  // ── Effects ───────────────────────────────────────────────
  useEffect(() => {
    if (!weightsOK || !fuelOK) { prevSafe.current = null; return; }
    if (prevSafe.current === null) { prevSafe.current = safe; return; }
    if (prevSafe.current !== safe) {
      setFlash(safe ? "safe" : "danger");
      if (navigator.vibrate) navigator.vibrate(safe ? [40,30,40] : [80,40,80,40,80]);
      setTimeout(() => setFlash(null), 700);
      prevSafe.current = safe;
    }
  }, [safe, weightsOK, fuelOK]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "slider" && weightsOK && !spreadAxle && slideHoles !== 0) {
      setTimeout(() => sliderResultRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 150);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (spreadAxle && activeTab === "slider") switchTab("main");
  }, [spreadAxle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate axle weights + fuel from scale session when odometer is entered
  useEffect(() => {
    if (!odoChangedByUser.current) return;
    if (!scaleSession || currentOdometer === "" || !scaleSession.odometerAtScale) return;
    const miles    = Math.max(0, Number(currentOdometer) - scaleSession.odometerAtScale);
    const burned   = miles / mpgNum;
    const wtBurned = burned * C.DIESEL_LB_PER_GAL;
    setSteer(String(Math.round(Math.max(0, scaleSession.steer  - wtBurned * C.STEER_PCT))));
    setDrives(String(Math.round(Math.max(0, scaleSession.drives - wtBurned * C.DRIVE_PCT))));
    setGallonsNow(String(Math.round(Math.max(0, scaleSession.fuelAtScale - burned))));
    setEstimatedApplied(true);
  }, [currentOdometer, scaleSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Style helpers ─────────────────────────────────────────
  const SL = {
    fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
    fontWeight: isDark ? 500 : 700, color: t.sectionLabel,
    marginBottom: 12, fontFamily: "'Barlow Condensed',sans-serif",
  };

  const inp = (val, set, ph, mode="numeric") => ({
    type:"number", inputMode:mode, value:val, placeholder:ph,
    onChange: e => set(e.target.value),
    style:{
      width:"100%", background:"transparent", border:"none",
      borderBottom:`1.5px solid ${val===""?"rgba(239,68,68,0.4)":t.borderStrong}`,
      color: val===""?"#888":t.text, fontSize:15, fontWeight:700,
      fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"4px 0"
    }
  });

  const reqCard = (val) => ({
    background: val===""?"rgba(239,68,68,0.07)":t.surface,
    border:`1px solid ${val===""?"rgba(239,68,68,0.35)":t.border}`,
    borderRadius:12, padding:"12px 8px", flex:1, textAlign:"center"
  });

  const orientationCards = [
    { step:1, title:"Enter your weights", body:"Start by entering your current steer, drive, and trailer axle weights from your last scale ticket. These reset every session.", icon:"⚖️" },
    { step:2, title:"Check your fuel",    body:"Enter your current fuel level using the gauge or type it in. FuelMargin will tell you the maximum you can safely add.", icon:"⛽" },
    { step:3, title:"Save your truck",    body:"Set your tank capacity, MPG, and axle type — then save them as a truck profile so you never have to enter them again.", icon:"🚛" },
  ];
  const oc = orientationCards[orientationStep - 1];

  const tabs = [
    { id:"main",   label:"Weights & Fuel" },
    { id:"scale",  label:"Scale", badge: scaleSession === null },
    { id:"truck",  label:"Truck" },
    ...(!spreadAxle ? [{ id:"slider", label:"Tandem Slider", badge: showSliderBadge }] : []),
  ];

  const trailerTypes = ["Dry Van","Reefer","Flatbed","Step Deck","RGN","Lowboy","Other"];

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background: t.bg, fontFamily:"'DM Sans',sans-serif", color:t.text, padding:"0 0 80px 0", transition:"background 0.3s" }}>

      {/* Disclaimer */}
      {!disclaimerAccepted && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)" }} />
          <div style={{ position:"fixed", inset:0, zIndex:1001, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
            <div style={{ background: isDark?"#1a1f2e":"#ffffff", border:`1px solid ${t.border}`, borderRadius:20, padding:"32px 24px", maxWidth:420, width:"100%", boxShadow: t.shadow }}>
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:800, color:t.text, letterSpacing:0.5 }}>Important Disclaimer</div>
                <div style={{ fontSize:12, color:t.textSecondary, marginTop:4 }}>Please read before using this application</div>
              </div>
              <div style={{ fontSize:13, color:t.textSub, lineHeight:1.65, marginBottom:24 }}>
                <p style={{ margin:"0 0 12px 0" }}>This is a <strong style={{ color:t.text }}>decision-support tool only</strong>, intended to help drivers make more informed fueling decisions based on estimated axle weights and weight limits.</p>
                <p style={{ margin:"0 0 12px 0" }}>Results are estimates and may not reflect actual scale weights due to load distribution, equipment variation, or input errors.</p>
                <p style={{ margin:0 }}><strong style={{ color:t.text }}>The driver is solely responsible</strong> for ensuring their vehicle is legally loaded and safe to operate. The driver assumes full responsibility for any citations, fines, accidents, or damages — regardless of what this app displays. This tool does not replace official scale tickets or applicable regulations.</p>
              </div>
              <div style={{ height:1, background:t.divider, marginBottom:24 }} />
              <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:24, cursor:"pointer" }} onClick={() => setDisclaimerChecked(v => !v)}>
                <div style={{ width:22, height:22, borderRadius:4, flexShrink:0, border:`2px solid ${disclaimerChecked?A.green:t.textMuted}`, background: disclaimerChecked?(isDark?`${A.green}25`:`${A.green}18`):"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
                  {disclaimerChecked && <span style={{ fontSize:13, color:A.green, lineHeight:1, fontWeight:900 }}>&#10003;</span>}
                </div>
                <span style={{ fontSize:12, color:t.textSub, lineHeight:1.5 }}>I understand that I am solely responsible for the safe and legal operation of my vehicle and take full responsibility for its operation. I will not hold the developers of this application liable for any outcome resulting from its use.</span>
              </div>
              <button onClick={acceptDisclaimer} disabled={!disclaimerChecked} style={{ width:"100%", padding:"16px", borderRadius:12, border:"none", background: disclaimerChecked?A.green:t.border, color: disclaimerChecked?(isDark?"#0d1a0f":"#fff"):t.textFaint, fontSize:15, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, cursor: disclaimerChecked?"pointer":"not-allowed", boxShadow: disclaimerChecked?`0 4px 16px ${A.green}40`:"none", transition:"all 0.25s" }}>
                I UNDERSTAND — CONTINUE
              </button>
            </div>
          </div>
        </>
      )}

      {/* Orientation */}
      {disclaimerAccepted && !orientationComplete && (
        <>
          <div onClick={orientationStep > 1 ? dismissOrientation : undefined} style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)", cursor: orientationStep > 1 ? "pointer" : "default" }} />
          <div style={{ position:"fixed", inset:0, zIndex:1001, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: isDark?"#1a1f2e":"#ffffff", border:`1px solid ${t.border}`, borderRadius:20, padding:"32px 24px", maxWidth:380, width:"100%", boxShadow: t.shadow }}>
              <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:24 }}>
                {[1,2,3].map(n => (
                  <div key={n} style={{ height:4, width: n === orientationStep ? 24 : 8, borderRadius:99, background: n === orientationStep ? A.green : t.border, transition:"all 0.3s" }} />
                ))}
              </div>
              <div style={{ fontSize:36, textAlign:"center", marginBottom:16 }}>{oc.icon}</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:800, color:t.text, textAlign:"center", marginBottom:12 }}>{oc.title}</div>
              <div style={{ fontSize:14, color:t.textSub, lineHeight:1.6, textAlign:"center", marginBottom:32 }}>{oc.body}</div>
              <div style={{ textAlign:"center", fontSize:10, color:t.textFaint, letterSpacing:1.5, textTransform:"uppercase", marginBottom:16 }}>{orientationStep} of 3</div>
              <button onClick={advanceOrientation} style={{ width:"100%", padding:"16px", borderRadius:12, border:"none", background: A.green, color: isDark?"#0d1a0f":"#fff", fontSize:15, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, cursor:"pointer", transition:"all 0.2s" }}>
                {orientationStep === 3 ? "LET'S GO" : "NEXT"}
              </button>
              {orientationStep > 1 && (
                <button onClick={dismissOrientation} style={{ width:"100%", marginTop:8, padding:"10px", borderRadius:8, border:"none", background:"transparent", color:t.textFaint, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Skip setup</button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Settings backdrop */}
      {settingsOpen && <div onClick={()=>setSettingsOpen(false)} style={{ position:"fixed", inset:0, zIndex:78 }} />}

      {/* Flash overlay */}
      {flash && (
        <div style={{ position:"fixed", inset:0, zIndex:999, pointerEvents:"none", background: flash==="safe"?t.flashSafe:t.flashDanger, animation:"flashAnim 0.7s ease-out forwards" }} />
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes pulseAnim { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>

      {/* ── Results overlay ── */}
      {resultsOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:200, background: isDark?"#0a0f1e":"#f0f4f0" }}>
          {/* Scrollable content area — padded so warning bar never hides content */}
          <div style={{ position:"absolute", inset:0, overflowY:"auto", paddingBottom: warningExpanded ? 220 : 56 }}>

          {/* Overlay header */}
          <div style={{ position:"sticky", top:0, zIndex:10, background: isDark?"rgba(10,15,30,0.97)":"rgba(240,244,240,0.97)", backdropFilter:"blur(12px)", borderBottom:`1px solid ${t.border}`, padding:"16px 20px", paddingTop:"max(16px, env(safe-area-inset-top))", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:800, color:t.text, letterSpacing:0.3 }}>Results</div>
            <button onClick={()=>setResultsOpen(false)} style={{ fontSize:13, fontWeight:600, color:t.textMuted, background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              ← Edit
            </button>
          </div>

          <div style={{ padding:"20px 16px", maxWidth:480, margin:"0 auto" }}>

            {/* Safe / Not Safe banner */}
            <div style={{ borderRadius:20, padding:"20px 24px", marginBottom:20, background: safe?(isDark?"rgba(74,222,128,0.12)":"rgba(22,163,74,0.08)"):(isDark?"rgba(255,68,68,0.12)":"rgba(220,38,38,0.08)"), border:`2px solid ${safe?A.green:A.red}`, boxShadow: safe?`0 0 24px ${A.green}20`:`0 0 24px ${A.red}20` }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:32, fontWeight:800, letterSpacing:0.5, color: steerTooLight?A.redText:safe?A.greenBanner:A.redText }}>
                {steerTooLight ? "STEER TOO LIGHT" : safe ? "SAFE TO ROLL" : "DO NOT ROLL"}
              </div>
              <div style={{ fontSize:13, color:t.textSecondary, marginTop:6 }}>
                {steerTooLight
                  ? <span style={{ color:A.red }}>Steer axle too light — {fmt(steerNum)} lb (min {fmt(STEER_MIN)} lb)</span>
                  : <>Gross: {fmt(newGross)} lb &nbsp;·&nbsp;<span style={{ color:grossOver?A.red:A.green }}>{grossOver?`${fmt(Math.abs(grossRem))} over limit`:`${fmt(grossRem)} under limit`}</span></>
                }
              </div>
            </div>

            {/* Axle gauges */}
            <div style={{ marginBottom:20 }}>
              <div style={SL}>Axle Weights After Fueling</div>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <AxleCard label="Steer"  current={Math.round(newSteer)}  limit={C.STEER_LIMIT} color={A.blue}   t={t} a={A} trafficLight minVal={STEER_MIN} />
                <AxleCard label="Drives" current={Math.round(newDrives)} limit={C.DRIVE_LIMIT} color={A.yellow} t={t} a={A} trafficLight />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <AxleCard label="Trailer" current={Math.round(newTrailer)} limit={trailerLim}    color={A.orange} t={t} a={A} trafficLight />
                <AxleCard label="Gross"   current={Math.round(newGross)}   limit={C.GROSS_LIMIT} color={A.purple} t={t} a={A} trafficLight />
              </div>
            </div>

            {/* Max Legal Fill */}
            <div style={{ marginBottom:20, borderRadius:12, padding:"14px 16px", background: maxLegalFromCurrent<20?"rgba(255,68,68,0.1)":"rgba(250,204,21,0.08)", border:`1px solid ${maxLegalFromCurrent<20?"rgba(255,68,68,0.35)":"rgba(250,204,21,0.3)"}` }}>
              <div style={{ fontSize:11, fontWeight:700, color: maxLegalFromCurrent<20?A.redText:A.yellowBanner, letterSpacing:0.3, marginBottom:4 }}>MAX LEGAL FILL</div>
              <div style={{ fontSize:18, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, color:t.text }}>
                {maxLegalFromCurrent} gal
                <span style={{ fontSize:12, fontWeight:400, color:t.textSecondary, marginLeft:10 }}>· {Math.round(maxLegalFromCurrent * mpgNum)} mi range</span>
              </div>
              <div style={{ fontSize:10, color:t.textFaint, marginTop:4 }}>Includes 50 lb safety buffer</div>
            </div>

            {/* Fuel summary + max safe */}
            <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px", marginBottom:20, boxShadow:t.shadow }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:t.textSub }}>Fueling Plan</div>
                <div style={{ fontSize:11, color:t.textFaint }}>
                  {fuelMode==="full" ? "Fill to Full" : fuelMode==="manual" ? "Manual" : "Max Safe"}
                </div>
              </div>
              <div style={{ fontSize:22, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color:t.text, marginBottom:4 }}>
                {effectiveGal} <span style={{ fontSize:13, fontWeight:400, color:t.textFaint }}>gal adding</span>
              </div>
              <div style={{ height:1, background:t.divider, margin:"12px 0" }} />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:11, color:t.textFaint, letterSpacing:0.5, textTransform:"uppercase", marginBottom:2 }}>Max Safe Add</div>
                  <div style={{ fontSize:18, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color: maxSafeGal===0?A.red:"#a78bfa" }}>
                    {maxSafeGal} <span style={{ fontSize:11, fontWeight:400, color:t.textFaint }}>gal</span>
                  </div>
                </div>
                <div style={{ fontSize:10, color:t.textFaint, textAlign:"right", lineHeight:1.5 }}>
                  50 lb buffer applied<br />
                  {maxSafeGal===0 ? <span style={{ color:A.red }}>already at or over limit</span> : `${Math.round(maxSafeGal * mpgNum)} mi range`}
                </div>
              </div>
            </div>

            {/* Fuel stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
              {[
                { label:"Gallons Adding",   val:`${effectiveGal} gal`, color:t.text },
                { label:"Total After Fill", val:`${totalAfter} gal`,   color:t.text },
                { label:"Range Now",        val:`${rangeCurrent.toLocaleString()} mi`, color:A.blue },
                { label:"Range After Fill", val:`${rangeAfter.toLocaleString()} mi`,   color:A.green },
              ].map(({label,val,color})=>(
                <div key={label} style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:12, padding:"12px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:18, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Weight breakdown */}
            {effectiveGal > 0 && (
              <div style={{ marginBottom:20, background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"12px 16px" }}>
                <div style={{ fontSize:11, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Weight Added Breakdown</div>
                {[
                  { label:"Total fuel weight",   val:`${fmt(addedWeight)} lb`,             color:t.text },
                  { label:"→ Steer axle (20%)",  val:`+${fmt(Math.round(addedSteer))} lb`, color:A.blue },
                  { label:"→ Drive axles (80%)", val:`+${fmt(Math.round(addedDrive))} lb`, color:A.yellow },
                ].map(({label,val,color})=>(
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:t.textSub, marginBottom:8 }}>
                    <span>{label}</span><span style={{ color, fontWeight:700 }}>{val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Reset */}
            <div style={{ display:"flex", justifyContent:"center" }}>
              {!resetConfirm ? (
                <button onClick={()=>setResetConfirm(true)} style={{ fontSize:12, color:A.red, background:"transparent", border:`1px solid ${A.red}40`, borderRadius:8, padding:"8px 20px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", letterSpacing:0.3 }}>
                  Reset Session
                </button>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:12, color:A.red }}>Clear all session data?</span>
                  <button onClick={doReset} style={{ fontSize:12, fontWeight:700, color:"#fff", background:A.red, border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer" }}>Yes, clear</button>
                  <button onClick={()=>setResetConfirm(false)} style={{ fontSize:12, color:t.textMuted, background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, padding:"6px 14px", cursor:"pointer" }}>Cancel</button>
                </div>
              )}
            </div>

          </div>
          </div>{/* end scrollable content */}

          {/* ── Collapsible warning strip — sticky bottom of overlay ── */}
          <div style={{
            position:"absolute", bottom:0, left:0, right:0, zIndex:20,
            background: isDark?"rgba(10,15,30,0.97)":"rgba(240,244,240,0.97)",
            backdropFilter:"blur(12px)",
            borderTop:`1px solid ${isDark?"rgba(255,68,68,0.3)":"rgba(220,38,38,0.25)"}`,
            transition:"all 0.3s cubic-bezier(.4,0,.2,1)",
          }}>
            {/* Tap handle / collapsed bar */}
            <button
              onClick={()=>setWarningExpanded(v=>!v)}
              style={{ width:"100%", padding:"12px 20px", background:"transparent", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:13 }}>⚠️</span>
                <span style={{ fontSize:11, fontWeight:700, color:isDark?"#ff6b6b":"#dc2626", letterSpacing:0.5, fontFamily:"'DM Sans',sans-serif" }}>
                  Driver Responsibility
                </span>
              </div>
              <span style={{ fontSize:11, color:t.textFaint, transition:"transform 0.3s", display:"inline-block", transform: warningExpanded?"rotate(180deg)":"rotate(0deg)" }}>▲</span>
            </button>

            {/* Expanded content */}
            {warningExpanded && (
              <div style={{ padding:"0 20px 20px", maxWidth:480, margin:"0 auto" }}>
                <div style={{ height:1, background:isDark?"rgba(255,68,68,0.2)":"rgba(220,38,38,0.15)", marginBottom:14 }} />
                <p style={{ margin:"0 0 10px 0", fontSize:12, color:t.textMuted, lineHeight:1.65 }}>
                  These results are estimates based on the weights you entered. Actual scale weights may differ due to load distribution, fuel burn, and equipment variation.
                </p>
                <p style={{ margin:0, fontSize:12, color:t.textMuted, lineHeight:1.65 }}>
                  <strong style={{ color:t.textSub }}>You are solely responsible</strong> for verifying your vehicle is legally loaded and safe to operate. The developers of FuelMargin are not liable for any violations, citations, accidents, or damages resulting from the use of this application.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── App header ── */}
      <div style={{ padding:"16px 16px 0", paddingTop:"max(16px, env(safe-area-inset-top))", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1 style={{ margin:0, fontSize:22, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, letterSpacing:-0.5, color:t.text }}>FuelMargin</h1>
        <div style={{ position:"relative" }}>
          <button onClick={()=>setSettingsOpen(o=>!o)} style={{ width:36, height:36, borderRadius:8, border:`1.5px solid ${settingsOpen?t.text:t.border}`, background: settingsOpen?t.surface:"transparent", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:t.textMuted, transition:"all 0.15s" }}>&#9881;</button>
          {settingsOpen && (
            <div style={{ position:"absolute", top:44, right:0, zIndex:200, background: isDark?"#1a1f2e":"#ffffff", border:`1px solid ${t.border}`, borderRadius:16, padding:"8px", minWidth:180, boxShadow: t.shadow }}>
              <div style={{ fontSize:10, color:t.textFaint, textTransform:"uppercase", letterSpacing:1.5, padding:"4px 8px 8px" }}>Appearance</div>
              {[["system","System"],["light","Light"],["dark","Dark"]].map(([mode,label])=>(
                <button key={mode} onClick={()=>{ saveTheme(mode); setSettingsOpen(false); }} style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:"none", background: themeMode===mode?(isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)"):"transparent", color: themeMode===mode?t.text:t.textMuted, fontSize:13, fontWeight: themeMode===mode?700:400, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", display:"flex", alignItems:"center", gap:8, textAlign:"left", transition:"background 0.15s" }}>
                  <span>{label}</span>
                  {themeMode===mode && <span style={{ marginLeft:"auto", fontSize:12, color:A.green, fontWeight:900 }}>&#10003;</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding:"16px 16px 24px", maxWidth:480, margin:"0 auto" }}>

        {/* ── Tab: Weights & Fuel ── */}
        {activeTab === "main" && <>


          {/* Progressive estimate */}
          {!weightsOK && estLevel > 0 && (
            <div style={{ marginBottom:16, borderRadius:12, padding:"12px 16px", background: isDark?"rgba(107,114,128,0.06)":"rgba(107,114,128,0.05)", border:`1px solid ${t.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:t.textMuted, letterSpacing:0.5 }}>
                {estLevel === 1 ? "MAX FILL ESTIMATE — STEER ONLY" : "MAX FILL ESTIMATE — STEER + DRIVES"}
              </div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:700, color:t.textSecondary, marginTop:4 }}>
                up to {progressiveEst} gal
              </div>
              <div style={{ fontSize:10, color:t.textFaint, marginTop:4 }}>
                {estLevel === 1 ? "Estimate — enter all weights for exact calculation" : "Partial estimate — enter trailer weight to finalize"}
              </div>
            </div>
          )}

          {/* Axle weights */}
          <div style={{ marginBottom:16 }}>
            <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, overflow:"hidden", boxShadow:t.shadow }}>
              <div style={{ padding:"16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:t.textSub }}>Axle Weights</span>
                    {estimatedApplied && <span style={{ fontSize:9, fontWeight:700, color:A.yellow, letterSpacing:0.5, border:`1px solid ${A.yellow}`, borderRadius:4, padding:"1px 5px" }}>ESTIMATED</span>}
                  </div>
                  <span style={{ fontSize:10, color:"#ef4444", fontWeight:700, letterSpacing:0.5 }}>REQUIRED</span>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    ["Steer",   steer,   (v) => { setSteer(v);   setEstimatedApplied(false); }, steerWarning,   "Steer axles typically range 6,000–12,000 lb — double check this value."],
                    ["Drives",  drives,  (v) => { setDrives(v);  setEstimatedApplied(false); }, drivesWarning,  "Drive axles typically range 10,000–34,000 lb — double check this value."],
                    ["Trailer", trailer, (v) => { setTrailer(v); setEstimatedApplied(false); }, trailerWarning, "Trailer axles typically range 5,000–40,000 lb — double check this value."],
                  ].map(([label, val, set, warn, warnText]) => (
                    <div key={label} style={{ flex:1, minWidth:0 }}>
                      <div style={reqCard(val)}>
                        <div style={{ fontSize:10, color:val===""?"#ef4444":t.textSecondary, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>
                          {label}{val===""?" *":""}
                        </div>
                        <input {...inp(val, set, "—")} onBlur={label==="Steer" ? () => {
                          if (val==="77777") { setSteer("11000"); setDrives("30000"); setTrailer("26000"); setGallonsNow("60"); }
                          else if (val==="88888") { setSteer("11900"); setDrives("33900"); setTrailer("33900"); setGallonsNow("60"); }
                          else if (val==="99999") { setSteer("11900"); setDrives("34800"); setTrailer("33600"); setGallonsNow("60"); }
                        } : undefined} />
                        <div style={{ fontSize:10, color:t.textFaint, marginTop:4 }}>lb</div>
                      </div>
                      {warn && <div style={{ fontSize:9, color:A.yellow, marginTop:4, lineHeight:1.4, textAlign:"center", padding:"0 2px" }}>{warnText}</div>}
                    </div>
                  ))}
                </div>
                {!weightsOK && <div style={{ marginTop:8, fontSize:11, color:"#ef4444", opacity:0.75, textAlign:"center" }}>All three weights required to calculate</div>}
              </div>
            </div>

          </div>

          {/* Current odometer — required when a scale session with odometer reference exists */}
          {scaleSession && scaleSession.odometerAtScale && (
            <div style={{ background:t.surface, border:`1px solid ${currentOdometer===""?"rgba(239,68,68,0.35)":t.border}`, borderRadius:14, padding:"12px 16px", marginBottom:16, boxShadow:t.shadow }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:currentOdometer===""?"#ef4444":t.textSub }}>
                    Current Odometer{currentOdometer===""?" *":""}
                  </div>
                  <div style={{ fontSize:11, color:t.textFaint, marginTop:2 }}>Enter to estimate axle weights &amp; fuel since scaling</div>
                </div>
                <span style={{ fontSize:10, color:"#ef4444", fontWeight:700, letterSpacing:0.5 }}>REQUIRED</span>
              </div>
              <div style={{ position:"relative" }}>
                <input type="number" inputMode="numeric" value={currentOdometer} placeholder="Enter miles"
                  onChange={e => { odoChangedByUser.current = true; setCurrentOdometer(e.target.value); }}
                  style={{ width:"100%", boxSizing:"border-box", background:currentOdometer===""?"rgba(239,68,68,0.06)":t.inputBg, border:`1px solid ${currentOdometer===""?"rgba(239,68,68,0.3)":t.border}`, borderRadius:10, color:t.text, fontSize:20, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"10px 44px 10px 10px" }} />
                <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:13, color:t.textFaint, fontWeight:600, pointerEvents:"none" }}>mi</span>
              </div>
              {currentOdometer === "" && (
                <div style={{ marginTop:6, fontSize:11, color:"#ef4444", opacity:0.75 }}>Required to estimate weights and fuel level</div>
              )}
              {currentOdometer !== "" && (
                <div style={{ marginTop:8, fontSize:11, color:t.textFaint }}>
                  {(() => {
                    const miles = Math.max(0, Number(currentOdometer) - scaleSession.odometerAtScale);
                    const burned = Math.round((miles / mpgNum) * 10) / 10;
                    return `${miles.toLocaleString()} mi since scale · ~${burned} gal burned`;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Fuel level */}
          <div style={{ background:t.surface, border:`1px solid ${gallonsNow===""?"rgba(239,68,68,0.35)":t.border}`, borderRadius:16, padding:"16px", marginBottom:20, boxShadow:t.shadow }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:700, color:gallonsNow===""?"#ef4444":t.textSub }}>
                Current Fuel Level{gallonsNow===""?" *":""}
              </span>
              <span style={{ fontSize:10, color:"#ef4444", fontWeight:700, letterSpacing:0.5 }}>REQUIRED</span>
            </div>

            {/* Fuel level notice — estimated vs generic tip */}
            {estimatedApplied && scaleSession ? (
              <div style={{ marginBottom:14, background:isDark?"rgba(250,204,21,0.07)":"rgba(217,119,6,0.05)", border:`1px solid ${isDark?"rgba(250,204,21,0.25)":"rgba(217,119,6,0.25)"}`, borderRadius:10, padding:"10px 12px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:A.yellow, letterSpacing:0.3, marginBottom:3 }}>ESTIMATED FUEL LEVEL</div>
                <span style={{ fontSize:11, color:t.textMuted, lineHeight:1.6 }}>
                  Calculated from your scale fuel ({scaleSession.fuelAtScale} gal at {scaleSession.odometerAtScale?.toLocaleString()} mi) minus estimated burn based on current odometer and your {mpgNum} mpg setting. Verify before relying on this value.
                </span>
              </div>
            ) : (
              <div style={{ marginBottom:14, background:isDark?"rgba(250,204,21,0.06)":"rgba(217,119,6,0.05)", border:`1px solid ${isDark?"rgba(250,204,21,0.18)":"rgba(217,119,6,0.2)"}`, borderRadius:10, padding:"10px 12px" }}>
                <span style={{ fontSize:11, color:t.textMuted, lineHeight:1.5 }}>For best accuracy, record your fuel level at the scale — or fuel immediately after weighing.</span>
              </div>
            )}

            {(() => {
              const fraction = gallonsNow === "" ? 0 : Math.min(galNowNum / fuelCapNum, 1);
              const hasValue = gallonsNow !== "";
              const fuelLow = fraction < 0.13;
              const fuelMed = fraction < 0.26;
              const gaugeColor = fuelLow ? "#ff4444" : fuelMed ? "#facc15" : A.green;
              const ticks = [0,1,2,3,4,5,6,7,8];
              const labels = ["E","⅛","¼","⅜","½","⅝","¾","⅞","F"];
              const sliderVal = !hasValue ? -1 : Math.round(fraction * 8);
              return (
                <div style={{ marginBottom:8 }}>
                  <FuelGauge fraction={hasValue ? fraction : 0} color={A.green} t={t} isDark={isDark} />
                  {hasValue ? (
                    <div style={{ textAlign:"center", marginTop:4, marginBottom:8 }}>
                      <span style={{ fontSize:18, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color:gaugeColor }}>
                        {galNowNum === 0 ? "EMPTY" : galNowNum >= fuelCapNum ? "FULL" : `${galNowNum} gal`}
                      </span>
                      {galNowNum > 0 && galNowNum < fuelCapNum && (
                        <span style={{ fontSize:12, color:t.textSecondary, marginLeft:8 }}>({Math.round(fraction * 100)}%)</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign:"center", marginBottom:8 }}>
                      <span style={{ fontSize:13, color:t.textFaint, fontStyle:"italic" }}>tap below to set level</span>
                    </div>
                  )}
                  <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                    {ticks.map(i => (
                      <button key={i} onClick={()=>setGallonsNow(String(Math.round((i/8)*fuelCapNum)))}
                        style={{ flex:1, height:28, borderRadius:8, cursor:"pointer",
                          border: sliderVal===i ? `1.5px solid ${gaugeColor}` : `1px solid ${t.border}`,
                          background: sliderVal===i ? (isDark?`${gaugeColor}30`:`${gaugeColor}20`) : (isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)"),
                          transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:9, fontWeight:700, color:sliderVal===i?gaugeColor:t.textFaint, fontFamily:"'DM Sans',sans-serif" }}>{labels[i]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:8, borderTop:`1px solid ${t.divider}` }}>
              <span style={{ fontSize:11, color:t.textSecondary, whiteSpace:"nowrap" }}>Or enter exact:</span>
              <input type="number" inputMode="decimal" value={gallonsNow} placeholder="—" onChange={e=>setGallonsNow(e.target.value)} style={{ flex:1, minWidth:0, background:"transparent", border:"none", borderBottom:`1.5px solid ${gallonsNow===""?"rgba(239,68,68,0.4)":t.borderStrong}`, color:gallonsNow===""?"#888":t.text, fontSize:20, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", outline:"none", padding:"4px 0", textAlign:"right" }} />
              <span style={{ fontSize:12, color:t.textFaint, fontWeight:600 }}>gal</span>
            </div>
            {!fuelOK && <div style={{ marginTop:8, fontSize:11, color:"#ef4444", opacity:0.75 }}>Current fuel level required to calculate</div>}
          </div>

          {/* Scale session reference row — shown below fuel card when a session with fuel data exists */}
          {scaleSession && scaleSession.fuelAtScale > 0 && (
            <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:-12, marginBottom:16, paddingLeft:4, paddingRight:4 }}>
              <div style={{ flex:1, background:isDark?"rgba(250,204,21,0.05)":"rgba(217,119,6,0.04)", border:`1px solid ${isDark?"rgba(250,204,21,0.15)":"rgba(217,119,6,0.18)"}`, borderRadius:10, padding:"8px 12px" }}>
                <div style={{ fontSize:10, color:t.textFaint, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Scale Fuel</div>
                <div style={{ fontSize:15, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color:A.yellow }}>{scaleSession.fuelAtScale} gal</div>
              </div>
              {scaleSession.odometerAtScale && (
                <div style={{ flex:1, background:isDark?"rgba(250,204,21,0.05)":"rgba(217,119,6,0.04)", border:`1px solid ${isDark?"rgba(250,204,21,0.15)":"rgba(217,119,6,0.18)"}`, borderRadius:10, padding:"8px 12px" }}>
                  <div style={{ fontSize:10, color:t.textFaint, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Scale Odometer</div>
                  <div style={{ fontSize:15, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color:A.yellow }}>{scaleSession.odometerAtScale.toLocaleString()}</div>
                </div>
              )}
              <button onClick={() => switchTab("scale")} style={{ fontSize:11, color:t.textFaint, background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>
                View session
              </button>
            </div>
          )}

          {/* Fueling mode */}
          <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px", marginBottom:20, boxShadow:t.shadow }}>
            <div style={SL}>How Much Are You Adding?</div>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <ModeButton active={fuelMode==="safe"}   label="Max Safe"     color="#a78bfa" onClick={()=>setFuelMode("safe")} />
              <ModeButton active={fuelMode==="full"}   label="Fill to Full" color={A.green} onClick={()=>setFuelMode("full")} />
              <ModeButton active={fuelMode==="manual"} label="Manual"       color={A.blue}  onClick={()=>setFuelMode("manual")} />
            </div>
            {fuelMode==="safe" && (
              <div style={{ background:"rgba(167,139,250,0.07)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:12, padding:"12px 16px", fontSize:13, color:isDark?"#c4b5fd":"#7c3aed" }}>
                Adding <strong style={{ fontSize:16, fontFamily:"'Barlow Condensed',sans-serif" }}>{maxSafeGal} gal</strong> — maximum without exceeding any legal weight limit
              </div>
            )}
            {fuelMode==="full" && (
              <div style={{ background:"rgba(74,222,128,0.07)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:12, padding:"12px 16px", fontSize:13, color:isDark?"#86efac":A.green }}>
                Adding <strong style={{ fontSize:16, fontFamily:"'Barlow Condensed',sans-serif" }}>{Math.max(0,fuelCapNum-galNowNum)} gal</strong> to reach full ({fuelCapNum} gal)
              </div>
            )}
            {fuelMode==="manual" && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <label style={{ fontSize:13, color:t.textSub }}>Gallons to add</label>
                <input type="number" inputMode="decimal" value={gallonsToAdd} placeholder="0" onChange={e=>setGallonsToAdd(e.target.value)} style={{ width:80, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:16, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"8px" }} />
              </div>
            )}
          </div>

          {/* Calculate button */}
          <button
            onClick={() => readyToCalculate && setResultsOpen(true)}
            disabled={!readyToCalculate}
            style={{
              width:"100%", padding:"18px", borderRadius:16, border:"none",
              background: readyToCalculate ? A.green : t.border,
              color: readyToCalculate ? (isDark?"#0d1a0f":"#fff") : t.textFaint,
              fontSize:17, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif",
              letterSpacing:0.5, cursor: readyToCalculate ? "pointer" : "not-allowed",
              boxShadow: readyToCalculate ? `0 4px 20px ${A.green}40` : "none",
              transition:"all 0.25s",
            }}
          >
            {!weightsOK ? "ENTER AXLE WEIGHTS TO CONTINUE" : !fuelOK ? "ENTER FUEL LEVEL TO CONTINUE" : "CALCULATE →"}
          </button>

        </> /* end main tab */}

        {/* ── Tab: Scale ── */}
        {activeTab === "scale" && <>

          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display:"none" }}
            onChange={e => { if (e.target.files[0]) scanTicket(e.target.files[0]); e.target.value = ""; }} />

          {/* Apply success toast */}
          {scaleApplyMsg && (
            <div style={{ background:"rgba(74,222,128,0.10)", border:"1px solid rgba(74,222,128,0.3)", borderRadius:12, padding:"12px 16px", marginBottom:16, fontSize:13, color:A.green, textAlign:"center", fontWeight:600 }}>
              {sessionType === "fuel" ? "Weights applied — heading to calculator…" : "Scale session logged"}
            </div>
          )}

          {/* ── Existing Session View ── */}
          {scaleSession && scaleStep === 0 && (
            <div>
              <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px", marginBottom:12, boxShadow:t.shadow }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={SL}>Active Scale Session</div>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:0.5, border:`1px solid ${A.green}50`, borderRadius:6, padding:"2px 7px", color:A.green }}>
                    {scaleSession.sessionType === "fuel" ? "WEIGH & FUEL" : "SCALE ONLY"}
                  </span>
                </div>
                <div style={{ fontSize:12, color:t.textMuted, marginBottom:12 }}>Scaled {fmtTs(scaleSession.timestamp)}</div>
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  {[
                    { label:"Steer",   val:scaleSession.steer,   color:A.blue },
                    { label:"Drives",  val:scaleSession.drives,  color:A.yellow },
                    { label:"Trailer", val:scaleSession.trailer, color:A.orange },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ flex:1, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
                      <div style={{ fontSize:9, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:16, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color }}>{fmt(val)}</div>
                      <div style={{ fontSize:9, color:t.textFaint, marginTop:2 }}>lb</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:16, marginBottom:16, fontSize:12, color:t.textSecondary }}>
                  <span>Fuel at scale: <strong style={{ color:t.text }}>{scaleSession.fuelAtScale} gal</strong></span>
                  {scaleSession.odometerAtScale && <span>Odometer: <strong style={{ color:t.text }}>{scaleSession.odometerAtScale.toLocaleString()}</strong></span>}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => switchTab("main")}
                    style={{ flex:1, padding:"12px", borderRadius:12, border:"none", background:A.green, color:isDark?"#0d1a0f":"#fff", fontSize:13, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, cursor:"pointer" }}>
                    Go to Calculator
                  </button>
                  {!scaleClearConfirm ? (
                    <button onClick={() => setScaleClearConfirm(true)}
                      style={{ padding:"12px 16px", borderRadius:12, border:`1px solid ${A.red}40`, background:"transparent", color:A.red, fontSize:13, fontWeight:700, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
                      Clear
                    </button>
                  ) : (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:11, color:A.red }}>Clear session?</span>
                      <button onClick={() => { setScaleSession(null); setScaleClearConfirm(false); }}
                        style={{ fontSize:12, fontWeight:700, color:"#fff", background:A.red, border:"none", borderRadius:8, padding:"6px 12px", cursor:"pointer" }}>Yes</button>
                      <button onClick={() => setScaleClearConfirm(false)}
                        style={{ fontSize:12, color:t.textMuted, background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer" }}>No</button>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => { setScaleSession(null); resetScaleWizard(); }}
                style={{ width:"100%", padding:"14px", borderRadius:12, border:`1px solid ${t.border}`, background:"transparent", color:t.textMuted, fontSize:13, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer" }}>
                Start New Session
              </button>
            </div>
          )}

          {/* ── Wizard Step 0: Session Type ── */}
          {scaleStep === 0 && !scaleSession && (
            <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"20px 16px", boxShadow:t.shadow }}>
              <div style={{ textAlign:"center", marginBottom:20 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:800, color:t.text, letterSpacing:0.3, marginBottom:6 }}>Start Scale Session</div>
                <div style={{ fontSize:13, color:t.textMuted, lineHeight:1.5 }}>What are you doing at the scale?</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button onClick={() => { setSessionType("scale"); setScaleStep(1); }}
                  style={{ width:"100%", padding:"16px", borderRadius:14, border:`1.5px solid ${t.border}`, background:t.inputBg, color:t.text, textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:isDark?"rgba(96,165,250,0.15)":"rgba(29,78,216,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>⚖️</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:t.text, fontFamily:"'DM Sans',sans-serif", marginBottom:2 }}>Scale Only</div>
                    <div style={{ fontSize:12, color:t.textMuted, lineHeight:1.4 }}>Just checking weight — fueling later or not at all</div>
                  </div>
                </button>
                <button onClick={() => { setSessionType("fuel"); setScaleStep(1); }}
                  style={{ width:"100%", padding:"16px", borderRadius:14, border:`1.5px solid ${A.green}50`, background:isDark?"rgba(74,222,128,0.06)":"rgba(22,163,74,0.04)", color:t.text, textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:isDark?"rgba(74,222,128,0.15)":"rgba(22,163,74,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>⛽</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:t.text, fontFamily:"'DM Sans',sans-serif", marginBottom:2 }}>Weigh &amp; Fuel Stop</div>
                    <div style={{ fontSize:12, color:t.textMuted, lineHeight:1.4 }}>Fueling at this stop — log weight &amp; fuel together</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Wizard Step 1: Enter Weights ── */}
          {scaleStep === 1 && (
            <div>
              {/* Progress bar */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                <button onClick={resetScaleWizard}
                  style={{ fontSize:11, color:t.textMuted, background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                  ← Back
                </button>
                <div style={{ flex:1, display:"flex", gap:4 }}>
                  {[1,2,3].map(s => <div key={s} style={{ flex:1, height:3, borderRadius:99, background:s<=scaleStep?A.blue:t.border }} />)}
                </div>
                <span style={{ fontSize:11, color:t.textFaint, fontWeight:600, whiteSpace:"nowrap" }}>1 of 3</span>
              </div>

              <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px", marginBottom:12, boxShadow:t.shadow }}>
                <div style={SL}>Scale Weights</div>
                <div style={{ fontSize:13, color:t.textMuted, marginBottom:16, lineHeight:1.5 }}>Scan your ticket or enter weights manually</div>

                {/* Scan button */}
                {!scanning && !scanResult && (
                  <>
                    <button onClick={() => fileInputRef.current?.click()}
                      style={{ width:"100%", padding:"13px", borderRadius:12, border:`1.5px dashed ${t.borderStrong}`, background:"transparent", color:A.blue, fontSize:14, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, cursor:"pointer", marginBottom:16 }}>
                      Scan Scale Ticket
                    </button>
                    {scanError && (
                      <div style={{ marginBottom:12, background:"rgba(255,68,68,0.08)", border:"1px solid rgba(255,68,68,0.3)", borderRadius:10, padding:"10px 14px", fontSize:12, color:isDark?"#ff6b6b":"#dc2626" }}>
                        {scanError}
                      </div>
                    )}
                  </>
                )}
                {scanning && (
                  <div style={{ textAlign:"center", padding:"8px 0 16px", fontSize:13, color:t.textMuted, animation:"pulseAnim 1.4s ease-in-out infinite" }}>
                    Reading ticket…
                  </div>
                )}

                {/* Scan review */}
                {scanResult && !scanning && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, color:t.textMuted, marginBottom:10 }}>Review — tap a value to correct it</div>
                    {[
                      { label:"Steer",   val:scanReviewSteer,   set:setScanReviewSteer,   conf:scanResult.steer?.confidence },
                      { label:"Drives",  val:scanReviewDrives,  set:setScanReviewDrives,  conf:scanResult.drives?.confidence },
                      { label:"Trailer", val:scanReviewTrailer, set:setScanReviewTrailer, conf:scanResult.trailer?.confidence },
                    ].map(({ label, val, set, conf }) => {
                      const dotColor = conf==="high" ? A.green : conf==="medium" ? A.yellow : A.red;
                      return (
                        <div key={label} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:dotColor, flexShrink:0 }} />
                          <span style={{ fontSize:12, color:t.textSecondary, width:48, flexShrink:0 }}>{label}</span>
                          <input type="number" inputMode="numeric" value={val} placeholder="—" onChange={e=>set(e.target.value)}
                            style={{ flex:1, minWidth:0, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:15, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"7px" }} />
                          <span style={{ fontSize:11, color:t.textFaint, flexShrink:0 }}>lb</span>
                        </div>
                      );
                    })}
                    <div style={{ fontSize:10, color:t.textFaint, marginBottom:10 }}>Green = high confidence · Yellow = uncertain · Red = could not read</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => { setScanResult(null); setScanError(null); }}
                        style={{ flex:1, padding:"10px", borderRadius:8, border:`1px solid ${t.border}`, background:"transparent", color:t.textMuted, fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
                        Discard
                      </button>
                      <button onClick={applyScannedWeights}
                        style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:A.green, color:isDark?"#0d1a0f":"#fff", fontSize:13, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, cursor:"pointer" }}>
                        Use These Weights
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual weight inputs */}
                <div style={{ display:"flex", gap:8, marginBottom:4 }}>
                  {[
                    { label:"Steer",   val:wizardSteer,   set:setWizardSteer },
                    { label:"Drives",  val:wizardDrives,  set:setWizardDrives },
                    { label:"Trailer", val:wizardTrailer, set:setWizardTrailer },
                  ].map(({ label, val, set }) => (
                    <div key={label} style={{ flex:1, minWidth:0 }}>
                      <div style={{ background:val?t.inputBg:"rgba(239,68,68,0.06)", border:`1px solid ${val?t.border:"rgba(239,68,68,0.3)"}`, borderRadius:12, padding:"12px 8px", textAlign:"center" }}>
                        <div style={{ fontSize:10, color:val?t.textSecondary:"#ef4444", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>{label}{!val?" *":""}</div>
                        <input type="number" inputMode="numeric" value={val} placeholder="—" onChange={e=>set(e.target.value)}
                          style={{ width:"100%", background:"transparent", border:"none", borderBottom:`1.5px solid ${val?t.borderStrong:"rgba(239,68,68,0.4)"}`, color:val?t.text:"#888", fontSize:15, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"4px 0" }} />
                        <div style={{ fontSize:10, color:t.textFaint, marginTop:4 }}>lb</div>
                      </div>
                    </div>
                  ))}
                </div>
                {(!wizardSteer || !wizardDrives || !wizardTrailer) && (
                  <div style={{ fontSize:11, color:"#ef4444", opacity:0.75, textAlign:"center", marginTop:8 }}>All three axle weights are required</div>
                )}
              </div>

              <button
                onClick={() => setScaleStep(2)}
                disabled={!wizardSteer || !wizardDrives || !wizardTrailer}
                style={{ width:"100%", padding:"16px", borderRadius:14, border:"none",
                  background:(wizardSteer&&wizardDrives&&wizardTrailer)?A.blue:t.border,
                  color:(wizardSteer&&wizardDrives&&wizardTrailer)?"#fff":t.textFaint,
                  fontSize:15, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5,
                  cursor:(wizardSteer&&wizardDrives&&wizardTrailer)?"pointer":"not-allowed",
                  boxShadow:(wizardSteer&&wizardDrives&&wizardTrailer)?`0 4px 16px ${A.blue}40`:"none",
                  transition:"all 0.2s" }}>
                NEXT: Fuel &amp; Odometer →
              </button>
            </div>
          )}

          {/* ── Wizard Step 2: Fuel & Odometer at Scale ── */}
          {scaleStep === 2 && (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                <button onClick={() => setScaleStep(1)}
                  style={{ fontSize:11, color:t.textMuted, background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                  ← Back
                </button>
                <div style={{ flex:1, display:"flex", gap:4 }}>
                  {[1,2,3].map(s => <div key={s} style={{ flex:1, height:3, borderRadius:99, background:s<=scaleStep?A.blue:t.border }} />)}
                </div>
                <span style={{ fontSize:11, color:t.textFaint, fontWeight:600, whiteSpace:"nowrap" }}>2 of 3</span>
              </div>

              <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px", marginBottom:12, boxShadow:t.shadow }}>
                <div style={SL}>At-Scale Conditions</div>
                <div style={{ fontSize:13, color:t.textMuted, marginBottom:16, lineHeight:1.5 }}>
                  Record your fuel level and odometer <strong style={{ color:t.text }}>right now at the scale</strong>
                </div>

                {/* ── Fuel gauge interface ── */}
                <div style={{ marginBottom:4 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:t.textSub, marginBottom:10 }}>
                    Fuel Level at Scale <span style={{ color:"#ef4444" }}>*</span>
                  </div>
                  {(() => {
                    const fuelVal   = Number(wizardFuelAtScale) || 0;
                    const fraction  = wizardFuelAtScale === "" ? 0 : Math.min(fuelVal / fuelCapNum, 1);
                    const hasValue  = wizardFuelAtScale !== "";
                    const fuelLow   = fraction < 0.13;
                    const fuelMed   = fraction < 0.26;
                    const gaugeColor = fuelLow ? "#ff4444" : fuelMed ? "#facc15" : A.green;
                    const ticks  = [0,1,2,3,4,5,6,7,8];
                    const labels = ["E","⅛","¼","⅜","½","⅝","¾","⅞","F"];
                    const sliderVal = !hasValue ? -1 : Math.round(fraction * 8);
                    return (
                      <div>
                        <FuelGauge fraction={hasValue ? fraction : 0} color={A.green} t={t} isDark={isDark} />
                        {hasValue ? (
                          <div style={{ textAlign:"center", marginTop:4, marginBottom:8 }}>
                            <span style={{ fontSize:18, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color:gaugeColor }}>
                              {fuelVal === 0 ? "EMPTY" : fuelVal >= fuelCapNum ? "FULL" : `${fuelVal} gal`}
                            </span>
                            {fuelVal > 0 && fuelVal < fuelCapNum && (
                              <span style={{ fontSize:12, color:t.textSecondary, marginLeft:8 }}>({Math.round(fraction * 100)}%)</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ textAlign:"center", marginBottom:8 }}>
                            <span style={{ fontSize:13, color:t.textFaint, fontStyle:"italic" }}>tap below to set level</span>
                          </div>
                        )}
                        <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                          {ticks.map(i => (
                            <button key={i} onClick={() => setWizardFuelAtScale(String(Math.round((i/8)*fuelCapNum)))}
                              style={{ flex:1, height:28, borderRadius:8, cursor:"pointer",
                                border: sliderVal===i ? `1.5px solid ${gaugeColor}` : `1px solid ${t.border}`,
                                background: sliderVal===i ? (isDark?`${gaugeColor}30`:`${gaugeColor}20`) : (isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)"),
                                transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <span style={{ fontSize:9, fontWeight:700, color:sliderVal===i?gaugeColor:t.textFaint, fontFamily:"'DM Sans',sans-serif" }}>{labels[i]}</span>
                            </button>
                          ))}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:8, borderTop:`1px solid ${t.divider}` }}>
                          <span style={{ fontSize:11, color:t.textSecondary, whiteSpace:"nowrap" }}>Or enter exact:</span>
                          <input type="number" inputMode="decimal" value={wizardFuelAtScale} placeholder="—"
                            onChange={e => setWizardFuelAtScale(e.target.value)}
                            style={{ flex:1, minWidth:0, background:"transparent", border:"none",
                              borderBottom:`1.5px solid ${wizardFuelAtScale===""?"rgba(239,68,68,0.4)":t.borderStrong}`,
                              color:wizardFuelAtScale===""?"#888":t.text, fontSize:20, fontWeight:700,
                              fontFamily:"'Barlow Condensed',sans-serif", outline:"none", padding:"4px 0", textAlign:"right" }} />
                          <span style={{ fontSize:12, color:t.textFaint, fontWeight:600 }}>gal</span>
                        </div>
                      </div>
                    );
                  })()}
                  {!wizardFuelAtScale && <div style={{ fontSize:11, color:"#ef4444", opacity:0.75, marginTop:6 }}>Required to enable fuel burn estimation</div>}
                </div>

                <div style={{ height:1, background:t.divider, margin:"16px 0" }} />

                {/* ── Odometer ── */}
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:t.textSub, marginBottom:4 }}>Odometer at Scale</div>
                  <div style={{ fontSize:11, color:t.textFaint, marginBottom:10 }}>Optional — enables automatic weight estimation as you drive</div>
                  <div style={{ position:"relative" }}>
                    <input type="number" inputMode="numeric" value={wizardOdoAtScale} placeholder="—"
                      onChange={e => setWizardOdoAtScale(e.target.value)}
                      style={{ width:"100%", boxSizing:"border-box", background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:10, color:t.text, fontSize:22, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"12px 44px 12px 12px" }} />
                    <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:13, color:t.textFaint, fontWeight:600, pointerEvents:"none" }}>mi</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (sessionType === "fuel" && !fuelAtPump) setFuelAtPump(wizardFuelAtScale);
                  setScaleStep(3);
                }}
                disabled={!wizardFuelAtScale}
                style={{ width:"100%", padding:"16px", borderRadius:14, border:"none",
                  background:wizardFuelAtScale?A.blue:t.border,
                  color:wizardFuelAtScale?"#fff":t.textFaint,
                  fontSize:15, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5,
                  cursor:wizardFuelAtScale?"pointer":"not-allowed",
                  boxShadow:wizardFuelAtScale?`0 4px 16px ${A.blue}40`:"none",
                  transition:"all 0.2s" }}>
                {sessionType === "fuel" ? "NEXT: Fuel at Pump →" : "NEXT: Review & Save →"}
              </button>
            </div>
          )}

          {/* ── Wizard Step 3: Confirm / Fuel at Pump ── */}
          {scaleStep === 3 && (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                <button onClick={() => setScaleStep(2)}
                  style={{ fontSize:11, color:t.textMuted, background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                  ← Back
                </button>
                <div style={{ flex:1, display:"flex", gap:4 }}>
                  {[1,2,3].map(s => <div key={s} style={{ flex:1, height:3, borderRadius:99, background:s<=scaleStep?A.blue:t.border }} />)}
                </div>
                <span style={{ fontSize:11, color:t.textFaint, fontWeight:600, whiteSpace:"nowrap" }}>3 of 3</span>
              </div>

              {/* Scale Only — review & save */}
              {sessionType === "scale" && (
                <div>
                  <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px", marginBottom:12, boxShadow:t.shadow }}>
                    <div style={SL}>Confirm Scale Session</div>
                    <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                      {[
                        { label:"Steer",   val:wizardSteer,   color:A.blue },
                        { label:"Drives",  val:wizardDrives,  color:A.yellow },
                        { label:"Trailer", val:wizardTrailer, color:A.orange },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ flex:1, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
                          <div style={{ fontSize:9, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
                          <div style={{ fontSize:16, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color }}>{fmt(Number(val)||0)}</div>
                          <div style={{ fontSize:9, color:t.textFaint, marginTop:2 }}>lb</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:16, fontSize:12, color:t.textSecondary }}>
                      <span>Fuel: <strong style={{ color:t.text }}>{wizardFuelAtScale} gal</strong></span>
                      {wizardOdoAtScale && <span>Odometer: <strong style={{ color:t.text }}>{Number(wizardOdoAtScale).toLocaleString()}</strong></span>}
                    </div>
                  </div>
                  <button onClick={completeScaleSession}
                    style={{ width:"100%", padding:"16px", borderRadius:14, border:"none", background:A.green, color:isDark?"#0d1a0f":"#fff", fontSize:15, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, cursor:"pointer", boxShadow:`0 4px 16px ${A.green}40`, transition:"all 0.2s" }}>
                    SAVE SESSION &amp; APPLY WEIGHTS
                  </button>
                </div>
              )}

              {/* Weigh & Fuel — enter pump fuel */}
              {sessionType === "fuel" && (
                <div>
                  <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px", marginBottom:12, boxShadow:t.shadow }}>
                    <div style={SL}>Current Fuel at the Pump</div>
                    <div style={{ fontSize:13, color:t.textMuted, marginBottom:6, lineHeight:1.5 }}>
                      You're at the pump. Confirm your fuel level — this is used to calculate how much you can safely add.
                    </div>
                    <div style={{ fontSize:11, color:t.textFaint, marginBottom:16 }}>
                      Scale fuel reference: <strong style={{ color:t.text }}>{wizardFuelAtScale} gal</strong>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                      <input type="number" inputMode="decimal" value={fuelAtPump} placeholder="—"
                        onChange={e => setFuelAtPump(e.target.value)}
                        style={{ flex:1, background:fuelAtPump?t.inputBg:"rgba(239,68,68,0.06)", border:`1px solid ${fuelAtPump?t.border:"rgba(239,68,68,0.3)"}`, borderRadius:10, color:t.text, fontSize:24, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"14px" }} />
                      <span style={{ fontSize:14, color:t.textFaint, fontWeight:600 }}>gal</span>
                    </div>
                    {!fuelAtPump && <div style={{ fontSize:11, color:"#ef4444", opacity:0.75 }}>Enter current fuel level to continue</div>}
                  </div>

                  {/* Weight summary */}
                  <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:14, padding:"12px 14px", marginBottom:12 }}>
                    <div style={{ fontSize:11, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Weights Being Applied</div>
                    <div style={{ display:"flex", gap:8 }}>
                      {[
                        { label:"Steer",   val:wizardSteer,   color:A.blue },
                        { label:"Drives",  val:wizardDrives,  color:A.yellow },
                        { label:"Trailer", val:wizardTrailer, color:A.orange },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ flex:1, textAlign:"center" }}>
                          <div style={{ fontSize:9, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
                          <div style={{ fontSize:14, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color }}>{fmt(Number(val)||0)}</div>
                          <div style={{ fontSize:9, color:t.textFaint }}>lb</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={completeScaleSession}
                    disabled={!fuelAtPump}
                    style={{ width:"100%", padding:"16px", borderRadius:14, border:"none",
                      background:fuelAtPump?A.green:t.border,
                      color:fuelAtPump?(isDark?"#0d1a0f":"#fff"):t.textFaint,
                      fontSize:15, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5,
                      cursor:fuelAtPump?"pointer":"not-allowed",
                      boxShadow:fuelAtPump?`0 4px 16px ${A.green}40`:"none",
                      transition:"all 0.2s" }}>
                    APPLY &amp; CALCULATE →
                  </button>
                </div>
              )}
            </div>
          )}

        </> /* end scale tab */}

        {/* ── Tab: Truck ── */}
        {activeTab === "truck" && <>

          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={SL}>Truck Profile</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {profiles.length > 0 && (
                  <div style={{ position:"relative" }}>
                    <button onClick={()=>setShowProfileMenu(m=>!m)} style={{ fontSize:11, fontWeight:600, color:A.blue, background:"transparent", border:`1px solid ${A.blue}40`, borderRadius:8, padding:"4px 8px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                      {activeProfile?(profiles.find(p=>p.id===activeProfile)?.name||"Profiles"):"Profiles"}
                    </button>
                    {showProfileMenu && (
                      <>
                        <div onClick={()=>setShowProfileMenu(false)} style={{ position:"fixed", inset:0, zIndex:149 }} />
                        <div style={{ position:"absolute", top:36, right:0, zIndex:150, background: isDark?"#1a1f2e":"#fff", border:`1px solid ${t.border}`, borderRadius:16, padding:"8px", minWidth:200, boxShadow: t.shadow }}>
                          <div style={{ fontSize:10, color:t.textFaint, textTransform:"uppercase", letterSpacing:1.5, padding:"4px 8px 8px" }}>Saved Profiles</div>
                          {profiles.map(p => (
                            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px" }}>
                              <button onClick={()=>loadProfile(p)} style={{ flex:1, padding:"8px", borderRadius:8, border:"none", textAlign:"left", background: activeProfile===p.id?(isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)"):"transparent", color: activeProfile===p.id?t.text:t.textMuted, fontSize:13, fontWeight: activeProfile===p.id?700:400, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>{p.name}</button>
                              <button onClick={()=>deleteProfile(p.id)} style={{ width:24, height:24, borderRadius:4, border:"none", background:"transparent", color:t.textFaint, cursor:"pointer", fontSize:14 }}>&#x2715;</button>
                            </div>
                          ))}
                          <div style={{ height:1, background:t.divider, margin:"8px 0" }} />
                          <button onClick={()=>{ setShowProfileMenu(false); setIsOnboardingProfile(false); setShowSavePrompt(true); }} style={{ width:"100%", padding:"8px", borderRadius:8, border:"none", background:"transparent", color:A.green, fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", textAlign:"left" }}>+ Save current as profile</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button onClick={()=>{ setIsOnboardingProfile(false); setShowSavePrompt(true); }} style={{ fontSize:11, fontWeight:600, color:A.green, background:"transparent", border:`1px solid ${A.green}40`, borderRadius:8, padding:"4px 8px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>+ Save</button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom:24 }}>
            <div style={SL}>Trailer Type</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {trailerTypes.map(type => (
                <button key={type} onClick={()=>setTrailerType(type)}
                  style={{ padding:"8px 14px", borderRadius:99, fontSize:12, fontWeight:700, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", transition:"all 0.15s",
                    border: trailerType===type ? `1.5px solid ${A.blue}` : `1px solid ${t.border}`,
                    background: trailerType===type ? (isDark?`${A.blue}20`:`${A.blue}15`) : "transparent",
                    color: trailerType===type ? A.blue : t.textMuted }}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:24 }}>
            <div style={SL}>Axle &amp; Tank Settings</div>
            <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, overflow:"hidden", boxShadow:t.shadow }}>
              <div style={{ padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }} onClick={()=>setSpreadAxle(!spreadAxle)}>
                <div>
                  <div style={{ fontSize:13, color:t.textSub, fontWeight:600 }}>Trailer Axle Type</div>
                  <div style={{ fontSize:11, color:t.textSecondary, marginTop:2 }}>
                    Limit: <span style={{ color:spreadAxle?A.orange:A.yellow, fontWeight:700 }}>{spreadAxle?"40,000 lb — spread":"34,000 lb — tandem"}</span>
                  </div>
                  {spreadAxle && <div style={{ fontSize:10, color:t.textFaint, marginTop:4 }}>Tandem Slider tab is hidden for spread axle</div>}
                </div>
                <Toggle on={spreadAxle} leftLabel="TANDEM" rightLabel="SPREAD" onColor={A.orange} t={t} />
              </div>
              <Divider t={t} />
              <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:16 }}>
                <SettingRow label="Tank Capacity" sub="gallons" value={fuelCapacity} onChange={setFuelCapacity} placeholder="150" t={t} />
                <SettingRow label="Avg Fuel Economy" sub="miles per gallon" value={mpg} onChange={setMpg} placeholder="7.5" t={t} />
                <SettingRow label="Steer Min Warning" sub="lb — alert if steer drops below this" value={steerMin} onChange={setSteerMin} placeholder="10000" t={t} />
              </div>
            </div>
          </div>

          {!spreadAxle && (
            <div style={{ marginBottom:24 }}>
              <div style={SL}>Tandem Hole Spacing</div>
              <div style={{ display:"flex", gap:8 }}>
                {[2,4,6].map(s=>(
                  <button key={s} onClick={()=>setHoleSpacing(s)} style={{ flex:1, padding:"12px 4px", borderRadius:12, border:holeSpacing===s?`1.5px solid ${A.orange}`:"1.5px solid rgba(128,128,128,0.15)", background:holeSpacing===s?(isDark?"rgba(251,146,60,0.12)":"rgba(154,52,18,0.08)"):"transparent", color:holeSpacing===s?A.orange:t.textMuted, fontSize:13, fontWeight:700, cursor:"pointer", transition:"all 0.18s", fontFamily:"'DM Sans',sans-serif" }}>
                    {s}" holes
                    <div style={{ fontSize:10, fontWeight:400, marginTop:4, opacity:0.7 }}>~{C.LBS_PER_HOLE[s]} lb/hole</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px", marginBottom:16 }}>
            <div style={{ fontSize:11, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Current Settings</div>
            {[
              ["Trailer Type", trailerType],
              ["Axle Config",  spreadAxle ? "Spread (40,000 lb)" : "Tandem (34,000 lb)"],
              ["Tank Capacity", `${fuelCapNum} gal`],
              ["Fuel Economy",  `${mpgNum} mpg`],
              ["Steer Min",     `${fmt(Number(steerMin) || 10000)} lb`],
              ...(!spreadAxle ? [["Hole Spacing", `${holeSpacing}" (~${C.LBS_PER_HOLE[holeSpacing]} lb/hole)`]] : []),
            ].map(([label, val]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:13 }}>
                <span style={{ color:t.textSecondary }}>{label}</span>
                <span style={{ color:t.text, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>{val}</span>
              </div>
            ))}
          </div>

        </> /* end truck tab */}

        {/* ── Tab: Slider ── */}
        {activeTab === "slider" && <>

          {weightsOK && !spreadAxle && slideHoles === 0 && (
            <div style={{ marginBottom:16, background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:16, padding:"20px 24px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color:A.green, marginBottom:4 }}>No adjustment needed</div>
              <div style={{ fontSize:13, color:t.textSecondary }}>{slideReason || "Both axles within legal limits"}</div>
            </div>
          )}

          <div style={{ marginBottom:24 }}>
            <div style={SL}>Tandem Slider</div>
            <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, overflow:"hidden", boxShadow:t.shadow }}>

              <div style={{ padding:"16px" }}>
                <div style={{ fontSize:12, color:t.textSub, fontWeight:600, marginBottom:8 }}>Goal</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { val:"legal",   label:"Get Legal",     color:A.green },
                    { val:"balance", label:"Balance",       color:A.blue },
                    { val:"both",    label:"Minimize Over", color:"#a78bfa" },
                  ].map(({val,label,color})=>(
                    <button key={val} onClick={()=>setSlideGoal(val)} style={{ flex:1, padding:"8px 4px", borderRadius:8, border:slideGoal===val?`1.5px solid ${color}`:"1.5px solid rgba(128,128,128,0.15)", background:slideGoal===val?`${color}1a`:"transparent", color:slideGoal===val?color:t.textMuted, fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.18s", fontFamily:"'DM Sans',sans-serif" }}>{label}</button>
                  ))}
                </div>
              </div>

              <Divider t={t} />

              <div style={{ padding:"16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:13, color:t.textSub, fontWeight:600 }}>Current Hole Position</div>
                    <div style={{ fontSize:11, color:t.textSecondary }}>Tap a hole or type the number</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:t.textFaint, marginBottom:4 }}>Total holes</div>
                    <input type="number" inputMode="numeric" value={totalHoles} min="1" max="30" onChange={e=>setTotalHoles(Math.max(1,Math.min(30,Number(e.target.value)||10)))} style={{ width:56, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:14, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"4px 8px" }} />
                  </div>
                </div>

                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
                  {Array.from({ length: totalHoles }, (_, i) => i + 1).map(hole => {
                    const isSelected = Number(currentHole) === hole;
                    const isTarget   = currentHole !== "" && hole === (currentHoleN + slideHoles);
                    const isPast     = Number(currentHole) > 0 && hole < Number(currentHole);
                    return (
                      <button key={hole} onClick={()=>setCurrentHole(String(hole))} style={{ width:36, height:36, borderRadius:8, border:isSelected?`2px solid ${A.orange}`:isTarget?`2px dashed ${slideDir==="forward"?A.orange:A.blue}`:`1px solid ${t.border}`, background:isSelected?(isDark?"rgba(251,146,60,0.2)":"rgba(217,119,6,0.12)"):isTarget?(isDark?"rgba(96,165,250,0.08)":"rgba(29,78,216,0.06)"):isPast?(isDark?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.03)"):t.surface, color:isSelected?A.orange:isTarget?(slideDir==="forward"?A.orange:A.blue):isPast?t.textFaint:t.textSub, fontSize:12, fontWeight:isSelected||isTarget?700:400, fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", transition:"all 0.15s", opacity:isPast?0.5:1 }}>
                        {hole}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display:"flex", gap:16, marginBottom:8, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:10, height:10, borderRadius:4, background:isDark?"rgba(251,146,60,0.2)":"rgba(217,119,6,0.12)", border:`2px solid ${A.orange}` }} />
                    <span style={{ fontSize:10, color:t.textFaint }}>Current</span>
                  </div>
                  {currentHole!==""&&slideHoles!==0&&(
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ width:10, height:10, borderRadius:4, border:`2px dashed ${slideDir==="forward"?A.orange:A.blue}` }} />
                      <span style={{ fontSize:10, color:t.textFaint }}>Target</span>
                    </div>
                  )}
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:8, borderTop:`1px solid ${t.divider}` }}>
                  <span style={{ fontSize:11, color:t.textMuted }}>Or type hole #:</span>
                  <input type="number" inputMode="numeric" value={currentHole} placeholder="—" onChange={e=>setCurrentHole(e.target.value)} style={{ width:70, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:16, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"4px 8px" }} />
                  {currentHole!==""&&<button onClick={()=>setCurrentHole("")} style={{ fontSize:11, color:t.textFaint, background:"transparent", border:"none", cursor:"pointer", padding:"4px 8px", borderRadius:4 }}>Clear</button>}
                </div>
              </div>

              <Divider t={t} />

              <div ref={sliderResultRef} style={{ padding:"16px" }}>
                {!weightsOK ? (
                  <div style={{ fontSize:12, color:t.textFaint, textAlign:"center", padding:"8px 0" }}>Enter axle weights on the Weights &amp; Fuel tab to calculate slide recommendation</div>
                ) : slideHoles === 0 ? (
                  <div style={{ background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:12, padding:"12px 16px" }}>
                    <div style={{ fontSize:14, fontWeight:700, color:A.green, marginBottom:4 }}>No slide needed</div>
                    <div style={{ fontSize:12, color:t.textSecondary }}>{slideReason}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ background:slideDir==="forward"?(isDark?"rgba(251,146,60,0.1)":"rgba(154,52,18,0.06)"):(isDark?"rgba(96,165,250,0.1)":"rgba(29,78,216,0.06)"), border:`1px solid ${slideDir==="forward"?(isDark?"rgba(251,146,60,0.3)":"rgba(154,52,18,0.25)"):(isDark?"rgba(96,165,250,0.3)":"rgba(29,78,216,0.25)")}`, borderRadius:12, padding:"16px", marginBottom:12 }}>
                      <div style={{ fontSize:11, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Recommendation</div>
                      <div style={{ fontSize:26, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color:slideDir==="forward"?A.orange:A.blue }}>
                        {absHoles} hole{absHoles!==1?"s":""} {slideDir}
                      </div>
                      <div style={{ fontSize:12, color:t.textSecondary, marginTop:4 }}>{slideReason}</div>
                      {currentHole!==""&&<div style={{ marginTop:8, fontSize:13, color:t.textSub }}>Move from hole <strong>{currentHoleN}</strong> → hole <strong style={{ color:slideDir==="forward"?A.orange:A.blue }}>{newHole}</strong></div>}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      {[
                        { label:"Drives — Before",  val:drivesNum,          limit:C.DRIVE_LIMIT,          color:A.yellow },
                        { label:"Drives — After",   val:slideResultDrives,  limit:C.DRIVE_LIMIT,          color:A.yellow },
                        { label:"Trailer — Before", val:trailerNum,         limit:C.TRAILER_TANDEM_LIMIT, color:A.orange },
                        { label:"Trailer — After",  val:slideResultTrailer, limit:C.TRAILER_TANDEM_LIMIT, color:A.orange },
                      ].map(({label,val,limit,color})=>{
                        const over = val > limit;
                        return (
                          <div key={label} style={{ background:over?(isDark?"rgba(255,68,68,0.07)":"rgba(220,38,38,0.06)"):(isDark?"rgba(74,222,128,0.05)":"rgba(22,163,74,0.06)"), border:`1px solid ${over?(isDark?"rgba(255,68,68,0.25)":"rgba(220,38,38,0.2)"):(isDark?"rgba(74,222,128,0.15)":"rgba(22,163,74,0.15)")}`, borderRadius:12, padding:"12px" }}>
                            <div style={{ fontSize:10, color:t.textSecondary, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>{label}</div>
                            <div style={{ fontSize:17, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color:over?A.redText:t.text }}>{fmt(val)} lb</div>
                            <div style={{ fontSize:10, color:over?A.redText:A.green, fontWeight:700 }}>{over?`+${fmt(val-limit)} over`:`-${fmt(limit-val)} left`}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop:8, fontSize:11, color:t.textFaint, textAlign:"center" }}>
                      ~{fmt(absHoles * lbsPerHole)} lb shifted · {holeSpacing}" spacing · {lbsPerHole} lb/hole
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </> /* end slider tab */}

      </div>

      {/* Save Profile Modal */}
      {showSavePrompt && (
        <>
          <div onClick={()=>{ setShowSavePrompt(false); setIsOnboardingProfile(false); }} style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)" }} />
          <div style={{ position:"fixed", inset:0, zIndex:1001, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
            <div style={{ background: isDark?"#1a1f2e":"#fff", border:`1px solid ${t.border}`, borderRadius:20, padding:"24px", maxWidth:360, width:"100%", boxShadow: t.shadow }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:800, color:t.text, marginBottom:8 }}>
                {isOnboardingProfile ? "Set up your first truck profile" : "Save Truck Profile"}
              </div>
              <div style={{ fontSize:12, color:t.textMuted, marginBottom:24 }}>
                Saves trailer type, tank capacity, fuel economy, axle config, hole spacing, and steer minimum.
              </div>
              <div style={{ fontSize:11, color:t.textSecondary, marginBottom:8 }}>Profile name</div>
              <input type="text" value={newProfileName}
                placeholder={isOnboardingProfile ? "My Truck" : "e.g. Pete 389 — 53ft Spread"}
                onChange={e=>setNewProfileName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&saveProfile()}
                style={{ width:"100%", background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:15, fontWeight:600, fontFamily:"'DM Sans',sans-serif", outline:"none", padding:"12px 16px", boxSizing:"border-box" }}
                autoFocus
              />
              <div style={{ display:"flex", gap:8, marginTop:16 }}>
                <button onClick={()=>{ setShowSavePrompt(false); setIsOnboardingProfile(false); }} style={{ flex:1, padding:"12px", borderRadius:8, border:`1px solid ${t.border}`, background:"transparent", color:t.textMuted, fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
                  {isOnboardingProfile ? "Skip" : "Cancel"}
                </button>
                <button onClick={saveProfile} disabled={!newProfileName.trim()} style={{ flex:2, padding:"12px", borderRadius:12, border:"none", background:newProfileName.trim()?A.green:t.border, color:newProfileName.trim()?(isDark?"#0d1a0f":"#fff"):t.textFaint, fontSize:13, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, cursor:newProfileName.trim()?"pointer":"not-allowed", transition:"all 0.2s" }}>SAVE PROFILE</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom Tab Bar */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50, background:isDark?"rgba(10,15,30,0.95)":"rgba(255,255,255,0.95)", backdropFilter:"blur(12px)", borderTop:`1px solid ${t.border}`, display:"flex", paddingBottom:"env(safe-area-inset-bottom)" }}>
        {tabs.map(({ id, label, badge }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={()=>switchTab(id)} style={{ flex:1, padding:"12px 8px", border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.15s" }}>
              <div style={{ width:32, height:3, borderRadius:4, marginBottom:4, background:active?A.green:"transparent", transition:"background 0.2s" }} />
              <div style={{ position:"relative", display:"inline-block" }}>
                <span style={{ fontSize:11, fontWeight:active?700:400, fontFamily:"'DM Sans',sans-serif", color:active?A.green:t.textMuted, letterSpacing:0.3, transition:"color 0.2s" }}>{label}</span>
                {badge && (
                  <div style={{ position:"absolute", top:-2, right:-8, width:6, height:6, borderRadius:"50%", background:A.orange }} />
                )}
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

/*
 ── Bug Fixes & Cleanup ───────────────────────────────────────────────────────
 Fix 1 — Netlify Function URL: APPLIED
   fetch("/api/scan-ticket") → fetch("/.netlify/functions/scan-ticket")

 Fix 2 — Emoji removal: APPLIED (4 locations)
   - Scaling notice: 💡 removed, flex layout simplified to single span
   - Apply success message: ✓ replaced with "Done"
   - Scan button: 📷 removed, text reads "Take Photo or Upload"
   - Scale session row: ⛽ / 🛣 replaced with "Fuel at scale:" / "Odometer:"
   - ⚠️ on driver responsibility strip: intentionally kept

 Fix 3 — oc variable: SKIPPED (already correct)
   orientationCards array + oc = orientationCards[orientationStep - 1]
   is structurally equivalent and working — no change made.

 Fix 4 — trailerTypes array: SKIPPED (already correct)
   Declared inside the component as a const — present and working.

 Fix 5 — Slider before/after card colors: APPLIED
   All four hardcoded rgba values replaced with isDark ternaries
   scoped to the slider result grid only.

 Fix 6 — Footer removed: APPLIED
   Diesel / Tank / Economy / Axles summary row removed entirely.
────────────────────────────────────────────────────────────────────────────── */
