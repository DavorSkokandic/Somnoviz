import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Chart, // Dodano Chart za pristup instanci grafa
  type TooltipItem, // Dodano za tipovanje tooltip callbacka - type-only import
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import annotationPlugin from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import { enUS } from 'date-fns/locale';
import { registerables } from 'chart.js';
import UploadZone from './UploadZone';
import StatusDisplay from './StatusDisplay';
import FileInfoDisplay from './FileInfoDisplay';
import ModeSelector from './ModeSelector';
import ChannelStatsDisplay from './ChannelStatsDisplay';
import EDFChart from './EDFChart';


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  annotationPlugin,
  ...registerables
);

type EDFFileInfo = {
  channels: string[];
  sampleRates: number[]; // Može biti više sample rate-ova
  duration: number; // Ukupno trajanje u sekundama
  startTime: string;
  patientInfo: string;
  recordingInfo: string;
  previewData: { [channel: string]: number[] };
  diagnostics: { [channel: string]: { min: number; max: number; mean: number; num_samples: number; } };
  tempFilePath: string; // Putanja do fajla na serveru (za dohvaćanje chunkova)
  originalFileName: string;
};

type ChannelData = {
  labels: Date[];
  data: number[];
}

type ChannelStats = {
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
};

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
// Formatiranje vremena
function addSeconds(date: Date, seconds: number): Date {
  const newDate = new Date(date.getTime() + seconds * 1000);
  return newDate;
}

// Create professional event timeline data for PSG-style visualization
function createEventTimelineData(labels: Date[], events: AHIEvent[], startTimeStr: string) {
  const startTime = new Date(startTimeStr).getTime();
  const data: number[] = [];
  const colors: string[] = [];
  const borderColors: string[] = [];
  
  // Initialize all timeline points as 0 (no event)
  labels.forEach(() => {
    data.push(0);
    colors.push('rgba(0, 0, 0, 0)'); // Transparent
    borderColors.push('rgba(0, 0, 0, 0)');
  });
  
  // Map events to timeline bars
  events.forEach((event) => {
    const eventStartMs = startTime + (event.start_time * 1000);
    const eventEndMs = startTime + (event.end_time * 1000);
    
    // Find corresponding indices in the labels array
    labels.forEach((labelTime, index) => {
      const labelMs = labelTime.getTime();
      
      // If this label falls within the event time range
      if (labelMs >= eventStartMs && labelMs <= eventEndMs) {
        data[index] = 1; // Event height (normalized)
        
        // Professional medical color coding
        if (event.type === 'apnea') {
          colors[index] = '#ef4444'; // Red for apnea
          borderColors[index] = '#dc2626';
        } else {
          colors[index] = '#f97316'; // Orange for hypopnea
          borderColors[index] = '#ea580c';
        }
      }
    });
  });
  
  return { data, colors, borderColors };
}








export default function EDFUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileInfo, setFileInfo] = useState<EDFFileInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  //const [isZooming, setIsZooming] = useState(false);
  const [multiChannelMode, setMultiChannelMode] = useState<boolean>(false); // Dodano za višekanalni prikaz
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]); // Za višekanalni prikaz
  const [channelData, setChannelData] = useState<{ [channel: string]: ChannelData }>({}); // Za višekanalni prikaz
  const [channelStats, setChannelStats] = useState<Record<string, ChannelStats>>({});

  // AHI Analysis Mode States
  const [ahiMode, setAhiMode] = useState<boolean>(false);
  const [ahiFlowChannel, setAhiFlowChannel] = useState<string>("");
  const [ahiSpo2Channel, setAhiSpo2Channel] = useState<string>("");
  const [ahiResults, setAhiResults] = useState<AHIResults | null>(null);
  const [ahiAnalyzing, setAhiAnalyzing] = useState<boolean>(false);
  const [showEventOverlays, setShowEventOverlays] = useState<boolean>(true);

  // Stanja za upravljanje prikazanim podacima i zumiranjem
  const [chartDataState, setChartDataState] = useState<{ labels: Date[]; data: number[]; } | null>(null);
  // Removed currentZoomStart - now using viewport state for all time tracking
  //const [currentZoomEnd, setCurrentZoomEnd] = useState<number>(0);     // Završni uzorak
  const [isLoadingChunk, setIsLoadingChunk] = useState<boolean>(false);
  const [loadingChannels, setLoadingChannels] = useState<Set<string>>(new Set());
  const [viewport, setViewport] = useState<{ start: number; end: number } | null>(null);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");


  // Referenca na ChartJS instancu - tip specificiran za 'line' graf
  const chartRef = useRef<Chart<'line'> | null>(null);

  // OLD: Removed unused fetchEdfChunkInternal - now using simplified downsampling approach

  // OLD: Removed unused debouncedFetchEdfChunk - now using simplified approach

// NEW: Simplified data fetching using downsampling endpoint
const fetchDownsampledData = useCallback(async (
    filePath: string,
    channel: string,
    startSample: number,
    numSamples: number,
  targetPoints: number,
  startTime: number,
  endTime: number
) => {
    // For AHI mode, allow multiple channels to load simultaneously
    if (ahiMode && ahiFlowChannel && ahiSpo2Channel) {
      if (loadingChannels.has(channel)) {
        console.log(`[DEBUG] Skipping ${channel} - already loading this channel`);
        return;
      }
      setLoadingChannels(prev => new Set(prev).add(channel));
    } else {
      // For single/multi channel mode, use the old loading logic
      if (isLoadingChunk) {
        console.log(`[DEBUG] Skipping ${channel} - already loading chunk`);
        return;
      }
      setIsLoadingChunk(true);
    }
    setError(null);

  console.log(`[DEBUG] fetchDownsampledData:`, {
    channel,
    startSample,
    numSamples,
    targetPoints,
    startTime,
    endTime
  });

    try {
      const response = await axios.get<{ data: number[] }>(
      `http://localhost:5000/api/upload/edf-chunk-downsample`,
      {
        params: {
          filePath: filePath,
          channel: channel,
          start_sample: startSample,
          num_samples: numSamples,
          target_points: targetPoints
        }
      }
      );

      const chunkData = response.data.data;
    console.log(`[DEBUG] Received ${chunkData.length} downsampled points for ${channel}`);

    if (!chunkData || chunkData.length === 0) {
      console.warn(`[WARN] No data received for channel ${channel}`);
      setError(`No data available for channel ${channel}.`);
      return;
    }

    // Generate labels based on the requested time range
    const fileStartTime = new Date(fileInfo!.startTime);
      const labels = chunkData.map((_, i) => {
      const timeOffset = startTime + (i * (endTime - startTime)) / chunkData.length;
      return addSeconds(fileStartTime, timeOffset);
      });

    console.log(`[DEBUG] Generated ${labels.length} labels from ${startTime}s to ${endTime}s`);

    // Update chartDataState for single channel mode
      setChartDataState({ labels, data: chunkData });
    
    // ALSO update channelData for AHI mode (and multi-channel mode)
    setChannelData(prev => {
      const newChannelData = {
        ...prev,
        [channel]: { labels, data: chunkData }
      };
      console.log(`[DEBUG] Updated channelData for ${channel}, now have channels:`, Object.keys(newChannelData));
      return newChannelData;
    });

  } catch (err: unknown) {
    console.error("Error fetching downsampled data:", err);
    if (axios.isAxiosError(err)) {
      console.error("Axios error details:", {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      setError(`Error fetching data: ${err.response?.status} ${err.response?.statusText || err.message}`);
    } else {
      setError("Error loading data.");
    }
    } finally {
      // Clear loading state based on mode
      if (ahiMode && ahiFlowChannel && ahiSpo2Channel) {
        setLoadingChannels(prev => {
          const newSet = new Set(prev);
          newSet.delete(channel);
          return newSet;
        });
      } else {
        setIsLoadingChunk(false);
      }
    }
}, [fileInfo, isLoadingChunk, ahiMode, ahiFlowChannel, ahiSpo2Channel, loadingChannels]);

// Debounced version of fetchDownsampledData for smooth interactions
const debouncedFetchDownsampledData = useDebouncedCallback(
  fetchDownsampledData,
  150 // Fast response for smooth UX
);

// NEW SIMPLIFIED APPROACH: Always use downsampling endpoint for consistency
const handleZoomOrPan = useCallback(async (startTime: number, endTime: number) => {
  if (!fileInfo) return;
  
  // Bound the time range to valid limits
  const boundedStartTime = Math.max(0, startTime);
  const boundedEndTime = Math.min(fileInfo.duration, Math.max(boundedStartTime + 0.1, endTime));
  
  // AHI MODE: Load both Flow and SpO2 channels
  if (ahiMode && ahiFlowChannel && ahiSpo2Channel) {
    console.log(`[DEBUG] AHI mode handleZoomOrPan: ${boundedStartTime}s to ${boundedEndTime}s for Flow & SpO2`);
    
    // Load Flow channel data
    const flowIndex = fileInfo.channels.indexOf(ahiFlowChannel);
    const spo2Index = fileInfo.channels.indexOf(ahiSpo2Channel);
    
    if (flowIndex === -1 || spo2Index === -1) {
      console.error(`[ERROR] AHI channels not found: Flow=${flowIndex}, SpO2=${spo2Index}`);
      return;
    }
    
    const flowSampleRate = fileInfo.sampleRates[flowIndex];
    const spo2SampleRate = fileInfo.sampleRates[spo2Index];
    const timeRange = boundedEndTime - boundedStartTime;
    
    // Target points for AHI visualization
    let targetPoints: number;
    if (timeRange <= 60) {
      targetPoints = 800;
    } else if (timeRange <= 600) {
      targetPoints = 600;
    } else if (timeRange <= 3600) {
      targetPoints = 500;
    } else {
      targetPoints = 400;
    }
    
    // Load Flow channel
    const flowStartSample = Math.floor(boundedStartTime * flowSampleRate);
    const flowNumSamples = Math.floor(timeRange * flowSampleRate);
    
    console.log(`[DEBUG] Loading Flow channel data:`, {
      channel: ahiFlowChannel,
      sampleRate: flowSampleRate,
      startSample: flowStartSample,
      numSamples: flowNumSamples,
      targetPoints
    });
    
    // Use debounced loading for both channels with different delays to avoid conflicts
    debouncedFetchDownsampledData(
      fileInfo.tempFilePath,
      ahiFlowChannel,
      flowStartSample,
      flowNumSamples,
      targetPoints,
      boundedStartTime,
      boundedEndTime
    );
    
    // Load SpO2 channel
    const spo2StartSample = Math.floor(boundedStartTime * spo2SampleRate);
    const spo2NumSamples = Math.floor(timeRange * spo2SampleRate);
    
    console.log(`[DEBUG] Loading SpO2 channel data:`, {
      channel: ahiSpo2Channel,
      sampleRate: spo2SampleRate,
      startSample: spo2StartSample,
      numSamples: spo2NumSamples,
      targetPoints
    });
    
    debouncedFetchDownsampledData(
      fileInfo.tempFilePath,
      ahiSpo2Channel,
      spo2StartSample,
      spo2NumSamples,
      targetPoints,
      boundedStartTime,
      boundedEndTime
    );
    
    return;
  }
  
  // SINGLE/MULTI CHANNEL MODE
  if (!selectedChannel) return;
  
  console.log(`[DEBUG] handleZoomOrPan: ${boundedStartTime}s to ${boundedEndTime}s for channel ${selectedChannel}`);
  
  const channelIndex = fileInfo.channels.indexOf(selectedChannel);
  if (channelIndex === -1) {
    console.error(`[ERROR] Channel ${selectedChannel} not found in channels list`);
    return;
  }
  
  const sampleRate = fileInfo.sampleRates[channelIndex];
  if (!sampleRate || sampleRate <= 0) {
    console.error(`[ERROR] Invalid sample rate for channel ${selectedChannel}: ${sampleRate}`);
    return;
  }
  
  // SIMPLIFIED: Always use low resolution for smooth performance
  const timeRange = boundedEndTime - boundedStartTime;
  const startSample = Math.floor(boundedStartTime * sampleRate);
  const numSamples = Math.floor(timeRange * sampleRate);
  
  // MUCH LOWER resolution for all zoom levels
  let targetPoints: number;
  if (timeRange <= 60) { // 0-1 minute: Still keep reasonable detail
    targetPoints = 800;
  } else if (timeRange <= 600) { // 1-10 minutes: Lower detail
    targetPoints = 600; 
  } else if (timeRange <= 3600) { // 10min-1 hour: Even lower
    targetPoints = 500;
  } else { // 1+ hour: Very low for performance
    targetPoints = 400;
  }
  
  console.log(`[DEBUG] Simplified approach: timeRange=${timeRange}s, startSample=${startSample}, numSamples=${numSamples}, targetPoints=${targetPoints}`);
  
  // Always use the downsampling endpoint for consistency
  debouncedFetchDownsampledData(
    fileInfo.tempFilePath,
    selectedChannel,
    startSample,
    numSamples,
    targetPoints,
    boundedStartTime,
    boundedEndTime
  );
}, [fileInfo, selectedChannel, debouncedFetchDownsampledData, ahiMode, ahiFlowChannel, ahiSpo2Channel]);

// Rolling window navigation for AHI events
const [currentEventIndex, setCurrentEventIndex] = useState(0);

const navigateToEvent = useCallback((direction: 'next' | 'prev' | 'first') => {
  if (!ahiResults || !ahiResults.all_events.length) return;
  
  const events = ahiResults.all_events.sort((a, b) => a.start_time - b.start_time);
  let newIndex = currentEventIndex;
  
  switch (direction) {
    case 'next':
      newIndex = (currentEventIndex + 1) % events.length;
      break;
    case 'prev':
      newIndex = currentEventIndex === 0 ? events.length - 1 : currentEventIndex - 1;
      break;
    case 'first':
      newIndex = 0;
      break;
  }
  
  setCurrentEventIndex(newIndex);
  const event = events[newIndex];
  
  // Navigate to event with 30-second window around it
  const windowSize = 30; // 30 seconds around the event
  const eventCenter = (event.start_time + event.end_time) / 2;
  const start = Math.max(0, eventCenter - windowSize / 2);
  const end = Math.min(fileInfo?.duration || 0, eventCenter + windowSize / 2);
  
  console.log(`[DEBUG] Navigating to event ${newIndex + 1}/${events.length}: ${event.type} at ${event.start_time}s`);
  
  setViewport({ start, end });
  handleZoomOrPan(start, end);
}, [ahiResults, currentEventIndex, fileInfo, handleZoomOrPan]);

// AHI Analysis Function
const handleAHIAnalysis = useCallback(async () => {
  if (!fileInfo || !ahiFlowChannel || !ahiSpo2Channel) {
    setError("Please select both Flow and SpO2 channels for AHI analysis");
    return;
  }

  setAhiAnalyzing(true);
  setError(null);

  console.log('[DEBUG] Starting AHI analysis:', {
    filePath: fileInfo.tempFilePath,
    flowChannel: ahiFlowChannel,
    spo2Channel: ahiSpo2Channel
  });

  try {
    const response = await axios.post<AHIResults & { success: boolean }>(
      'http://localhost:5000/api/upload/ahi-analysis',
      {
        filePath: fileInfo.tempFilePath,
        flowChannel: ahiFlowChannel,
        spo2Channel: ahiSpo2Channel
      }
    );

    if (response.data.success) {
      setAhiResults(response.data);
      console.log('[DEBUG] AHI analysis completed:', response.data.ahi_analysis);
    } else {
      throw new Error('AHI analysis failed');
    }
  } catch (err) {
    console.error('AHI analysis error:', err);
    if (axios.isAxiosError(err)) {
      setError(`AHI analysis failed: ${err.response?.data?.error || err.message}`);
    } else {
      setError('AHI analysis failed. Please try again.');
    }
  } finally {
    setAhiAnalyzing(false);
  }
}, [fileInfo, ahiFlowChannel, ahiSpo2Channel]);

// Mode switching functions
const handleModeSwitch = useCallback((mode: 'single' | 'multi' | 'ahi') => {
  // Clear previous states
  setError(null);
  setAhiResults(null);
  
  switch (mode) {
    case 'single':
      setMultiChannelMode(false);
      setAhiMode(false);
      break;
    case 'multi':
      setMultiChannelMode(true);
      setAhiMode(false);
      break;
    case 'ahi':
      setMultiChannelMode(false);
      setAhiMode(true);
      console.log('[DEBUG] Switching to AHI mode');
      // Auto-select Flow and SpO2 channels if available
      if (fileInfo) {
        const flowChannel = fileInfo.channels.find(ch => 
          ch.toLowerCase().includes('flow') || 
          ch.toLowerCase().includes('airflow') ||
          ch.toLowerCase().includes('nasal')
        );
        const spo2Channel = fileInfo.channels.find(ch => 
          ch.toLowerCase().includes('spo2') || 
          ch.toLowerCase().includes('sao2') ||
          ch.toLowerCase().includes('oxygen')
        );
        
        console.log('[DEBUG] Auto-selecting AHI channels:', { flowChannel, spo2Channel });
        
        if (flowChannel) setAhiFlowChannel(flowChannel);
        if (spo2Channel) setAhiSpo2Channel(spo2Channel);
      }
      break;
  }
}, [fileInfo]);

// Add missing useEffect for initial data loading
useEffect(() => {
  if (!fileInfo) return;
  
  // In AHI mode, load Flow and SpO2 channels
  if (ahiMode && ahiFlowChannel && ahiSpo2Channel) {
    console.log('[DEBUG] Loading initial data for AHI channels:', { ahiFlowChannel, ahiSpo2Channel, ahiMode });
    const initialEndTime = Math.min(300, fileInfo.duration);
    console.log('[DEBUG] Calling handleZoomOrPan for AHI mode:', { start: 0, end: initialEndTime });
    handleZoomOrPan(0, initialEndTime);
    setViewport({ start: 0, end: initialEndTime });
    return;
  }
  
  // In other modes, load selected channel
  if (!selectedChannel) return;
  const initialEndTime = Math.min(300, fileInfo.duration);
  handleZoomOrPan(0, initialEndTime);
  setViewport({ start: 0, end: initialEndTime });
}, [selectedChannel, fileInfo, handleZoomOrPan, ahiMode, ahiFlowChannel, ahiSpo2Channel]);

    // OLD: toggleMultiChannelMode removed - now handled by handleModeSwitch
    // Handle channel selection changes
  const handleChannelSelect = (channel: string) => {
    if (selectedChannels.includes(channel)) {
      setSelectedChannels(selectedChannels.filter(ch => ch !== channel));
    } else {
      if (selectedChannels.length < 5) {
        setSelectedChannels([...selectedChannels, channel]);
      } else {
        alert("Maximum 5 channels can be displayed simultaneously");
      }
    }
  };

const channelDataRef = useRef(channelData);
  useEffect(() => {
    channelDataRef.current = channelData;
  }, [channelData]);
   // Fetch data for multiple channels
  const fetchDataForChannels = useCallback(async () => {
  if (!fileInfo || selectedChannels.length === 0) return;
  
  setIsLoadingChunk(true);
  setError(null);
  
  try {
    const newChannelData: { [channel: string]: ChannelData } = { ...channelDataRef.current };

    for (const channel of selectedChannels) {
      if (!newChannelData[channel] || newChannelData[channel].data.length === 0) {
        const sampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(channel)];
        // Use a reasonable default number of samples (10 seconds worth of data)
        const initialNumSamples = Math.min(500, Math.floor(10 * sampleRate));

        console.log(`[DEBUG] Fetching initial data for channel ${channel}:`, {
          sampleRate,
          initialNumSamples
        });

        const response = await axios.get<{ data: number[] }>(
          `http://localhost:5000/api/upload/edf-chunk?filePath=${encodeURIComponent(fileInfo.tempFilePath)}&channel=${encodeURIComponent(channel)}&start_sample=0&num_samples=${initialNumSamples}`
        );

        const chunkData = response.data.data;
        const startTime = new Date(fileInfo.startTime);

        const labels = chunkData.map((_, i) => addSeconds(startTime, i / sampleRate));

        newChannelData[channel] = { labels, data: chunkData };
      }
    }

    setChannelData(newChannelData);
  } catch (err) {
    console.error("Error fetching multi-channel data:", err);
    setError("Error loading channel data");
  } finally {
    setIsLoadingChunk(false);
  }
}, [fileInfo, selectedChannels]);

  // Fetch data when selected channels change
  useEffect(() => {
    if (multiChannelMode && selectedChannels.length > 0) {
      fetchDataForChannels();
    }
  }, [multiChannelMode, selectedChannels, fetchDataForChannels]);

const handleFullNightView = () => {
  if (!fileInfo || !selectedChannel) return;
  
  // Get the actual first and last sample timestamps
  const start = 0;
  const end = fileInfo.duration;
  
  console.log(`[DEBUG] Full night view: ${start}s to ${end}s`);
  setViewport({ start, end });

  if (multiChannelMode) {
    debouncedFetchMultiChunks(start, end);
  } else {
    // Use the same simplified approach as zoom/pan for consistency
    handleZoomOrPan(start, end);
  }
};
const debouncedFetchMultiChunks = useDebouncedCallback(
  async (start: number, end: number) => {
    if (!fileInfo || selectedChannels.length === 0) return;

    const duration = fileInfo.duration;

    // ❗ Osiguraj granice uzorkovanja
    const boundedStart = Math.max(0, start);
    const boundedEnd = Math.min(duration, end);

    if (boundedEnd <= boundedStart) return;
    
    // Smart multi-channel downsampling based on time range
    const timeRange = boundedEnd - boundedStart;
    
    // Calculate optimal target points (SIMPLIFIED - same as single channel)
    let targetPoints: number;
    if (timeRange <= 60) { // 0-1 minute: Still keep reasonable detail
      targetPoints = 800;
    } else if (timeRange <= 600) { // 1-10 minutes: Lower detail
      targetPoints = 600; 
    } else if (timeRange <= 3600) { // 10min-1 hour: Even lower
      targetPoints = 500;
    } else { // 1+ hour: Very low for performance
      targetPoints = 400;
    }
    
    console.log(`[DEBUG] Multi-channel fetch: ${timeRange}s range, ${targetPoints} target points`);
    
    try {
      // Use the efficient multi-channel endpoint; send seconds (backend converts)
      const startSec = boundedStart;
      const endSec = boundedEnd;
      
      console.log(`[DEBUG] Multi-channel request:`, {
        channels: selectedChannels,
        startSec,
        endSec,
        targetPoints,
        boundedStart,
        boundedEnd
      });

      const response = await axios.get<{
        labels: number[];
        channels: {
          [channel: string]: number[];
        };
      }>(`http://localhost:5000/api/upload/edf-multi-chunk`, {
        params: {
          filePath: fileInfo.tempFilePath,
          channels: JSON.stringify(selectedChannels),
          start_sec: startSec,
          end_sec: endSec,
          max_points: targetPoints,
        },
      });

      console.log(`[DEBUG] Multi-channel response:`, {
        labelCount: response.data.labels?.length || 0,
        channelCount: Object.keys(response.data.channels || {}).length,
        channels: Object.keys(response.data.channels || {})
      });

      // Process the response for each channel
      const newChannelData: { [channel: string]: ChannelData } = {};
      const newChannelStats: { [channel: string]: ChannelStats } = {};

      // Prefer backend labels (absolute ms) when provided and aligned
      let labelsFromBackend: Date[] | null = null;
      if (Array.isArray(response.data.labels) && response.data.labels.length > 0) {
        labelsFromBackend = response.data.labels.map((ms) => new Date(ms));
      }

      for (const channel of selectedChannels) {
        const series = response.data.channels?.[channel];
        if (!series || series.length === 0) {
          console.warn(`No data received for channel ${channel}`);
          continue;
        }

        let labels: Date[];
        if (labelsFromBackend && labelsFromBackend.length === series.length) {
          labels = labelsFromBackend;
        } else {
          const base = new Date(fileInfo.startTime);
          labels = series.map((_: number, i: number) =>
            addSeconds(base, boundedStart + (i * timeRange) / series.length)
          );
        }

        newChannelData[channel] = { labels, data: series };
        console.log(`[DEBUG] Processed channel ${channel}: ${series.length} points`);
      }
      
      // Update state with all channels at once
      setChannelData(prev => ({ ...prev, ...newChannelData }));
      setChannelStats(prev => ({ ...prev, ...newChannelStats }));
      
      console.log(`[DEBUG] Multi-channel loaded: ${Object.keys(newChannelData).length} channels`);
      
    } catch (err) {
      console.error(`Error fetching multi-channel data:`, err);
      
      // Log more details about the error
      if (axios.isAxiosError(err)) {
        console.error(`[DEBUG] Axios error details:`, {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          message: err.message
        });
      }
      
      // Fallback to individual channel requests if multi-channel fails
      console.log(`[DEBUG] Falling back to individual channel requests`);
    
    for (const channel of selectedChannels) {
      try {
          const channelIndex = fileInfo.channels.indexOf(channel);
          const sampleRate = fileInfo.sampleRates[channelIndex];
          
          if (!sampleRate) continue;

    const startSample = Math.floor(boundedStart * sampleRate);
          const numSamples = Math.max(0, Math.floor(boundedEnd - boundedStart) * sampleRate);
    
          if (numSamples <= 0) continue;

        const response = await axios.get<{
          data: number[];
          stats?: ChannelStats;
        }>(`http://localhost:5000/api/upload/edf-chunk-downsample`, {
          params: {
            filePath: fileInfo.tempFilePath,
            channel,
            start_sample: startSample,
            num_samples: numSamples,
              target_points: targetPoints,
          },
        });

        const chunkData = response.data?.data || [];
          if (chunkData.length === 0) continue;

        const startTime = new Date(fileInfo.startTime);
          const labels = chunkData.map((_: number, i: number) => addSeconds(startTime, boundedStart + i / sampleRate));

        setChannelData(prev => ({
          ...prev,
          [channel]: { labels, data: chunkData },
        }));

        if (response.data.stats) {
          setChannelStats(prev => ({
            ...prev,
            [channel]: response.data.stats as ChannelStats,
          }));
        }
        } catch (channelErr) {
          console.error(`Error fetching data for channel ${channel}:`, channelErr);
        }
      }
    }
  },
  120  // Optimized for smooth multi-channel interactions
);
// Generiraj boje za točke ako je SpO2 kanal

const chartJSData = useMemo(() => {
  // AHI ANALYSIS MODE - Show Flow and SpO2 with event overlays
  if (ahiMode && ahiFlowChannel && ahiSpo2Channel) {
    const flowData = channelData[ahiFlowChannel];
    const spo2Data = channelData[ahiSpo2Channel];
    
    console.log('[DEBUG] AHI mode chartJSData generation:', {
      ahiFlowChannel,
      ahiSpo2Channel,
      flowDataExists: !!flowData,
      spo2DataExists: !!spo2Data,
      flowDataLength: flowData?.data.length,
      spo2DataLength: spo2Data?.data.length,
      channelDataKeys: Object.keys(channelData),
      flowData: flowData ? 'exists' : 'missing',
      spo2Data: spo2Data ? 'exists' : 'missing'
    });
    
    if (!flowData || !spo2Data) {
      console.log('[DEBUG] Missing channel data for AHI mode, returning empty chart');
      return { labels: [], datasets: [] };
    }

    // Create professional medical chart: Flow + SpO2 + Event Timeline
    const datasets = [
      {
        label: `${ahiFlowChannel} (Flow)`,
        data: flowData.data,
        borderColor: "rgb(34, 197, 94)", // Green for flow
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        tension: 0.2,
        pointRadius: 0,
        borderWidth: 1,
        yAxisID: 'y', // Primary Y-axis for flow
      },
      {
        label: `${ahiSpo2Channel} (SpO2)`,
        data: spo2Data.data,
        borderColor: "rgb(59, 130, 246)", // Blue for SpO2
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.2,
        pointRadius: 1,
        borderWidth: 2,
        yAxisID: 'y1', // Secondary Y-axis for SpO2
        // Color SpO2 points red when < 90%
        pointBackgroundColor: spo2Data.data.map(value => value < 90 ? "red" : "rgb(59, 130, 246)"),
      }
    ];

    // Add professional event timeline track (if events exist and overlays enabled)
    if (ahiResults && showEventOverlays && ahiResults.all_events.length > 0 && fileInfo) {
      const eventTimelineData = createEventTimelineData(flowData.labels, ahiResults.all_events, fileInfo.startTime);
      
      // Add event timeline as mixed chart type
      const eventDataset: {
        label: string;
        data: number[];
        type: string;
        backgroundColor: string[];
        borderColor: string[];
        borderWidth: number;
        yAxisID: string;
        barThickness: number;
        maxBarThickness: number;
        categoryPercentage: number;
        barPercentage: number;
      } = {
        label: 'Sleep Events',
        data: eventTimelineData.data,
        type: 'bar',
        backgroundColor: eventTimelineData.colors,
        borderColor: eventTimelineData.borderColors,
        borderWidth: 1,
        yAxisID: 'y2',
        barThickness: 20,
        maxBarThickness: 20,
        categoryPercentage: 1.0,
        barPercentage: 1.0,
      };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (datasets as any).push(eventDataset);
    }

    console.log('[DEBUG] AHI chart data created:', {
      labelsLength: flowData.labels.length,
      datasetsCount: datasets.length,
      datasetLabels: datasets.map(d => d.label)
    });

    return {
      labels: flowData.labels, // Use flow labels as primary timeline
      datasets,
    };
  }

  // SINGLE CHANNEL MODE
  if (!multiChannelMode || selectedChannels.length === 0) {
    if (!chartDataState || !selectedChannel) return { labels: [], datasets: [] };

    const isSpo2 = selectedChannel.toLowerCase().includes("spo2");
    const pointColors = isSpo2 && chartDataState.data
      ? chartDataState.data.map(value => value < 90 ? "red" : "blue")
      : [];

    return {
      labels: chartDataState.labels,
      datasets: [{
        label: selectedChannel,
        data: chartDataState.data,
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        tension: 0.4,
        pointRadius: isSpo2 ? 1 : 0,
        pointBackgroundColor: isSpo2 ? pointColors : undefined,
        borderWidth: 1,
      }],
    };
  }

  // MULTI CHANNEL MODE
  // Always synthesize shared labels from viewport if available to ensure alignment
  const firstChannel = selectedChannels[0];
  let sharedLabels: Date[] = [];
  if (viewport && fileInfo) {
    // Prefer length from first channel data, else from any non-empty channel
    let n = channelData[firstChannel]?.data?.length || 0;
    if (n === 0) {
      for (const ch of selectedChannels) {
        n = channelData[ch]?.data?.length || 0;
        if (n > 0) break;
      }
    }
    if (n > 0) {
      const base = new Date(fileInfo.startTime);
      const range = viewport.end - viewport.start;
      sharedLabels = Array.from({ length: n }, (_, i) =>
        addSeconds(base, viewport.start + (i * range) / n)
      );
    }
  } else {
    // Fallback: use first available labels
    for (const ch of selectedChannels) {
      const lbls = channelData[ch]?.labels;
      if (lbls && lbls.length > 0) { sharedLabels = lbls; break; }
    }
  }
  const colors = ["#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6"];

  return {
    labels: sharedLabels, //  SVI KANALE ISTI LABELS!
    datasets: selectedChannels.map((channel, index) => {
      const data = channelData[channel]?.data || [];
      const isSpo2 = channel.toLowerCase().includes("spo2");

      const pointColors = isSpo2
        ? data.map(value => value < 90 ? "red" : "blue")
        : [];

      return {
        label: channel,
        data,
        borderColor: colors[index % colors.length],
        backgroundColor: `${colors[index % colors.length]}33`,
        tension: 0.4,
        pointRadius: isSpo2 ? 1 : 0,
        pointBackgroundColor: isSpo2 ? pointColors : undefined,
        borderWidth: 1,
        yAxisID: `y-${index}`, // ako koristiš više y-osi
      };
    }),
  };
}, [multiChannelMode, selectedChannels, channelData, chartDataState, selectedChannel, fileInfo, viewport, ahiMode, ahiFlowChannel, ahiSpo2Channel, ahiResults, showEventOverlays]);






  


  // Chart.js opcije s prilagođenom logikom zooma
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartOptions: any = useMemo(() => {
  if (!fileInfo) return {};

  const startTime = new Date(fileInfo.startTime).getTime();

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 200, // Short animation for smoother transitions
      easing: 'easeOutQuart',
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'second',
          stepSize: 1,
          displayFormats: {
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MM-DD',
          },
          tooltipFormat: 'HH:mm:ss',
          // Improve time scale stability
          round: 'second',
          isoWeekday: false,
        },
        adapters: {
          date: {
            locale: enUS,
          },
        },
        title: {
          display: true,
          text: 'Vrijeme',
        },
        min: viewport && viewport.start !== undefined ? startTime + viewport.start * 1000 : undefined,
        max: viewport && viewport.end !== undefined ? startTime + viewport.end * 1000 : undefined,
        ticks: {
          maxTicksLimit: 10,
          autoSkip: true,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: ahiMode ? 'Flow (Airflow)' : 'Amplituda',
        },
      },
      // Secondary Y-axis for SpO2 in AHI mode
      ...(ahiMode ? {
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'SpO2 (%)',
          },
          min: 80,
          max: 100,
          grid: {
            drawOnChartArea: false,
          },
        },
        // Third Y-axis for professional event timeline
        y2: {
          type: 'linear',
          display: false, // Hide axis labels for cleaner look
          position: 'left',
          min: 0,
          max: 1,
          grid: {
            display: false, // No grid lines for timeline
            drawOnChartArea: false,
          },
          ticks: {
            display: false, // Hide tick marks
          },
        },
      } : {}),
    },
    plugins: {
      decimation: {
        enabled: true,
        algorithm: 'min-max',
      },
      // Removed crowded annotation overlays - using professional event timeline instead
      tooltip: {
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            const time = items[0].label;
            return time;
          },
          label: (context: TooltipItem<'line'>) => {
            // Enhanced tooltip for event timeline
            if (context.dataset.label === 'Sleep Events' && context.parsed.y > 0) {
              const timeLabel = context.label;
              const time = new Date(timeLabel);
              const startTime = new Date(fileInfo.startTime);
              const secondsFromStart = (time.getTime() - startTime.getTime()) / 1000;
              
              // Find the event at this time
              const event = ahiResults?.all_events.find(e => 
                secondsFromStart >= e.start_time && secondsFromStart <= e.end_time
              );
              
              if (event) {
                return [
                  `${event.type.toUpperCase()} Event`,
                  `Duration: ${event.duration.toFixed(1)}s`,
                  event.spo2_drop ? `SpO2 Drop: ${event.spo2_drop.toFixed(1)}%` : ''
                ].filter(Boolean);
              }
            }
            
            // Default tooltip for other datasets
            return `${context.dataset.label}: ${context.parsed.y}`;
          },
        },
        filter: (tooltipItem: TooltipItem<'line'>) => {
          // Only show tooltip for Sleep Events if there's actually an event
          if (tooltipItem.dataset.label === 'Sleep Events') {
            return tooltipItem.parsed.y > 0;
          }
          return true;
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPanComplete: ({ chart }: { chart: any }) => {
            const xScale = chart.scales['x'];
            const startTime = new Date(fileInfo.startTime).getTime();
            const start = (xScale.min as number - startTime) / 1000;
            const end = (xScale.max as number - startTime) / 1000;

            if (typeof start === 'number' && typeof end === 'number' && start < end) {
              console.log(`[DEBUG] Pan complete: ${start}s to ${end}s`);
              setViewport({ start, end });

              if (multiChannelMode) {
                debouncedFetchMultiChunks(start, end);
              } else {
                handleZoomOrPan(start, end);
              }
            }
          },
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onZoomComplete: ({ chart }: { chart: any }) => {
            const xScale = chart.scales['x'];
            const startTime = new Date(fileInfo.startTime).getTime();
            const start = (xScale.min as number - startTime) / 1000;
            const end = (xScale.max as number - startTime) / 1000;

            if (typeof start === 'number' && typeof end === 'number' && start < end) {
              console.log(`[DEBUG] Zoom complete: ${start}s to ${end}s`);
              setViewport({ start, end });

              if (multiChannelMode) {
                debouncedFetchMultiChunks(start, end);
              } else {
                handleZoomOrPan(start, end);
              }
            }
          },
        },
      },
      legend: { 
        display: true,
        position: 'top',
        labels: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filter: (legendItem: any) => {
            // Show more informative legend for AHI mode
            return legendItem.text !== 'Sleep Events' || ahiMode;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          generateLabels: (chart: any) => {
            const defaultLabels = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
            
            // Add custom legend for event timeline in AHI mode
            if (ahiMode && ahiResults && showEventOverlays) {
              defaultLabels.push({
                text: `Events: ${ahiResults.ahi_analysis.apnea_count} Apneas, ${ahiResults.ahi_analysis.hypopnea_count} Hypopneas`,
                fillStyle: '#ef4444',
                strokeStyle: '#dc2626',
                lineWidth: 1,
                hidden: false,
                index: defaultLabels.length,
                datasetIndex: defaultLabels.length,
              });
            }
            
            return defaultLabels;
          },
        },
      },
    },
  };
}, [fileInfo, viewport, multiChannelMode, debouncedFetchMultiChunks, handleZoomOrPan, ahiMode, ahiResults, showEventOverlays]);




// State for zoom time (double-clicked time on chart)

// Removed problematic useEffect that was causing issues
  // Ažuriranje statistike za odabrani kanal (sada na temelju dohvaćenih podataka)


  // Dodaj na vrh komponente
const handleChartDoubleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
  if (!chartRef.current || !fileInfo || !selectedChannel) return;
  const chart = chartRef.current;

    // Get the clicked point using Chart.js API
  const points = chart.getElementsAtEventForMode(event.nativeEvent, 'nearest', { intersect: false }, false);
  if (!points.length) return;
    
  const firstPoint = points[0];
  const dataIndex = firstPoint.index;

    // Get the actual time value from the chart data
    const clickedTime = chartDataState?.labels?.[dataIndex];
    if (!clickedTime) return;
    
    // Convert clicked time to seconds from start
    const startTime = new Date(fileInfo.startTime).getTime();
    const clickedTimeMs = clickedTime instanceof Date ? clickedTime.getTime() : new Date(clickedTime).getTime();
    const centerTimeSeconds = (clickedTimeMs - startTime) / 1000;
    
    // Define zoom window (15 minutes around clicked point for detailed analysis)
    const zoomWindowSeconds = 900; // 5 minutes - now safe with 15-minute threshold
    const halfWindow = zoomWindowSeconds / 2;
    
    const startTime_s = Math.max(0, centerTimeSeconds - halfWindow);
    const endTime_s = Math.min(fileInfo.duration, centerTimeSeconds + halfWindow);
    
    console.log(`[DEBUG] Double-click zoom: center=${centerTimeSeconds}s, window=${startTime_s}s to ${endTime_s}s`);
    
    // Update viewport and load data using the consistent handleZoomOrPan function
    setViewport({ start: startTime_s, end: endTime_s });
    handleZoomOrPan(startTime_s, endTime_s);
  }, [chartRef, fileInfo, selectedChannel, chartDataState, handleZoomOrPan]);
  

  // Restore file upload handlers
  const handleFileUpload = async (file: File) => {
    console.log("[DEBUG] Starting file upload for:", file.name);
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError(null);
    setFileInfo(null); // Resetirajte informacije
    setChartDataState(null); // Resetirajte graf

    try {
      console.log("[DEBUG] Sending request to backend...");
      const response = await axios.post<EDFFileInfo>(
        "http://localhost:5000/api/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      console.log("[DEBUG] Backend response:", response.data);
      const initialFileInfo = response.data;
      setFileInfo(initialFileInfo);  
      setSelectedChannel(initialFileInfo.channels[0]);

      // Početno učitavanje preview podataka u graf
      if (initialFileInfo.previewData[initialFileInfo.channels[0]]) {
        const previewDataArr = initialFileInfo.previewData[initialFileInfo.channels[0]];
        const startTime = new Date(initialFileInfo.startTime);

        const labels = previewDataArr.map((_, i) => {
          const newDate = addSeconds(startTime, i / initialFileInfo.sampleRates[0]);
          return newDate;
        });
        setChartDataState({ labels, data: previewDataArr });
        //setCurrentZoomEnd(previewDataArr.length);
      }
    } catch (err: unknown) {
      console.error("[ERROR] Upload error:", err);
      if (axios.isAxiosError(err)) {
        console.error("[ERROR] Axios error details:", err.response?.data);
        setError(`Greška pri obradi EDF fajla: ${err.response?.data?.error || err.message}`);
      } else {
        setError("Greška pri obradi EDF fajla. Provjerite format i pokušajte ponovo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".edf")) {
        handleFileUpload(file);
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

const timeToSeconds = (time: string): number => {
  // Accepts "HH:MM" or "HH:MM:SS"
  const parts = time.split(":").map((v) => Number(v));
  if (parts.length === 2) {
    const [h, m] = parts;
    if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
    return h * 3600 + m * 60;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return NaN;
    return h * 3600 + m * 60 + s;
  }
  return NaN;
}

// Convert user input time (HH:MM format) to seconds from file start
const timeInputToFileSeconds = (timeInput: string, fileInfo: EDFFileInfo): number => {
  const inputSeconds = timeToSeconds(timeInput);
  if (Number.isNaN(inputSeconds)) return NaN;
  
  // Parse file start time
  const fileStartDate = new Date(fileInfo.startTime);
  const fileStartHours = fileStartDate.getHours();
  const fileStartMinutes = fileStartDate.getMinutes();
  const fileStartSeconds = fileStartDate.getSeconds();
  const fileStartTotalSeconds = fileStartHours * 3600 + fileStartMinutes * 60 + fileStartSeconds;
  
  // Calculate seconds from file start
  let secondsFromFileStart = inputSeconds - fileStartTotalSeconds;
  
  // Handle day boundary crossings
  if (secondsFromFileStart < 0) {
    // User time is in the next day
    secondsFromFileStart += 24 * 3600;
  }
  
  // Ensure it's within file duration
  if (secondsFromFileStart < 0 || secondsFromFileStart > fileInfo.duration) {
    return NaN; // Time is outside recording range
  }
  
  return secondsFromFileStart;
}
function handleCustomInterval() {
  if (!fileInfo || !startTime || !endTime) return;

  // Convert real clock times to file-relative seconds
  const startSec = timeInputToFileSeconds(startTime, fileInfo);
  const endSec = timeInputToFileSeconds(endTime, fileInfo);

  if (Number.isNaN(startSec) || Number.isNaN(endSec)) {
    const fileStartDate = new Date(fileInfo.startTime);
    const fileStartTime = `${fileStartDate.getHours().toString().padStart(2, '0')}:${fileStartDate.getMinutes().toString().padStart(2, '0')}`;
    const fileEndDate = new Date(fileStartDate.getTime() + fileInfo.duration * 1000);
    const fileEndTime = `${fileEndDate.getHours().toString().padStart(2, '0')}:${fileEndDate.getMinutes().toString().padStart(2, '0')}`;
    
    alert(`Invalid time or time outside recording range.\nRecording time: ${fileStartTime} - ${fileEndTime}\nUse format HH:MM or HH:MM:SS`);
    return;
  }

  if (endSec <= startSec) {
    alert("End time must be after start time");
    return;
  }

  const boundedStart = Math.max(0, Math.min(startSec, fileInfo.duration));
  const boundedEnd = Math.max(boundedStart + 1, Math.min(endSec, fileInfo.duration));

  console.log(`[DEBUG] Custom interval: ${startTime}-${endTime} → ${boundedStart}s-${boundedEnd}s from file start`);
  
  // Set viewport to the requested time range
  setViewport({ start: boundedStart, end: boundedEnd });

  // Use existing zoom/pan fetchers for consistency
  if (multiChannelMode) {
    debouncedFetchMultiChunks(boundedStart, boundedEnd);
  } else {
    handleZoomOrPan(boundedStart, boundedEnd);
  }
}


  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Upload zona */}
      <UploadZone
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
        handleFileUpload={handleFileUpload}
        handleClick={handleClick}
        handleDrop={handleDrop}
      />
      {/* Status */}
      <StatusDisplay loading={loading} isLoadingChunk={isLoadingChunk} error={error} />
      {/* Prikaz informacija o EDF fajlu */}
      {fileInfo && (
        <div className="mt-8 space-y-8">
          {/* Glavne metrike */}
          <FileInfoDisplay fileInfo={fileInfo} />
          {/* Detaljne informacije i graf */}
          {/* Mode Selection and Channel Configuration */}
          <ModeSelector
            fileInfo={fileInfo}
            multiChannelMode={multiChannelMode}
            ahiMode={ahiMode}
            selectedChannel={selectedChannel}
            selectedChannels={selectedChannels}
            ahiFlowChannel={ahiFlowChannel}
            ahiSpo2Channel={ahiSpo2Channel}
            ahiResults={ahiResults}
            ahiAnalyzing={ahiAnalyzing}
            showEventOverlays={showEventOverlays}
            handleModeSwitch={handleModeSwitch}
            setSelectedChannel={setSelectedChannel}
            handleChannelSelect={handleChannelSelect}
            setAhiFlowChannel={setAhiFlowChannel}
            setAhiSpo2Channel={setAhiSpo2Channel}
            handleAHIAnalysis={handleAHIAnalysis}
            setShowEventOverlays={setShowEventOverlays}
            navigateToEvent={navigateToEvent}
            currentEventIndex={currentEventIndex}
          />
          {/* Statistika */}
          <ChannelStatsDisplay channelStats={channelStats} />
          {/* Graf na cijeloj širini */}
          <div className="bg-white rounded-xl shadow p-4">
            {/* Custom Time Interval Section */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Custom Time Interval</h4>
              {fileInfo && (
                <div className="text-xs text-gray-600 mb-2">
                  Recording time: {new Date(fileInfo.startTime).toLocaleTimeString('en-GB', { hour12: false })} - {new Date(new Date(fileInfo.startTime).getTime() + fileInfo.duration * 1000).toLocaleTimeString('en-GB', { hour12: false })}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">From:</label>
                <input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  />
              </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">To:</label>
                      <input
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <button 
                  onClick={handleCustomInterval} 
                  className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 transition duration-200"
                >
                  Show interval
                </button>
            </div>
                </div>

            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-medium">EDF Signal Visualization</h4>
              <button
                onClick={handleFullNightView}
                className="bg-black text-white px-6 py-2 rounded-xl shadow-md hover:from-blue-700 hover:via-indigo-800 hover:to-blue-950 hover:scale-105 transition duration-200 font-semibold tracking-wide flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
              >
                Pregled cijele snimke
              </button>
            </div>
            <EDFChart
              chartRef={chartRef}
              chartJSData={chartJSData}
              chartOptions={chartOptions}
              isLoadingChunk={isLoadingChunk || loadingChannels.size > 0}
              handleChartDoubleClick={handleChartDoubleClick}
              height={ahiMode ? 600 : 500} // Increased height for AHI timeline
            />
          </div>
        </div>
      )}
    </div>
  );
}


// setViewport is now managed by useState above, so this function is not needed and can be removed.
