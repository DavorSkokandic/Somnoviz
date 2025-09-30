import React, { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Activity, Minus, Plus, ChevronDown, ChevronUp } from 'lucide-react';

type ChannelStats = {
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
  total_samples?: number;
  sample_rate?: number;
};

type ChannelStatsDisplayProps = {
  channelStats: Record<string, ChannelStats>;
  isLoading?: boolean;
  mode?: 'single' | 'multi';
  selectedChannel?: string | null;
  selectedChannels?: string[];
};

const ChannelStatsDisplay: React.FC<ChannelStatsDisplayProps> = ({ 
  channelStats, 
  isLoading = false, 
  mode = 'multi',
  selectedChannel = null,
  selectedChannels = []
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm animate-pulse"></div>
            <div>
              <div className="h-5 bg-slate-200 rounded animate-pulse mb-2"></div>
              <div className="h-4 bg-slate-200 rounded animate-pulse w-32"></div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-slate-100">
                <div className="h-4 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="h-8 bg-slate-200 rounded animate-pulse mb-1"></div>
                <div className="h-3 bg-slate-200 rounded animate-pulse w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!channelStats || Object.keys(channelStats).length === 0) {
    // Show helpful message based on mode
    if (mode === 'single' && selectedChannel) {
      return (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-amber-800 mb-2">Statistics Loading</h3>
          <p className="text-amber-700 mb-4">Calculating statistics for <strong>{selectedChannel}</strong>...</p>
          <div className="text-sm text-amber-600">
            This may take a moment for large files as we analyze the complete dataset.
          </div>
        </div>
      );
    } else if (mode === 'multi' && selectedChannels.length > 0) {
      return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Multi-Channel Statistics Loading</h3>
          <p className="text-blue-700 mb-4">Calculating statistics for <strong>{selectedChannels.length}</strong> channels...</p>
          <div className="text-sm text-blue-600">
            Analyzing complete datasets for accurate statistical analysis.
          </div>
        </div>
      );
    }
    
    return null;
  }

  const formatValue = (value: number | undefined | null): string => {
    // Handle undefined/null values
    if (value === undefined || value === null || isNaN(value)) {
      return 'N/A';
    }
    
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
      {/* Collapsible Header */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-4 shadow-sm">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-slate-100 rounded-lg p-2 -m-2 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${mode === 'single' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
            <div>
              <span className="text-sm font-medium text-slate-600">
                {mode === 'single' ? 'Single Channel Analysis' : 'Multi-Channel Analysis'}
              </span>
              <div className="text-xs text-slate-500">
                {Object.keys(channelStats).length} channel{Object.keys(channelStats).length !== 1 ? 's' : ''} analyzed
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Click to {isExpanded ? 'collapse' : 'expand'}</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="space-y-4">
      
      {Object.entries(channelStats).map(([channel, stats]) => {
        // Safety check: ensure stats object has all required properties
        if (!stats || typeof stats !== 'object') {
          return null;
        }
        
        return (
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-slate-500">
              <div>
                <span className="font-medium text-slate-600">Signal Range:</span>
                <br />
                <span className="text-slate-800 font-mono">{formatValue(stats.max - stats.min)}</span>
              </div>
              <div>
                <span className="font-medium text-slate-600">Coefficient of Variation:</span>
                <br />
                <span className="text-slate-800 font-mono">
                  {stats.mean !== 0 ? formatValue((stats.stddev / Math.abs(stats.mean)) * 100) : '0.00'}%
                </span>
              </div>
              {stats.total_samples && (
                <div>
                  <span className="font-medium text-slate-600">Total Samples:</span>
                  <br />
                  <span className="text-slate-800 font-mono">{stats.total_samples.toLocaleString()}</span>
                </div>
              )}
              {stats.sample_rate && (
                <div>
                  <span className="font-medium text-slate-600">Sample Rate:</span>
                  <br />
                  <span className="text-slate-800 font-mono">{stats.sample_rate.toFixed(1)} Hz</span>
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })}
        </div>
      )}
    </div>
  );
};

export default ChannelStatsDisplay;