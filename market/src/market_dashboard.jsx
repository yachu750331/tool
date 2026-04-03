import { useState, useEffect, useRef } from "react";

// ── Simulated Data ──
const MOCK = {
  // 估值與基本面
  buffett: { value: 218.5, prev: 220.1, threshold: { green: 120, yellow: 160, red: 200 }, unit: "%", name: "巴菲特指標", sub: "Wilshire 5000 / GDP" },
  cape: { value: 33.2, prev: 34.8, threshold: { green: 20, yellow: 25, red: 30 }, unit: "x", name: "席勒本益比", sub: "Shiller CAPE Ratio" },
  // 恐慌情緒
  vix: { value: 29.4, prev: 27.1, threshold: { green: 20, yellow: 30, red: 40 }, unit: "", name: "VIX 恐慌指數", sub: "S&P 500 隱含波動率" },
  fearGreed: { value: 22, prev: 27, threshold: { green: 50, yellow: 30, red: 15 }, unit: "", name: "恐懼與貪婪", sub: "CNN Fear & Greed", invertColor: true },
  putCall: { value: 1.12, prev: 0.90, threshold: { green: 0.7, yellow: 0.9, red: 1.2 }, unit: "", name: "Put/Call Ratio", sub: "CBOE 選擇權比率" },
  // 流動性
  sofr_iorb: { value: 2.8, prev: 1.2, threshold: { green: 0, yellow: 1, red: 3 }, unit: "bps", name: "SOFR − IORB", sub: "短端資金壓力" },
  onrrp: { value: 185, prev: 220, threshold: { green: 300, yellow: 200, red: 150 }, unit: "B", name: "ON RRP 餘額", sub: "流動性緩衝墊", invertColor: true },
  tga: { value: 680, prev: 610, threshold: { green: 400, yellow: 600, red: 750 }, unit: "B", name: "TGA 餘額", sub: "財政部帳戶" },
  srf: { value: 1.8, prev: 0.3, threshold: { green: 0, yellow: 1, red: 5 }, unit: "B", name: "SRF 使用量", sub: "Fed 後備工具" },
  // 債券與利率
  us10y: { value: 4.52, prev: 4.38, threshold: { green: 3.5, yellow: 4.0, red: 4.5 }, unit: "%", name: "美債 10Y 殖利率", sub: "US Treasury 10Y" },
  us2y: { value: 4.05, prev: 3.92, threshold: { green: 3.0, yellow: 3.5, red: 4.0 }, unit: "%", name: "美債 2Y 殖利率", sub: "US Treasury 2Y" },
  spread2s10s: { value: 0.47, prev: 0.46, threshold: { green: 0.5, yellow: 0.2, red: 0 }, unit: "%", name: "2Y-10Y 利差", sub: "殖利率曲線斜率", invertColor: true },
  breakeven: { value: 2.85, prev: 2.72, threshold: { green: 2.0, yellow: 2.5, red: 3.0 }, unit: "%", name: "10Y 通膨預期", sub: "Breakeven Inflation" },
  move: { value: 118, prev: 105, threshold: { green: 80, yellow: 100, red: 120 }, unit: "", name: "MOVE Index", sub: "美債波動率" },
  // 信用與金融狀況
  hySpread: { value: 428, prev: 385, threshold: { green: 300, yellow: 400, red: 500 }, unit: "bps", name: "高收益債利差", sub: "HY OAS Spread" },
  bloomberg: { value: -0.85, prev: -0.62, threshold: { green: 0, yellow: -0.5, red: -1.0 }, unit: "", name: "彭博金融狀況", sub: "Bloomberg FCI", invertColor: true },
  // 避險與商品
  gold: { value: 5320, prev: 5180, threshold: { green: 4000, yellow: 4800, red: 5200 }, unit: "$", name: "黃金現貨", sub: "XAU/USD" },
  wti: { value: 98.5, prev: 92.3, threshold: { green: 70, yellow: 85, red: 100 }, unit: "$", name: "WTI 原油現金期貨", sub: "CL1 Front Month" },
  brent: { value: 102.3, prev: 96.8, threshold: { green: 75, yellow: 90, red: 105 }, unit: "$", name: "布蘭特原油現金期貨", sub: "CO1 Front Month" },
  dxy: { value: 105.8, prev: 104.2, threshold: { green: 100, yellow: 103, red: 106 }, unit: "", name: "美元指數", sub: "DXY Index" },
  // 大盤
  sp500: { value: 6477, prev: 6592, name: "S&P 500", sub: "標普500指數" },
  nasdaq: { value: 19820, prev: 20150, name: "NASDAQ", sub: "那斯達克指數" },
  dow: { value: 41250, prev: 41800, name: "道瓊工業", sub: "Dow Jones" },
};

const LIQUIDITY_COMBOS = [
  { keys: ["onrrp", "sofr_iorb"], label: "ON RRP 低 + SOFR > IORB", meaning: "緩衝墊變薄，資金價格已轉緊", level: "高" },
  { keys: ["tga", "onrrp"], label: "TGA 大升 + ON RRP 已低", meaning: "政府抽水時，市場已缺乏緩衝", level: "高" },
  { keys: ["sofr_iorb", "srf"], label: "SOFR > IORB + SRF 跳升", meaning: "不只資金變貴，Fed 後備工具都在動用", level: "很高" },
  { keys: ["onrrp", "tga", "sofr_iorb"], label: "ON RRP 低 + TGA 大升 + SOFR > IORB", meaning: "流動性明顯惡化核心組合", level: "最高" },
];

const HISTORY_VIX = [18, 19, 21, 24, 22, 25, 28, 26, 30, 27, 25, 29, 32, 28, 27, 29, 31, 28, 26, 29.4];
const HISTORY_SP = [6850, 6820, 6790, 6750, 6770, 6720, 6680, 6700, 6650, 6620, 6590, 6560, 6540, 6570, 6530, 6510, 6500, 6490, 6480, 6477];

function getSignal(item) {
  if (!item.threshold) return "neutral";
  const { value, threshold, invertColor } = item;
  if (invertColor) {
    if (value >= threshold.green) return "green";
    if (value >= threshold.yellow) return "yellow";
    return "red";
  }
  if (value <= threshold.green) return "green";
  if (value <= threshold.yellow) return "yellow";
  return "red";
}

function getChange(item) {
  if (!item.prev) return 0;
  return item.value - item.prev;
}

function getChangePct(item) {
  if (!item.prev || item.prev === 0) return 0;
  return ((item.value - item.prev) / Math.abs(item.prev)) * 100;
}

// ── Mini Sparkline ──
function Spark({ data, color, width = 120, height = 32 }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
}

// ── Gauge Arc ──
function GaugeArc({ value, min, max, signal, label, size = 100 }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + pct * 270;
  const r = size * 0.38;
  const cx = size / 2, cy = size / 2 + 4;
  const colors = { green: "#22c55e", yellow: "#eab308", red: "#ef4444", neutral: "#6b7280" };
  const c = colors[signal];
  
  const arcPath = (startAngle, endAngle) => {
    const s = (startAngle * Math.PI) / 180;
    const e = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`;
  };

  const needleAngle = (angle * Math.PI) / 180;
  const nx = cx + (r - 8) * Math.cos(needleAngle);
  const ny = cy + (r - 8) * Math.sin(needleAngle);

  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
      <path d={arcPath(-135, 135)} fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
      <path d={arcPath(-135, angle)} fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" opacity="0.9" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={c} strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3" fill={c} />
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="'JetBrains Mono', monospace">{label}</text>
    </svg>
  );
}

// ── Signal Dot ──
function SignalDot({ signal, size = 10 }) {
  const colors = { green: "#22c55e", yellow: "#eab308", red: "#ef4444", neutral: "#6b7280" };
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: colors[signal],
      boxShadow: signal === "red" ? `0 0 8px ${colors[signal]}80` : signal === "yellow" ? `0 0 6px ${colors[signal]}60` : "none",
      animation: signal === "red" ? "pulse-red 1.5s ease-in-out infinite" : "none",
    }} />
  );
}

// ── Metric Card ──
function MetricCard({ id, data, showGauge }) {
  const signal = getSignal(data);
  const change = getChange(data);
  const pct = getChangePct(data);
  const isUp = change > 0;
  const colors = { green: "#22c55e", yellow: "#eab308", red: "#ef4444", neutral: "#6b7280" };

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      border: `1px solid ${signal === "red" ? "#ef444440" : signal === "yellow" ? "#eab30830" : "#334155"}`,
      borderRadius: 12, padding: "16px 18px", position: "relative", overflow: "hidden",
      transition: "all 0.3s ease",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = colors[signal]; e.currentTarget.style.transform = "translateY(-2px)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = signal === "red" ? "#ef444440" : signal === "yellow" ? "#eab30830" : "#334155"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {signal === "red" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #ef4444, transparent)" }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{data.sub}</div>
          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{data.name}</div>
        </div>
        <SignalDot signal={signal} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", fontFamily: "'JetBrains Mono', monospace", letterSpacing: -1 }}>
          {data.unit === "$" ? "$" : ""}{typeof data.value === "number" && data.value >= 1000 ? data.value.toLocaleString() : data.value}
        </span>
        {data.unit && data.unit !== "$" && (
          <span style={{ fontSize: 13, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>{data.unit}</span>
        )}
      </div>
      <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: isUp ? (signal === "green" || data.invertColor ? "#22c55e" : "#ef4444") : (signal === "green" || data.invertColor ? "#ef4444" : "#22c55e") }}>
        {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(change > 100 ? 0 : 2)} ({Math.abs(pct).toFixed(1)}%)
      </div>
      {data.threshold && (
        <div style={{ marginTop: 10, height: 4, background: "#0f172a", borderRadius: 2, overflow: "hidden", position: "relative" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 2,
            width: `${Math.min(100, Math.max(5, data.invertColor 
              ? ((data.threshold.green - data.value) / (data.threshold.green - data.threshold.red)) * 100
              : (data.value / (data.threshold.red * 1.3)) * 100))}%`,
            background: `linear-gradient(90deg, ${colors[signal]}90, ${colors[signal]})`,
            transition: "width 0.5s ease",
          }} />
        </div>
      )}
    </div>
  );
}

// ── Index Card (for major indices) ──
function IndexCard({ data }) {
  const change = getChange(data);
  const pct = getChangePct(data);
  const isDown = change < 0;
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f172a, #1e293b)", border: "1px solid #334155",
      borderRadius: 12, padding: "14px 18px", flex: 1, minWidth: 180,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>{data.sub}</div>
      <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600, marginBottom: 6 }}>{data.name}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc", fontFamily: "'JetBrains Mono', monospace" }}>{data.value.toLocaleString()}</div>
      <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: isDown ? "#ef4444" : "#22c55e", marginTop: 4 }}>
        {isDown ? "▼" : "▲"} {Math.abs(change).toFixed(0)} ({Math.abs(pct).toFixed(2)}%)
      </div>
    </div>
  );
}

// ── Liquidity Alert Panel ──
function LiquidityAlert({ combos, data }) {
  const active = combos.filter(c => {
    return c.keys.every(k => getSignal(data[k]) === "red" || getSignal(data[k]) === "yellow");
  });

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f172a 0%, #1a0a0a 100%)",
      border: "1px solid #7f1d1d40", borderRadius: 12, padding: 18,
    }}>
      <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>⚡</span> 流動性組合警示
      </div>
      {combos.map((c, i) => {
        const isActive = c.keys.every(k => getSignal(data[k]) === "red" || getSignal(data[k]) === "yellow");
        const levelColor = c.level === "最高" ? "#ef4444" : c.level === "很高" ? "#f97316" : "#eab308";
        return (
          <div key={i} style={{
            padding: "10px 12px", marginBottom: 8, borderRadius: 8,
            background: isActive ? `${levelColor}10` : "#0f172a",
            border: `1px solid ${isActive ? `${levelColor}40` : "#1e293b"}`,
            opacity: isActive ? 1 : 0.45,
            transition: "all 0.3s ease",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: isActive ? "#f8fafc" : "#64748b", fontWeight: 600 }}>{c.label}</span>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
                background: isActive ? `${levelColor}20` : "transparent",
                color: isActive ? levelColor : "#475569",
                border: `1px solid ${isActive ? levelColor : "#334155"}`,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {isActive ? "🔴 觸發" : "○ 未觸發"} ・ {c.level}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.meaning}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Bottom Checklist ──
function BottomChecklist({ data }) {
  const checks = [
    { label: "巴菲特指標回落至合理區間", met: data.buffett.value < 160, current: `${data.buffett.value}%`, target: "< 160%" },
    { label: "CAPE 回落至 20-25x", met: data.cape.value <= 25, current: `${data.cape.value}x`, target: "20-25x" },
    { label: "VIX 噴出後底背離", met: false, current: `${data.vix.value}`, target: "> 40 後回落" },
    { label: "恐懼與貪婪指數極度恐懼", met: data.fearGreed.value <= 15, current: `${data.fearGreed.value}`, target: "≤ 15" },
    { label: "Put/Call Ratio 極端悲觀", met: data.putCall.value >= 1.5, current: `${data.putCall.value}`, target: "≥ 1.5" },
    { label: "巨量換手 + 縮量止跌", met: false, current: "觀察中", target: "放量後縮量" },
    { label: "高收益債利差見頂回落", met: false, current: `${data.hySpread.value} bps`, target: "見頂後收窄" },
    { label: "VIX 快速回落確認被動賣壓結束", met: false, current: `${data.vix.value}`, target: "< 25" },
  ];

  const metCount = checks.filter(c => c.met).length;

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f172a 0%, #0a1628 100%)",
      border: "1px solid #334155", borderRadius: 12, padding: 18,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🎯</span> 市場底部量化驗證清單
        </div>
        <span style={{
          fontSize: 12, padding: "3px 10px", borderRadius: 20, fontFamily: "'JetBrains Mono', monospace",
          background: metCount >= 6 ? "#22c55e20" : metCount >= 3 ? "#eab30820" : "#ef444420",
          color: metCount >= 6 ? "#22c55e" : metCount >= 3 ? "#eab308" : "#ef4444",
          fontWeight: 700,
        }}>
          {metCount} / {checks.length} 達標
        </span>
      </div>
      {checks.map((c, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 4,
          borderRadius: 6, background: c.met ? "#22c55e08" : "transparent",
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
            background: c.met ? "#22c55e20" : "#1e293b", border: `1px solid ${c.met ? "#22c55e50" : "#334155"}`,
            fontSize: 12, color: c.met ? "#22c55e" : "#475569",
          }}>
            {c.met ? "✓" : ""}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: c.met ? "#e2e8f0" : "#94a3b8" }}>{c.label}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: c.met ? "#22c55e" : "#64748b" }}>{c.current}</div>
            <div style={{ fontSize: 10, color: "#475569" }}>{c.target}</div>
          </div>
        </div>
      ))}
    </div>
  );
}


// ── Main Dashboard ──
export default function Dashboard() {
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tabs = [
    { id: "overview", label: "總覽", icon: "◎" },
    { id: "valuation", label: "估值 & 情緒", icon: "📊" },
    { id: "liquidity", label: "流動性", icon: "💧" },
    { id: "rates", label: "利率 & 信用", icon: "📈" },
    { id: "commodities", label: "避險 & 商品", icon: "🛡" },
    { id: "checklist", label: "底部清單", icon: "🎯" },
  ];

  const overallSignals = Object.entries(MOCK).filter(([k, v]) => v.threshold).map(([k, v]) => getSignal(v));
  const redCount = overallSignals.filter(s => s === "red").length;
  const yellowCount = overallSignals.filter(s => s === "yellow").length;
  const greenCount = overallSignals.filter(s => s === "green").length;
  const totalAlerts = redCount + yellowCount;
  const overallLevel = redCount >= 6 ? "DEFCON 1" : redCount >= 4 ? "DEFCON 2" : redCount >= 2 ? "DEFCON 3" : "NORMAL";
  const overallColor = redCount >= 6 ? "#ef4444" : redCount >= 4 ? "#f97316" : redCount >= 2 ? "#eab308" : "#22c55e";

  const sectionMap = {
    valuation: ["buffett", "cape", "vix", "fearGreed", "putCall"],
    liquidity: ["sofr_iorb", "onrrp", "tga", "srf"],
    rates: ["us10y", "us2y", "spread2s10s", "breakeven", "move", "hySpread", "bloomberg"],
    commodities: ["gold", "wti", "brent", "dxy"],
  };

  const renderCards = (keys) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
      {keys.map(k => <MetricCard key={k} id={k} data={MOCK[k]} />)}
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#020617", color: "#e2e8f0",
      fontFamily: "'Noto Sans TC', 'SF Pro Display', -apple-system, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Noto+Sans+TC:wght@400;500;600;700&display=swap');
        @keyframes pulse-red { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
        borderBottom: "1px solid #1e293b", padding: "16px 24px",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `linear-gradient(135deg, ${overallColor}30, ${overallColor}10)`,
              border: `1px solid ${overallColor}50`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>
              {redCount >= 4 ? "🔴" : redCount >= 2 ? "🟡" : "🟢"}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", letterSpacing: -0.5 }}>
                美股戰情儀表板
              </div>
              <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                US MARKET WAR ROOM ・ SIMULATED DATA
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: overallColor,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: 2,
              }}>
                {overallLevel}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                🔴 {redCount} ・ 🟡 {yellowCount} ・ 🟢 {greenCount}
              </div>
            </div>
            <div style={{
              fontSize: 12, color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace",
              background: "#0f172a", padding: "6px 12px", borderRadius: 8, border: "1px solid #1e293b",
            }}>
              {now.toLocaleTimeString("zh-TW", { hour12: false })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        background: "#0f172a80", borderBottom: "1px solid #1e293b",
        padding: "0 24px", position: "sticky", top: 73, zIndex: 99,
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", gap: 4, maxWidth: 1400, margin: "0 auto", overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: activeTab === t.id ? "#1e293b" : "transparent",
              border: "none", borderBottom: activeTab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
              color: activeTab === t.id ? "#f8fafc" : "#64748b",
              padding: "12px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "'Noto Sans TC', sans-serif", whiteSpace: "nowrap",
              transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 6,
              borderRadius: "8px 8px 0 0",
            }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px" }}>

        {/* Overview */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Major Indices */}
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                主要指數
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <IndexCard data={MOCK.sp500} />
                <IndexCard data={MOCK.nasdaq} />
                <IndexCard data={MOCK.dow} />
              </div>
            </div>

            {/* VIX vs S&P Sparkline */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", border: "1px solid #334155", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>VIX 走勢 (20日)</div>
                <Spark data={HISTORY_VIX} color="#ef4444" width={300} height={40} />
              </div>
              <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", border: "1px solid #334155", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>S&P 500 走勢 (20日)</div>
                <Spark data={HISTORY_SP} color="#3b82f6" width={300} height={40} />
              </div>
            </div>

            {/* Key Danger Indicators */}
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                關鍵風險指標
              </div>
              {renderCards(["vix", "fearGreed", "hySpread", "us10y", "sofr_iorb", "bloomberg"])}
            </div>

            {/* Bottom Checklist Summary */}
            <BottomChecklist data={MOCK} />
          </div>
        )}

        {/* Valuation & Sentiment */}
        {activeTab === "valuation" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              估值與基本面 + 恐慌情緒與波動率
            </div>
            {renderCards(sectionMap.valuation)}
            <div style={{
              background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 18,
            }}>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
                <strong style={{ color: "#e2e8f0" }}>判讀邏輯：</strong>巴菲特指標達 220% 為歷史極端高估。CAPE 需回落至 20-25x 才進入合理區間。VIX 需噴出 40+ 後出現底背離（股市新低但 VIX 未新高）。恐懼與貪婪指數需深跌至 10-15 極度恐懼。Put/Call Ratio 需連續數日飆至 1.5+ 代表極端悲觀。
              </div>
            </div>
          </div>
        )}

        {/* Liquidity */}
        {activeTab === "liquidity" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              市場資金流動性監控
            </div>
            {renderCards(sectionMap.liquidity)}
            <LiquidityAlert combos={LIQUIDITY_COMBOS} data={MOCK} />
            <div style={{
              background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 18,
            }}>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
                <strong style={{ color: "#e2e8f0" }}>核心邏輯：</strong>QT = Fed 不把到期資金放回市場 ・ ON RRP 下降 = 緩衝墊變薄 ・ TGA 上升 = 財政部抽走市場資金 ・ SRF 飆升 = 市場借貸功能開始卡住。三者同時朝「抽水方向」走，流動性壓力最大。
              </div>
            </div>
          </div>
        )}

        {/* Rates & Credit */}
        {activeTab === "rates" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              利率・殖利率曲線・信用狀況
            </div>
            {renderCards(sectionMap.rates)}
            <div style={{
              background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 18,
            }}>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
                <strong style={{ color: "#e2e8f0" }}>判讀邏輯：</strong>10Y 殖利率突破 4.5% 為關鍵壓力位。2Y-10Y 利差結束倒掛轉正，歷史上常伴隨衰退降臨。MOVE Index 超過 120 代表債市恐慌。高收益債利差擴大至 500+ bps 代表信用市場進入危機模式。彭博 FCI 持續負值代表金融狀況偏緊。
              </div>
            </div>
          </div>
        )}

        {/* Commodities & Safe Haven */}
        {activeTab === "commodities" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              避險資產・商品・匯率
            </div>
            {renderCards(sectionMap.commodities)}
            <div style={{
              background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 18,
            }}>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
                <strong style={{ color: "#e2e8f0" }}>判讀邏輯：</strong>黃金突破 $5,000 反映地緣風險溢價永久化與法幣信用貶值交易。WTI 現金期貨接近 $100、布蘭特突破 $100 為停滯性通膨關鍵門檻，WTI-Brent 價差可觀察全球供需結構。DXY 走強壓縮跨國企業利潤。關注「低增長、高通膨、強美元」三殺組合。
              </div>
            </div>
          </div>
        )}

        {/* Checklist */}
        {activeTab === "checklist" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <BottomChecklist data={MOCK} />
            <div style={{
              background: "linear-gradient(135deg, #0f172a, #1a1a0a)",
              border: "1px solid #854d0e40", borderRadius: 12, padding: 18,
            }}>
              <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚠️</span> 三條生存原則
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { rule: "RULE 01", text: "不要急著進場，活到趨勢確立", en: "Don't catch falling knives during systemic deleveraging." },
                  { rule: "RULE 02", text: "擁抱實體短缺，遠離紙上富貴", en: "Focus on physical shortages: AI infrastructure, precious metals, constrained commodities." },
                  { rule: "RULE 03", text: "現金不是錯失機會，而是擁有選擇權", en: "In a liquidity crisis, cash preserves optionality." },
                ].map((r, i) => (
                  <div key={i} style={{
                    background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "12px 16px",
                  }}>
                    <div style={{ fontSize: 11, color: "#eab308", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, marginBottom: 4 }}>{r.rule}</div>
                    <div style={{ fontSize: 14, color: "#f8fafc", fontWeight: 600, marginBottom: 2 }}>{r.text}</div>
                    <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>{r.en}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px 0", borderTop: "1px solid #1e293b", marginTop: 20 }}>
        <div style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>
          ⚠ 模擬數據 ・ 僅供架構展示 ・ 非投資建議 ・ 資料來源：大叔美股筆記
        </div>
      </div>
    </div>
  );
}
