import React, { useState } from 'react';
import { FaChartBar } from 'react-icons/fa';
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
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => handleModeSwitch('single')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            currentMode === 'single'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📊 Single Channel
        </button>
        <button
          onClick={() => handleModeSwitch('multi')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            currentMode === 'multi'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          📈 Multi-Channel
        </button>
        <button
          onClick={() => handleModeSwitch('ahi')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            currentMode === 'ahi'
              ? 'bg-white text-red-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          🫁 AHI Analysis
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
              <label key={`${channel}-${index}`} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
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
          <p className="mt-2 text-sm text-gray-500">
            {selectedChannels.length}/5 channels selected
          </p>
        </div>
      )}

      {/* AHI Analysis Mode */}
      {currentMode === 'ahi' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-red-800 mb-3">🫁 Sleep Apnea Analysis (AHI)</h3>
            <p className="text-sm text-red-700 mb-4">
              Analyze apnea and hypopnea events to calculate the Apnea-Hypopnea Index (AHI).
              Requires both Flow and SpO2 channels.
            </p>
            
            {/* Channel Selection for AHI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flow Channel (Airflow)
                </label>
                <select
                  value={ahiFlowChannel}
                  onChange={(e) => setAhiFlowChannel(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Select Flow channel...</option>
                  {fileInfo.channels.map((channel, index) => (
                    <option key={`flow-${channel}-${index}`} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SpO2 Channel (Oxygen Saturation)
                </label>
                <select
                  value={ahiSpo2Channel}
                  onChange={(e) => setAhiSpo2Channel(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
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

            {/* Analysis Button */}
            <div className="mt-4">
              <button
                onClick={handleAHIAnalysis}
                disabled={!hasRequiredAHIChannels() || ahiAnalyzing}
                className={`w-full md:w-auto px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                  hasRequiredAHIChannels() && !ahiAnalyzing
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {ahiAnalyzing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing Sleep Events...
                  </span>
                ) : (
                  '🫁 Analyze Sleep Events (AHI)'
                )}
              </button>
              
              {!hasRequiredAHIChannels() && (
                <p className="mt-2 text-sm text-red-600">
                  Please select both Flow and SpO2 channels to start analysis
                </p>
              )}
            </div>
          </div>

          {/* AHI Results Display */}
          {ahiResults && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h4 className="text-xl font-bold mb-4">📊 AHI Analysis Results</h4>
              
              {/* Main AHI Score */}
              <div className="mb-6 text-center">
                <div className="inline-flex items-center space-x-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <div className="text-3xl font-bold" style={{ color: ahiResults.ahi_analysis.severity_color }}>
                      {ahiResults.ahi_analysis.ahi_score}
                    </div>
                    <div className="text-sm text-gray-600">AHI Score</div>
                  </div>
                  <div>
                    <div className={`text-lg font-semibold`} style={{ color: ahiResults.ahi_analysis.severity_color }}>
                      {ahiResults.ahi_analysis.severity}
                    </div>
                    <div className="text-sm text-gray-600">Severity</div>
                  </div>
                </div>
              </div>

              {/* Event Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{ahiResults.ahi_analysis.apnea_count}</div>
                  <div className="text-sm text-gray-600">Apnea Events</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{ahiResults.ahi_analysis.hypopnea_count}</div>
                  <div className="text-sm text-gray-600">Hypopnea Events</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{ahiResults.ahi_analysis.total_events}</div>
                  <div className="text-sm text-gray-600">Total Events</div>
                </div>
                <div className="text-center p-3 bg-black-50 rounded-lg">
                  <div className="text-2xl font-bold text-white-600">{ahiResults.ahi_analysis.recording_duration_hours}h</div>
                  <div className="text-sm text-white-600">Recording Time</div>
                </div>
              </div>

              {/* Event Overlay Toggle */}
              <div className="flex items-center justify-between mt-4 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Show Event Timeline Track</span>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={showEventOverlays}
                      onChange={(e) => setShowEventOverlays(e.target.checked)}
                    />
                    <div className={`block w-14 h-8 rounded-full transition ${showEventOverlays ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${showEventOverlays ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>

              {/* Event Navigation Controls */}
              {ahiResults.all_events.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h5 className="text-lg font-semibold text-blue-800 mb-3">🔍 Navigate Events</h5>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-blue-700">
                      Event {currentEventIndex + 1} of {ahiResults.all_events.length}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigateToEvent('first')}
                        disabled={currentEventIndex === 0}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                      >
                        ⏮ First
                      </button>
                      <button
                        onClick={() => navigateToEvent('prev')}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        ◀ Prev
                      </button>
                      <button
                        onClick={() => navigateToEvent('next')}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Next ▶
                      </button>
                      <button
                        onClick={() => navigateToEvent('last')}
                        disabled={currentEventIndex === ahiResults.all_events.length - 1}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                      >
                        Last ⏭
                      </button>
                    </div>
                  </div>
                  {/* Current Event Info */}
                  {ahiResults.all_events[currentEventIndex] && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              ahiResults.all_events[currentEventIndex].type === 'apnea' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {ahiResults.all_events[currentEventIndex].type.toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-600">
                              Duration: {ahiResults.all_events[currentEventIndex].duration.toFixed(1)}s
                            </span>
                            <span className="text-sm text-gray-600">
                              Severity: {ahiResults.all_events[currentEventIndex].severity}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {Math.floor(ahiResults.all_events[currentEventIndex].start_time / 60)}:{
                              String(Math.floor(ahiResults.all_events[currentEventIndex].start_time % 60)).padStart(2, '0')
                            } - {Math.floor(ahiResults.all_events[currentEventIndex].end_time / 60)}:{
                              String(Math.floor(ahiResults.all_events[currentEventIndex].end_time % 60)).padStart(2, '0')
                            }
                          </div>
                        </div>
                        {ahiResults.all_events[currentEventIndex].spo2_drop && (
                          <div className="text-sm text-gray-600">
                            SpO2 Drop: {ahiResults.all_events[currentEventIndex].spo2_drop.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Event Duration Histogram */}
          {ahiResults && ahiResults.all_events.length > 0 && (
            <div className="mt-6">
              {/* Histogram Toggle and Controls */}
              <div className="flex items-center justify-between mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FaChartBar className="text-blue-600" />
                  <span className="text-lg font-semibold text-blue-800">Duration Analysis</span>
                </div>
                <button
                  onClick={() => setShowHistogram(!showHistogram)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    showHistogram
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {showHistogram ? 'Hide Histogram' : 'Show Histogram'}
                </button>
              </div>

              {showHistogram && (
                <div className="space-y-4">
                  {/* Histogram Controls */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3">Histogram Settings</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Bin Count Control */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number of Bins
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="3"
                            max="20"
                            value={histogramBins}
                            onChange={(e) => setHistogramBins(Math.max(3, Math.min(20, parseInt(e.target.value) || 8)))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => setHistogramBins(recommendedBins)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            title={`Recommended: ${recommendedBins} bins`}
                          >
                            Auto ({recommendedBins})
                          </button>
                        </div>
                      </div>

                      {/* Event Type Separation */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Display Mode
                        </label>
                        <select
                          value={separateEventTypes ? 'separate' : 'combined'}
                          onChange={(e) => setSeparateEventTypes(e.target.value === 'separate')}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="separate">Separate Apnea/Hypopnea</option>
                          <option value="combined">Combined Events</option>
                        </select>
                      </div>

                      {/* Statistics Info */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quick Stats
                        </label>
                        <div className="text-xs text-gray-600">
                          <div>Total Events: {ahiResults.all_events.length}</div>
                          <div>Apnea: {ahiResults.ahi_analysis.apnea_count}</div>
                          <div>Hypopnea: {ahiResults.ahi_analysis.hypopnea_count}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Histogram Chart */}
                  <AHIHistogram
                    events={ahiResults.all_events}
                    binCount={histogramBins}
                    showSeparateTypes={separateEventTypes}
                  />
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
