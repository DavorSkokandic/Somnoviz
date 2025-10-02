import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { axiosInstance } from '../config/axios.config';
import { AxiosError } from 'axios';
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
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import annotationPlugin from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import { enUS } from 'date-fns/locale';
import { registerables } from 'chart.js';

// Helper function to add seconds to a date
const addSeconds = (date: Date, seconds: number): Date => {
  const result = new Date(date);
  result.setSeconds(result.getSeconds() + seconds);
  return result;
};
import { 
  Activity, 
  Upload, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Loader2,
  Info,
  Settings,
  Eye,
  EyeOff,
  ZoomIn,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import UploadZone from './UploadZone';
import StatusDisplay from './StatusDisplay';
import FileInfoDisplay from './FileInfoDisplay';
import ModeSelector from './ModeSelector';
import ChannelStatsDisplay from './ChannelStatsDisplay';
import EDFChart from './EDFChart';
import { endpoints } from '../config/api.config';


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
  labels?: Date[]; // Optional for backward compatibility
  data: number[] | { x: Date; y: number }[]; // Support both formats
  sampleRate?: number;
  startTimeSec?: number;
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
  event_summary?: {
    apnea_count: number;
    hypopnea_count: number;
    total_events: number;
  };
  apnea_events: AHIEvent[];
  hypopnea_events: AHIEvent[];
  all_events: AHIEvent[];
};
// Formatiranje vremena

// Create professional event timeline data for PSG-style visualization with improved synchronization
function createEventTimelineData(labels: Date[], events: AHIEvent[], startTimeStr: string, currentEventIndex: number = -1) {
  const startTime = new Date(startTimeStr).getTime();
  const data: number[] = [];
  const colors: string[] = [];
  const borderColors: string[] = [];
  
  console.log('[DEBUG] Creating event timeline data:', {
    startTime: startTimeStr,
    startTimeMs: startTime,
    labelsCount: labels.length,
    eventsCount: events.length,
    currentEventIndex,
    firstLabel: labels[0]?.toISOString(),
    lastLabel: labels[labels.length - 1]?.toISOString()
  });
  
  // Initialize all timeline points as 0 (no event)
  labels.forEach(() => {
    data.push(0);
    colors.push('rgba(0, 0, 0, 0)'); // Transparent
    borderColors.push('rgba(0, 0, 0, 0)');
  });
  
  // Map events to timeline bars with improved time synchronization
  events.forEach((event, eventIndex) => {
    // Convert event times to milliseconds from recording start
    const eventStartMs = startTime + (event.start_time * 1000);
    const eventEndMs = startTime + (event.end_time * 1000);
    
    console.log(`[DEBUG] Processing event ${eventIndex + 1}/${events.length}:`, {
      type: event.type,
      startTimeSec: event.start_time,
      endTimeSec: event.end_time,
      duration: event.duration,
      startTimeMs: eventStartMs,
      endTimeMs: eventEndMs,
      startTimeDate: new Date(eventStartMs).toISOString(),
      endTimeDate: new Date(eventEndMs).toISOString()
    });
    
    let eventMapped = false;
    const mappedIndices: number[] = [];
    
    // Find corresponding indices in the labels array with tolerance for small time differences
    labels.forEach((labelTime, index) => {
      const labelMs = labelTime.getTime();
      
      // Use a much larger tolerance (±30 seconds) for synchronization issues and downsampling
      // This accounts for potential time zone differences, floating point precision, and downsampling artifacts
      const tolerance = 30000; // 30 seconds in milliseconds
      
      // If this label falls within the event time range (with tolerance)
      if (labelMs >= (eventStartMs - tolerance) && labelMs <= (eventEndMs + tolerance)) {
        data[index] = event.type === 'apnea' ? 1 : 0.5; // Different heights for apnea vs hypopnea
        
        // Highlight current event with brighter colors and thicker border
        const isCurrentEvent = eventIndex === currentEventIndex;
        
        // Professional medical color coding with improved visibility
        if (event.type === 'apnea') {
          colors[index] = isCurrentEvent ? '#dc2626' : '#ef4444'; // Brighter red for current event
          borderColors[index] = isCurrentEvent ? '#991b1b' : '#dc2626';
        } else {
          colors[index] = isCurrentEvent ? '#ea580c' : '#f97316'; // Brighter orange for current event
          borderColors[index] = isCurrentEvent ? '#c2410c' : '#ea580c';
        }
        
        eventMapped = true;
        mappedIndices.push(index);
      }
    });
    
    // If event still not mapped with large tolerance, try fallback strategies
    if (!eventMapped) {
      // Fallback 1: Try to map to the closest point in time
      let closestIndex = -1;
      let minDistance = Infinity;
      
      labels.forEach((labelTime, index) => {
        const labelMs = labelTime.getTime();
        const eventCenterMs = (eventStartMs + eventEndMs) / 2;
        const distance = Math.abs(labelMs - eventCenterMs);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      // If we found a close enough point (within 2 minutes), map to it
      if (closestIndex !== -1 && minDistance < 120000) { // 2 minutes tolerance
        data[closestIndex] = event.type === 'apnea' ? 1 : 0.5;
        const isCurrentEvent = eventIndex === currentEventIndex;
        
        if (event.type === 'apnea') {
          colors[closestIndex] = isCurrentEvent ? '#dc2626' : '#ef4444';
          borderColors[closestIndex] = isCurrentEvent ? '#991b1b' : '#dc2626';
        } else {
          colors[closestIndex] = isCurrentEvent ? '#ea580c' : '#f97316';
          borderColors[closestIndex] = isCurrentEvent ? '#c2410c' : '#ea580c';
        }
        
        eventMapped = true;
        mappedIndices.push(closestIndex);
        
        console.log(`[DEBUG] Event ${eventIndex + 1} mapped to closest point (fallback):`, {
          type: event.type,
          closestIndex,
          distance: (minDistance / 1000).toFixed(1) + 's',
          eventTime: new Date((eventStartMs + eventEndMs) / 2).toISOString(),
          chartTime: labels[closestIndex]?.toISOString()
        });
      } else {
        console.warn(`[WARN] Event ${eventIndex + 1} could not be mapped to chart timeline:`, {
          eventStart: new Date(eventStartMs).toISOString(),
          eventEnd: new Date(eventEndMs).toISOString(),
          chartStart: labels[0]?.toISOString(),
          chartEnd: labels[labels.length - 1]?.toISOString(),
          eventDuration: event.duration,
          eventTimeRange: `${event.start_time}s to ${event.end_time}s`,
          closestDistance: closestIndex !== -1 ? (minDistance / 1000).toFixed(1) + 's' : 'N/A'
        });
      }
    } else {
      console.log(`[DEBUG] Event ${eventIndex + 1} mapped to ${mappedIndices.length} chart points:`, {
        type: event.type,
        mappedIndices: mappedIndices.slice(0, 5), // Show first 5 indices
        totalMapped: mappedIndices.length
      });
    }
  });
  
  const mappedEvents = data.filter(d => d > 0).length;
  console.log(`[DEBUG] Event timeline created: ${mappedEvents} events mapped to ${data.length} chart points`);
  
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
  const [fullFileStats, setFullFileStats] = useState<Record<string, ChannelStats>>({});

  // AHI Analysis Mode States
  const [ahiMode, setAhiMode] = useState<boolean>(false);
  const [ahiFlowChannel, setAhiFlowChannel] = useState<string>("");
  const [ahiSpo2Channel, setAhiSpo2Channel] = useState<string>("");
  const [ahiResults, setAhiResults] = useState<AHIResults | null>(null);
  const [ahiAnalyzing, setAhiAnalyzing] = useState<boolean>(false);
  const [ahiAnalysisProgress, setAhiAnalysisProgress] = useState<string>("");
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
      const response = await axiosInstance.get<{ data: number[] }>(
        endpoints.edfChunkDownsample,
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
      
      // Note: AHI mode now uses multi-channel approach, no cache clearing needed
      
      return newChannelData;
    });

  } catch (err: unknown) {
    console.error("Error fetching downsampled data:", err);
    if (err instanceof AxiosError) {
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

// Multi-channel data fetching function (moved before handleZoomOrPan to fix dependency order)
const fetchMultiChunks = useCallback(async (startSec: number, endSec: number) => {
  if (!fileInfo || !selectedChannels || selectedChannels.length === 0) return;
  try {
    setIsLoadingChunk(true);
    // target_points = desired number of points per channel (downsample target)
    // Use adaptive downsampling based on time range like single channel mode
    const timeRange = endSec - startSec;
    let target_points: number;
    if (timeRange <= 60) {
      target_points = 800;
    } else if (timeRange <= 600) {
      target_points = 600;
    } else if (timeRange <= 3600) {
      target_points = 500;
    } else {
      target_points = 400;
    }

    const params = {
      filePath: fileInfo.tempFilePath,
      channels: JSON.stringify(selectedChannels), // backend expects JSON string list of channels
      start_sec: Math.floor(startSec), // send seconds as integer
      end_sec: Math.ceil(endSec),
      max_points: target_points, // Fixed: use max_points instead of target_points
    };

    console.log('[DEBUG] Multi-channel request params:', params);
    const resp = await axiosInstance.get(endpoints.edfMultiChunk, { params });

    console.log('[DEBUG] Multi-channel raw response:', resp.data);
    console.log('[DEBUG] Response type:', typeof resp.data);
    console.log('[DEBUG] Response keys:', Object.keys(resp.data || {}));

    // expect resp.data structure: { channels: [ { name, data: [...], sample_rate, start_time_sec, stats? }, ... ] }
    const result = resp.data;
    if (!result || !result.channels) {
      console.warn("Multi chunk returned no channels", result);
      return;
    }

    console.log('[DEBUG] Multi-channel result channels:', result.channels);
    console.log('[DEBUG] Number of channels in result:', result.channels.length);

    // Build new channelData and stats
    setChannelData(prev => {
      const next = { ...prev };
      for (const chObj of result.channels) {
        const name = chObj.name;
        const dataArr: number[] = chObj.data || [];
        const sampleRate: number = chObj.sample_rate ?? 1;
        const start_time_sec: number = chObj.start_time_sec ?? (startSec); // fallback
        // Convert to {x: Date, y: value}
        const baseMs = new Date(fileInfo.startTime).getTime() + Math.round(start_time_sec * 1000);
        const points = dataArr.map((v: number, i: number) => {
          // For downsampled data, distribute points evenly across the requested time range
          const timeRange = endSec - startSec;
          const timeProgress = dataArr.length > 1 ? i / (dataArr.length - 1) : 0; // 0 to 1
          const msOffset = Math.round(timeProgress * timeRange * 1000);
          return { x: new Date(baseMs + msOffset), y: v };
        });
        next[name] = {
          data: points,
      sampleRate,
          startTimeSec: start_time_sec,
        };
      }
      return next;
    });

    // Stats (optional)
    console.log('[DEBUG] Checking for stats in multi-channel response:', { 
      hasGlobalStats: !!result.stats, 
      channelsCount: result.channels?.length,
      channelStats: result.channels?.map((ch: { name: string; stats?: any }) => ({ name: ch.name, hasStats: !!ch.stats }))
    });
    
    // NOTE: We do NOT update channelStats here because this function fetches chunk data
    // The full file statistics should be fetched separately via fetchFullStats()
    // and should remain constant regardless of the displayed data range
    console.log('[DEBUG] Multi-channel chunk data loaded, but not updating statistics (use fetchFullStats for full file stats)');
  } catch (err) {
    console.error("Error fetching multi-channel chunk data:", err);
  } finally {
    setIsLoadingChunk(false);
  }
}, [fileInfo, selectedChannels, setIsLoadingChunk, setChannelData]);

const debouncedFetchMultiChunks = useDebouncedCallback(fetchMultiChunks, 300);

// Function to fetch full file statistics for accurate results
const fetchFullStats = useCallback(async (channels: string[]) => {
  if (!fileInfo || channels.length === 0) return;
  
  // Check if we already have full file stats for all requested channels
  const missingChannels = channels.filter(ch => !fullFileStats[ch]);
  if (missingChannels.length === 0) {
    console.log('[DEBUG] Full file statistics already cached for all channels:', channels);
    // Update channelStats with cached full file stats for display
    const statsToShow: Record<string, ChannelStats> = {};
    channels.forEach(ch => {
      if (fullFileStats[ch]) {
        statsToShow[ch] = fullFileStats[ch];
      }
    });
    
    // Filter to only show statistics for the requested channels (not stale selectedChannels)
    const filteredStats: Record<string, ChannelStats> = {};
    if (multiChannelMode) {
      // In multi-channel mode, only show stats for the requested channels
      channels.forEach(ch => {
        if (statsToShow[ch]) {
          filteredStats[ch] = statsToShow[ch];
        }
      });
    } else {
      // In single-channel mode, show all stats
      Object.assign(filteredStats, statsToShow);
    }
    
    setChannelStats(filteredStats);
    return;
  }
  
  try {
    console.log('[DEBUG] Fetching full file statistics for missing channels:', missingChannels);
    setIsLoadingChunk(true);
    
    const response = await axiosInstance.post(endpoints.fullStats, {
      filePath: fileInfo.tempFilePath,
      channels: missingChannels
    });
    
    console.log('[DEBUG] Full stats response:', response.data);
    
    if (response.data && response.data.channels) {
      // Cache the full file stats
      setFullFileStats(prev => ({ ...prev, ...response.data.channels }));
      
      // Update display stats with all requested channels (cached + newly fetched)
      // Only show statistics for the requested channels (not stale selectedChannels)
      const statsToShow: Record<string, ChannelStats> = {};
      channels.forEach(ch => {
        if (response.data.channels[ch]) {
          statsToShow[ch] = response.data.channels[ch];
        } else if (fullFileStats[ch]) {
          statsToShow[ch] = fullFileStats[ch];
        }
      });
      
      // Filter to only show statistics for the requested channels
      const filteredStats: Record<string, ChannelStats> = {};
      if (multiChannelMode) {
        // In multi-channel mode, only show stats for the requested channels
        channels.forEach(ch => {
          if (statsToShow[ch]) {
            filteredStats[ch] = statsToShow[ch];
          }
        });
      } else {
        // In single-channel mode, show all stats
        Object.assign(filteredStats, statsToShow);
      }
      
      setChannelStats(filteredStats);
      
      console.log('[DEBUG] Full statistics loaded and cached for channels:', Object.keys(response.data.channels));
    }
  } catch (error) {
    console.error('[ERROR] Failed to fetch full statistics:', error);
    // Don't show error to user, just log it - stats are optional
  } finally {
    setIsLoadingChunk(false);
  }
}, [fileInfo, fullFileStats, multiChannelMode]); // Removed selectedChannels to avoid stale closure

// Function to fetch statistics for single channel mode
const fetchSingleChannelStats = useCallback(async (channel: string) => {
  if (!fileInfo || !channel) return;
  
  // Check if we already have full file stats for this channel
  if (fullFileStats[channel]) {
    console.log('[DEBUG] Single channel statistics already cached for:', channel);
    setChannelStats({ [channel]: fullFileStats[channel] });
    return;
  }
  
  try {
    console.log('[DEBUG] Fetching statistics for single channel:', channel);
    setIsLoadingChunk(true);
    
    const response = await axiosInstance.post(endpoints.fullStats, {
      filePath: fileInfo.tempFilePath,
      channels: [channel]
    });
    
    console.log('[DEBUG] Single channel stats response:', response.data);
    
    if (response.data && response.data.channels && response.data.channels[channel]) {
      // Cache the full file stats
      setFullFileStats(prev => ({ ...prev, [channel]: response.data.channels[channel] }));
      // Update display stats
      setChannelStats({ [channel]: response.data.channels[channel] });
      console.log('[DEBUG] Single channel statistics loaded and cached for:', channel);
    }
  } catch (error) {
    console.error('[ERROR] Failed to fetch single channel statistics:', error);
    // Don't show error to user, just log it - stats are optional
  } finally {
    setIsLoadingChunk(false);
  }
}, [fileInfo, fullFileStats]); // Added fullFileStats to dependencies

// NEW SIMPLIFIED APPROACH: Always use downsampling endpoint for consistency
const handleZoomOrPan = useCallback(async (startTime: number, endTime: number) => {
  if (!fileInfo) return;
  
  // Bound the time range to valid limits
  const boundedStartTime = Math.max(0, startTime);
  const boundedEndTime = Math.min(fileInfo.duration, Math.max(boundedStartTime + 0.1, endTime));
  
  // AHI MODE: Use multi-channel approach for reliable data loading
  if (ahiMode && ahiFlowChannel && ahiSpo2Channel) {
    console.log(`[DEBUG] AHI mode handleZoomOrPan: ${boundedStartTime}s to ${boundedEndTime}s using multi-channel approach`);
    
    // Temporarily set selectedChannels to AHI channels and use multi-channel mechanism
    const ahiChannels = [ahiFlowChannel, ahiSpo2Channel];
    setSelectedChannels(ahiChannels);
    
    // Use the same multi-channel mechanism that works reliably
    debouncedFetchMultiChunks(boundedStartTime, boundedEndTime);
    return;
  }
  
  // SINGLE CHANNEL MODE
  if (!multiChannelMode && selectedChannel) {
    console.log(`[DEBUG] handleZoomOrPan: ${boundedStartTime}s to ${boundedEndTime}s for single channel ${selectedChannel}`);
    
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
    return;
  }
  
  // MULTI-CHANNEL MODE
  if (multiChannelMode && selectedChannels && selectedChannels.length > 0) {
    console.log(`[DEBUG] handleZoomOrPan: ${boundedStartTime}s to ${boundedEndTime}s for multi-channel mode with ${selectedChannels.length} channels`);
    
    // Use the proper multi-channel mechanism that was working in development
    debouncedFetchMultiChunks(boundedStartTime, boundedEndTime);
    return;
  }
}, [
  fileInfo, // Keep full fileInfo as it's used extensively in the function
  selectedChannel, 
  debouncedFetchDownsampledData, 
  ahiMode, 
  ahiFlowChannel, 
  ahiSpo2Channel, 
  multiChannelMode, 
  selectedChannels, // Keep full array as it's used in the function
  debouncedFetchMultiChunks
]);

// Rolling window navigation for AHI events
const [currentEventIndex, setCurrentEventIndex] = useState(0);

// Max/Min finder state
  const [maxMinData, setMaxMinData] = useState<{
    max: { value: number; time: number; channel: string } | null;
    min: { value: number; time: number; channel: string } | null;
    allChannels?: Record<string, {
      max: { value: number; time: number };
      min: { value: number; time: number };
    }> | null;
  }>({ max: null, min: null, allChannels: null });
  const [showMaxMinMarkers, setShowMaxMinMarkers] = useState<boolean>(true);
  const [showMaxMinSection, setShowMaxMinSection] = useState<boolean>(false);

// Function to select an event by clicking on it
const selectEventByClick = useCallback((clickedTime: number) => {
  if (!ahiResults || !ahiResults.all_events.length) return;
  
  const events = ahiResults.all_events.sort((a, b) => a.start_time - b.start_time);
  
  // Find the closest event to the clicked time
  let closestEventIndex = 0;
  let minDistance = Infinity;
  
  events.forEach((event, index) => {
    const eventCenter = (event.start_time + event.end_time) / 2;
    const distance = Math.abs(eventCenter - clickedTime);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestEventIndex = index;
    }
  });
  
  console.log(`[DEBUG] Clicked at ${clickedTime}s, selecting event ${closestEventIndex + 1}/${events.length} (${events[closestEventIndex].type})`);
  
  setCurrentEventIndex(closestEventIndex);
  
  // Navigate to the selected event
  const event = events[closestEventIndex];
  const windowSize = 500;
  const eventCenter = (event.start_time + event.end_time) / 2;
  
  let start = eventCenter - windowSize / 2;
  let end = eventCenter + windowSize / 2;
  
  if (start < 0) {
    start = 0;
    end = Math.min(fileInfo?.duration || 0, windowSize);
  } else if (end > (fileInfo?.duration || 0)) {
    end = fileInfo?.duration || 0;
    start = Math.max(0, end - windowSize);
  }
  
  setViewport({ start, end });
  setTimeout(() => {
    handleZoomOrPanRef.current(start, end);
  }, 100);
}, [ahiResults, fileInfo]);

const navigateToEvent = useCallback((direction: 'next' | 'prev' | 'first' | 'last') => {
  if (!ahiResults || !ahiResults.all_events.length) {
    console.log('[DEBUG] No AHI results or events available for navigation');
    return;
  }
  
  const events = ahiResults.all_events.sort((a, b) => a.start_time - b.start_time);
  console.log(`[DEBUG] Available events (${events.length}):`, events.map((e, i) => `${i}: ${e.type}@${e.start_time}s`));
  console.log(`[DEBUG] Current event index: ${currentEventIndex}`);
  
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
    case 'last':
      newIndex = events.length - 1;
      break;
  }
  
  console.log(`[DEBUG] Navigation: ${direction} from index ${currentEventIndex} to ${newIndex}`);
  
  setCurrentEventIndex(newIndex);
  const event = events[newIndex];
  
  // Navigate to event with larger window for better visibility
  const windowSize = 500; // 8+ minutes around the event for better context
  const eventCenter = (event.start_time + event.end_time) / 2;
  
  // Ensure the event is perfectly centered in the view
  let start = eventCenter - windowSize / 2;
  let end = eventCenter + windowSize / 2;
  
  // Adjust if we're near the beginning or end of the recording
  if (start < 0) {
    start = 0;
    end = Math.min(fileInfo?.duration || 0, windowSize);
  } else if (end > (fileInfo?.duration || 0)) {
    end = fileInfo?.duration || 0;
    start = Math.max(0, end - windowSize);
  }
  
  console.log(`[DEBUG] Navigating to event ${newIndex + 1}/${events.length}: ${event.type} at ${event.start_time}s (${event.duration}s duration)`);
  console.log(`[DEBUG] Event center: ${eventCenter}s, Window: ${start}s to ${end}s (${end - start}s total)`);
  console.log(`[DEBUG] Event position in window: ${((eventCenter - start) / (end - start) * 100).toFixed(1)}% from left`);
  console.log(`[DEBUG] Current viewport: ${viewport?.start}s to ${viewport?.end}s`);
  console.log(`[DEBUG] Event outside current viewport: ${eventCenter < (viewport?.start || 0) || eventCenter > (viewport?.end || 0)}`);
  
  setViewport({ start, end });
  
  // For events outside current viewport, ensure data is loaded immediately
  console.log(`[DEBUG] Calling handleZoomOrPan to load data for new viewport`);
  handleZoomOrPanRef.current(start, end);
}, [ahiResults, currentEventIndex, fileInfo, viewport]);

// Chart click handler for AHI mode
const handleChartClick = useCallback((event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
  if (!ahiMode || !ahiResults || !fileInfo || !chartRef.current) return;
  
  const chart = chartRef.current;
  const rect = chart.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  
  // Get the data point at the clicked position
  const dataX = chart.scales.x.getValueForPixel(x);
  
  if (dataX !== null && dataX !== undefined) {
    // Convert chart time to seconds from start
    const startTime = new Date(fileInfo.startTime).getTime();
    const clickedTime = (dataX - startTime) / 1000;
    
    console.log(`[DEBUG] Chart clicked at time: ${clickedTime}s`);
    selectEventByClick(clickedTime);
  }
}, [ahiMode, ahiResults, fileInfo, selectEventByClick]);

// Function to find max/min values from backend (raw data)
const findMaxMinValues = useCallback(async () => {
  if (!fileInfo) return;
  
  // Skip max/min calculation in AHI mode as it's not needed
  if (ahiMode) {
    console.log('[DEBUG] Skipping max/min values calculation in AHI mode');
    return;
  }
  
  try {
    // Determine which channels to analyze based on current mode
    let channelsToAnalyze: string[] = [];
    
    if (ahiMode && ahiFlowChannel && ahiSpo2Channel) {
      channelsToAnalyze = [ahiFlowChannel, ahiSpo2Channel];
    } else if (multiChannelMode && selectedChannels.length > 0) {
      channelsToAnalyze = selectedChannels;
    } else if (selectedChannel) {
      channelsToAnalyze = [selectedChannel];
    }
    
    if (channelsToAnalyze.length === 0) {
      console.log('[DEBUG] No channels to analyze for max/min');
      return;
    }
    
    console.log('[DEBUG] Finding max/min values for channels:', channelsToAnalyze);
    
    // Get current viewport for time range
    const startSec = viewport?.start || 0;
    const endSec = viewport?.end || fileInfo.duration;
    
    const requestData = {
      filePath: fileInfo.tempFilePath,
      channels: channelsToAnalyze,
      startSec: startSec,
      endSec: endSec
    };
    
    console.log('[DEBUG] Max-min request data:', requestData);
    console.log('[DEBUG] Max-min endpoint:', endpoints.maxMinValues);
    console.log('[DEBUG] Axios instance config for max-min:', {
      baseURL: axiosInstance.defaults.baseURL,
      headers: axiosInstance.defaults.headers,
      timeout: axiosInstance.defaults.timeout
    });
    
    const response = await axiosInstance.post(endpoints.maxMinValues, requestData);
    
    if (response.data.success) {
      const backendData = response.data.data;
      console.log('[DEBUG] Backend max/min results:', backendData);
      
      // Store all channel max/min data for multi-channel mode
      if (multiChannelMode) {
        // For multi-channel mode, store all channel data
        setMaxMinData({
          max: null, // Will be set per channel
          min: null, // Will be set per channel
          allChannels: backendData // Store all channel data
        });
      } else {
        // For single channel and AHI mode, find global max and min
        let globalMax = { value: -Infinity, time: 0, channel: '' };
        let globalMin = { value: Infinity, time: 0, channel: '' };
        
        Object.entries(backendData).forEach(([channel, data]) => {
          const channelData = data as {
            max: { value: number; time: number };
            min: { value: number; time: number };
          };
          if (channelData.max && channelData.max.value > globalMax.value) {
            globalMax = {
              value: channelData.max.value,
              time: channelData.max.time,
              channel: channel
            };
          }
          if (channelData.min && channelData.min.value < globalMin.value) {
            globalMin = {
              value: channelData.min.value,
              time: channelData.min.time,
              channel: channel
            };
          }
        });
        
        if (globalMax.value !== -Infinity && globalMin.value !== Infinity) {
          setMaxMinData({
            max: globalMax,
            min: globalMin,
            allChannels: null
          });
          console.log(`[DEBUG] Backend found max: ${globalMax.value.toFixed(2)} at ${globalMax.time.toFixed(1)}s (${globalMax.channel})`);
          console.log(`[DEBUG] Backend found min: ${globalMin.value.toFixed(2)} at ${globalMin.time.toFixed(1)}s (${globalMin.channel})`);
        }
      }
    }
  } catch (error) {
    console.error('[ERROR] Failed to get max/min values from backend:', error);
  }
}, [fileInfo, ahiMode, ahiFlowChannel, ahiSpo2Channel, multiChannelMode, selectedChannels, selectedChannel, viewport]);

// Function to navigate to max/min value
const navigateToMaxMin = useCallback((type: 'max' | 'min') => {
  const target = maxMinData[type];
  if (!target || !fileInfo) return;
  
  const windowSize = 1200; // 20 minutes (20 * 60 seconds)
  const start = Math.max(0, target.time - windowSize / 2);
  const end = Math.min(fileInfo.duration, target.time + windowSize / 2);
  
  console.log(`[DEBUG] Navigating to ${type}: ${target.value.toFixed(2)} at ${target.time.toFixed(1)}s (${target.channel})`);
  console.log(`[DEBUG] Window: ${start}s to ${end}s (${end - start}s total)`);
  
  setViewport({ start, end });
  setTimeout(() => {
    handleZoomOrPanRef.current(start, end);
  }, 100);
}, [maxMinData, fileInfo]);


// Helper function to convert seconds offset to actual EDF file timestamp (HH:MM:SS)
const formatEDFTimestamp = useCallback((secondsFromStart: number) => {
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
}, [fileInfo?.startTime]);

// Function to navigate to specific channel max/min value
const navigateToChannelMaxMin = useCallback((channel: string, type: 'max' | 'min') => {
  if (!maxMinData.allChannels || !fileInfo) return;
  
  const channelData = maxMinData.allChannels[channel];
  if (!channelData || !channelData[type]) return;

  const target = channelData[type];
  
  const windowSize = 1200; // 20 minutes (20 * 60 seconds)
  const start = Math.max(0, target.time - windowSize / 2);
  const end = Math.min(fileInfo.duration, target.time + windowSize / 2);

  console.log(`[DEBUG] Navigating to ${channel} ${type}: ${target.value.toFixed(2)} at ${target.time.toFixed(1)}s`);
  console.log(`[DEBUG] Window: ${start}s to ${end}s (${end - start}s total)`);

  setViewport({ start, end });
  setTimeout(() => {
    handleZoomOrPanRef.current(start, end);
  }, 100);
}, [maxMinData.allChannels, fileInfo]);

// Auto-find max/min values when chart data changes
useEffect(() => {
  if (fileInfo && (chartDataState || Object.keys(channelData).length > 0)) {
    findMaxMinValues();
  }
}, [fileInfo, chartDataState, channelData, findMaxMinValues]);

// AHI Analysis Function
const handleAHIAnalysis = useCallback(async () => {
  if (!fileInfo || !ahiFlowChannel || !ahiSpo2Channel) {
    setError("Please select both Flow and SpO2 channels for AHI analysis");
    return;
  }

  setAhiAnalyzing(true);
  setError(null);
  
  // Professional analysis progress updates
  const progressSteps = [
    "Initializing Python analysis engine...",
    "Loading full-resolution flow and SpO2 data...",
    "Applying AASM clinical criteria...",
    "Detecting apnea events (≥90% flow reduction)...",
    "Detecting hypopnea events (30-90% flow reduction)...",
    "Analyzing oxygen desaturation patterns...",
    "Calculating AHI score and severity classification...",
    "Generating comprehensive sleep metrics...",
    "Finalizing analysis results..."
  ];
  
  let currentStep = 0;
  const progressInterval = setInterval(() => {
    if (currentStep < progressSteps.length) {
      setAhiAnalysisProgress(progressSteps[currentStep]);
      currentStep++;
    }
  }, 800); // Update every 800ms

  console.log('[DEBUG] Starting AHI analysis:', {
    filePath: fileInfo.tempFilePath,
    flowChannel: ahiFlowChannel,
    spo2Channel: ahiSpo2Channel
  });

  try {
    const requestData = {
      filePath: fileInfo.tempFilePath,
      flowChannel: ahiFlowChannel,
      spo2Channel: ahiSpo2Channel
    };
    
    console.log('[DEBUG] AHI Analysis request data:', requestData);
    console.log('[DEBUG] AHI Analysis endpoint:', endpoints.ahiAnalysis);
    console.log('[DEBUG] Axios instance config:', {
      baseURL: axiosInstance.defaults.baseURL,
      headers: axiosInstance.defaults.headers,
      timeout: axiosInstance.defaults.timeout
    });
    
    // Try AHI analysis with retry mechanism and progress tracking
    let response;
    let retryCount = 0;
    const maxRetries = 3;
    
    // Set a longer timeout for AHI analysis (up to 10 minutes for large files)
    const originalTimeout = axiosInstance.defaults.timeout;
    axiosInstance.defaults.timeout = 600000; // 10 minutes
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`[DEBUG] AHI analysis attempt ${retryCount + 1}/${maxRetries + 1}`);
        setAhiAnalysisProgress(`Starting AHI analysis... (Attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        response = await axiosInstance.post<AHIResults & { success: boolean }>(
          endpoints.ahiAnalysis,
          requestData
        );
        console.log(`[DEBUG] AHI analysis attempt ${retryCount + 1} successful`);
        setAhiAnalysisProgress("AHI analysis completed successfully!");
        break; // Success, exit retry loop
      } catch (err) {
        retryCount++;
        console.log(`[DEBUG] AHI analysis attempt ${retryCount} failed:`, err);
        if (retryCount <= maxRetries) {
          const waitTime = retryCount * 2000; // Exponential backoff: 2s, 4s, 6s
          console.log(`[DEBUG] Retrying in ${waitTime/1000} seconds...`);
          setAhiAnalysisProgress(`Analysis failed, retrying in ${waitTime/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.log(`[DEBUG] All ${maxRetries + 1} AHI analysis attempts failed`);
          throw err; // Re-throw error if all retries failed
        }
      }
    }
    
    // Restore original timeout
    axiosInstance.defaults.timeout = originalTimeout;

    if (response && response.data.success) {
      // Validate response data structure
      const ahiData = response.data;
      console.log('[DEBUG] AHI analysis response structure:', {
        hasAhiAnalysis: !!ahiData.ahi_analysis,
        hasEvents: !!ahiData.all_events,
        eventCount: ahiData.all_events?.length || 0,
        apneaCount: ahiData.apnea_events?.length || 0,
        hypopneaCount: ahiData.hypopnea_events?.length || 0
      });
      
      // Validate required fields
      if (!ahiData.ahi_analysis) {
        throw new Error('AHI analysis results missing from response');
      }
      
      if (!ahiData.all_events || !Array.isArray(ahiData.all_events)) {
        console.warn('[WARN] No events found in AHI analysis - this may be normal for healthy patients');
        ahiData.all_events = [];
      }
      
      if (!ahiData.apnea_events || !Array.isArray(ahiData.apnea_events)) {
        ahiData.apnea_events = [];
      }
      
      if (!ahiData.hypopnea_events || !Array.isArray(ahiData.hypopnea_events)) {
        ahiData.hypopnea_events = [];
      }
      
      setAhiResults(ahiData);
      console.log('[DEBUG] AHI analysis completed successfully:', {
        ahiScore: ahiData.ahi_analysis.ahi_score,
        severity: ahiData.ahi_analysis.severity,
        totalEvents: ahiData.all_events.length,
        apneaEvents: ahiData.apnea_events.length,
        hypopneaEvents: ahiData.hypopnea_events.length,
        recordingDuration: (fileInfo.duration/3600).toFixed(1) + ' hours'
      });
      
      // Full night view will be handled by the useEffect hook when ahiResults changes
    } else {
      throw new Error('AHI analysis failed - invalid response format');
    }
  } catch (err) {
    console.error('AHI analysis error:', err);
    
    // Better error handling for different types of errors
    let errorMessage = 'AHI analysis failed';
    if (err instanceof AxiosError) {
      if (err.message.includes('Network Error') || err.message.includes('ERR_CONNECTION_CLOSED')) {
        errorMessage = 'Connection lost during AHI analysis. The analysis may have completed on the server. Please try again.';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'AHI analysis timed out. Please try with a smaller file or wait a few minutes and try again.';
      } else {
        errorMessage = `AHI analysis failed: ${err.response?.data?.error || err.message}`;
      }
    } else if (err instanceof Error) {
      errorMessage = `AHI analysis failed: ${err.message}`;
    }
    
    setError(errorMessage);
  } finally {
    clearInterval(progressInterval);
    setAhiAnalyzing(false);
    setAhiAnalysisProgress("");
  }
}, [fileInfo, ahiFlowChannel, ahiSpo2Channel]);

// Effect to handle AHI results and set full night view
const ahiLoadedResultsRef = useRef<string | null>(null);
const handleZoomOrPanRef = useRef(handleZoomOrPan);

// Keep the ref updated with the current function
useEffect(() => {
  handleZoomOrPanRef.current = handleZoomOrPan;
}, [handleZoomOrPan]);

useEffect(() => {
  if (ahiResults && fileInfo) {
    // Create a unique key for this AHI analysis result
    const ahiKey = `${ahiResults.ahi_analysis?.ahi_score}_${ahiResults.all_events?.length}_${fileInfo.duration}`;
    
    // Only load if we haven't loaded this specific result yet
    if (ahiLoadedResultsRef.current !== ahiKey) {
      console.log('[DEBUG] AHI results received, setting full night view:', {
        totalEvents: ahiResults.all_events?.length || 0,
        apneaEvents: ahiResults.apnea_events?.length || 0,
        hypopneaEvents: ahiResults.hypopnea_events?.length || 0,
        recordingDuration: fileInfo.duration,
        ahiScore: ahiResults.ahi_analysis?.ahi_score
      });
      
      // Set full night view to show the entire recording
      const fullNightView = {
        start: 0,
        end: fileInfo.duration
      };
      
      setViewport(fullNightView);
      console.log('[DEBUG] Set viewport to full night view:', fullNightView);
      
      // Load initial data for the full night view
      if (ahiFlowChannel && ahiSpo2Channel) {
        console.log('[DEBUG] Loading initial AHI data for full night view');
        handleZoomOrPanRef.current(0, fileInfo.duration);
        ahiLoadedResultsRef.current = ahiKey;
      }
    }
  }
}, [ahiResults, fileInfo, ahiFlowChannel, ahiSpo2Channel]);

// Effect to ensure chart updates when viewport changes in multi-channel mode
useEffect(() => {
  if (!fileInfo || !multiChannelMode || !viewport || !selectedChannels || selectedChannels.length === 0) return;
  
  console.log('[DEBUG] Viewport changed in multi-channel mode:', {
    start: viewport.start,
    end: viewport.end,
    selectedChannels,
    channelDataKeys: Object.keys(channelData),
    dataPoints: Object.values(channelData).map(d => d?.data?.length || 0)
  });
  
  // The chart should automatically update when channelData changes via the useMemo dependency
  // This effect is mainly for debugging and ensuring the viewport state is correct
  // Data loading is handled by the proper multi-channel functions when called explicitly (double-click, max/min navigation)
}, [fileInfo, multiChannelMode, viewport, selectedChannels, channelData]);


// Mode switching functions
const handleModeSwitch = useCallback((mode: 'single' | 'multi' | 'ahi') => {
  // Clear previous states
  setError(null);
  setAhiResults(null);
  
  switch (mode) {
    case 'single':
      setMultiChannelMode(false);
      setAhiMode(false);
      console.log('[DEBUG] Switching to single-channel mode');
      // Clear multi-channel data
      setChannelData({});
      setSelectedChannels([]);
      
      // Fetch statistics for the currently selected single channel
      if (selectedChannel) {
        fetchSingleChannelStats(selectedChannel);
      }
      break;
    case 'multi':
      console.log('[DEBUG] Switching to multi-channel mode');
      console.log('[DEBUG] Current selectedChannels:', selectedChannels);
      console.log('[DEBUG] Current channelData keys:', Object.keys(channelData));
      setMultiChannelMode(true);
      setAhiMode(false);
      // Trigger multi-channel data fetch if we have selected channels
      if (fileInfo && selectedChannels.length > 0) {
        console.log('[DEBUG] Triggering multi-channel data fetch for:', selectedChannels);
        const start = 0;
        const end = fileInfo.duration;
        setViewport({ start, end });
        debouncedFetchMultiChunks(start, end);
        
        // Also fetch full file statistics for accurate results
        fetchFullStats(selectedChannels);
      } else {
        console.log('[DEBUG] No selected channels for multi-channel mode, waiting for user selection');
      }
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
        
        // Load initial data for both channels
        if (flowChannel && spo2Channel) {
          console.log('[DEBUG] Loading initial data for AHI channels');
          const timeRange = Math.min(3600, fileInfo.duration); // Load first hour or full duration if shorter
          // Use same responsive downsampling as single/multi-channel modes
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
          const startTime = 0;
          const endTime = timeRange;
          
          // Load Flow channel data
          const flowChannelIndex = fileInfo.channels.indexOf(flowChannel);
          const flowSampleRate = fileInfo.sampleRates[flowChannelIndex];
          const flowStartSample = Math.floor(startTime * flowSampleRate);
          const flowNumSamples = Math.floor((endTime - startTime) * flowSampleRate);
          
          fetchDownsampledData(
            fileInfo.tempFilePath,
            flowChannel,
            flowStartSample,
            flowNumSamples,
            targetPoints,
            startTime,
            endTime
          );
          
          // Load SpO2 channel data
          const spo2ChannelIndex = fileInfo.channels.indexOf(spo2Channel);
          const spo2SampleRate = fileInfo.sampleRates[spo2ChannelIndex];
          const spo2StartSample = Math.floor(startTime * spo2SampleRate);
          const spo2NumSamples = Math.floor((endTime - startTime) * spo2SampleRate);
          
          fetchDownsampledData(
            fileInfo.tempFilePath,
            spo2Channel,
            spo2StartSample,
            spo2NumSamples,
            targetPoints,
            startTime,
            endTime
          );
        }
      }
      break;
  }
}, [fileInfo, selectedChannels, channelData, fetchDownsampledData, debouncedFetchMultiChunks, fetchFullStats, fetchSingleChannelStats, selectedChannel]);

// Add missing useEffect for initial data loading
useEffect(() => {
  if (!fileInfo) return;
  
  // In AHI mode, load Flow and SpO2 channels
  if (ahiMode && ahiFlowChannel && ahiSpo2Channel) {
    console.log('[DEBUG] Loading initial data for AHI channels:', { ahiFlowChannel, ahiSpo2Channel, ahiMode });
    // For AHI mode, load a larger initial view to show more context
    const initialEndTime = Math.min(1800, fileInfo.duration); // 30 minutes instead of 5
    console.log('[DEBUG] Calling handleZoomOrPan for AHI mode:', { start: 0, end: initialEndTime });
    handleZoomOrPanRef.current(0, initialEndTime);
    setViewport({ start: 0, end: initialEndTime });
    return;
  }
  
  // In other modes, load selected channel
  if (!selectedChannel) return;
  const initialEndTime = Math.min(300, fileInfo.duration);
  handleZoomOrPanRef.current(0, initialEndTime);
  setViewport({ start: 0, end: initialEndTime });
}, [selectedChannel, fileInfo, ahiMode, ahiFlowChannel, ahiSpo2Channel]);

// Effect to fetch statistics when selected channel changes in single-channel mode
useEffect(() => {
  if (!multiChannelMode && selectedChannel && fileInfo) {
    console.log('[DEBUG] Selected channel changed in single-channel mode:', selectedChannel);
    fetchSingleChannelStats(selectedChannel);
  }
}, [selectedChannel, multiChannelMode, fileInfo, fetchSingleChannelStats]);

// Note: AHI mode now uses multi-channel approach, no cache clearing needed

// Effect to set full night view when AHI results are available
useEffect(() => {
  if (ahiMode && ahiResults && fileInfo && ahiResults.all_events.length > 0) {
    // Create a unique key for this AHI full night view setup
    const fullNightKey = `${ahiResults.ahi_analysis?.ahi_score}_${ahiResults.all_events.length}_${fileInfo.duration}`;
    
    // Check if we've already set the full night view for this AHI result
    if (ahiFullNightViewSetRef.current === fullNightKey) {
      console.log('[DEBUG] AHI full night view already set, skipping:', fullNightKey);
      return;
    }
    
    console.log('[DEBUG] AHI results available, setting full night view');
    const fullNightViewport = { start: 0, end: fileInfo.duration };
    setViewport(fullNightViewport);
    console.log(`[DEBUG] Set full night viewport: ${fullNightViewport.start}s to ${fullNightViewport.end}s (${(fullNightViewport.end/3600).toFixed(1)} hours)`);
    
    // Mark this full night view as set to prevent infinite loops
    ahiFullNightViewSetRef.current = fullNightKey;
    
    // Load full night data for AHI display using multi-channel approach
    console.log('[DEBUG] Loading full night data for AHI display using multi-channel approach');
    
    // Set AHI channels and use multi-channel mechanism for consistency
    const ahiChannels = [ahiFlowChannel, ahiSpo2Channel];
    setSelectedChannels(ahiChannels);
    
    // Use the same multi-channel mechanism that works reliably
    debouncedFetchMultiChunks(0, fileInfo.duration);
  }
}, [ahiMode, ahiResults, fileInfo, ahiFlowChannel, ahiSpo2Channel, debouncedFetchMultiChunks]);

    // OLD: toggleMultiChannelMode removed - now handled by handleModeSwitch
    // Handle channel selection changes
  const handleChannelSelect = (channel: string) => {
    if (selectedChannels.includes(channel)) {
      console.log(`[DEBUG] Removing channel ${channel} from selection`);
      const newSelectedChannels = selectedChannels.filter(ch => ch !== channel);
      setSelectedChannels(newSelectedChannels);
      
      // Update statistics display for the new selection
      if (multiChannelMode) {
        // Filter statistics to only show currently selected channels
        const filteredStats: Record<string, ChannelStats> = {};
        newSelectedChannels.forEach(ch => {
          if (fullFileStats[ch]) {
            filteredStats[ch] = fullFileStats[ch];
          }
        });
        setChannelStats(filteredStats);
      } else {
        // In single channel mode, just remove the unselected channel stats
        setChannelStats(prev => {
          const newStats = { ...prev };
          delete newStats[channel];
          return newStats;
        });
      }
    } else {
      if (selectedChannels.length < 5) {
        console.log(`[DEBUG] Adding channel ${channel} to selection`);
        const newSelectedChannels = [...selectedChannels, channel];
        setSelectedChannels(newSelectedChannels);
        
        // If we're in multi-channel mode, fetch data for the new selection
        if (multiChannelMode && fileInfo) {
          console.log(`[DEBUG] Fetching multi-channel data for new selection:`, newSelectedChannels);
          console.log(`[DEBUG] Current channelData before fetch:`, Object.keys(channelData));
          const start = 0;
          const end = fileInfo.duration;
          setViewport({ start, end });
          debouncedFetchMultiChunks(start, end);
          
          // Also fetch full file statistics for accurate results
          fetchFullStats(newSelectedChannels);
        } else {
          console.log(`[DEBUG] Not fetching data - multiChannelMode: ${multiChannelMode}, hasFileInfo: ${!!fileInfo}`);
        }
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

        const response = await axiosInstance.get<{ data: number[] }>(
          `${endpoints.edfChunk}?filePath=${encodeURIComponent(fileInfo.tempFilePath)}&channel=${encodeURIComponent(channel)}&start_sample=0&num_samples=${initialNumSamples}`
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
  if (!fileInfo) return;
  const start = 0;
  const end = fileInfo.duration; // number of seconds in recording
  setViewport({ start, end });

  console.log('[DEBUG] handleFullNightView called:', { start, end, ahiMode, multiChannelMode });

  if (ahiMode && ahiFlowChannel && ahiSpo2Channel) {
    // AHI MODE: Use multi-channel approach for reliable data loading
    console.log('[DEBUG] Full night view for AHI mode - using multi-channel approach');
    const ahiChannels = [ahiFlowChannel, ahiSpo2Channel];
    setSelectedChannels(ahiChannels);
    debouncedFetchMultiChunks(start, end);
  } else if (multiChannelMode) {
    debouncedFetchMultiChunks(start, end);
  } else {
    // single-channel: use fetchDownsampledData function
    if (fileInfo.tempFilePath && selectedChannel) {
    const sampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(selectedChannel)];
    const numSamples = Math.floor(fileInfo.duration * sampleRate);
      fetchDownsampledData(fileInfo.tempFilePath, selectedChannel, 0, numSamples, 2000, start, end);
    }
  }
};
// Generiraj boje za točke ako je SpO2 kanal

  // Create stable reference to flow channel data to prevent infinite loops
  const flowChannelData = useMemo(() => {
    return channelData[ahiFlowChannel];
  }, [channelData, ahiFlowChannel]);

  // Add ref to track event timeline generation to prevent infinite loops
  const eventTimelineGeneratedRef = useRef<string | null>(null);
  const ahiFullNightViewSetRef = useRef<string | null>(null);

  // Create event timeline data separately to avoid constant recalculation
  const eventTimelineData = useMemo(() => {
    if (!ahiResults || !showEventOverlays || !ahiResults.all_events.length || !fileInfo) {
      return null;
    }
    
    // Only create timeline data if we have flow data with labels
    if (!flowChannelData?.labels || !Array.isArray(flowChannelData.labels)) {
      return null;
    }
    
    // Create a unique key for this event timeline generation
    const eventTimelineKey = `${ahiResults.all_events.length}_${flowChannelData.labels.length}_${currentEventIndex}_${showEventOverlays}`;
    
    // Check if we've already generated this exact event timeline
    if (eventTimelineGeneratedRef.current === eventTimelineKey) {
      console.log('[DEBUG] Event timeline already generated, skipping:', eventTimelineKey);
      return null; // Return null to prevent recalculation
    }
    
    console.log('[DEBUG] Creating event timeline data:', {
      startTime: fileInfo.startTime,
      startTimeMs: new Date(fileInfo.startTime).getTime(),
      labelsCount: flowChannelData.labels.length,
      eventsCount: ahiResults.all_events.length,
      currentEventIndex,
      eventTimelineKey
    });
    
    const result = createEventTimelineData(flowChannelData.labels, ahiResults.all_events, fileInfo.startTime, currentEventIndex);
    
    // Mark this event timeline as generated to prevent infinite loops
    eventTimelineGeneratedRef.current = eventTimelineKey;
    
    return result;
  }, [
    ahiResults, // Keep full ahiResults as it's used in the function
    showEventOverlays, 
    fileInfo, // Keep full fileInfo as it's used in the function
    currentEventIndex, 
    flowChannelData // Keep full flowChannelData as it's used in the function
  ]);

  // Create AHI annotations separately to avoid constant recalculation
  const ahiAnnotations = useMemo(() => {
    if (!ahiMode || !ahiResults || !showEventOverlays || !ahiResults.all_events.length || !fileInfo) {
      return null;
    }
    
    const startTime = new Date(fileInfo.startTime).getTime();
    
    return ahiResults.all_events
      .filter(event => {
        // Only show events within current viewport
        if (!viewport) return true;
        return event.start_time >= viewport.start && event.start_time <= viewport.end;
      })
      .map((event: AHIEvent) => {
        const eventStartTime = startTime + event.start_time * 1000;
        const eventEndTime = startTime + event.end_time * 1000;
        
        return {
          type: 'box' as const,
          xMin: eventStartTime,
          xMax: eventEndTime,
          yMin: 'chartMin' as const,
          yMax: 'chartMax' as const,
          backgroundColor: event.type === 'apnea' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(249, 115, 22, 0.15)',
          borderColor: event.type === 'apnea' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(249, 115, 22, 0.8)',
          borderWidth: 1,
          borderDash: event.type === 'apnea' ? [5, 5] : [3, 3],
          label: {
            enabled: true,
            content: [
              `${event.type.toUpperCase()}`,
              `${event.duration.toFixed(1)}s`,
              event.spo2_drop ? `SpO2 -${event.spo2_drop.toFixed(1)}%` : ''
            ].filter(Boolean),
            position: 'start' as const,
            backgroundColor: event.type === 'apnea' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(249, 115, 22, 0.9)',
            color: 'white',
            font: { size: 10, weight: 'bold' as const },
            padding: 4,
            rotation: 0,
            xAdjust: 0,
            yAdjust: -10
          }
        };
      });
  }, [
    ahiMode, 
    ahiResults, // Keep full ahiResults as it's needed for filtering and mapping
    showEventOverlays, 
    fileInfo, // Keep full fileInfo as it's used in the function
    viewport // Keep full viewport as it's used in the function
  ]);

  // Create AHI chart data using multi-channel approach
  const ahiChartData = useMemo(() => {
    if (!ahiMode || !ahiFlowChannel || !ahiSpo2Channel) {
      return null;
    }

    const flowData = channelData[ahiFlowChannel];
    const spo2Data = channelData[ahiSpo2Channel];
    
    // Check if both channels have data before proceeding
    if (!flowData || !spo2Data || !flowData.data || !spo2Data.data) {
      console.log('[DEBUG] AHI channel data not ready yet:', {
        flowData: flowData ? 'exists' : 'missing',
        spo2Data: spo2Data ? 'exists' : 'missing',
        flowDataLength: flowData?.data?.length || 0,
        spo2DataLength: spo2Data?.data?.length || 0
      });
      return null;
    }

    console.log('[DEBUG] AHI mode using multi-channel data format:', {
      ahiFlowChannel,
      ahiSpo2Channel,
      flowDataLength: flowData.data.length,
      spo2DataLength: spo2Data.data.length,
      flowDataType: Array.isArray(flowData.data) ? typeof flowData.data[0] : 'unknown',
      spo2DataType: Array.isArray(spo2Data.data) ? typeof spo2Data.data[0] : 'unknown'
    });

    // Use the same data format as multi-channel mode (already time-synchronized)
    const datasets = [
      {
        label: `${ahiFlowChannel} (Flow)`,
        data: flowData.data, // Multi-channel data is already in {x: Date, y: number} format
        borderColor: "rgb(34, 197, 94)", // Green for flow
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        tension: 0.2,
        pointRadius: 0,
        borderWidth: 1,
        yAxisID: 'y', // Primary Y-axis for flow
      },
      {
        label: `${ahiSpo2Channel} (SpO2)`,
        data: spo2Data.data, // Multi-channel data is already in {x: Date, y: number} format
        borderColor: "rgb(59, 130, 246)", // Blue for SpO2
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.2,
        pointRadius: 1,
        borderWidth: 2,
        yAxisID: 'y1', // Secondary Y-axis for SpO2
        // Color SpO2 points red when < 90%
        pointBackgroundColor: Array.isArray(spo2Data.data) && spo2Data.data.length > 0 && typeof spo2Data.data[0] === 'object' && spo2Data.data[0]?.y !== undefined
          ? (spo2Data.data as {x: Date, y: number}[]).map((point: {x: Date, y: number}) => 
              point.y < 90 ? "red" : "rgb(59, 130, 246)"
            )
          : undefined,
      }
    ];

    // Add professional event timeline track (if events exist and overlays enabled)
    if (eventTimelineData && flowData.labels) {
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
    
    console.log('[DEBUG] AHI mode chartJSData generated using multi-channel approach:', {
      labelsLength: flowData.labels?.length || 0,
      datasetsCount: datasets.length,
      datasetLabels: datasets.map(d => d.label)
    });

    return {
      labels: [], // Empty labels for time-based data format (using x,y coordinates)
      datasets: datasets as unknown as ChartDataset<"line">[], // Type assertion for Chart.js compatibility
    };
  }, [ahiMode, ahiFlowChannel, ahiSpo2Channel, channelData, eventTimelineData]);

  const chartJSData: { labels: Date[] | string[]; datasets: ChartDataset<"line">[] } = useMemo(() => {
  // AHI ANALYSIS MODE - Use isolated AHI chart data
  if (ahiMode && ahiChartData) {
    return ahiChartData;
  }

  // SINGLE CHANNEL MODE
  if (!multiChannelMode || selectedChannels.length === 0) {
    if (!chartDataState || !selectedChannel) return { labels: [] as string[], datasets: [] as ChartDataset<"line">[] };

    const isSpo2 = selectedChannel.toLowerCase().includes("spo2");
    const pointColors = isSpo2 && chartDataState.data
      ? chartDataState.data.map(value => value < 90 ? "red" : "blue")
      : [];

    const datasets = [{
        label: selectedChannel,
        data: chartDataState.data,
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        tension: 0.4,
      pointRadius: isSpo2 ? 1 : 0,
        pointBackgroundColor: isSpo2 ? pointColors : undefined,
        borderWidth: 1,
    }];

    // Add max/min data points if enabled and data exists
    if (showMaxMinMarkers && maxMinData.max && maxMinData.min && fileInfo) {
      const startTime = new Date(fileInfo.startTime);
      
      // Add MAX data point
      if (viewport && maxMinData.max.time >= viewport.start && maxMinData.max.time <= viewport.end) {
        const maxTime = addSeconds(startTime, maxMinData.max.time);
        const maxDataset = {
          label: `MAX: ${maxMinData.max.value.toFixed(2)} (${maxMinData.max.channel})`,
          data: [{ x: maxTime, y: maxMinData.max.value }],
          borderColor: '#10B981',
          backgroundColor: '#10B981',
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBorderWidth: 1,
          pointBorderColor: '#ffffff',
          pointBackgroundColor: '#10B981',
          showLine: false,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (datasets as any).push(maxDataset);
      }
      
      // Add MIN data point
      if (viewport && maxMinData.min.time >= viewport.start && maxMinData.min.time <= viewport.end) {
        const minTime = addSeconds(startTime, maxMinData.min.time);
        const minDataset = {
          label: `MIN: ${maxMinData.min.value.toFixed(2)} (${maxMinData.min.channel})`,
          data: [{ x: minTime, y: maxMinData.min.value }],
          borderColor: '#EF4444',
          backgroundColor: '#EF4444',
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBorderWidth: 1,
          pointBorderColor: '#ffffff',
          pointBackgroundColor: '#EF4444',
          showLine: false,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (datasets as any).push(minDataset);
      }
    }

    return {
      labels: chartDataState.labels || [],
      datasets: datasets as ChartDataset<"line">[], // Type assertion for Chart.js compatibility
    };
  }

  // MULTI CHANNEL MODE
  // Use {x: Date, y: number} format for proper time-based positioning
  const colors = ["#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6"];

  console.log('[DEBUG] Multi-channel chart data generation:', {
    selectedChannels,
    selectedChannelsLength: selectedChannels?.length,
    channelDataKeys: Object.keys(channelData),
    channelDataSize: Object.keys(channelData).length,
    viewport: viewport,
    fileStartTime: fileInfo?.startTime
  });
  
  // Log the actual data points for each channel to verify they're in the correct time range
  selectedChannels.forEach(channel => {
    const chan = channelData[channel];
    if (chan && chan.data && chan.data.length > 0) {
      const firstPoint = chan.data[0];
      const lastPoint = chan.data[chan.data.length - 1];
      
      // Check if data points are objects with x and y properties
      if (typeof firstPoint === 'object' && 'x' in firstPoint && typeof lastPoint === 'object' && 'x' in lastPoint) {
        const firstTime = new Date(firstPoint.x).getTime();
        const lastTime = new Date(lastPoint.x).getTime();
        const fileStartMs = new Date(fileInfo?.startTime || 0).getTime();
        
        console.log(`[DEBUG] Channel ${channel} data time range:`, {
          dataPointsCount: chan.data.length,
          firstPointTime: new Date(firstPoint.x).toLocaleTimeString('en-US', { hour12: false }),
          lastPointTime: new Date(lastPoint.x).toLocaleTimeString('en-US', { hour12: false }),
          firstPointSec: (firstTime - fileStartMs) / 1000,
          lastPointSec: (lastTime - fileStartMs) / 1000,
          expectedViewport: viewport
        });
      }
    }
  });

  // Safety check for selectedChannels
  if (!selectedChannels || selectedChannels.length === 0) {
    console.log('[DEBUG] No selected channels for multi-channel mode');
    return { labels: [] as string[], datasets: [] as ChartDataset<"line">[] };
  }

  const datasets = selectedChannels.map((channel, index) => {
      const chan = channelData[channel];
      console.log(`[DEBUG] Processing channel ${channel}:`, {
        hasChannelData: !!chan,
        hasData: !!chan?.data,
        dataLength: chan?.data?.length,
        dataType: typeof chan?.data,
        isArray: Array.isArray(chan?.data)
      });
      
      if (!chan || !chan.data || !Array.isArray(chan.data) || chan.data.length === 0) {
        console.warn(`[DEBUG] No valid data for channel ${channel}`, {
          hasChan: !!chan,
          hasData: !!chan?.data,
          isArray: Array.isArray(chan?.data),
          dataLength: chan?.data?.length
        });
        return null;
      }
      
      const dataPoints = Array.isArray(chan.data) ? chan.data : []; // should be [{x: Date, y: number}, ...]
      const isSpo2 = channel.toLowerCase().includes("spo2");

      return {
        label: channel,
        data: dataPoints,
        borderColor: colors[index % colors.length],
        backgroundColor: `${colors[index % colors.length]}33`,
        tension: 0.4,
        pointRadius: isSpo2 ? 1 : 0,
        pointBackgroundColor: isSpo2 && Array.isArray(dataPoints) && dataPoints.length > 0 && typeof dataPoints[0] === 'object' 
          ? dataPoints.map((p: any) => (p.y < 90 ? "red" : "blue")) 
          : undefined,
        borderWidth: 1,
        yAxisID: `y-${index}`,
        parsing: {
          xAxisKey: "x",
          yAxisKey: "y",
        },
      };
    });

    const validDatasets = datasets.filter(Boolean);
   
   // Add max/min markers for multi-channel mode if enabled
   if (showMaxMinMarkers && fileInfo) {
     const startTime = new Date(fileInfo.startTime);
     
     // Handle multi-channel mode: show min/max for each selected channel
     if (multiChannelMode && maxMinData.allChannels && viewport) {
       Object.entries(maxMinData.allChannels).forEach(([channel, data]) => {
         const channelData = data as {
           max: { value: number; time: number };
           min: { value: number; time: number };
         };
         
         // Add MAX data point for this channel
         if (channelData.max && channelData.max.time >= viewport.start && channelData.max.time <= viewport.end) {
           const maxTime = addSeconds(startTime, channelData.max.time);
           const maxDataset = {
             label: `MAX: ${channelData.max.value.toFixed(2)} (${channel})`,
             data: [{ x: maxTime, y: channelData.max.value }],
             borderColor: '#10B981',
             backgroundColor: '#10B981',
             pointRadius: 4,
             pointHoverRadius: 6,
             pointBorderWidth: 1,
             pointBorderColor: '#ffffff',
             pointBackgroundColor: '#10B981',
             showLine: false,
             pointHitRadius: 10, // Make points easier to click
             pointHoverBorderWidth: 2,
           };
           validDatasets.push(maxDataset as any);
         }
         
         // Add MIN data point for this channel
         if (channelData.min && channelData.min.time >= viewport.start && channelData.min.time <= viewport.end) {
           const minTime = addSeconds(startTime, channelData.min.time);
           const minDataset = {
             label: `MIN: ${channelData.min.value.toFixed(2)} (${channel})`,
             data: [{ x: minTime, y: channelData.min.value }],
             borderColor: '#EF4444',
             backgroundColor: '#EF4444',
             pointRadius: 4,
             pointHoverRadius: 6,
             pointBorderWidth: 1,
             pointBorderColor: '#ffffff',
             pointBackgroundColor: '#EF4444',
             showLine: false,
             pointHitRadius: 10, // Make points easier to click
             pointHoverBorderWidth: 2,
           };
           validDatasets.push(minDataset as any);
         }
       });
     }
     // Handle single-channel mode: show global max/min
     else if (!multiChannelMode && maxMinData.max && maxMinData.min) {
       // Add MAX data point
       if (viewport && maxMinData.max.time >= viewport.start && maxMinData.max.time <= viewport.end) {
         const maxTime = addSeconds(startTime, maxMinData.max.time);
         const maxDataset = {
           label: `MAX: ${maxMinData.max.value.toFixed(2)} (${maxMinData.max.channel})`,
           data: [{ x: maxTime, y: maxMinData.max.value }],
           borderColor: '#10B981',
           backgroundColor: '#10B981',
           pointRadius: 4,
           pointHoverRadius: 6,
           pointBorderWidth: 1,
           pointBorderColor: '#ffffff',
           pointBackgroundColor: '#10B981',
           showLine: false,
           pointHitRadius: 10, // Make points easier to click
           pointHoverBorderWidth: 2,
         };
         validDatasets.push(maxDataset as any);
       }
       
       // Add MIN data point
       if (viewport && maxMinData.min.time >= viewport.start && maxMinData.min.time <= viewport.end) {
         const minTime = addSeconds(startTime, maxMinData.min.time);
         const minDataset = {
           label: `MIN: ${maxMinData.min.value.toFixed(2)} (${maxMinData.min.channel})`,
           data: [{ x: minTime, y: maxMinData.min.value }],
           borderColor: '#EF4444',
           backgroundColor: '#EF4444',
           pointRadius: 4,
           pointHoverRadius: 6,
           pointBorderWidth: 1,
           pointBorderColor: '#ffffff',
           pointBackgroundColor: '#EF4444',
           showLine: false,
           pointHitRadius: 10, // Make points easier to click
           pointHoverBorderWidth: 2,
         };
         validDatasets.push(minDataset as any);
       }
     }
   }
   
   console.log('[DEBUG] Multi-channel datasets created:', {
     totalChannels: selectedChannels.length,
     validDatasets: validDatasets.length,
     datasetLabels: validDatasets.map(d => d?.label),
     allDatasets: datasets.length,
     hasMaxMinMarkers: showMaxMinMarkers && maxMinData.max && maxMinData.min
   });

  return {
    labels: [], // Multi-channel mode doesn't use labels array
    datasets: validDatasets as ChartDataset<"line">[], // Remove null entries and type assertion for Chart.js compatibility
  };
}, [
  multiChannelMode, 
  selectedChannels, // Keep full array as it's used in the logic
  channelData, // Keep this for multi-channel mode
  chartDataState, // Keep this for single channel mode
      selectedChannel,
  fileInfo, // Keep full fileInfo as it's used in the logic
  viewport, // Keep full viewport as it's used in the logic
  ahiMode, 
  ahiChartData, // Use isolated AHI chart data instead of individual dependencies
  showMaxMinMarkers, 
  maxMinData // Keep full maxMinData as it's used in the logic
]);


const chartOptions: ChartOptions<"line"> = useMemo(() => {
  if (!fileInfo || (!selectedChannel && selectedChannels.length === 0)) return {};

  const isMulti = multiChannelMode;

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 200, // Short animation for smoother transitions
      easing: 'easeOutQuart',
    },
    scales: {
      x: {
        type: "time",
        time: {
          tooltipFormat: "HH:mm:ss.SSS",
          displayFormats: {
            millisecond: "HH:mm:ss.SSS",
            second: "HH:mm:ss",
            minute: "HH:mm",
            hour: "HH:mm",
            day: "HH:mm",
            week: "HH:mm",
            month: "HH:mm",
            quarter: "HH:mm",
            year: "HH:mm"
          },
        },
        adapters: {
          date: {
            locale: {
              ...enUS,
              options: {
                ...enUS.options,
                timeZone: 'UTC'
              }
            },
          },
        },
        ticks: {
          callback: function(value: any) {
            const date = new Date(value);
            return date.toLocaleTimeString('en-GB', { 
              hour12: false, 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            });
          }
        },
        title: {
          display: true,
          text: "Time",
        },
      },
      // If you want separate y axes for each dataset, you can define them dynamically outside this useMemo
      y: {
        title: { display: true, text: "Amplitude" },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items: TooltipItem<"line">[]) => {
            // items[0].parsed.x can be timestamp in ms or Date
            const it = items[0];
            const xVal = (it.parsed && (it.parsed as any).x) || (it.raw && ((it.raw as any).x ?? it.raw));
            if (!xVal || !fileInfo) return it.label ?? "";
            const ms = typeof xVal === "number" ? xVal : new Date(xVal).getTime();
            const date = new Date(ms);
            return date.toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              fractionalSecondDigits: 3,
            } as Intl.DateTimeFormatOptions);
          },
        },
      },
      // Professional AHI Event Annotations
      annotation: ahiAnnotations ? { annotations: ahiAnnotations } : {},
      zoom: {
        pan: {
          enabled: true,
          mode: "x",
          onPanComplete: ({ chart }: { chart: any }) => {
            if (!fileInfo) return;
            const xScale = chart.scales["x"];
            const startMs = xScale.min as number;
            const endMs = xScale.max as number;
            const fileStartMs = new Date(fileInfo.startTime).getTime();
            const startSec = (startMs - fileStartMs) / 1000;
            const endSec = (endMs - fileStartMs) / 1000;
            if (isNaN(startSec) || isNaN(endSec)) return;
            setViewport({ start: startSec, end: endSec });
            // Use appropriate handler based on mode
            if (isMulti) {
              debouncedFetchMultiChunks(startSec, endSec);
              } else {
              // Use consistent handleZoomOrPan for single channel mode
              if (handleZoomOrPan) {
                handleZoomOrPan(startSec, endSec);
              }
            }
          },
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "x",
          // Enable double-click zoom
          onZoomComplete: ({ chart }: { chart: any }) => {
            if (!fileInfo) return;
            const xScale = chart.scales["x"];
            const startMs = xScale.min as number;
            const endMs = xScale.max as number;
            const fileStartMs = new Date(fileInfo.startTime).getTime();
            const startSec = (startMs - fileStartMs) / 1000;
            const endSec = (endMs - fileStartMs) / 1000;
            if (isNaN(startSec) || isNaN(endSec)) return;
            setViewport({ start: startSec, end: endSec });
            // Use appropriate handler based on mode
            if (isMulti) {
              debouncedFetchMultiChunks(startSec, endSec);
              } else {
              // Use consistent handleZoomOrPan for single channel mode
              if (handleZoomOrPan) {
                handleZoomOrPan(startSec, endSec);
              }
            }
          },
          // Configure double-click zoom
          limits: {
            x: {
              min: new Date(fileInfo?.startTime).getTime(),
              max: new Date(fileInfo?.startTime).getTime() + (fileInfo?.duration || 0) * 1000
            }
          }
        },
      },
      legend: { display: true },
      onClick: (event: any, elements: any, chart: any) => {
        console.log('[DEBUG] Chart onClick event:', {
          elements: elements,
          mode: isMulti ? 'multi-channel' : 'single-channel'
        });

        if (!fileInfo) return;

        // Handle min/max marker clicks
        if (elements && elements.length > 0) {
          const element = elements[0];
          const datasetIndex = element.datasetIndex;
          const dataIndex = element.index;
          const dataset = chart.data.datasets[datasetIndex];
          
          console.log('[DEBUG] Clicked element:', {
            datasetIndex,
            dataIndex,
            datasetLabel: dataset.label
          });

          // Check if this is a min/max marker
          if (dataset.label && (dataset.label.includes('MAX:') || dataset.label.includes('MIN:'))) {
            console.log('[DEBUG] Min/Max marker clicked, zooming to point');
            
            // Get the clicked point's time
            const clickedPoint = dataset.data[dataIndex];
            const clickedTime = new Date(clickedPoint.x).getTime();
            const fileStartMs = new Date(fileInfo.startTime).getTime();
            const clickedSec = (clickedTime - fileStartMs) / 1000;
            
            // Zoom to a 20-minute window around the clicked point
            const zoomWindow = 20 * 60; // 20 minutes in seconds
            const startSec = Math.max(0, clickedSec - zoomWindow / 2);
            const endSec = Math.min(fileInfo.duration, clickedSec + zoomWindow / 2);
            
            console.log('[DEBUG] Zooming to min/max point:', {
              clickedSec,
              startSec,
              endSec,
              zoomWindow: zoomWindow / 60 // Convert to minutes for display
            });
            
            // Update viewport
            setViewport({ start: startSec, end: endSec });
            
            // Use appropriate handler based on mode
            if (isMulti) {
              debouncedFetchMultiChunks(startSec, endSec);
            } else {
              // Use consistent handleZoomOrPan for single channel mode
              if (handleZoomOrPan) {
                handleZoomOrPan(startSec, endSec);
              }
            }
            
            // Update chart scale
            const xScale = chart.scales["x"];
            xScale.options.min = fileStartMs + startSec * 1000;
            xScale.options.max = fileStartMs + endSec * 1000;
            chart.update('none'); // Update without animation for immediate feedback
            
            return; // Don't process as double-click
          }
        }

        // Handle double-click zoom (fallback for when no specific element is clicked)
        if (event.native && event.native.detail === 2) {
          console.log('[DEBUG] Double-click detected for zoom');
          
          // Get the clicked position on the chart
          const canvasPosition = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
          if (canvasPosition.length === 0) {
            console.log('[DEBUG] No canvas position found for double-click, using center');
            return;
          }
          
          const xScale = chart.scales["x"];
          const clickedPoint = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true)[0];
          
          // Get the clicked time
          const clickedTime = xScale.getValueForPixel(clickedPoint.element.x);
          const fileStartMs = new Date(fileInfo.startTime).getTime();
          const clickedSec = (clickedTime - fileStartMs) / 1000;
          
          // Zoom to a 20-minute window around the clicked point
          const zoomWindow = 20 * 60; // 20 minutes in seconds
          const startSec = Math.max(0, clickedSec - zoomWindow / 2);
          const endSec = Math.min(fileInfo.duration, clickedSec + zoomWindow / 2);
          
          console.log('[DEBUG] Double-click zoom to point:', {
            clickedSec,
            startSec,
            endSec,
            zoomWindow: zoomWindow / 60 // Convert to minutes for display
          });
          
          // Update viewport
          const newStart = fileStartMs + startSec * 1000;
          const newEnd = fileStartMs + endSec * 1000;
          
          if (isNaN(startSec) || isNaN(endSec)) return;
          
          setViewport({ start: startSec, end: endSec });
          
          // Use appropriate handler based on mode
          if (isMulti) {
            debouncedFetchMultiChunks(startSec, endSec);
          } else {
            if (handleZoomOrPan) {
              handleZoomOrPan(startSec, endSec);
            }
          }
          
          // Update chart scale
          xScale.options.min = newStart;
          xScale.options.max = newEnd;
          chart.update('none'); // Update without animation for immediate feedback
        }
      },
    },
  };
}, [
  fileInfo,
  selectedChannel,
  selectedChannels,
  multiChannelMode,
  handleZoomOrPan,
  debouncedFetchMultiChunks,
  ahiAnnotations,
]);




// State for zoom time (double-clicked time on chart)

// Removed problematic useEffect that was causing issues
  // Ažuriranje statistike za odabrani kanal (sada na temelju dohvaćenih podataka)


  // Dodaj na vrh komponente
const handleChartDoubleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
  if (!chartRef.current || !fileInfo) return;
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
    
    // Define zoom window (15 minutes total around clicked point for detailed analysis)
    const zoomWindowSeconds = 15 * 60; // 15 minutes = 900 seconds
    const halfWindow = zoomWindowSeconds / 2; // 7.5 minutes on each side
    
    const startTime_s = Math.max(0, centerTimeSeconds - halfWindow);
    const endTime_s = Math.min(fileInfo.duration, centerTimeSeconds + halfWindow);
    
    console.log(`[DEBUG] Double-click zoom: center=${centerTimeSeconds.toFixed(1)}s, window=${startTime_s.toFixed(1)}s to ${endTime_s.toFixed(1)}s (${(endTime_s - startTime_s).toFixed(1)}s total)`);
    
    // Update viewport and load data using the consistent handleZoomOrPan function
    setViewport({ start: startTime_s, end: endTime_s });
    handleZoomOrPanRef.current(startTime_s, endTime_s);
  }, [chartRef, fileInfo, chartDataState]);
  

  // Restore file upload handlers
  const handleFileUpload = async (file: File) => {
    console.log("[DEBUG] Starting file upload for:", file.name);
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError(null);
    setFileInfo(null); // Resetirajte informacije
    setChartDataState(null); // Resetirajte graf
    setChannelStats({}); // Clear statistics
    setFullFileStats({}); // Clear cached full file statistics

    try {
      console.log("[DEBUG] Sending request to backend...");
      const response = await axiosInstance.post<EDFFileInfo>(
        endpoints.upload,
        formData,
        { 
          headers: { 
            // Don't set Content-Type for FormData - let axios set it with boundary
          }
        }
      );

      console.log("[DEBUG] Backend response:", response.data);
      const initialFileInfo = response.data;
      setFileInfo(initialFileInfo);  
      setSelectedChannel(initialFileInfo.channels[0]);
      
      // Fetch statistics for the initially selected channel
      if (initialFileInfo.channels[0]) {
        fetchSingleChannelStats(initialFileInfo.channels[0]);
      }

      // Početno učitavanje preview podataka u graf
      if (initialFileInfo.previewData[initialFileInfo.channels[0]]) {
        const previewDataArr = initialFileInfo.previewData[initialFileInfo.channels[0]];
        const startTime = new Date(initialFileInfo.startTime);

        const labels = previewDataArr.map((_: number, i: number) => {
          const newDate = addSeconds(startTime, i / initialFileInfo.sampleRates[0]);
          return newDate;
        });
        setChartDataState({ labels, data: previewDataArr });
        //setCurrentZoomEnd(previewDataArr.length);
      }
    } catch (err: unknown) {
      console.error("[ERROR] Upload error:", err);
      if (err instanceof AxiosError) {
        console.error("[ERROR] Axios error details:", err.response?.data);
        setError(`Error processing EDF file: ${err.response?.data?.error || err.message}`);
      } else {
        setError("Error processing EDF file. Please check the format and try again.");
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
    <div className="p-6 space-y-6">
      {/* Grafana-inspired Upload Panel */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Upload className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Data Source</h2>
                <p className="text-sm text-slate-500">Upload EDF polysomnographic recordings</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
              <span className="text-xs text-slate-500 font-medium">Ready</span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <UploadZone
            fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
            handleFileUpload={handleFileUpload}
            handleClick={handleClick}
            handleDrop={handleDrop}
          />
        </div>
      </div>

          {/* Status Section */}
          <StatusDisplay loading={loading} isLoadingChunk={isLoadingChunk} error={error} />
  
      {/* File Information */}
      {fileInfo && (
        <div className="space-y-6">
          {/* Grafana-style Recording Info Panel */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <Info className="w-4 h-4 text-white" />
        </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Recording Overview</h2>
                    <p className="text-sm text-slate-500">EDF file metadata and channel information</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-emerald-600 font-medium">Active</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <FileInfoDisplay fileInfo={fileInfo} />
            </div>
          </div>
  
          {/* Grafana-style Analysis Configuration Panel */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Settings className="w-4 h-4 text-white" />
        </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Analysis Configuration</h2>
                    <p className="text-sm text-slate-500">Configure visualization and analysis parameters</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-xs text-purple-600 font-medium">Configured</span>
                </div>
              </div>
            </div>
            <div className="p-6">
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
                    ahiAnalysisProgress={ahiAnalysisProgress}
                    showEventOverlays={showEventOverlays}
                    handleModeSwitch={handleModeSwitch}
                    setSelectedChannel={setSelectedChannel}
                    handleChannelSelect={handleChannelSelect}
                    setAhiFlowChannel={setAhiFlowChannel}
                    setAhiSpo2Channel={setAhiSpo2Channel}
                    handleAHIAnalysis={handleAHIAnalysis}
                    setShowEventOverlays={setShowEventOverlays}
            />
            </div>
          </div>
  
          {/* Grafana-style Channel Statistics Panel */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Channel Statistics</h2>
                    <p className="text-sm text-slate-500">
                      {multiChannelMode ? 'Multi-channel statistical analysis' : 'Single-channel statistical analysis'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isLoadingChunk ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                  <span className={`text-xs font-medium ${isLoadingChunk ? 'text-amber-600' : 'text-green-600'}`}>
                    {isLoadingChunk ? 'Computing' : 'Ready'}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ChannelStatsDisplay 
                channelStats={channelStats}
                isLoading={isLoadingChunk}
                mode={multiChannelMode ? 'multi' : 'single'}
                selectedChannel={selectedChannel}
                selectedChannels={selectedChannels}
              />
            </div>
          </div>

          {/* Grafana-style Main Visualization Panel */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Signal Visualization</h2>
                    <p className="text-sm text-slate-500">Real-time polysomnographic data analysis</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {(isLoadingChunk || (ahiMode && loadingChannels.size > 0)) ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      <span className="text-xs text-blue-600 font-medium">Loading data...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-600 font-medium">Live</span>
        </div>
      )}
                </div>
              </div>
              
              {/* Event Navigation - Only show in AHI mode with results */}
              {ahiMode && ahiResults && ahiResults.all_events.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <div>
                          <h5 className="text-sm font-semibold text-blue-900">Event Navigation</h5>
                          <p className="text-xs text-blue-600">Navigate through detected sleep events</p>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-blue-700 bg-white px-3 py-1 rounded-full border border-blue-200">
                        {currentEventIndex + 1} of {ahiResults.all_events.length}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center space-x-2 mb-3">
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

                    {/* Current Event Info */}
                    {ahiResults.all_events[currentEventIndex] && (
                      <div className="bg-white border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
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
                            {new Date(new Date(fileInfo.startTime).getTime() + ahiResults.all_events[currentEventIndex].start_time * 1000).toLocaleTimeString('en-GB', { hour12: false })}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Duration:</span>
                            <span className="font-semibold text-slate-900">
                              {ahiResults.all_events[currentEventIndex].duration.toFixed(1)}s
                            </span>
                          </div>
                          {ahiResults.all_events[currentEventIndex].spo2_drop && (
                            <div className="flex justify-between">
                              <span className="text-slate-600">SpO2 Drop:</span>
                              <span className="font-semibold text-red-600">
                                -{ahiResults.all_events[currentEventIndex].spo2_drop.toFixed(1)}%
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-600">Time Range:</span>
                            <span className="font-semibold text-slate-900">
                              {new Date(new Date(fileInfo.startTime).getTime() + ahiResults.all_events[currentEventIndex].start_time * 1000).toLocaleTimeString('en-GB', { hour12: false })} - {new Date(new Date(fileInfo.startTime).getTime() + ahiResults.all_events[currentEventIndex].end_time * 1000).toLocaleTimeString('en-GB', { hour12: false })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 space-y-6">
  
              {/* Grafana-style Time Range Controls */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Time Range</h3>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Query Inspector
                  </div>
                </div>
      {fileInfo && (
                      <div className="text-xs text-slate-500 mb-3">
                        Recording time: {new Date(fileInfo.startTime).toLocaleTimeString('en-GB', { hour12: false })} -{' '}
                        {new Date(new Date(fileInfo.startTime).getTime() + fileInfo.duration * 1000).toLocaleTimeString('en-GB', {
                          hour12: false,
                        })}
              </div>
                    )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">From</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
            </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">To</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
              </div>
                  <button
                    onClick={handleCustomInterval}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-md text-sm hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center space-x-2 font-medium shadow-sm"
                  >
                    <ZoomIn className="w-4 h-4" />
                    <span>Apply Range</span>
                  </button>
            </div>
              </div>

              {/* Grafana-style Chart Controls */}
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-slate-600 to-slate-700 rounded flex items-center justify-center">
                    <BarChart3 className="w-3 h-3 text-white" />
            </div>
                  <h3 className="text-base font-semibold text-slate-900">Signal Data</h3>
                  <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-mono">
                    Real-time
              </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleFullNightView}
                    className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-3 py-2 rounded-md text-sm hover:from-slate-900 hover:to-black transition-all duration-200 flex items-center space-x-2 shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Full View</span>
                  </button>
            </div>
          </div>

              {/* Grafana-style Peak Analysis Panel - Hide in AHI mode */}
              {!ahiMode && ((maxMinData.max || maxMinData.min) || (multiChannelMode && maxMinData.allChannels)) && (
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">Peak Analysis</h4>
                          <p className="text-sm text-slate-500">
                            {multiChannelMode ? 'Peak values per channel with navigation' : 'Global peak values with navigation'}
                          </p>
                        </div>
                      </div>
                        <div className="flex items-center space-x-4">
                          {/* Professional Peak Markers Toggle */}
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 w-full">
                            <div className="flex items-center justify-between gap-4 sm:gap-6 md:gap-8">
                              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                {showMaxMinMarkers ? (
                                  <Eye className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                ) : (
                                  <EyeOff className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="text-sm font-medium text-slate-900 block">Peak Markers Track</span>
                                  <p className="text-xs text-slate-500 hidden sm:block">Display min/max markers on the visualization chart</p>
                                </div>
                              </div>
                              <label className="flex items-center cursor-pointer flex-shrink-0">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                                  checked={showMaxMinMarkers}
                                  onChange={(e) => setShowMaxMinMarkers(e.target.checked)}
                                />
                                <div
                                  className={`block w-12 h-6 rounded-full transition-colors ${
                                    showMaxMinMarkers ? 'bg-blue-600' : 'bg-slate-300'
                                  }`}
                                ></div>
                                <div
                                  className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                                    showMaxMinMarkers ? 'transform translate-x-6' : ''
                                  }`}
                                ></div>
              </div>
            </label>
                          </div>
          </div>

                        {/* Collapsible Toggle */}
                        <button
                          onClick={() => setShowMaxMinSection(!showMaxMinSection)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors duration-200"
                          title={showMaxMinSection ? "Collapse Peak Values" : "Expand Peak Values"}
                        >
                          {showMaxMinSection ? (
                            <ChevronUp className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Content */}
                  {showMaxMinSection && (
                    <div className="p-6">
                      {multiChannelMode && maxMinData.allChannels ? (
                        // Multi-channel mode: Professional channel cards
                        <div className="space-y-4">
                          {Object.entries(maxMinData.allChannels).map(([channel, data]) => {
                            const channelData = data as {
                              max: { value: number; time: number };
                              min: { value: number; time: number };
                            };
                            return (
                              <div key={channel} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">{channel}</h5>
                                  <div className="text-xs text-slate-500 font-mono">Channel Analysis</div>
                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {channelData.max && (
                                    <button
                                      onClick={() => navigateToChannelMaxMin(channel, 'max')}
                                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border border-green-200 rounded-lg transition-all duration-200 text-left group"
                                    >
                                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <TrendingUp className="w-5 h-5 text-white" />
                                      </div>
                                      <div>
                                        <div className="text-xs font-medium text-green-600 uppercase tracking-wide">Maximum</div>
                                        <div className="text-lg font-bold text-green-800">{channelData.max.value.toFixed(2)}</div>
                                        <div className="text-xs text-green-600 font-mono">at {formatEDFTimestamp(channelData.max.time)}</div>
                                      </div>
                                    </button>
                                  )}
                                  {channelData.min && (
                                    <button
                                      onClick={() => navigateToChannelMaxMin(channel, 'min')}
                                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 border border-red-200 rounded-lg transition-all duration-200 text-left group"
                                    >
                                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <TrendingDown className="w-5 h-5 text-white" />
            </div>
                                      <div>
                                        <div className="text-xs font-medium text-red-600 uppercase tracking-wide">Minimum</div>
                                        <div className="text-lg font-bold text-red-800">{channelData.min.value.toFixed(2)}</div>
                                        <div className="text-xs text-red-600 font-mono">at {formatEDFTimestamp(channelData.min.time)}</div>
                                      </div>
                                    </button>
                                  )}
                </div>
            </div>
                            );
                          })}
                </div>
              ) : (
                        // Single channel mode: Professional global cards
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {maxMinData.max && (
                            <button
                              onClick={() => navigateToMaxMin('max')}
                              className="flex items-center gap-4 p-6 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border border-green-200 rounded-lg transition-all duration-200 text-left group shadow-sm"
                            >
                              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                                <TrendingUp className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Global Maximum</div>
                                <div className="text-2xl font-bold text-green-800">{maxMinData.max.value.toFixed(2)}</div>
                                <div className="text-sm text-green-700 font-medium">{maxMinData.max.channel}</div>
                                <div className="text-xs text-green-600 font-mono mt-1">at {formatEDFTimestamp(maxMinData.max.time)}</div>
                              </div>
                            </button>
                          )}
                          {maxMinData.min && (
              <button
                              onClick={() => navigateToMaxMin('min')}
                              className="flex items-center gap-4 p-6 bg-gradient-to-br from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 border border-red-200 rounded-lg transition-all duration-200 text-left group shadow-sm"
                            >
                              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                                <TrendingDown className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Global Minimum</div>
                                <div className="text-2xl font-bold text-red-800">{maxMinData.min.value.toFixed(2)}</div>
                                <div className="text-sm text-red-700 font-medium">{maxMinData.min.channel}</div>
                                <div className="text-xs text-red-600 font-mono mt-1">at {formatEDFTimestamp(maxMinData.min.time)}</div>
                              </div>
              </button>
                          )}
            </div>
                      )}

                      {/* Professional Help Section */}
                      <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <Info className="w-5 h-5 text-slate-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-700 mb-1">Peak Analysis Guide</p>
                            <p className="text-xs text-slate-600">
                              {multiChannelMode
                                ? 'Click on any peak value to navigate to a 20-minute window around that point. Toggle chart markers to show/hide peak indicators on the visualization.'
                                : 'Click on peak values to navigate to a 20-minute window around that point. Toggle chart markers for cleaner visualization.'}
                            </p>
                          </div>
                        </div>
                      </div>
                </div>
              )}
            </div>
          )}

              {/* Grafana-style Chart Container */}
              <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-slate-300 font-medium">Live Chart</span>
                </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {ahiMode ? '600px' : '500px'} × Auto
            </div>
                  </div>
                </div>
                <div className="p-2 bg-slate-900">
                  <EDFChart
                    chartRef={chartRef}
                    chartJSData={chartJSData}
                    chartOptions={chartOptions}
                    isLoadingChunk={isLoadingChunk || loadingChannels.size > 0}
                    handleChartDoubleClick={handleChartDoubleClick}
                    handleChartClick={handleChartClick}
                    height={ahiMode ? 600 : 500}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}