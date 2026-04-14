import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_URL = "http://localhost:3000/data";
const STALE_DATA_MS = 10000;
const RANGE_OPTIONS = [
  { key: "1m", label: "1 Min", minutes: 1 },
  { key: "5m", label: "5 Min", minutes: 5 },
  { key: "15m", label: "15 Min", minutes: 15 },
  { key: "all", label: "All", minutes: null },
];

function getStressColor(stress, isDark) {
  const value = (stress || "").toLowerCase();
  if (value === "low") return isDark ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-700";
  if (value === "medium") return isDark ? "bg-yellow-900/50 text-yellow-300" : "bg-yellow-100 text-yellow-700";
  if (value === "high") return isDark ? "bg-red-900/50 text-red-300" : "bg-red-100 text-red-700";
  return isDark ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-700";
}

function formatTimeLabel(createdAt) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [failedPollCount, setFailedPollCount] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const [selectedRange, setSelectedRange] = useState("5m");

  useEffect(() => {
    const savedTheme = localStorage.getItem("iot-dashboard-theme");
    if (savedTheme === "dark") setIsDark(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("iot-dashboard-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    let timerId;

    const fetchData = async () => {
      try {
        const response = await axios.get(API_URL);
        const safeData = Array.isArray(response.data) ? response.data : [];
        setRecords(safeData);
        setError("");
        if (safeData[0]?.createdAt) {
          setLastUpdated(new Date(safeData[0].createdAt));
        }
        setFailedPollCount(0);
      } catch (fetchError) {
        setError("Unable to fetch data from backend.");
        setFailedPollCount((prev) => prev + 1);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    timerId = setInterval(fetchData, 2000);

    return () => clearInterval(timerId);
  }, []);

  const filteredRecords = useMemo(() => {
    const option = RANGE_OPTIONS.find((item) => item.key === selectedRange);
    if (!option || option.minutes === null) return records;

    const threshold = Date.now() - option.minutes * 60 * 1000;
    return records.filter((item) => new Date(item.createdAt).getTime() >= threshold);
  }, [records, selectedRange]);

  const latest = filteredRecords[0] || records[0];
  const previous = filteredRecords[1] || records[1];
  const latestRecordAgeMs = records[0]?.createdAt
    ? Date.now() - new Date(records[0].createdAt).getTime()
    : Infinity;
  const isDataStale = latestRecordAgeMs > STALE_DATA_MS;
  const connectionState =
    failedPollCount >= 3 || isDataStale
      ? "Offline"
      : failedPollCount > 0
      ? "Reconnecting"
      : "Connected";
  const connectionColor =
    connectionState === "Connected"
      ? "bg-emerald-500"
      : connectionState === "Reconnecting"
      ? "bg-amber-500"
      : "bg-rose-500";

  const chartData = useMemo(
    () =>
      [...filteredRecords]
        .reverse()
        .map((item) => ({
          time: formatTimeLabel(item.createdAt),
          heart_rate: item.heart_rate,
          temperature: item.temperature,
        })),
    [filteredRecords]
  );

  const heartTrend = previous ? latest.heart_rate - previous.heart_rate : 0;
  const tempTrend = previous ? latest.temperature - previous.temperature : 0;

  const trendText = (value, unit) =>
    value > 0 ? `+${value.toFixed(1)}${unit}` : `${value.toFixed(1)}${unit}`;

  const rootBg = isDark
    ? "bg-[radial-gradient(circle_at_top,_#0f172a_0%,_#111827_45%,_#020617_100%)]"
    : "bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#eff6ff_40%,_#f8fafc_70%,_#ffffff_100%)]";
  const textMain = isDark ? "text-slate-100" : "text-slate-800";
  const textSub = isDark ? "text-slate-300" : "text-slate-500";
  const panel = isDark ? "bg-slate-900/70 border-slate-700" : "bg-white/80 border-slate-200";
  const loadingPanel = isDark ? "text-slate-300" : "text-slate-500";

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div
        className={`rounded-xl border px-3 py-2 text-xs shadow-lg ${
          isDark ? "border-slate-700 bg-slate-900/95" : "border-slate-200 bg-white/95"
        }`}
      >
        <p className={`mb-1 font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
          {label}
        </p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className={`min-h-screen p-4 transition-colors duration-300 sm:p-6 lg:p-8 ${rootBg}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className={`glass rounded-3xl p-6 sm:p-8 ${isDark ? "border-slate-700 bg-slate-900/70" : ""}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className={`text-2xl font-bold sm:text-3xl ${textMain}`}>
                IoT Stress Monitoring Dashboard
              </h1>
              <p className={`mt-2 text-sm sm:text-base ${textSub}`}>
                Live sensor updates every 2 seconds
              </p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ${panel}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${connectionColor} status-dot`} />
                <span className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                  {connectionState}
                </span>
              </div>
              <p className={`mt-1 text-xs ${textSub}`}>
                Last update: {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                isDark
                  ? "border-slate-600 bg-slate-800 text-slate-100"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedRange(option.key)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  selectedRange === option.key
                    ? isDark
                      ? "border-blue-400 bg-blue-600/20 text-blue-200"
                      : "border-blue-300 bg-blue-50 text-blue-700"
                    : isDark
                    ? "border-slate-600 bg-slate-800 text-slate-300"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className={`glass rounded-3xl p-10 text-center ${loadingPanel}`}>
            Loading latest sensor data...
          </div>
        ) : error && records.length === 0 ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
            {error}
          </div>
        ) : records.length === 0 ? (
          <div className={`glass rounded-3xl p-10 text-center ${loadingPanel}`}>
            No data
          </div>
        ) : (
          <>
            {error || isDataStale ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow-sm">
                {isDataStale
                  ? "Sensor data stream paused. Showing last known data."
                  : "Connection issue detected. Showing last known data."}
              </div>
            ) : null}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className={`metric-card ${isDark ? "border-slate-700 bg-slate-900" : ""}`}>
                <p className={`text-sm font-medium ${textSub}`}>Heart Rate</p>
                <p className="mt-2 text-3xl font-bold text-red-500">
                  {latest.heart_rate} <span className="text-lg font-semibold">BPM</span>
                </p>
                <p className="mt-2 text-xs text-slate-400">Cardio signal from pulse sensor</p>
                <p className={`mt-2 text-xs font-semibold ${heartTrend >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {heartTrend >= 0 ? "▲" : "▼"} {trendText(heartTrend, " BPM")} vs previous
                </p>
              </div>

              <div className={`metric-card ${isDark ? "border-slate-700 bg-slate-900" : ""}`}>
                <p className={`text-sm font-medium ${textSub}`}>Temperature</p>
                <p className="mt-2 text-3xl font-bold text-blue-500">
                  {latest.temperature} <span className="text-lg font-semibold">°C</span>
                </p>
                <p className="mt-2 text-xs text-slate-400">Body temperature trend</p>
                <p className={`mt-2 text-xs font-semibold ${tempTrend >= 0 ? "text-orange-400" : "text-emerald-400"}`}>
                  {tempTrend >= 0 ? "▲" : "▼"} {trendText(tempTrend, " C")} vs previous
                </p>
              </div>

              <div className={`metric-card ${isDark ? "border-slate-700 bg-slate-900" : ""}`}>
                <p className={`text-sm font-medium ${textSub}`}>Stress Level</p>
                <span
                  className={`mt-3 inline-block rounded-full px-4 py-1 text-lg font-semibold capitalize ${getStressColor(latest.stress, isDark)}`}
                >
                  {latest.stress}
                </span>
                <p className="mt-2 text-xs text-slate-400">Derived stress classification</p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={`chart-card ${isDark ? "border-slate-700 bg-slate-900" : ""}`}>
                <h2 className={`mb-4 text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                  Heart Rate Over Time
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="heartFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.24} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                      <XAxis dataKey="time" tick={{ fontSize: 12, fill: isDark ? "#cbd5e1" : "#475569" }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 12, fill: isDark ? "#cbd5e1" : "#475569" }} />
                      <Tooltip content={customTooltip} />
                      <Area
                        type="monotone"
                        dataKey="heart_rate"
                        stroke="#ef4444"
                        fill="url(#heartFill)"
                        strokeWidth={2.5}
                        dot={false}
                        animationDuration={600}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`chart-card ${isDark ? "border-slate-700 bg-slate-900" : ""}`}>
                <h2 className={`mb-4 text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                  Temperature Over Time
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                      <XAxis dataKey="time" tick={{ fontSize: 12, fill: isDark ? "#cbd5e1" : "#475569" }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 12, fill: isDark ? "#cbd5e1" : "#475569" }} />
                      <Tooltip content={customTooltip} />
                      <Line
                        type="monotone"
                        dataKey="temperature"
                        name="temperature"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={false}
                        animationDuration={600}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
