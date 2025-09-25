import React from 'react';
import { TrendingUp, TrendingDown, BarChart3, Activity, Minus, Plus } from 'lucide-react';

type ChannelStats = {
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
};

type ChannelStatsDisplayProps = {
  channelStats: Record<string, ChannelStats>;
};

const ChannelStatsDisplay: React.FC<ChannelStatsDisplayProps> = ({ channelStats }) => {
  if (!channelStats || Object.keys(channelStats).length === 0) return null;

  const formatValue = (value: number): string => {
    // Format values with appropriate precision
    if (Math.abs(value) < 0.01) {
      return value.toExponential(2);
    } else if (Math.abs(value) < 1) {
      return value.toFixed(3);
    } else if (Math.abs(value) < 100) {
      return value.toFixed(2);
    } else {
      return value.toFixed(1);
    }
  };

  const getChannelIcon = (channel: string) => {
    const channelLower = channel.toLowerCase();
    if (channelLower.includes('flow') || channelLower.includes('airflow')) {
      return <Activity className="w-4 h-4" />;
    } else if (channelLower.includes('spo2') || channelLower.includes('oxygen')) {
      return <TrendingUp className="w-4 h-4" />;
    } else if (channelLower.includes('heart') || channelLower.includes('hr')) {
      return <Activity className="w-4 h-4" />;
    } else {
      return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getValueColor = (_value: number, type: 'mean' | 'min' | 'max' | 'stddev') => {
    switch (type) {
      case 'mean':
        return 'text-blue-600';
      case 'min':
        return 'text-red-600';
      case 'max':
        return 'text-green-600';
      case 'stddev':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(channelStats).map(([channel, stats]) => (
        <div key={channel} className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
          {/* Channel Header */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
              <div className="text-white">
                {getChannelIcon(channel)}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{channel}</h3>
              <p className="text-sm text-slate-500">Signal Statistics</p>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Mean Value */}
            <div className="bg-white rounded-lg p-4 border border-blue-100 hover:border-blue-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-slate-600">Mean</span>
              </div>
              <div className={`text-xl font-bold ${getValueColor(stats.mean, 'mean')}`}>
                {formatValue(stats.mean)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Average</div>
            </div>

            {/* Median Value */}
            <div className="bg-white rounded-lg p-4 border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Minus className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-600">Median</span>
              </div>
              <div className="text-xl font-bold text-slate-700">
                {formatValue(stats.median)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Middle Value</div>
            </div>

            {/* Min Value */}
            <div className="bg-white rounded-lg p-4 border border-red-100 hover:border-red-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-slate-600">Minimum</span>
              </div>
              <div className={`text-xl font-bold ${getValueColor(stats.min, 'min')}`}>
                {formatValue(stats.min)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Lowest Point</div>
            </div>

            {/* Max Value */}
            <div className="bg-white rounded-lg p-4 border border-green-100 hover:border-green-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-slate-600">Maximum</span>
              </div>
              <div className={`text-xl font-bold ${getValueColor(stats.max, 'max')}`}>
                {formatValue(stats.max)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Peak Value</div>
            </div>

            {/* Standard Deviation */}
            <div className="bg-white rounded-lg p-4 border border-purple-100 hover:border-purple-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-slate-600">Std Dev</span>
              </div>
              <div className={`text-xl font-bold ${getValueColor(stats.stddev, 'stddev')}`}>
                {formatValue(stats.stddev)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Variability</div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-4 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Signal Range: {formatValue(stats.max - stats.min)}</span>
              <span>CV: {stats.mean !== 0 ? formatValue((stats.stddev / Math.abs(stats.mean)) * 100) : '0.00'}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChannelStatsDisplay;