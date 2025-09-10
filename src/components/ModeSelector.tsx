import React, { useState } from 'react';
import { 
  BarChart3, 
  Activity, 
  Settings,
  Stethoscope,
  Loader2,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  TrendingDown,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import AHIHistogram from './AHIHistogram';
import { calculateRecommendedBins } from '../utils/histogramUtils';

// AHI Types (matching EDFUpload.tsx)
type AHIEvent = {
  type: 'apnea' | 'hypopnea';
  start_time: number;
  end_time: number;
  duration: number;
  severity: string;
  spo2_drop?: number;
};

type AHIResults = {
  ahi_analysis: {
    ahi_score: number;
    severity: string;
    severity_color: string;
    total_events: number;
    apnea_count: number;
    hypopnea_count: number;
    recording_duration_hours: number;
    total_event_duration_minutes: number;
    event_percentage: number;
    avg_apnea_duration: number;
    avg_hypopnea_duration: number;
    events_per_hour_breakdown: {
      apnea_per_hour: number;
      hypopnea_per_hour: number;
    };
  };
  apnea_events: AHIEvent[];
  hypopnea_events: AHIEvent[];
  all_events: AHIEvent[];
};

type ModeSelectorProps = {
  fileInfo: {
    channels: string[];
    startTime: string;
  };
  // Current mode states
  multiChannelMode: boolean;
  ahiMode: boolean;
  selectedChannel: string | null;
  selectedChannels: string[];
  // AHI specific states
  ahiFlowChannel: string;
  ahiSpo2Channel: string;
  ahiResults: AHIResults | null;
  ahiAnalyzing: boolean;
  showEventOverlays: boolean;
  // Handlers
  handleModeSwitch: (mode: 'single' | 'multi' | 'ahi') => void;
  setSelectedChannel: (channel: string) => void;
  handleChannelSelect: (channel: string) => void;
  setAhiFlowChannel: (channel: string) => void;
  setAhiSpo2Channel: (channel: string) => void;
  handleAHIAnalysis: () => void;
  setShowEventOverlays: (show: boolean) => void;
  navigateToEvent: (direction: 'next' | 'prev' | 'first' | 'last') => void;
  currentEventIndex: number;
};

const ModeSelector: React.FC<ModeSelectorProps> = ({
  fileInfo,
  multiChannelMode,
  ahiMode,
  selectedChannel,
  selectedChannels,
  ahiFlowChannel,
  ahiSpo2Channel,
  ahiResults,
  ahiAnalyzing,
  showEventOverlays,
  handleModeSwitch,
  setSelectedChannel,
  handleChannelSelect,
  setAhiFlowChannel,
  setAhiSpo2Channel,
  handleAHIAnalysis,
  setShowEventOverlays,
  navigateToEvent,
  currentEventIndex,
}) => {
  // Helper function to convert seconds offset to actual EDF file timestamp (HH:MM:SS)
  const formatEDFTimestamp = (secondsFromStart: number): string => {
    if (!fileInfo?.startTime) return '00:00:00';
    
    try {
      // Parse the EDF start time and add the offset seconds
      const startTime = new Date(fileInfo.startTime);
      const actualTime = new Date(startTime.getTime() + (secondsFromStart * 1000));
      
      // Format as HH:MM:SS
      const hours = actualTime.getHours().toString().padStart(2, '0');
      const minutes = actualTime.getMinutes().toString().padStart(2, '0');
      const seconds = actualTime.getSeconds().toString().padStart(2, '0');
      
      return `${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('[ERROR] Failed to format EDF timestamp:', error);
      return '00:00:00';
    }
  };

  const currentMode = ahiMode ? 'ahi' : multiChannelMode ? 'multi' : 'single';
  
  // Histogram controls state
  const [showHistogram, setShowHistogram] = useState(false);
  const [histogramBins, setHistogramBins] = useState(8);
  const [separateEventTypes, setSeparateEventTypes] = useState(true);

  const hasRequiredAHIChannels = () => {
    return ahiFlowChannel && ahiSpo2Channel;
  };
  
  // Calculate recommended bins when AHI results change
  const recommendedBins = ahiResults ? calculateRecommendedBins(ahiResults.all_events.length) : 8;

  return (
    <div className="space-y-6">
      {/* Mode Selection Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => handleModeSwitch('single')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            currentMode === 'single'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Single Channel</span>
        </button>
        <button
          onClick={() => handleModeSwitch('multi')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            currentMode === 'multi'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Multi Channel</span>
        </button>
        <button
          onClick={() => handleModeSwitch('ahi')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
            currentMode === 'ahi'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>AHI Analysis</span>
        </button>
      </div>

      {/* Single Channel Mode */}
      {currentMode === 'single' && (
        <div>
          <h3 className="text-lg font-medium mb-3">Select Channel:</h3>
          <select
            value={selectedChannel || ''}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a channel...</option>
            {fileInfo.channels.map((channel, index) => (
              <option key={`${channel}-${index}`} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Multi-Channel Mode */}
      {currentMode === 'multi' && (
        <div>
          <h3 className="text-lg font-medium mb-3">Select Channels (max 5):</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {fileInfo.channels.map((channel, index) => (
              <label
                key={`${channel}-${index}`}
                className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  checked={selectedChannels.includes(channel)}
                  onChange={() => handleChannelSelect(channel)}
                  disabled={selectedChannels.length >= 5 && !selectedChannels.includes(channel)}
                />
                <span className="text-sm text-gray-700">{channel}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500">{selectedChannels.length}/5 channels selected</p>
        </div>
      )}

      {/* AHI Analysis Mode */}
      {currentMode === 'ahi' && (
        <div className="space-y-6">
          {/* Grafana-style AHI Configuration Panel */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                    <Stethoscope className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Sleep Apnea Analysis (AHI)</h3>
                    <p className="text-sm text-slate-500">
                      Apnea-Hypopnea Index calculation and event detection
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-red-600 font-medium">Medical Analysis</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-700 font-medium mb-1">Clinical Requirements</p>
                    <p className="text-sm text-red-600">
                      Requires both Flow (airflow) and SpO2 (oxygen saturation) channels for accurate analysis.
                    </p>
                  </div>
                </div>
              </div>

              {/* Professional Channel Selection */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                      Flow Channel (Airflow)
                    </label>
                    <select
                      value={ahiFlowChannel}
                      onChange={(e) => setAhiFlowChannel(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                    >
                      <option value="">Select Flow channel...</option>
                      {fileInfo.channels.map((channel, index) => (
                        <option key={`flow-${channel}-${index}`} value={channel}>
                          {channel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                      SpO2 Channel (Oxygen Saturation)
                    </label>
                    <select
                      value={ahiSpo2Channel}
                      onChange={(e) => setAhiSpo2Channel(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                    >
                      <option value="">Select SpO2 channel...</option>
                      {fileInfo.channels.map((channel, index) => (
                        <option key={`spo2-${channel}-${index}`} value={channel}>
                          {channel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Professional Analysis Button */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <div className="flex items-center space-x-2">
                    {hasRequiredAHIChannels() ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">Ready for Analysis</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm text-amber-600 font-medium">Select Both Channels</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleAHIAnalysis}
                    disabled={!hasRequiredAHIChannels() || ahiAnalyzing}
                    className={`px-6 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
                      hasRequiredAHIChannels() && !ahiAnalyzing
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-sm'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {ahiAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Stethoscope className="w-4 h-4" />
                        <span>Start Analysis</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grafana-style AHI Results Panel */}
          {ahiResults && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">AHI Analysis Results</h4>
                      <p className="text-sm text-slate-500">Sleep apnea severity assessment and event summary</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600 font-medium">Analysis Complete</span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {/* Professional AHI Score Display */}
                <div className="mb-6">
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-6 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center justify-center space-x-8 flex-1">
                        <div className="text-center">
                          <div
                            className="text-4xl font-bold mb-2"
                            style={{ color: '#363e5d' }}
                          >
                            {ahiResults.ahi_analysis.ahi_score}
                          </div>
                          <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">AHI Score</div>
                          <div className="text-xs text-slate-500">Events/Hour</div>
                        </div>
                        <div className="w-px h-16 bg-slate-300"></div>
                        <div className="text-center">
                          <div
                            className="text-xl font-semibold mb-2"
                            style={{ color: '#363e5d' }}
                          >
                            {ahiResults.ahi_analysis.severity}
                          </div>
                          <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">Severity Level</div>
                          <div className="text-xs text-slate-500">Clinical Assessment</div>
                        </div>
                      </div>
                      
                      {/* Vertical Severity Scale Legend - Right Aligned */}
                      <div className="flex flex-col items-start space-y-1 ml-8">
                        <div className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">Severity Scale</div>
                        
                        {/* Severe (30+) */}
                        <div className="flex items-center space-x-2">
                          <div 
                            className={`w-3 h-6 rounded-sm border ${
                              ahiResults.ahi_analysis.ahi_score >= 30 
                                ? 'bg-red-500 border-red-600' 
                                : 'bg-red-100 border-red-200'
                            }`}
                          ></div>
                          <div className="text-xs text-slate-600 min-w-0">
                            <div className="font-medium">Severe</div>
                            <div className="text-slate-500">30+</div>
                          </div>
                        </div>
                        
                        {/* Moderate (15-29) */}
                        <div className="flex items-center space-x-2">
                          <div 
                            className={`w-3 h-6 rounded-sm border ${
                              ahiResults.ahi_analysis.ahi_score >= 15 && ahiResults.ahi_analysis.ahi_score < 30
                                ? 'bg-orange-500 border-orange-600' 
                                : 'bg-orange-100 border-orange-200'
                            }`}
                          ></div>
                          <div className="text-xs text-slate-600 min-w-0">
                            <div className="font-medium">Moderate</div>
                            <div className="text-slate-500">15-29</div>
                          </div>
                        </div>
                        
                        {/* Mild (5-14) */}
                        <div className="flex items-center space-x-2">
                          <div 
                            className={`w-3 h-6 rounded-sm border ${
                              ahiResults.ahi_analysis.ahi_score >= 5 && ahiResults.ahi_analysis.ahi_score < 15
                                ? 'bg-yellow-500 border-yellow-600' 
                                : 'bg-yellow-100 border-yellow-200'
                            }`}
                          ></div>
                          <div className="text-xs text-slate-600 min-w-0">
                            <div className="font-medium">Mild</div>
                            <div className="text-slate-500">5-14</div>
                          </div>
                        </div>
                        
                        {/* Normal (0-4) */}
                        <div className="flex items-center space-x-2">
                          <div 
                            className={`w-3 h-6 rounded-sm border ${
                              ahiResults.ahi_analysis.ahi_score < 5
                                ? 'bg-green-500 border-green-600' 
                                : 'bg-green-100 border-green-200'
                            }`}
                          ></div>
                          <div className="text-xs text-slate-600 min-w-0">
                            <div className="font-medium">Normal</div>
                            <div className="text-slate-500">0-4</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Professional Event Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span className="text-xs font-medium text-red-600 uppercase tracking-wide">Apnea</span>
                    </div>
                    <div className="text-2xl font-bold text-red-700">{ahiResults.ahi_analysis.apnea_count}</div>
                    <div className="text-xs text-red-600">Complete Obstruction</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <TrendingDown className="w-5 h-5 text-orange-600" />
                      <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">Hypopnea</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-700">{ahiResults.ahi_analysis.hypopnea_count}</div>
                    <div className="text-xs text-orange-600">Partial Obstruction</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Total</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-700">{ahiResults.ahi_analysis.total_events}</div>
                    <div className="text-xs text-blue-600">All Events</div>
                  </div>
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Activity className="w-5 h-5 text-slate-600" />
                      <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Duration</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-700">
                      {ahiResults.ahi_analysis.recording_duration_hours}h
                    </div>
                    <div className="text-xs text-slate-600">Recording Time</div>
                  </div>
                </div>

                {/* Professional Event Timeline Toggle */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {showEventOverlays ? (
                        <Eye className="w-4 h-4 text-blue-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <span className="text-sm font-medium text-slate-900">Event Timeline Track</span>
                        <p className="text-xs text-slate-500">Display events on the visualization chart</p>
                      </div>
                    </div>
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={showEventOverlays}
                          onChange={(e) => setShowEventOverlays(e.target.checked)}
                        />
                        <div
                          className={`block w-12 h-6 rounded-full transition-colors ${
                            showEventOverlays ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        ></div>
                        <div
                          className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                            showEventOverlays ? 'transform translate-x-6' : ''
                          }`}
                        ></div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Professional Event Navigation Panel */}
                {ahiResults.all_events.length > 0 && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <div>
                          <h5 className="text-sm font-semibold text-blue-900">Event Navigation</h5>
                          <p className="text-xs text-blue-600">Navigate through detected sleep events</p>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-blue-700 bg-white px-3 py-1 rounded-full">
                        {currentEventIndex + 1} of {ahiResults.all_events.length}
                      </div>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => navigateToEvent('first')}
                        disabled={currentEventIndex === 0}
                        className="p-2 bg-white border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                        title="First Event"
                      >
                        <ChevronFirst className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigateToEvent('prev')}
                        disabled={currentEventIndex === 0}
                        className="p-2 bg-white border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                        title="Previous Event"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigateToEvent('next')}
                        disabled={currentEventIndex === ahiResults.all_events.length - 1}
                        className="p-2 bg-white border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                        title="Next Event"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigateToEvent('last')}
                        disabled={currentEventIndex === ahiResults.all_events.length - 1}
                        className="p-2 bg-white border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                        title="Last Event"
                      >
                        <ChevronLast className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Professional Current Event Info */}
                    {ahiResults.all_events[currentEventIndex] && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                ahiResults.all_events[currentEventIndex].type === 'apnea'
                                  ? 'bg-red-500'
                                  : 'bg-orange-500'
                              }`}
                            ></div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                                ahiResults.all_events[currentEventIndex].type === 'apnea'
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : 'bg-orange-100 text-orange-700 border border-orange-200'
                              }`}
                            >
                              {ahiResults.all_events[currentEventIndex].type}
                            </span>
                            <span className="text-sm text-slate-600 font-medium">
                              {ahiResults.all_events[currentEventIndex].severity} Severity
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {formatEDFTimestamp(ahiResults.all_events[currentEventIndex].start_time)} -{' '}
                            {formatEDFTimestamp(ahiResults.all_events[currentEventIndex].end_time)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Duration:</span>
                            <span className="font-semibold text-slate-900">
                              {ahiResults.all_events[currentEventIndex].duration.toFixed(1)}s
                            </span>
                          </div>
                          {ahiResults.all_events[currentEventIndex].spo2_drop && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">SpO2 Drop:</span>
                              <span className="font-semibold text-red-600">
                                {ahiResults.all_events[currentEventIndex].spo2_drop.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Grafana-style Histogram Panel */}
          {ahiResults && ahiResults.all_events.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">Event Duration Analysis</h4>
                      <p className="text-sm text-slate-500">Statistical distribution of apnea and hypopnea event durations</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {showHistogram ? (
                        <>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-purple-600 font-medium">Active</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                          <span className="text-xs text-slate-500 font-medium">Hidden</span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setShowHistogram(!showHistogram)}
                      className={`px-3 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
                        showHistogram
                          ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                      }`}
                    >
                      {showHistogram ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>Show</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {showHistogram && (
                <div className="p-6">
                  {/* Professional Histogram Controls */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <Settings className="w-4 h-4 text-slate-600" />
                      <h5 className="text-sm font-semibold text-slate-900">Analysis Parameters</h5>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Professional Bin Count Control */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                          Histogram Bins
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="3"
                            max="20"
                            value={histogramBins}
                            onChange={(e) => setHistogramBins(Math.max(3, Math.min(20, parseInt(e.target.value) || 8)))}
                            className="w-20 bg-white border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <button
                            onClick={() => setHistogramBins(recommendedBins)}
                            className="px-3 py-2 text-xs bg-purple-100 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-200 transition-colors"
                            title={`Recommended: ${recommendedBins} bins`}
                          >
                            Auto ({recommendedBins})
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">Optimal: {recommendedBins} bins (Sturges' Rule)</p>
                      </div>

                      {/* Professional Display Mode */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                          Display Mode
                        </label>
                        <select
                          value={separateEventTypes ? 'separate' : 'combined'}
                          onChange={(e) => setSeparateEventTypes(e.target.value === 'separate')}
                          className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="separate">Separate Apnea/Hypopnea</option>
                          <option value="combined">Combined Events</option>
                        </select>
                        <p className="text-xs text-slate-500">Visualization grouping method</p>
                      </div>

                      {/* Professional Statistics */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                          Event Statistics
                        </label>
                        <div className="bg-white border border-slate-200 rounded-md p-3 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Total Events:</span>
                            <span className="font-semibold text-slate-900">{ahiResults.all_events.length}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-red-600">Apnea:</span>
                            <span className="font-semibold text-red-700">{ahiResults.ahi_analysis.apnea_count}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-orange-600">Hypopnea:</span>
                            <span className="font-semibold text-orange-700">{ahiResults.ahi_analysis.hypopnea_count}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Professional Histogram Chart Container */}
                  <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                    <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-slate-300 font-medium">Duration Distribution</span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {separateEventTypes ? 'Separated' : 'Combined'} • {histogramBins} bins
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900">
                      <AHIHistogram
                        events={ahiResults.all_events}
                        binCount={histogramBins}
                        showSeparateTypes={separateEventTypes}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModeSelector;