import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Chart, // Dodano Chart za pristup instanci grafa
  type ChartOptions, // Dodano za tipovanje opcija grafa - type-only import
  type TooltipItem, // Dodano za tipovanje tooltip callbacka - type-only import
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import "chartjs-adapter-date-fns";
import { enUS } from 'date-fns/locale';
import { registerables } from 'chart.js';
import UploadZone from './UploadZone';
import StatusDisplay from './StatusDisplay';
import FileInfoDisplay from './FileInfoDisplay';
import ChannelSelector from './ChannelSelector';
import ChannelStatsDisplay from './ChannelStatsDisplay';
import EDFChart from './EDFChart';


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
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
// Formatiranje vremena
function addSeconds(date: Date, seconds: number): Date {
  const newDate = new Date(date.getTime() + seconds * 1000);
  return newDate;
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

  // Stanja za upravljanje prikazanim podacima i zumiranjem
  const [chartDataState, setChartDataState] = useState<{ labels: Date[]; data: number[]; } | null>(null);
  // Removed currentZoomStart - now using viewport state for all time tracking
  //const [currentZoomEnd, setCurrentZoomEnd] = useState<number>(0);     // Završni uzorak
  const [isLoadingChunk, setIsLoadingChunk] = useState<boolean>(false);
  const [viewport, setViewport] = useState<{ start: number; end: number } | null>(null);


  // Referenca na ChartJS instancu - tip specificiran za 'line' graf
  const chartRef = useRef<Chart<'line'> | null>(null);

  // Interna funkcija za dohvaćanje chunkova (prije debouncanja)
  const fetchEdfChunkInternal = useCallback(async (
    filePath: string,
    channel: string,
    startSample: number,
    numSamples: number,
    sampleRate: number, // Dodajte sampleRate kao argument
    maxPoints: number = 2000 // Maksimalan broj uzoraka za dohvaćanje
  ):Promise<void> => {
    if (isLoadingChunk) return;
    setIsLoadingChunk(true);
    setError(null);

    try {
      const response = await axios.get<{ data: number[] }>(
        `http://localhost:5000/api/upload/edf-chunk?filePath=${encodeURIComponent(filePath)}&channel=${encodeURIComponent(channel)}&start_sample=${Math.floor(startSample)}&num_samples=${Math.floor(numSamples)}&max_points=${maxPoints}`,
      );

      const chunkData = response.data.data;
      const startTime = new Date(fileInfo!.startTime);

      const labels = chunkData.map((_, i) => {
        const absoluteSampleIndex = startSample + i;
        const newDate = addSeconds(startTime, absoluteSampleIndex / sampleRate);
        return newDate;
      });

      setChartDataState({ labels, data: chunkData });
      //setCurrentZoomEnd(startSample + chunkData.length);

    } catch (err: unknown) { // Ispravljen tip za catch block
      console.error("Greška pri dohvaćanju EDF chunka:", err);
      setError("Greška pri učitavanju dijela signala.");
    } finally {
      setIsLoadingChunk(false);
    }
  }, [fileInfo, isLoadingChunk]); // Uklonjeni currentZoomStart/End iz deps-a

  // Debouncana verzija funkcije za dohvaćanje chunkova
  // useMemo osigurava da se debouncana funkcija stvara samo kada se promijeni fetchEdfChunkInternal.
 const debouncedFetchEdfChunk = useDebouncedCallback(
  (
    filePath: string,
    channel: string,
    startSample: number,
    numSamples: number,
    sampleRate: number,
    maxPoints: number = 2000 // Maksimalan broj uzoraka za dohvaćanje
  ) => {
    // 🔧 Osiguraj da su vrijednosti cijeli brojevi
    const roundedStartSample = Math.floor(startSample);
    const roundedNumSamples = Math.floor(numSamples);
    const safeMaxPoints = Math.floor(maxPoints);

    fetchEdfChunkInternal(
      filePath,
      channel,
      roundedStartSample,
      roundedNumSamples,
      sampleRate,
      safeMaxPoints
    );
  },
  120  // Optimized for smooth, responsive interactions
);
const handleZoomOrPan = useCallback(async (startTime: number, endTime: number) => {
  if (!fileInfo || !selectedChannel) return;
  
  const sampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(selectedChannel)];
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const numSamples = endSample - startSample;

  if (isNaN(startSample) || isNaN(endSample) || startSample < 0 || numSamples <= 0) return;


  
  // Optimized chunk-based approach with smart downsampling
  const chartWidth = chartRef.current?.width || 1200;
  const timeRange = endTime - startTime;
  
  // Calculate optimal sample count based on time range and screen width
  let actualSamples = numSamples;
  let maxPoints = Math.max(chartWidth * 2, 2000);
  
  // Smart downsampling based on time range - prevents laggy performance
  if (timeRange <= 60) { // 0-1 minute: High detail
    actualSamples = Math.min(numSamples, 20000);
    maxPoints = Math.max(chartWidth * 3, 4000);
  } else if (timeRange <= 600) { // 1-10 minutes: Good detail
    actualSamples = Math.min(numSamples, 30000);
    maxPoints = Math.max(chartWidth * 2.5, 3000);
  } else if (timeRange <= 3600) { // 10min-1 hour: Medium detail
    actualSamples = Math.min(numSamples, 20000);
    maxPoints = Math.max(chartWidth * 2, 2500);
  } else if (timeRange <= 14400) { // 1-4 hours: Lower detail
    actualSamples = Math.min(numSamples, 10000);
    maxPoints = Math.max(chartWidth * 1.5, 2000);
  } else { // 4+ hours: Overview mode - lightweight for performance
    actualSamples = Math.min(numSamples, 8000); // Reduced for better performance
    maxPoints = Math.max(chartWidth, 1500); // Fewer points for speed
  }
  
  // Always use chunk-based loading - fastest and most stable
  debouncedFetchEdfChunk(
    fileInfo.tempFilePath,
    selectedChannel,
    startSample,
    actualSamples,
    sampleRate,
    maxPoints
  );
}, [fileInfo, selectedChannel, debouncedFetchEdfChunk]);

// Add missing useEffect for initial data loading
useEffect(() => {
  if (!fileInfo || !selectedChannel) return;

  // Load initial view - first 5 minutes for optimal startup performance or entire duration if shorter
  
  const initialEndTime = Math.min(300, fileInfo.duration); // First 5 minutes or entire duration if shorter
  handleZoomOrPan(0, initialEndTime);
  setViewport({ start: 0, end: initialEndTime });
}, [selectedChannel, fileInfo, handleZoomOrPan]);

    // Toggle multi-channel mode
  const toggleMultiChannelMode = () => {
    setMultiChannelMode(!multiChannelMode);
    if (!multiChannelMode) {
      setSelectedChannels(selectedChannel ? [selectedChannel] : []);
    }
  };
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
  const sampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(selectedChannel)];
  const totalSamples = Math.floor(fileInfo.duration * sampleRate);
  
  console.log(`[DEBUG] Full night view: ${start}s to ${end}s (${totalSamples} samples)`);
  setViewport({ start, end });

  if (multiChannelMode) {
    debouncedFetchMultiChunks(start, end);
  } else {
    // For full night view, use downsampling endpoint for proper distribution
    const chartWidth = chartRef.current?.width || 1200;
    const targetPoints = Math.min(chartWidth * 1.5, 2500); // Reasonable point count
    
    console.log(`[DEBUG] Full night using downsampling: ${totalSamples} → ${targetPoints} points`);
    
    // Use downsampling endpoint to get evenly distributed samples across entire night
    const fetchFullNight = async () => {
      try {
        setIsLoadingChunk(true);
        
        const response = await axios.get<{
          data: number[];
          stats?: ChannelStats;
        }>(`http://localhost:5000/api/upload/edf-chunk-downsample`, {
      params: {
            filePath: fileInfo.tempFilePath,
            channel: selectedChannel,
            start_sample: 0, // Start from first sample
            num_samples: totalSamples, // Use ALL samples
            target_points: targetPoints, // Downsample to target points
      },
    });

        const chunkData = response.data?.data || [];
        if (chunkData.length === 0) return;

        // Create timestamps evenly distributed across the entire duration
        const startTimeObj = new Date(fileInfo.startTime);
        const labels = chunkData.map((_: number, i: number) => 
          addSeconds(startTimeObj, (i * fileInfo.duration) / chunkData.length)
        );

        setChartDataState({ labels, data: chunkData });
        console.log(`[DEBUG] Full night loaded: ${chunkData.length} points from ${totalSamples} samples`);
      } catch (err) {
        console.error("Error fetching full night data:", err);
        setError("Error loading full night view");
      } finally {
        setIsLoadingChunk(false);
      }
    };
    
    fetchFullNight();
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
    const chartWidth = chartRef.current?.width || 1200;
    
    // Calculate optimal target points based on time range (same logic as single channel)
    let targetPoints: number;
    if (timeRange <= 60) { // 0-1 minute: High detail
      targetPoints = Math.max(chartWidth * 3, 4000);
    } else if (timeRange <= 600) { // 1-10 minutes: Good detail
      targetPoints = Math.max(chartWidth * 2.5, 3000);
    } else if (timeRange <= 3600) { // 10min-1 hour: Medium detail
      targetPoints = Math.max(chartWidth * 2, 2500);
    } else if (timeRange <= 14400) { // 1-4 hours: Lower detail
      targetPoints = Math.max(chartWidth * 1.5, 2000);
    } else { // 4+ hours: Overview mode
      targetPoints = Math.max(chartWidth, 1500);
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
      
      // Handle timestamp labels from Python response
      const startTime = new Date(fileInfo.startTime);
      let labels: Date[] = [];
      
      if (response.data.labels && response.data.labels.length > 0) {
        // Check if the timestamps look reasonable (not epoch-based)
        const firstTimestamp = response.data.labels[0];
        const fileStartMs = startTime.getTime();
        
        console.log(`[DEBUG] First timestamp: ${firstTimestamp}, File start: ${fileStartMs}`);
        
        // If timestamps are close to file start time (within reasonable range), use them directly
        if (Math.abs(firstTimestamp - fileStartMs) < 86400000 * 365) { // Within 1 year
          labels = response.data.labels.map((timestamp: number) => new Date(timestamp));
          console.log(`[DEBUG] Using Python timestamps directly`);
        } else {
          // Python timestamps might be relative or epoch-based, calculate proper timestamps
          console.log(`[DEBUG] Python timestamps seem incorrect, calculating manually`);
          labels = [];
        }
      }
      
      for (const channel of selectedChannels) {
        const channelData = response.data.channels?.[channel];
        if (!channelData || channelData.length === 0) {
          console.warn(`No data received for channel ${channel}`);
          continue;
        }

        // Use Python timestamps if valid, otherwise calculate based on time range
        const channelLabels = labels.length === channelData.length ? labels : 
          channelData.map((_: number, i: number) => 
            addSeconds(startTime, boundedStart + (i * timeRange) / channelData.length)
          );

        newChannelData[channel] = { 
          labels: channelLabels, 
          data: channelData 
        };
        
        console.log(`[DEBUG] Processed channel ${channel}: ${channelData.length} points`);
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
        pointRadius: isSpo2 ? 3 : 0,
        pointBackgroundColor: isSpo2 ? pointColors : undefined,
        borderWidth: 1,
      }],
    };
  }

  // MULTI CHANNEL MODE
  const firstChannel = selectedChannels[0];
  const sharedLabels = channelData[firstChannel]?.labels || [];
  const colors = ["#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6"];

  return {
    labels: sharedLabels, // 💡 SVI KANALE ISTI LABELS!
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
        pointRadius: isSpo2 ? 3 : 0,
        pointBackgroundColor: isSpo2 ? pointColors : undefined,
        borderWidth: 1,
        yAxisID: `y-${index}`, // ako koristiš više y-osi
      };
    }),
  };
}, [multiChannelMode, selectedChannels, channelData, chartDataState, selectedChannel]);






  


  // Chart.js opcije s prilagođenom logikom zooma
const chartOptions: ChartOptions<'line'> = useMemo(() => {
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
        title: {
          display: true,
          text: 'Amplituda',
        },
      },
    },
    plugins: {
      decimation: {
        enabled: true,
        algorithm: 'min-max',
      },
      tooltip: {
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            const time = items[0].label;
            return time;
          },
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          onPanComplete: ({ chart }) => {
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
          onZoomComplete: ({ chart }) => {
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
      legend: { display: true },
    },
  };
}, [fileInfo, viewport, multiChannelMode, debouncedFetchMultiChunks, handleZoomOrPan]);




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
    
    // Define zoom window (5 minutes around clicked point for detailed analysis)
    const zoomWindowSeconds = 300; // 5 minutes - now safe with 15-minute threshold
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
          {/* Channel Selection and Multi-channel toggle */}
          <ChannelSelector
            fileInfo={fileInfo}
            multiChannelMode={multiChannelMode}
            selectedChannel={selectedChannel}
            selectedChannels={selectedChannels}
            toggleMultiChannelMode={toggleMultiChannelMode}
            setSelectedChannel={setSelectedChannel}
            handleChannelSelect={handleChannelSelect}
          />
          {/* Statistika */}
          <ChannelStatsDisplay channelStats={channelStats} />
          {/* Graf na cijeloj širini */}
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-medium"></h4>
              <button
                onClick={handleFullNightView}
                className="bg-black text-white px-6 py-2 rounded -xl shadow-md hover:from-blue-700 hover:via-indigo-800 hover:to-blue-950 hover:scale-105 transition duration-200 font-semibold tracking-wide flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
              >
                Pregled cijele snimke
              </button>
            </div>
            <EDFChart
              chartRef={chartRef}
              chartJSData={chartJSData}
              chartOptions={chartOptions}
              isLoadingChunk={isLoadingChunk}
              handleChartDoubleClick={handleChartDoubleClick}
              height={500}
            />
          </div>
        </div>
      )}
    </div>
  );
}


// setViewport is now managed by useState above, so this function is not needed and can be removed.
