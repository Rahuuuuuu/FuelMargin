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
  FUEL_BUFFER_LB: 50, // safety buffer
  // lbs shifted per hole for each spacing option (tandem slide estimates)
  // sliding FORWARD moves weight from trailer to drives
  LBS_PER_HOLE: { 2: 125, 4: 250, 6: 375 },
};

const ls = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const fmt = (n) => Math.round(n).toLocaleString("en-US");
const pct = (v, lim) => Math.min((v / lim) * 100, 100);

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
function GaugeBar({ value, limit, color, t, a, trafficLight }) {
  const over = value > limit;
  const headroom = limit - value;
  let barColor = color;
  if (trafficLight) {
    if (over || headroom <= 100) barColor = a.red;
    else if (headroom <= 500)    barColor = a.yellow;
    else                         barColor = a.green;
  } else if (over) {
    barColor = a.red;
  }
  return (
    <div style={{ width:"100%", background: t.gaugeBg, borderRadius:4, height:8, overflow:"hidden", marginTop:6 }}>
      <div style={{ width:`${pct(value,limit)}%`, height:"100%", background: barColor, borderRadius:4, transition:"width 0.4s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

function AxleCard({ label, current, limit, color, icon, t, a, trafficLight, minVal }) {
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
  return (
    <div style={{ background: t.surface, border:`1px solid ${over||tooLight?a.red:t.border}`, borderRadius:16, padding:"12px 14px", flex:1, minWidth:0, boxShadow: t.shadow }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
        <span style={{ fontSize:10, color:t.textSecondary, letterSpacing:1, textTransform:"uppercase" }}>{label}</span>
        <span style={{ fontSize:10, color: badgeColor, fontWeight:700 }}>
          {tooLight ? `${fmt(minVal-current)} low` : over ? `+${fmt(Math.abs(remaining))} over` : `-${fmt(remaining)} left`}
        </span>
      </div>
      <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color: over||tooLight?a.redText:t.text }}>
        {fmt(current)} <span style={{ fontSize:12, fontWeight:400, color:t.textFaint }}>lb</span>
      </div>
      <div style={{ fontSize:10, color:t.textFaint, marginBottom:2 }}>
        {tooLight ? <span style={{ color:a.red }}>Min {fmt(minVal)} lb</span> : `Limit ${fmt(limit)} lb`}
      </div>
      <GaugeBar value={current} limit={limit} color={color} t={t} a={a} trafficLight={trafficLight} />
      {tooLight && <div style={{ fontSize:9, color:a.red, marginTop:4, fontWeight:700 }}>TOO LIGHT — STEERING RISK</div>}
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
        style={{ width:80, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:16, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"6px 8px" }}
      />
    </div>
  );
}

function Divider({ t }) {
  return <div style={{ height:1, background:t.divider }} />;
}

function ModeButton({ active, label, color, onClick }) {
  return (
    <button onClick={onClick} style={{ flex:1, padding:"9px 4px", borderRadius:8,
      border: active?`1.5px solid ${color}`:"1.5px solid rgba(128,128,128,0.15)",
      background: active?`${color}1a`:"transparent",
      color: active?color:"#888", fontSize:11, fontWeight:700,
      fontFamily:"'DM Sans',sans-serif", letterSpacing:0.3, cursor:"pointer", transition:"all 0.18s" }}>
      {label}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  // Theme
  const [themeMode, setThemeMode] = useState(() => ls.get("qf_theme","system"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => ls.get("qf_activeTab", "main"));
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => ls.get("qf_disclaimer_accepted", false));
  const [disclaimerChecked, setDisclaimerChecked] = useState(false); // always unchecked on load

  const acceptDisclaimer = () => {
    if (!disclaimerChecked) return;
    setDisclaimerAccepted(true);
    ls.set("qf_disclaimer_accepted", true);
  };
  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = themeMode === "system" ? systemDark : themeMode === "dark";
  const t = isDark ? themes.dark : themes.light;
  const saveTheme = (v) => { setThemeMode(v); ls.set("qf_theme",v); };
  const switchTab = (tab) => { setActiveTab(tab); ls.set("qf_activeTab", tab); };

  // Accent colors — darker in light mode for contrast
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

  // Session fields (never persisted)
  const [steer, setSteer]       = useState("");
  const [drives, setDrives]     = useState("");
  const [trailer, setTrailer]   = useState("");
  const [gallonsNow, setGallonsNow] = useState("");

  // Persisted settings
  const [spreadAxle, _setSpreadAxle]       = useState(() => ls.get("qf_spreadAxle", false));
  const [fuelCapacity, _setFuelCapacity]   = useState(() => ls.get("qf_fuelCapacity","150"));
  const [mpg, _setMpg]                     = useState(() => ls.get("qf_mpg","7.5"));
  const [fuelMode, _setFuelMode]           = useState(() => ls.get("qf_fuelMode","manual"));
  const [holeSpacing, _setHoleSpacing]     = useState(() => ls.get("qf_holeSpacing", 4));
  const [slideGoal, _setSlideGoal]         = useState(() => ls.get("qf_slideGoal","legal"));
  const [currentHole, _setCurrentHole]     = useState(() => ls.get("qf_currentHole",""));
  const [totalHoles, _setTotalHoles]       = useState(() => ls.get("qf_totalHoles", 10));
  const [gallonsToAdd, setGallonsToAdd]    = useState("");

  const setSpreadAxle   = (val) => { _setSpreadAxle(val); ls.set("qf_spreadAxle", val); };
  const setFuelCapacity = (val) => { _setFuelCapacity(val); ls.set("qf_fuelCapacity", val); };
  const setMpg          = (val) => { _setMpg(val); ls.set("qf_mpg", val); };
  const setFuelMode     = (val) => { _setFuelMode(val); ls.set("qf_fuelMode", val); };
  const setHoleSpacing  = (val) => { _setHoleSpacing(val); ls.set("qf_holeSpacing", val); };
  const setSlideGoal    = (val) => { _setSlideGoal(val); ls.set("qf_slideGoal", val); };
  const setCurrentHole  = (val) => { _setCurrentHole(val); ls.set("qf_currentHole", val); };
  const setTotalHoles   = (val) => { _setTotalHoles(val);  ls.set("qf_totalHoles",  val); };

  // Quick reset
  const [resetConfirm, setResetConfirm] = useState(false);
  const doReset = () => {
    setSteer(""); setDrives(""); setTrailer(""); setGallonsNow(""); setGallonsToAdd("");
    setResetConfirm(false);
  };

  // Truck profiles
  const [profiles, setProfiles]               = useState(() => ls.get("qf_profiles", []));
  const [activeProfile, _setActiveProfile]    = useState(() => ls.get("qf_activeProfile", null));
  const [showSavePrompt, setShowSavePrompt]   = useState(false);
  const [newProfileName, setNewProfileName]   = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);


  const setActiveProfile = (v) => { _setActiveProfile(v); ls.set("qf_activeProfile", v); };

  const saveProfile = () => {
    const name = newProfileName.trim();
    if (!name) return;
    const profile = { id: Date.now(), name, fuelCapacity, mpg, spreadAxle, holeSpacing };
    const updated = [...profiles, profile];
    setProfiles(updated); ls.set("qf_profiles", updated);
    setActiveProfile(profile.id);
    setShowSavePrompt(false); setNewProfileName("");
  };

  const loadProfile = (profile) => {
    setFuelCapacity(profile.fuelCapacity);
    setMpg(profile.mpg);
    setSpreadAxle(profile.spreadAxle);
    setHoleSpacing(profile.holeSpacing);
    setActiveProfile(profile.id);
    setShowProfileMenu(false);
  };

  const deleteProfile = (id) => {
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated); ls.set("qf_profiles", updated);
    if (activeProfile === id) setActiveProfile(null);
  };



  // Steer minimum warning threshold (value defined after derived numbers below)
  const STEER_MIN = 10000;

  // Flash / haptic state
  const [flash, setFlash] = useState(null); // "safe" | "danger" | null
  const prevSafe = useRef(null);

  // Derived numbers
  const fuelCapNum  = Number(fuelCapacity) || 150;
  const mpgNum      = Number(mpg) || 7.5;
  const trailerLim  = spreadAxle ? C.TRAILER_SPREAD_LIMIT : C.TRAILER_TANDEM_LIMIT;
  const steerNum    = Number(steer)   || 0;
  const drivesNum   = Number(drives)  || 0;
  const trailerNum  = Number(trailer) || 0;
  const galNowNum   = Number(gallonsNow) || 0;
  const weightsOK   = steer !== "" && drives !== "" && trailer !== "";
  const fuelOK      = gallonsNow !== "";
  const steerTooLight = weightsOK && steerNum < STEER_MIN && steerNum > 0;

  // 50 lb buffer applied to each limit for max-safe calc
  const maxBySteer   = (C.STEER_LIMIT  - C.FUEL_BUFFER_LB - steerNum)  / (C.DIESEL_LB_PER_GAL * C.STEER_PCT);
  const maxByDrives  = (C.DRIVE_LIMIT  - C.FUEL_BUFFER_LB - drivesNum) / (C.DIESEL_LB_PER_GAL * C.DRIVE_PCT);
  const maxByGross   = (C.GROSS_LIMIT  - C.FUEL_BUFFER_LB - steerNum - drivesNum - trailerNum) / C.DIESEL_LB_PER_GAL;
  const maxSafeGal   = Math.max(0, Math.floor(Math.min(maxBySteer, maxByDrives, maxByGross, fuelCapNum - galNowNum)));
  // Max legal fill warning — based on current weights before any fueling
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

  // Flash + haptic on safe/unsafe change
  useEffect(() => {
    if (!weightsOK || !fuelOK) { prevSafe.current = null; return; }
    if (prevSafe.current === null) { prevSafe.current = safe; return; }
    if (prevSafe.current !== safe) {
      const type = safe ? "safe" : "danger";
      setFlash(type);
      if (navigator.vibrate) navigator.vibrate(safe ? [40,30,40] : [80,40,80,40,80]);
      setTimeout(() => setFlash(null), 700);
      prevSafe.current = safe;
    }
  }, [safe, weightsOK, fuelOK]);

  // ── Tandem Slider Calculator ──────────────────────────────
  const lbsPerHole    = C.LBS_PER_HOLE[holeSpacing] || 250;
  const currentHoleN  = Number(currentHole) || 0;

  // How many holes to slide to fix trailer/drives imbalance
  // Sliding FORWARD (+holes): weight moves from trailer → drives
  // Sliding BACK   (-holes): weight moves from drives  → trailer
  let slideHoles = 0;
  let slideReason = "";
  let slideResultDrives = drivesNum;
  let slideResultTrailer = trailerNum;

  if (weightsOK && !spreadAxle) {
    const driveOver   = drivesNum  > C.DRIVE_LIMIT;
    const trailerOver = trailerNum > C.TRAILER_TANDEM_LIMIT;

    if (slideGoal === "balance") {
      // Target: drives + trailer split evenly
      const totalDT = drivesNum + trailerNum;
      const targetEach = totalDT / 2;
      const diff = drivesNum - targetEach; // positive = drives heavy
      slideHoles = -Math.round(diff / lbsPerHole); // slide back to move weight to trailer
      slideReason = "Balance drives & trailer evenly";
    } else if (slideGoal === "legal") {
      // Move just enough to get both within legal limits
      if (trailerOver && !driveOver) {
        // trailer too heavy → slide back (moves weight to drives)... wait, we need to reduce trailer
        // sliding BACK moves weight FROM drives TO trailer — makes trailer heavier
        // sliding FORWARD moves weight FROM trailer TO drives
        // So to reduce trailer: slide forward
        const excess = trailerNum - C.TRAILER_TANDEM_LIMIT;
        slideHoles = Math.ceil(excess / lbsPerHole);
        slideReason = "Reduce trailer to legal limit";
      } else if (driveOver && !trailerOver) {
        const excess = drivesNum - C.DRIVE_LIMIT;
        slideHoles = -Math.ceil(excess / lbsPerHole);
        slideReason = "Reduce drives to legal limit";
      } else if (driveOver && trailerOver) {
        // Both over — find best compromise
        const excessT = trailerNum - C.TRAILER_TANDEM_LIMIT;
        const excessD = drivesNum  - C.DRIVE_LIMIT;
        slideHoles = Math.ceil((excessT - excessD) / (2 * lbsPerHole));
        slideReason = "Reduce both axles toward legal";
      } else {
        slideReason = "Both axles within legal limits";
      }
    } else {
      // "both" — minimize total over-limit exposure
      const totalOver = Math.max(0, drivesNum - C.DRIVE_LIMIT) + Math.max(0, trailerNum - C.TRAILER_TANDEM_LIMIT);
      if (totalOver === 0) {
        slideReason = "No adjustment needed";
      } else {
        const excessT = trailerNum - C.TRAILER_TANDEM_LIMIT;
        const excessD = drivesNum  - C.DRIVE_LIMIT;
        slideHoles = Math.ceil((excessT - excessD) / (2 * lbsPerHole));
        slideReason = "Minimize total over-limit weight";
      }
    }

    slideResultDrives  = drivesNum  - (slideHoles * lbsPerHole);
    slideResultTrailer = trailerNum + (slideHoles * lbsPerHole);
  }

  const newHole       = currentHoleN + slideHoles;
  const slideDir      = slideHoles > 0 ? "forward" : slideHoles < 0 ? "back" : "none";
  const absHoles      = Math.abs(slideHoles);

  // ── Render ────────────────────────────────────────────────
  const inp = (val, set, ph, mode="numeric") => ({
    type:"number", inputMode:mode, value:val, placeholder:ph,
    onChange: e => set(e.target.value),
    style:{
      width:"100%", background:"transparent", border:"none",
      borderBottom:`1.5px solid ${val===""?"rgba(239,68,68,0.4)":t.borderStrong}`,
      color: val===""?"#888":t.text, fontSize:15, fontWeight:700,
      fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"3px 0"
    }
  });

  const reqCard = (val) => ({
    background: val===""?"rgba(239,68,68,0.07)":t.surface,
    border:`1px solid ${val===""?"rgba(239,68,68,0.35)":t.border}`,
    borderRadius:12, padding:"10px 8px", flex:1, textAlign:"center"
  });

  return (
    <div style={{ minHeight:"100vh", background: t.bg, fontFamily:"'DM Sans',sans-serif", color:t.text, padding:"0 0 80px 0", transition:"background 0.3s" }}>

      {/* Disclaimer modal — first launch only */}
      {!disclaimerAccepted && (
        <>
          {/* Backdrop */}
          <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)" }} />
          {/* Modal */}
          <div style={{
            position:"fixed", inset:0, zIndex:1001,
            display:"flex", alignItems:"center", justifyContent:"center",
            padding:"24px",
          }}>
            <div style={{
              background: isDark ? "#1a1f2e" : "#ffffff",
              border:`1px solid ${t.border}`,
              borderRadius:20, padding:"28px 24px",
              maxWidth:420, width:"100%",
              boxShadow:"0 24px 64px rgba(0,0,0,0.5)",
            }}>
              {/* Icon + title */}
              <div style={{ textAlign:"center", marginBottom:20 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:800, color:t.text, letterSpacing:0.5 }}>
                  Important Disclaimer
                </div>
                <div style={{ fontSize:12, color:t.textSecondary, marginTop:4 }}>
                  Please read before using this application
                </div>
              </div>

              {/* Body */}
              <div style={{ fontSize:13, color:t.textSub, lineHeight:1.65, marginBottom:22 }}>
                <p style={{ margin:"0 0 12px 0" }}>
                  This is a <strong style={{ color:t.text }}>decision-support tool only</strong>, intended to help drivers make more informed fueling decisions based on estimated axle weights and weight limits.
                </p>
                <p style={{ margin:"0 0 12px 0" }}>
                  Results are estimates and may not reflect actual scale weights due to load distribution, equipment variation, or input errors.
                </p>
                <p style={{ margin:0 }}>
                  <strong style={{ color:t.text }}>The driver is solely responsible</strong> for ensuring their vehicle is legally loaded and safe to operate. The driver assumes full responsibility for any citations, fines, accidents, or damages — regardless of what this app displays. This tool does not replace official scale tickets or applicable regulations.
                </p>
              </div>

              {/* Divider */}
              <div style={{ height:1, background:t.divider, marginBottom:20 }} />

              {/* Checkbox — must be checked before button activates */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20, cursor:"pointer" }}
                onClick={() => setDisclaimerChecked(v => !v)}>
                <div style={{
                  width:22, height:22, borderRadius:4, flexShrink:0, marginTop:1,
                  border:`2px solid ${disclaimerChecked ? A.green : t.textMuted}`,
                  background: disclaimerChecked ? (isDark ? `${A.green}25` : `${A.green}18`) : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.2s",
                }}>
                  {disclaimerChecked && <span style={{ fontSize:13, color:A.green, lineHeight:1, fontWeight:900 }}>&#10003;</span>}
                </div>
                <span style={{ fontSize:12, color:t.textSub, lineHeight:1.5 }}>
                  I understand that I am solely responsible for the safe and legal operation of my vehicle and take full responsibility for its operation. I will not hold the developers of this application liable for any outcome resulting from its use.
                </span>
              </div>

              {/* Accept button — disabled until checkbox is checked */}
              <button onClick={acceptDisclaimer} disabled={!disclaimerChecked} style={{
                width:"100%", padding:"14px",
                borderRadius:12, border:"none",
                background: disclaimerChecked ? A.green : t.border,
                color: disclaimerChecked ? (isDark ? "#0d1a0f" : "#fff") : t.textFaint,
                fontSize:15, fontWeight:800,
                fontFamily:"'Barlow Condensed',sans-serif",
                letterSpacing:0.5,
                cursor: disclaimerChecked ? "pointer" : "not-allowed",
                boxShadow: disclaimerChecked ? `0 4px 16px ${A.green}40` : "none",
                transition:"all 0.25s",
              }}>
                I UNDERSTAND — CONTINUE
              </button>
            </div>
          </div>
        </>
      )}

      {/* Settings backdrop */}
      {settingsOpen && (
        <div onClick={()=>setSettingsOpen(false)}
          style={{ position:"fixed", inset:0, zIndex:78 }} />
      )}

      {/* Flash overlay */}
      {flash && (
        <div style={{
          position:"fixed", inset:0, zIndex:999, pointerEvents:"none",
          background: flash==="safe" ? t.flashSafe : t.flashDanger,
          animation:"flashAnim 0.7s ease-out forwards",
        }} />
      )}

      {/* ── Sticky header panel ── */}
      <div style={{
        position:"sticky", top:0, zIndex:79,
        background: isDark ? "#0a0f1e" : "#f0f4f0",
        paddingTop:"env(safe-area-inset-top, 44px)",
        borderBottom:`1px solid ${t.border}`,
        boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.6)" : "0 4px 20px rgba(0,0,0,0.1)",
      }}>
        {/* Title row + settings gear */}
        <div style={{ padding:"10px 16px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h1 style={{ margin:0, fontSize:20, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, letterSpacing:-0.5, color:t.text }}>
            Fuel / Axle Weight Calculator
          </h1>
          <div style={{ position:"relative" }}>
            <button onClick={()=>setSettingsOpen(o=>!o)} style={{
              width:36, height:36, borderRadius:8,
              border:`1.5px solid ${settingsOpen?t.text:t.border}`,
              background: settingsOpen?t.surface:"transparent",
              fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              color:t.textMuted, transition:"all 0.15s",
            }}>&#9881;</button>
            {settingsOpen && (
              <div style={{
                position:"absolute", top:44, right:0, zIndex:200,
                background: isDark?"#1a1f2e":"#ffffff",
                border:`1px solid ${t.border}`,
                borderRadius:16, padding:"8px", minWidth:180,
                boxShadow: isDark?"0 8px 32px rgba(0,0,0,0.5)":"0 8px 32px rgba(0,0,0,0.15)",
              }}>
                <div style={{ fontSize:10, color:t.textFaint, textTransform:"uppercase", letterSpacing:1.5, padding:"4px 8px 8px" }}>Appearance</div>
                {[["system","System"],["light","Light"],["dark","Dark"]].map(([mode,label])=>(
                  <button key={mode} onClick={()=>{ saveTheme(mode); setSettingsOpen(false); }} style={{
                    width:"100%", padding:"10px 12px", borderRadius:8, border:"none",
                    background: themeMode===mode?(isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)"):"transparent",
                    color: themeMode===mode?t.text:t.textMuted,
                    fontSize:13, fontWeight: themeMode===mode?700:400,
                    fontFamily:"'DM Sans',sans-serif",
                    cursor:"pointer", display:"flex", alignItems:"center", gap:10, textAlign:"left",
                    transition:"background 0.15s",
                  }}>
                    <span>{label}</span>
                    {themeMode===mode && <span style={{ marginLeft:"auto", fontSize:12, color:A.green, fontWeight:900 }}>&#10003;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status banner */}
        <div style={{
          margin:"10px 16px 0", borderRadius:16, padding:"12px 20px",
          background: !weightsOK||!fuelOK ? t.surface : safe?(isDark?"rgba(74,222,128,0.12)":"rgba(22,163,74,0.08)"):(isDark?"rgba(255,68,68,0.12)":"rgba(220,38,38,0.08)"),
          border:`1.5px solid ${!weightsOK||!fuelOK?t.border:safe?A.green:A.red}`,
          display:"flex", alignItems:"center", gap:12, boxShadow:t.shadow,
        }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:800, letterSpacing:0.5,
              color:!weightsOK||!fuelOK?t.textSecondary:safe?A.greenBanner:A.redText }}>
              {!weightsOK?"ENTER AXLE WEIGHTS":!fuelOK?"ENTER CURRENT FUEL":steerTooLight?"STEER TOO LIGHT":safe?"SAFE TO ROLL":"DO NOT ROLL"}
            </div>
            <div style={{ fontSize:12, color:t.textSecondary, marginTop:2 }}>
              {!weightsOK||!fuelOK ? "Fill in all required fields below" :
                steerTooLight ? <span style={{ color:A.red }}>Steer axle too light — {fmt(steerNum)} lb (min {fmt(STEER_MIN)} lb)</span> :
                <>Gross: {fmt(newGross)} lb &nbsp;·&nbsp;
                  <span style={{ color:grossOver?A.red:A.green }}>
                    {grossOver?`${fmt(Math.abs(grossRem))} over limit`:`${fmt(grossRem)} under limit`}
                  </span>
                </>}
            </div>
          </div>
        </div>

        {/* Fuel to Add controls */}
        <div style={{ padding:"10px 16px 14px" }}>
          <div style={{ fontSize:11, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Fueling Mode</div>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <ModeButton active={fuelMode==="manual"} label="Manual"       color={A.blue}   onClick={()=>setFuelMode("manual")} />
            <ModeButton active={fuelMode==="full"}   label="Fill to Full" color={A.green}  onClick={()=>setFuelMode("full")} />
            <ModeButton active={fuelMode==="safe"}   label="Max Safe"     color="#a78bfa"  onClick={()=>setFuelMode("safe")} />
          </div>
          {fuelMode==="manual" && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <label style={{ fontSize:13, color:t.textSub }}>Gallons to add</label>
              <input type="number" inputMode="decimal" value={gallonsToAdd} placeholder="0"
                onChange={e=>setGallonsToAdd(e.target.value)}
                style={{ width:80, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:16, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"6px 8px" }}
              />
            </div>
          )}
          {fuelMode==="full" && (
            <div style={{ marginBottom:6, background:"rgba(74,222,128,0.07)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:12, padding:"10px 14px", fontSize:13, color:isDark?"#86efac":A.green }}>
              Adding <strong style={{ fontSize:16, fontFamily:"'Barlow Condensed',sans-serif" }}>{Math.max(0,fuelCapNum-galNowNum)} gal</strong> to reach full ({fuelCapNum} gal)
            </div>
          )}
          {fuelMode==="safe" && weightsOK && fuelOK && (
            <div style={{ marginBottom:6, background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:12, padding:"10px 14px", fontSize:13, color:isDark?"#c4b5fd":A.purple }}>
              Max safe fill: <strong style={{ fontSize:16, fontFamily:"'Barlow Condensed',sans-serif" }}>{maxSafeGal} gal</strong>
              <span style={{ fontSize:10, color:t.textFaint, marginLeft:6 }}>50 lb buffer applied</span>
              {maxSafeGal===0 && <span style={{ color:A.redText, marginLeft:8 }}>— already at or over limit</span>}
            </div>
          )}
          {fuelMode==="safe" && (!weightsOK||!fuelOK) && (
            <div style={{ marginBottom:6, background:"rgba(167,139,250,0.05)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:12, padding:"10px 14px", fontSize:12, color:isDark?"#7c6fa0":A.purple }}>
              Enter axle weights and current fuel to calculate max safe fill
            </div>
          )}
          {/* Reset */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
            {(weightsOK || fuelOK) && !resetConfirm && (
              <button onClick={()=>setResetConfirm(true)} style={{
                fontSize:10, color:t.textFaint, background:"transparent",
                border:`1px solid ${t.border}`, borderRadius:4,
                padding:"2px 7px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", letterSpacing:0.3,
              }}>Reset</button>
            )}
            {resetConfirm && (
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:10, color:A.red }}>Clear all?</span>
                <button onClick={doReset} style={{ fontSize:10, fontWeight:700, color:"#fff", background:A.red, border:"none", borderRadius:4, padding:"2px 8px", cursor:"pointer" }}>Yes</button>
                <button onClick={()=>setResetConfirm(false)} style={{ fontSize:10, color:t.textMuted, background:"transparent", border:`1px solid ${t.border}`, borderRadius:4, padding:"2px 8px", cursor:"pointer" }}>No</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding:"20px 16px", maxWidth:480, margin:"0 auto" }}>
        {/* ── Tab: Weights & Fuel ─────────────────────────── */}
        {activeTab === "main" && <>

        {/* Max Legal Fuel Warning */}
        {weightsOK && fuelOK && (
          <div style={{
            marginBottom:18, borderRadius:12, padding:"11px 16px",
            background: maxLegalFromCurrent < 20 ? "rgba(255,68,68,0.1)" : "rgba(250,204,21,0.08)",
            border:`1px solid ${maxLegalFromCurrent < 20?"rgba(255,68,68,0.35)":"rgba(250,204,21,0.3)"}`,
            display:"flex", alignItems:"center", gap:10,
          }}>
            
            <div>
              <div style={{ fontSize:12, fontWeight:700, color: maxLegalFromCurrent<20?A.redText:A.yellowBanner, letterSpacing:0.3 }}>
                MAX LEGAL FILL
              </div>
              <div style={{ fontSize:15, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, color:t.text }}>
                {maxLegalFromCurrent} gal
                <span style={{ fontSize:11, fontWeight:400, color:t.textSecondary, marginLeft:6 }}>
                  ({maxLegalFromCurrent * C.DIESEL_LB_PER_GAL} lb · {Math.round(maxLegalFromCurrent * mpgNum)} mi range)
                </span>
              </div>
              <div style={{ fontSize:10, color:t.textFaint, marginTop:1 }}>Includes 50 lb safety buffer</div>
            </div>
          </div>
        )}

        {/* ── Truck Profiles ───────────────────────────────── */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:11, letterSpacing:2, color:t.sectionLabel, fontWeight: isDark?400:700, textTransform:"uppercase" }}>Truck Settings</div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              {profiles.length > 0 && (
                <div style={{ position:"relative" }}>
                  <button onClick={()=>setShowProfileMenu(m=>!m)} style={{
                    fontSize:11, fontWeight:600, color:A.blue,
                    background:"transparent", border:`1px solid ${A.blue}40`,
                    borderRadius:8, padding:"4px 10px", cursor:"pointer",
                    fontFamily:"'DM Sans',sans-serif",
                  }}>
                    {activeProfile ? (profiles.find(p=>p.id===activeProfile)?.name || "Profiles") : "Profiles"}
                  </button>
                  {showProfileMenu && (
                    <>
                      <div onClick={()=>setShowProfileMenu(false)} style={{ position:"fixed", inset:0, zIndex:149 }} />
                      <div style={{ position:"absolute", top:36, right:0, zIndex:150, background: isDark?"#1a1f2e":"#fff", border:`1px solid ${t.border}`, borderRadius:16, padding:"8px", minWidth:200, boxShadow: isDark?"0 8px 32px rgba(0,0,0,0.5)":"0 8px 32px rgba(0,0,0,0.15)" }}>
                        <div style={{ fontSize:10, color:t.textFaint, textTransform:"uppercase", letterSpacing:1.5, padding:"4px 8px 8px" }}>Saved Profiles</div>
                        {profiles.map(p => (
                          <div key={p.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 4px" }}>
                            <button onClick={()=>loadProfile(p)} style={{
                              flex:1, padding:"8px 10px", borderRadius:8, border:"none", textAlign:"left",
                              background: activeProfile===p.id?(isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)"):"transparent",
                              color: activeProfile===p.id?t.text:t.textMuted,
                              fontSize:13, fontWeight: activeProfile===p.id?700:400,
                              fontFamily:"'DM Sans',sans-serif", cursor:"pointer",
                            }}>{p.name}</button>
                            <button onClick={()=>deleteProfile(p.id)} style={{
                              width:24, height:24, borderRadius:4, border:"none",
                              background:"transparent", color:t.textFaint, cursor:"pointer", fontSize:14,
                            }}>&#x2715;</button>
                          </div>
                        ))}
                        <div style={{ height:1, background:t.divider, margin:"6px 0" }} />
                        <button onClick={()=>{ setShowProfileMenu(false); setShowSavePrompt(true); }} style={{
                          width:"100%", padding:"8px 10px", borderRadius:8, border:"none",
                          background:"transparent", color:A.green,
                          fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
                          cursor:"pointer", textAlign:"left",
                        }}>+ Save current as profile</button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button onClick={()=>setShowSavePrompt(true)} style={{
                fontSize:11, fontWeight:600, color:A.green,
                background:"transparent", border:`1px solid ${A.green}40`,
                borderRadius:8, padding:"4px 10px", cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif",
              }}>+ Save</button>
            </div>
          </div>
          <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, overflow:"hidden", boxShadow:t.shadow }}>

            {/* Axle Weights */}
            <div style={{ padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:12, color:t.textSub, fontWeight:600 }}>Current Axle Weights</span>
                <span style={{ fontSize:10, color:"#ef4444", fontWeight:700, letterSpacing:0.5 }}>REQUIRED</span>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                {[["Steer","",steer,setSteer],["Drives","",drives,setDrives],["Trailer","",trailer,setTrailer]].map(([label,icon,val,set])=>(
                  <div key={label} style={reqCard(val)}>
                    <div style={{ fontSize:10, color:val===""?"#ef4444":t.textSecondary, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                      {icon} {label}{val===""?" *":""}
                    </div>
                    <input {...inp(val, set, "—")} />
                    <div style={{ fontSize:10, color:t.textFaint, marginTop:5 }}>lb</div>
                  </div>
                ))}
              </div>
              {!weightsOK && <div style={{ marginTop:10, fontSize:11, color:"#ef4444", opacity:0.75, textAlign:"center" }}>All three weights required to calculate</div>}
            </div>

            <Divider t={t} />

            {/* Trailer Axle Type */}
            <div style={{ padding:"13px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
              onClick={()=>setSpreadAxle(!spreadAxle)}>
              <div>
                <div style={{ fontSize:13, color:t.textSub, fontWeight:600 }}>Trailer Axle Type</div>
                <div style={{ fontSize:11, color:t.textSecondary, marginTop:1 }}>
                  Limit: <span style={{ color:spreadAxle?A.orange:A.yellow, fontWeight:700 }}>
                    {spreadAxle?"40,000 lb — spread":"34,000 lb — tandem"}
                  </span>
                </div>
              </div>
              <Toggle on={spreadAxle} leftLabel="TANDEM" rightLabel="SPREAD" onColor={A.orange} t={t} />
            </div>

            <Divider t={t} />

            {/* Tank & MPG */}
            <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:14 }}>
              <SettingRow label="Tank Capacity" sub="gallons" value={fuelCapacity} onChange={setFuelCapacity} placeholder="150" t={t} />
              <SettingRow label="Avg Fuel Economy" sub="miles per gallon" value={mpg} onChange={setMpg} placeholder="7.5" t={t} />
            </div>
          </div>
        </div>

        {/* ── Fuel Section ──────────────────────────────────── */}
        <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"16px", marginBottom:20, boxShadow:t.shadow }}>
          <div style={{ fontSize:11, letterSpacing:2, color:t.sectionLabel, fontWeight: isDark?400:700, textTransform:"uppercase", marginBottom:14 }}>Fuel</div>

          {/* Current gallons — required */}
          <div style={{ background:gallonsNow===""?"rgba(239,68,68,0.07)":t.surface, border:`1px solid ${gallonsNow===""?"rgba(239,68,68,0.35)":t.border}`, borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:13, color:gallonsNow===""?"#ef4444":t.textSub, fontWeight:600 }}>
                Gallons Currently in Tanks{gallonsNow===""?" *":""}
              </span>
              <span style={{ fontSize:10, color:"#ef4444", fontWeight:700, letterSpacing:0.5 }}>REQUIRED</span>
            </div>

            {/* Fuel gauge slider */}
            {(() => {
              const ticks = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // eighths: 0/8 through 8/8
              const labels = ["E", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞", "F"];
              const sliderVal = galNowNum > 0 ? Math.round((galNowNum / fuelCapNum) * 8) : (gallonsNow === "" ? -1 : 0);
              const fillPct = sliderVal < 0 ? 0 : (sliderVal / 8) * 100;
              const fuelColor = sliderVal < 0 ? t.border : sliderVal <= 1 ? A.red : sliderVal <= 2 ? A.yellow : A.green;

              return (
                <div style={{ marginBottom:14 }}>
                  {/* Visual gauge tank */}
                  <div style={{ position:"relative", height:36, marginBottom:10 }}>
                    {/* Tank background */}
                    <div style={{ position:"absolute", inset:0, background:isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)", borderRadius:8, overflow:"hidden", border:`1px solid ${t.border}` }}>
                      {/* Fuel fill */}
                      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${fillPct}%`, background: fuelColor, opacity:0.25, transition:"width 0.3s, background 0.3s" }} />
                      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${fillPct}%`, borderRight: sliderVal > 0 && sliderVal < 8 ? `2px solid ${fuelColor}` : "none", transition:"width 0.3s" }} />
                      {/* Quarter tick marks */}
                      {[1,2,3,4,5,6,7].map(i => (
                        <div key={i} style={{ position:"absolute", left:`${(i/8)*100}%`, top: i % 2 === 0 ? "0%" : "30%", bottom: i % 2 === 0 ? "0%" : "30%", width:1, background: isDark?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.1)" }} />
                      ))}
                    </div>
                    {/* Gauge label overlay */}
                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:14, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color: sliderVal < 0 ? t.textFaint : fuelColor, letterSpacing:0.5 }}>
                        {sliderVal < 0 ? "tap to set level" : sliderVal === 0 ? "EMPTY" : sliderVal === 8 ? "FULL" : labels[sliderVal]}
                        {sliderVal > 0 && sliderVal < 8 && (
                          <span style={{ fontSize:11, fontWeight:400, color:t.textSecondary, marginLeft:6 }}>
                            ≈ {Math.round((sliderVal / 8) * fuelCapNum)} gal
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Tap targets — 8 equal segments */}
                  <div style={{ display:"flex", gap:3, marginBottom:6 }}>
                    {ticks.map(i => (
                      <button key={i} onClick={() => setGallonsNow(String(Math.round((i / 8) * fuelCapNum)))}
                        style={{
                          flex:1, height:28, borderRadius:8, cursor:"pointer",
                          border: sliderVal === i ? `1.5px solid ${fuelColor}` : `1px solid ${t.border}`,
                          background: sliderVal === i
                            ? (isDark ? `${fuelColor}30` : `${fuelColor}20`)
                            : (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"),
                          transition:"all 0.15s",
                          display:"flex", alignItems:"center", justifyContent:"center",
                        }}>
                        <span style={{ fontSize:9, fontWeight:700, color: sliderVal === i ? fuelColor : t.textFaint, fontFamily:"'DM Sans',sans-serif" }}>
                          {labels[i]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Quarter labels */}
                  <div style={{ display:"flex", justifyContent:"space-between", paddingLeft:0 }}>
                    {["E","¼","½","¾","F"].map((l, i) => (
                      <span key={l} style={{ fontSize:9, color:t.textFaint, fontWeight:600, width: i === 0 || i === 4 ? "auto" : 0, textAlign:"center", whiteSpace:"nowrap" }}>{l}</span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Manual gallons input */}
            <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:10, borderTop:`1px solid ${t.divider}` }}>
              <span style={{ fontSize:11, color:t.textSecondary, whiteSpace:"nowrap" }}>Or enter exact:</span>
              <input type="number" inputMode="decimal" value={gallonsNow} placeholder="—"
                onChange={e=>setGallonsNow(e.target.value)}
                style={{ flex:1, background:"transparent", border:"none", borderBottom:`1.5px solid ${gallonsNow===""?"rgba(239,68,68,0.4)":t.borderStrong}`, color:gallonsNow===""?"#888":t.text, fontSize:20, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", outline:"none", padding:"2px 0", textAlign:"right" }}
              />
              <span style={{ fontSize:12, color:t.textFaint, fontWeight:600 }}>gal</span>
            </div>
            {!fuelOK && <div style={{ marginTop:8, fontSize:11, color:"#ef4444", opacity:0.75 }}>Current fuel level required to calculate</div>}
          </div>

          {/* Fuel stats */}
          <div style={{ paddingTop:14, borderTop:`1px solid ${t.divider}`, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { label:"Gallons Adding",  val:`${effectiveGal} gal`,                              color:t.text },
              { label:"Total After Fill", val:`${totalAfter} gal`,                               color:t.text },
              { label:"Range Now",        val:fuelOK?`${rangeCurrent.toLocaleString()} mi`:"—",  color:A.blue },
              { label:"Range After Fill", val:fuelOK?`${rangeAfter.toLocaleString()} mi`:"—",    color:A.green },
            ].map(({label,val,color})=>(
              <div key={label} style={{ background:isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)", borderRadius:12, padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:10, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Axle Results ──────────────────────────────────── */}
        {weightsOK && fuelOK ? (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, letterSpacing:2, color:t.sectionLabel, fontWeight: isDark?400:700, textTransform:"uppercase", marginBottom:10 }}>Axle Weights After Fueling</div>
            <div style={{ display:"flex", gap:10, marginBottom:10 }}>
              <AxleCard label="Steer"  current={Math.round(newSteer)}  limit={C.STEER_LIMIT} color={A.blue} icon="" t={t} a={A} trafficLight minVal={STEER_MIN} />
              <AxleCard label="Drives" current={Math.round(newDrives)} limit={C.DRIVE_LIMIT} color={A.yellow} icon="" t={t} a={A} trafficLight />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <AxleCard label="Trailer" current={Math.round(newTrailer)} limit={trailerLim}   color={A.orange} icon="" t={t} a={A} trafficLight />
              <AxleCard label="Gross"   current={Math.round(newGross)}   limit={C.GROSS_LIMIT} color={A.purple} icon="" t={t} a={A} trafficLight />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom:16, background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"20px 16px", textAlign:"center" }}>
            <div style={{ fontSize:12, color:t.textMuted }}>Enter axle weights and current fuel level to see results</div>
          </div>
        )}

        {/* Weight breakdown */}
        {weightsOK && fuelOK && effectiveGal > 0 && (
          <div style={{ marginBottom:20, background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"12px 16px" }}>
            <div style={{ fontSize:11, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Weight Added Breakdown</div>
            {[
              { label:"Total fuel weight",   val:`${fmt(addedWeight)} lb`,             color:t.text },
              { label:"→ Steer axle (20%)",  val:`+${fmt(Math.round(addedSteer))} lb`, color:A.blue },
              { label:"→ Drive axles (80%)", val:`+${fmt(Math.round(addedDrive))} lb`, color:A.yellow },
            ].map(({label,val,color})=>(
              <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:t.textSub, marginBottom:6 }}>
                <span>{label}</span><span style={{ color, fontWeight:700 }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        </> /* end main tab */}

        {/* ── Tab: Slider ─────────────────────────────────── */}
        {activeTab === "slider" && <>
        {/* ── Tandem Slider (tandem only) ───────────────────── */}
        {spreadAxle ? (
          <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"32px 20px", textAlign:"center", marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:t.textSub, marginBottom:6 }}>Spread Axle Selected</div>
            <div style={{ fontSize:12, color:t.textMuted }}>Tandem slider is not applicable for spread axle configurations.</div>
            <div style={{ fontSize:12, color:t.textMuted, marginTop:4 }}>Switch to Tandem on the Weights & Fuel tab to use this tool.</div>
          </div>
        ) : (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, letterSpacing:2, color:t.sectionLabel, fontWeight: isDark?400:700, textTransform:"uppercase", marginBottom:10 }}>Tandem Slider</div>
            <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, overflow:"hidden", boxShadow:t.shadow }}>

              {/* Hole spacing */}
              <div style={{ padding:"14px 16px" }}>
                <div style={{ fontSize:12, color:t.textSub, fontWeight:600, marginBottom:10 }}>Hole Spacing</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[2,4,6].map(s=>(
                    <button key={s} onClick={()=>setHoleSpacing(s)} style={{
                      flex:1, padding:"9px 4px", borderRadius:8,
                      border: holeSpacing===s?`1.5px solid ${A.orange}`:"1.5px solid rgba(128,128,128,0.15)",
                      background: holeSpacing===s?(isDark?"rgba(251,146,60,0.12)":"rgba(154,52,18,0.08)"):"transparent",
                      color: holeSpacing===s?A.orange:t.textMuted,
                      fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.18s",
                      fontFamily:"'DM Sans',sans-serif",
                    }}>
                      {s}" holes
                      <div style={{ fontSize:9, fontWeight:400, marginTop:1, opacity:0.7 }}>~{C.LBS_PER_HOLE[s]} lb/hole</div>
                    </button>
                  ))}
                </div>
              </div>

              <Divider t={t} />

              {/* Slide goal */}
              <div style={{ padding:"14px 16px" }}>
                <div style={{ fontSize:12, color:t.textSub, fontWeight:600, marginBottom:10 }}>Goal</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { val:"legal",   label:"Get Legal",  color:A.green },
                    { val:"balance", label:"Balance",     color:A.blue },
                    { val:"both",    label:"Minimize Over", color:"#a78bfa" },
                  ].map(({val,label,color})=>(
                    <button key={val} onClick={()=>setSlideGoal(val)} style={{
                      flex:1, padding:"9px 4px", borderRadius:8,
                      border: slideGoal===val?`1.5px solid ${color}`:"1.5px solid rgba(128,128,128,0.15)",
                      background: slideGoal===val?`${color}1a`:"transparent",
                      color: slideGoal===val?color:t.textMuted,
                      fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.18s",
                      fontFamily:"'DM Sans',sans-serif",
                    }}>{label}</button>
                  ))}
                </div>
              </div>

              <Divider t={t} />

              {/* Current hole position */}
              <div style={{ padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:13, color:t.textSub, fontWeight:600 }}>Current Hole Position</div>
                    <div style={{ fontSize:11, color:t.textSecondary }}>Tap a hole or type the number</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:10, color:t.textFaint, marginBottom:3 }}>Total holes</div>
                      <input type="number" inputMode="numeric" value={totalHoles} min="1" max="30"
                        onChange={e => setTotalHoles(Math.max(1, Math.min(30, Number(e.target.value) || 10)))}
                        style={{ width:56, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:14, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"5px 6px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Visual hole grid */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                  {Array.from({ length: totalHoles }, (_, i) => i + 1).map(hole => {
                    const isSelected = Number(currentHole) === hole;
                    const isTarget   = currentHole !== "" && hole === (currentHoleN + slideHoles);
                    const isPast     = Number(currentHole) > 0 && hole < Number(currentHole);
                    return (
                      <button key={hole} onClick={() => setCurrentHole(String(hole))}
                        style={{
                          width: 36, height: 36, borderRadius: 8,
                          border: isSelected
                            ? `2px solid ${A.orange}`
                            : isTarget
                            ? `2px dashed ${slideDir==="forward"?A.orange:A.blue}`
                            : `1px solid ${t.border}`,
                          background: isSelected
                            ? (isDark ? "rgba(251,146,60,0.2)" : "rgba(217,119,6,0.12)")
                            : isTarget
                            ? (isDark ? "rgba(96,165,250,0.08)" : "rgba(29,78,216,0.06)")
                            : isPast
                            ? (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)")
                            : t.surface,
                          color: isSelected ? A.orange : isTarget ? (slideDir==="forward"?A.orange:A.blue) : isPast ? t.textFaint : t.textSub,
                          fontSize: 12, fontWeight: isSelected || isTarget ? 700 : 400,
                          fontFamily: "'Barlow Condensed',sans-serif",
                          cursor: "pointer", transition: "all 0.15s",
                          opacity: isPast ? 0.5 : 1,
                        }}>
                        {hole}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display:"flex", gap:14, marginBottom:10, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:10, height:10, borderRadius:4, background: isDark?"rgba(251,146,60,0.2)":"rgba(217,119,6,0.12)", border:`2px solid ${A.orange}` }} />
                    <span style={{ fontSize:10, color:t.textFaint }}>Current</span>
                  </div>
                  {currentHole !== "" && slideHoles !== 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:10, height:10, borderRadius:4, border:`2px dashed ${slideDir==="forward"?A.orange:A.blue}` }} />
                      <span style={{ fontSize:10, color:t.textFaint }}>Target</span>
                    </div>
                  )}
                </div>

                {/* Manual number input fallback */}
                <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:10, borderTop:`1px solid ${t.divider}` }}>
                  <span style={{ fontSize:11, color:t.textMuted }}>Or type hole #:</span>
                  <input type="number" inputMode="numeric" value={currentHole} placeholder="—"
                    onChange={e => setCurrentHole(e.target.value)}
                    style={{ width:70, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:16, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center", outline:"none", padding:"5px 8px" }}
                  />
                  {currentHole !== "" && (
                    <button onClick={() => setCurrentHole("")}
                      style={{ fontSize:11, color:t.textFaint, background:"transparent", border:"none", cursor:"pointer", padding:"4px 8px", borderRadius:4 }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <Divider t={t} />

              {/* Result */}
              <div style={{ padding:"14px 16px" }}>
                {!weightsOK ? (
                  <div style={{ fontSize:12, color:t.textFaint, textAlign:"center", padding:"8px 0" }}>Enter axle weights above to calculate slide recommendation</div>
                ) : slideHoles === 0 ? (
                  <div style={{ background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:12, padding:"12px 14px" }}>
                    <div style={{ fontSize:14, fontWeight:700, color:A.green, marginBottom:4 }}>No slide needed</div>
                    <div style={{ fontSize:12, color:t.textSecondary }}>{slideReason}</div>
                  </div>
                ) : (
                  <div>
                    {/* Main recommendation */}
                    <div style={{ background: slideDir==="forward"?(isDark?"rgba(251,146,60,0.1)":"rgba(154,52,18,0.06)"):(isDark?"rgba(96,165,250,0.1)":"rgba(29,78,216,0.06)"), border:`1px solid ${slideDir==="forward"?(isDark?"rgba(251,146,60,0.3)":"rgba(154,52,18,0.25)"):(isDark?"rgba(96,165,250,0.3)":"rgba(29,78,216,0.25)")}`, borderRadius:12, padding:"14px", marginBottom:12 }}>
                      <div style={{ fontSize:11, color:t.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Recommendation</div>
                      <div style={{ fontSize:26, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color: slideDir==="forward"?A.orange:A.blue }}>
                        {absHoles} hole{absHoles!==1?"s":""} {slideDir}
                      </div>
                      <div style={{ fontSize:12, color:t.textSecondary, marginTop:4 }}>{slideReason}</div>
                      {currentHole !== "" && (
                        <div style={{ marginTop:8, fontSize:13, color:t.textSub }}>
                          Move from hole <strong>{currentHoleN}</strong> → hole <strong style={{ color: slideDir==="forward"?A.orange:A.blue }}>{newHole}</strong>
                        </div>
                      )}
                    </div>

                    {/* Before / after weights */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      {[
                        { label:"Drives — Before", val:drivesNum,            limit:C.DRIVE_LIMIT,           color:A.yellow },
                        { label:"Drives — After",  val:slideResultDrives,    limit:C.DRIVE_LIMIT,           color:A.yellow },
                        { label:"Trailer — Before",val:trailerNum,           limit:C.TRAILER_TANDEM_LIMIT,  color:A.orange },
                        { label:"Trailer — After", val:slideResultTrailer,   limit:C.TRAILER_TANDEM_LIMIT,  color:A.orange },
                      ].map(({label,val,limit,color})=>{
                        const over = val > limit;
                        return (
                          <div key={label} style={{ background: over?"rgba(255,68,68,0.07)":"rgba(74,222,128,0.05)", border:`1px solid ${over?"rgba(255,68,68,0.25)":"rgba(74,222,128,0.15)"}`, borderRadius:12, padding:"10px 12px" }}>
                            <div style={{ fontSize:10, color:t.textSecondary, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>{label}</div>
                            <div style={{ fontSize:17, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", color: over?A.redText:t.text }}>{fmt(val)} lb</div>
                            <div style={{ fontSize:10, color: over?A.redText:A.green, fontWeight:700 }}>
                              {over?`+${fmt(val-limit)} over`:`-${fmt(limit-val)} left`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop:10, fontSize:11, color:t.textFaint, textAlign:"center" }}>
                      ~{fmt(absHoles * lbsPerHole)} lb shifted · {holeSpacing}" spacing · {lbsPerHole} lb/hole
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </> /* end slider tab */}

        {/* Footer — always visible */}
        <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:"14px 16px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { label:"Diesel Weight", val:"8 lb / gal" },
            { label:"Tank Capacity", val:`${fuelCapNum} gal` },
            { label:"Fuel Economy",  val:`${mpgNum} MPG` },
            { label:"Trailer Axles", val:spreadAxle?"Spread":"Tandem" },
          ].map(({label,val})=>(
            <div key={label} style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:10, color:t.textFaint, textTransform:"uppercase", letterSpacing:0.8 }}>{label}</span>
              <span style={{ fontSize:14, color:t.textSecondary, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>{val}</span>
            </div>
          ))}
        </div>

      </div>

      {/* ── Save Profile Modal ─────────────────────────── */}
      {showSavePrompt && (
        <>
          <div onClick={()=>setShowSavePrompt(false)} style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)" }} />
          <div style={{ position:"fixed", inset:0, zIndex:1001, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
            <div style={{ background: isDark?"#1a1f2e":"#fff", border:`1px solid ${t.border}`, borderRadius:20, padding:"24px", maxWidth:360, width:"100%", boxShadow:"0 24px 64px rgba(0,0,0,0.4)" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:800, color:t.text, marginBottom:6 }}>Save Truck Profile</div>
              <div style={{ fontSize:12, color:t.textMuted, marginBottom:20 }}>
                Saves tank capacity, fuel economy, axle type, and hole spacing.
              </div>
              <div style={{ fontSize:11, color:t.textSecondary, marginBottom:6 }}>Profile name</div>
              <input
                type="text" value={newProfileName}
                placeholder="e.g. Pete 389 — 53ft Spread"
                onChange={e=>setNewProfileName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&saveProfile()}
                style={{ width:"100%", background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:8, color:t.text, fontSize:15, fontWeight:600, fontFamily:"'DM Sans',sans-serif", outline:"none", padding:"10px 14px" }}
                autoFocus
              />
              <div style={{ display:"flex", gap:10, marginTop:18 }}>
                <button onClick={()=>setShowSavePrompt(false)} style={{ flex:1, padding:"12px", borderRadius:8, border:`1px solid ${t.border}`, background:"transparent", color:t.textMuted, fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>Cancel</button>
                <button onClick={saveProfile} disabled={!newProfileName.trim()} style={{ flex:2, padding:"12px", borderRadius:12, border:"none", background: newProfileName.trim()?A.green:t.border, color: newProfileName.trim()?(isDark?"#0d1a0f":"#fff"):t.textFaint, fontSize:13, fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:0.5, cursor: newProfileName.trim()?"pointer":"not-allowed", transition:"all 0.2s" }}>SAVE PROFILE</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Tab Bar ─────────────────────────────────── */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:50,
        background: isDark ? "rgba(10,15,30,0.95)" : "rgba(255,255,255,0.95)",
        backdropFilter:"blur(12px)",
        borderTop:`1px solid ${t.border}`,
        display:"flex",
        paddingBottom:"env(safe-area-inset-bottom)",
      }}>
        {[
          { id:"main",   label:"Weights & Fuel" },
          { id:"slider", label:"Tandem Slider"  },
        ].map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => switchTab(id)} style={{
              flex:1, padding:"12px 8px 10px",
              border:"none", background:"transparent",
              cursor:"pointer", display:"flex", flexDirection:"column",
              alignItems:"center", gap:3, transition:"all 0.15s",
            }}>
              <div style={{
                width:32, height:3, borderRadius:4, marginBottom:2,
                background: active ? A.green : "transparent",
                transition:"background 0.2s",
              }} />
              <span style={{
                fontSize:11, fontWeight: active ? 700 : 400,
                fontFamily:"'DM Sans',sans-serif",
                color: active ? A.green : t.textMuted,
                letterSpacing: 0.3,
                transition:"color 0.2s",
              }}>{label}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes flashAnim {
          0%   { opacity: 0.85; }
          100% { opacity: 0; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        button { font-family: 'DM Sans', sans-serif; }
      `}</style>
    </div>
  );
}
