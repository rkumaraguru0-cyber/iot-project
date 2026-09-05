import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDeviceTelemetry } from '../../api/devices';
import {
  Activity,
  Cpu,
  HardDrive,
  Thermometer,
  Wifi,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

function getMetricVal(metrics, key, fallbackKey) {
  if (!metrics) return null;
  if (typeof metrics[key] === 'number') return metrics[key];
  if (fallbackKey && typeof metrics[fallbackKey] === 'number') return metrics[fallbackKey];
  return null;
}

/**
 * Helper to generate responsive SVG path from time-series points.
 */
function generateSvgPath(data, key, fallbackKey, minVal, maxVal, width = 300, height = 80) {
  if (!data || data.length < 2) return '';

  const values = data.map((d) => getMetricVal(d.metrics, key, fallbackKey) ?? 0);
  const actualMin = minVal !== undefined ? minVal : Math.min(...values);
  const actualMax = maxVal !== undefined ? maxVal : Math.max(...values);
  const range = actualMax - actualMin || 1;

  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const normalizedY = (val - actualMin) / range;
    const y = height - normalizedY * (height - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M ${points.join(' L ')}`;
}

/**
 * Metric Card with embedded SVG Sparkline Chart
 */
const MetricChartCard = ({ title, icon: Icon, unit, data, metricKey, fallbackKey, color = 'indigo', minBound, maxBound }) => {
  const values = (data || []).map((d) => getMetricVal(d.metrics, metricKey, fallbackKey)).filter((v) => typeof v === 'number');
  const latestValue = values.length > 0 ? values[values.length - 1] : null;
  const minValue = values.length > 0 ? Math.min(...values) : null;
  const maxValue = values.length > 0 ? Math.max(...values) : null;
  const avgValue = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : null;

  const svgPath = generateSvgPath(data, metricKey, fallbackKey, minBound, maxBound, 280, 60);

  const colorStyles = {
    indigo: {
      text: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      stroke: '#818cf8',
      fill: 'rgba(129, 140, 248, 0.1)'
    },
    emerald: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      stroke: '#34d399',
      fill: 'rgba(52, 211, 153, 0.1)'
    },
    amber: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      stroke: '#fbbf24',
      fill: 'rgba(251, 191, 36, 0.1)'
    },
    cyan: {
      text: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      stroke: '#22d3ee',
      fill: 'rgba(34, 211, 238, 0.1)'
    }
  }[color] || colorStyles.indigo;

  return (
    <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${colorStyles.bg} ${colorStyles.border} border ${colorStyles.text}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-300">{title}</span>
        </div>
        <div className="text-right">
          <span className="text-lg font-black text-white">
            {latestValue !== null ? latestValue : '—'}
          </span>
          <span className="text-[10px] text-slate-400 ml-1 font-medium">{unit}</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full h-16 relative flex items-center justify-center bg-slate-900/40 rounded-xl overflow-hidden px-2">
        {values.length >= 2 ? (
          <svg className="w-full h-full overflow-visible" viewBox="0 0 280 60" preserveAspectRatio="none">
            <path
              d={svgPath}
              fill="none"
              stroke={colorStyles.stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="text-[11px] text-slate-500 italic">Awaiting more data points...</span>
        )}
      </div>

      {/* Mini Stats Footer */}
      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/60 text-[10px] text-slate-400 font-mono">
        <div>
          <span className="text-slate-500 block">MIN</span>
          <span className="text-slate-300 font-semibold">{minValue !== null ? minValue : '—'}</span>
        </div>
        <div className="text-center">
          <span className="text-slate-500 block">AVG</span>
          <span className="text-slate-300 font-semibold">{avgValue !== null ? avgValue : '—'}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-500 block">MAX</span>
          <span className="text-slate-300 font-semibold">{maxValue !== null ? maxValue : '—'}</span>
        </div>
      </div>
    </div>
  );
};

export const TelemetryCharts = ({ deviceId }) => {
  const [limit, setLimit] = useState(50);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['device-telemetry', deviceId, limit],
    queryFn: () => getDeviceTelemetry(deviceId, { limit, sort: 'asc' }),
    enabled: Boolean(deviceId),
    refetchInterval: 10000 // Polling every 10 seconds
  });

  const telemetryList = data?.telemetry || [];

  if (isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Live Hardware Telemetry & Time-Series
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs">Loading telemetry series...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Failed to load telemetry: {error?.message || 'Server error'}
          </span>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-lg transition text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (telemetryList.length === 0) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Live Hardware Telemetry & Time-Series
          </h2>
          <button
            onClick={() => refetch()}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="p-8 bg-slate-950/40 border border-slate-800/60 border-dashed rounded-2xl text-center space-y-2">
          <Activity className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-xs font-bold text-slate-300">No Telemetry Received Yet</div>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
            This device has not yet transmitted telemetry. Start the Phase 5 simulator or publish via MQTT
            to begin receiving real-time hardware metrics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Live Hardware Telemetry & Time-Series
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingested via Aedes MQTT broker / REST fallback ({telemetryList.length} points plotted)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value={20}>Last 20 readings</option>
            <option value={50}>Last 50 readings</option>
            <option value={100}>Last 100 readings</option>
          </select>

          <button
            onClick={() => refetch()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center justify-center"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid of 4 Core Metric Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricChartCard
          title="CPU Utilization"
          icon={Cpu}
          unit="%"
          data={telemetryList}
          metricKey="cpu_usage"
          fallbackKey="cpu"
          color="indigo"
          minBound={0}
          maxBound={100}
        />

        <MetricChartCard
          title="Memory Consumption"
          icon={HardDrive}
          unit="%"
          data={telemetryList}
          metricKey="memory_usage"
          fallbackKey="memory"
          color="emerald"
          minBound={0}
          maxBound={100}
        />

        <MetricChartCard
          title="Operating Temperature"
          icon={Thermometer}
          unit="°C"
          data={telemetryList}
          metricKey="temperature"
          fallbackKey="temp"
          color="amber"
          minBound={0}
          maxBound={80}
        />

        <MetricChartCard
          title="Network Traffic (Outbound)"
          icon={Wifi}
          unit="B"
          data={telemetryList}
          metricKey="network_out"
          fallbackKey="network"
          color="cyan"
          minBound={0}
        />
      </div>
    </div>
  );
};

export default TelemetryCharts;
