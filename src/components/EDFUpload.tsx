import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { FaUpload, FaInfoCircle, FaHeartbeat, FaClock, FaWaveSquare } from "react-icons/fa";
import axios from "axios";
import { Line } from "react-chartjs-2";
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
// Formatiranje vremena
function addSeconds(date: Date, seconds: number): Date {
  const newDate = new Date(date.getTime() + seconds * 1000);
  return newDate;
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(arr: number[]): number {
  if (!arr.length) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
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

  // Stanja za upravljanje prikazanim podacima i zumiranjem
  const [chartDataState, setChartDataState] = useState<{ labels: Date[]; data: number[]; } | null>(null);
  const [currentZoomStart, setCurrentZoomStart] = useState<number>(0); // Početni uzorak
  const [currentZoomEnd, setCurrentZoomEnd] = useState<number>(0);     // Završni uzorak
  const [isLoadingChunk, setIsLoadingChunk] = useState<boolean>(false);

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
        `http://localhost:5000/api/upload/edf-chunk?filePath=${encodeURIComponent(filePath)}&channel=${encodeURIComponent(channel)}&start_sample=${startSample}&num_samples=${numSamples}&max_points=${maxPoints}`,
      );

      const chunkData = response.data.data;
      const startTime = new Date(fileInfo!.startTime);

      const labels = chunkData.map((_, i) => {
        const absoluteSampleIndex = startSample + i;
        const newDate = addSeconds(startTime, absoluteSampleIndex / sampleRate);
        return newDate;
      });

      setChartDataState({ labels, data: chunkData });
      setCurrentZoomStart(startSample);
      setCurrentZoomEnd(startSample + chunkData.length);

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
    fetchEdfChunkInternal(filePath, channel, startSample, numSamples, sampleRate,maxPoints);
  },
  300
);
  // Initialize with first channel selected
  useEffect(() => {
    if (fileInfo?.channels?.length && fileInfo.channels.length > 0) {
      if (multiChannelMode) {
        setSelectedChannels([fileInfo.channels[0]]);
      } else {
        setSelectedChannel(fileInfo.channels[0]);
      }
    }
  }, [fileInfo, multiChannelMode])

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

   // Fetch data for multiple channels
  const fetchDataForChannels = useCallback(async () => {
    if (!fileInfo || selectedChannels.length === 0) return;
    
    setIsLoadingChunk(true);
    setError(null);
    
    try {
      const newChannelData: {[channel: string]: ChannelData} = {...channelData};
      
      for (const channel of selectedChannels) {
        if (!channelData[channel] || channelData[channel].data.length === 0) {
          const sampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(channel)];
          const initialNumSamples = fileInfo.previewData[channel]?.length || 500;
          
          const response = await axios.get<{ data: number[] }>(
            `http://localhost:5000/api/upload/edf-chunk?filePath=${encodeURIComponent(fileInfo.tempFilePath)}&channel=${encodeURIComponent(channel)}&start_sample=0&num_samples=${initialNumSamples}`
          );
          
          const chunkData = response.data.data;
          const startTime = new Date(fileInfo.startTime);
          
          const labels = chunkData.map((_, i) => {
            return addSeconds(startTime, i / sampleRate);
          });
          
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
  }, [fileInfo, selectedChannels, channelData]);

  // Fetch data when selected channels change
  useEffect(() => {
    if (multiChannelMode && selectedChannels.length > 0) {
      fetchDataForChannels();
    }
  }, [multiChannelMode, selectedChannels, fetchDataForChannels]);

const handleFullNightView = useCallback(() => {
  if (!fileInfo || !selectedChannel) return;
  
  const sampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(selectedChannel)];
  const totalSamples = fileInfo.duration * sampleRate;
  
  // Auto-downsample ako ima više od 100k uzoraka 
  const downsampleFactor = totalSamples > 100000 ? 100 : 1;
  
  debouncedFetchEdfChunk(
    fileInfo.tempFilePath,
    selectedChannel,
    0,
    Math.floor(totalSamples / downsampleFactor),
    sampleRate,
  );
}, [fileInfo, selectedChannel, debouncedFetchEdfChunk]);
  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError(null);
    setFileInfo(null); // Resetirajte informacije
    setChartDataState(null); // Resetirajte graf

    try {
      const response = await axios.post<EDFFileInfo>(
        "http://localhost:5000/api/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

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
        setCurrentZoomStart(0);
        setCurrentZoomEnd(previewDataArr.length);
      }

    } catch (err: unknown) { // Ispravljen tip za catch block
      setError("Greška pri obradi EDF fajla. Provjerite format i pokušajte ponovo.");
      console.error("Upload error:", err);
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
  //const debouncedFetchEdfChunkRef = useRef(debounce(fetchEdfChunkInternal, 300));
  // Učitaj nove podatke samo kada se promijeni fajl (fileInfo) ili odabrani kanal (selectedChannel)
  // Uklonili smo 'chartDataState?.data' iz zavisnosti da spriječimo konstantno re-renderiranje
  // jer chartDataState ažurira unutar fetchEdfChunkInternal, što bi stvorilo petlju.
   useEffect(() => {
    if (!fileInfo || !selectedChannel) return;

    const currentSampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(selectedChannel)];
    const initialNumSamples = fileInfo.previewData[selectedChannel]?.length || 500;
    const maxPoints = 2000; // Maksimalan broj uzoraka za dohvaćanje

    if (fileInfo.tempFilePath && selectedChannel && currentSampleRate) {
        debouncedFetchEdfChunk(fileInfo.tempFilePath, selectedChannel, 0, initialNumSamples, currentSampleRate, maxPoints);
    }
  }, [selectedChannel, fileInfo, debouncedFetchEdfChunk]);


// Generiraj boje za točke ako je SpO2 kanal

const chartJSData = useMemo(() => {
    if (!multiChannelMode || selectedChannels.length === 0) {
      // Single channel mode (existing implementation)
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

    // Multi-channel mode
    const colors = ["#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6"];
    
    return {
      labels: selectedChannels.length > 0 
        ? channelData[selectedChannels[0]]?.labels || [] 
        : [],
      datasets: selectedChannels.map((channel, index) => {
        const data = channelData[channel]?.data || [];
        const isSpo2 = channel.toLowerCase().includes("spo2");
        
        return {
          label: channel,
          data,
          borderColor: colors[index % colors.length],
          backgroundColor: `${colors[index % colors.length]}33`,
          tension: 0.4,
          pointRadius: isSpo2 ? 3 : 0,
          borderWidth: 1,
        };
      }),
    };
  }, [multiChannelMode, selectedChannels, channelData, chartDataState, selectedChannel]);
  const handleZoomOrPan = useCallback((startSample: number, endSample: number) => {
  if (!fileInfo || !selectedChannel) return;
  
  const sampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(selectedChannel)];
  const numSamples = endSample - startSample;

  const chartWidth = chartRef.current?.width || 0;
  const maxPoints= chartWidth*2;
  
  // Downsample za velike rangeove
  if (numSamples > 100000) {
    const downsampledSamples = Math.floor(numSamples / 100);
    debouncedFetchEdfChunk(
      fileInfo.tempFilePath,
      selectedChannel,
      startSample,
      downsampledSamples,
      sampleRate,
      maxPoints 
    );
  } else {
    debouncedFetchEdfChunk(
      fileInfo.tempFilePath,
      selectedChannel,
      startSample,
      numSamples,
      sampleRate,
      maxPoints
    );
  }
}, [fileInfo, selectedChannel, debouncedFetchEdfChunk]);


  // Chart.js opcije s prilagođenom logikom zooma
   const chartOptions: ChartOptions<'line'> = useMemo(() => { // Eksplicitno tipovanje opcija
    if (!fileInfo || !selectedChannel) return {};

    const sampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(selectedChannel)];
    const totalSamples = Math.floor(fileInfo.duration * sampleRate);

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const, // Ispravljen tip za `animation`
      scales: {
        x: {
          type: 'time',
          time: {
              unit: 'second',
              displayFormats: {
                  second: 'HH:mm:ss',
                  minute: 'HH:mm',
                  hour: 'HH',
                  day: 'MM-DD',
              },
          },
          adapters: {
            date: {
              locale: enUS,
            }
          },
          title: {
            display: true,
            text: "Vrijeme",
          },
        },
        y: {
          title: {
            display: true,
            text: "Amplituda",
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items: TooltipItem<'line'>[]) => { // Ispravljen tip za items
              if (fileInfo && chartDataState) {
                const dataIndex = items[0].dataIndex;
                const absoluteSampleIndex = currentZoomStart + dataIndex;
                const timeInSeconds = absoluteSampleIndex / sampleRate;
                const date = addSeconds(new Date(fileInfo.startTime), timeInSeconds);
                // Casting na any za `toLocaleTimeString` zbog fractionalSecondDigits
                return date.toLocaleTimeString('hr-HR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  fractionalSecondDigits: 3
                } as Intl.DateTimeFormatOptions); // Casting na Intl.DateTimeFormatOptions
              }
              return items[0].label ?? ""; // Dodana ?? "" za sigurnost
            }
          }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            onPanComplete: (context) => {
              const chart = context.chart as Chart<'line'>;
              if (!fileInfo || !selectedChannel || !chartDataState) return;

              const xScale = chart.scales.x;
              const newMinTime = xScale.min as number;
              const newMaxTime = xScale.max as number;
              const originalStartTime = new Date(fileInfo.startTime).getTime();

              const newStartSample = Math.floor((newMinTime - originalStartTime) / 1000 * sampleRate);
              const newEndSample = Math.ceil((newMaxTime - originalStartTime) / 1000 * sampleRate);

              const buffer = Math.floor(chartDataState.data.length * 0.1);
              if (newStartSample >= currentZoomStart - buffer && newEndSample <= currentZoomEnd + buffer) {
                  return;
              }

              const fetchStartSample = Math.max(0, newStartSample - buffer);
              const fetchEndSample = Math.min(totalSamples, newEndSample + buffer);
              let fetchNumSamples = fetchEndSample - fetchStartSample;
              handleZoomOrPan(xScale.min, xScale.max);
              if (fetchStartSample + fetchNumSamples > totalSamples) {
                fetchNumSamples = totalSamples - fetchStartSample;
              }
              if (fetchNumSamples <= 0) {
                return;
              }

              if (fileInfo.tempFilePath && selectedChannel && fetchNumSamples > 0 && sampleRate &&
                  (fetchStartSample !== currentZoomStart || fetchNumSamples !== (currentZoomEnd - currentZoomStart))) {
                debouncedFetchEdfChunk(fileInfo.tempFilePath, selectedChannel, fetchStartSample, fetchNumSamples, sampleRate);
              }
            }
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true
            },
            mode: 'x',
            onZoomComplete: (context) => {
              const chart = context.chart as Chart<'line'>;
              if (!fileInfo || !selectedChannel || !chartDataState) return;

              const xScale = chart.scales.x;
              const newMinTime = xScale.min as number;
              const newMaxTime = xScale.max as number;
              const originalStartTime = new Date(fileInfo.startTime).getTime();

              const newStartSample = Math.floor((newMinTime - originalStartTime) / 1000 * sampleRate);
              const newEndSample = Math.ceil((newMaxTime - originalStartTime) / 1000 * sampleRate);

              const fetchStartSample = Math.max(0, newStartSample);
              const fetchEndSample = Math.min(totalSamples, newEndSample);
              const fetchNumSamples = fetchEndSample - fetchStartSample;
              handleZoomOrPan(xScale.min, xScale.max)
              if (fileInfo.tempFilePath && selectedChannel && fetchNumSamples > 0 && sampleRate &&
                (fetchStartSample !== currentZoomStart || fetchNumSamples !== (currentZoomEnd - currentZoomStart))) {
                  debouncedFetchEdfChunk(fileInfo.tempFilePath, selectedChannel, fetchStartSample, fetchNumSamples, sampleRate);
              }
            }
          }
        }
      },
    };
  }, [fileInfo, selectedChannel, debouncedFetchEdfChunk, chartDataState, currentZoomStart, currentZoomEnd,handleZoomOrPan]);


  // Ažuriranje statistike za odabrani kanal (sada na temelju dohvaćenih podataka)
  const channelStats = useMemo(() => {
    if (!selectedChannel || !chartDataState) return null; // Koristite chartDataState.data
    const arr = chartDataState.data || [];
    return {
      mean: mean(arr),
      median: median(arr),
      min: arr.length ? Math.min(...arr) : 0,
      max: arr.length ? Math.max(...arr) : 0,
      stddev: stddev(arr),
    };
  }, [selectedChannel, chartDataState]);

  // Dodaj na vrh komponente
const handleChartDoubleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
  if (!chartRef.current || !fileInfo || !selectedChannel) return;
  const chart = chartRef.current;
  const sampleRate = fileInfo.sampleRates[fileInfo.channels.indexOf(selectedChannel)];
  const totalSamples = Math.floor(fileInfo.duration * sampleRate);

  // Dohvati X koordinatu klika
  const points = chart.getElementsAtEventForMode(event.nativeEvent, 'nearest', { intersect: false }, false);
  if (!points.length) return;
  const firstPoint = points[0];
  const dataIndex = firstPoint.index;

  // Izračunaj vrijeme (ili sample) oko kojeg se zumira
  const zoomSeconds = 200; // npr. 30 sekundi interval
  const centerSample = currentZoomStart + dataIndex;
  const startSample = Math.max(0, centerSample - Math.floor(zoomSeconds * sampleRate / 2));
  const endSample = Math.min(totalSamples, centerSample + Math.floor(zoomSeconds * sampleRate / 2));
  const numSamples = endSample - startSample;

  // Pozovi fetch za taj raspon (koristi debouncedFetchEdfChunk)
  const chartWidth = chart.width || 800;
  const maxPoints = chartWidth * 2;
  debouncedFetchEdfChunk(
    fileInfo.tempFilePath,
    selectedChannel,
    startSample,
    numSamples,
    sampleRate,
    maxPoints
  );
}, [chartRef, fileInfo, selectedChannel, currentZoomStart, debouncedFetchEdfChunk]);



  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Upload zona */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
      >
        <div className="flex flex-col items-center text-gray-600">
          <FaUpload className="w-12 h-12 mb-4" />
          <p className="text-lg font-medium">Povucite EDF fajl ovdje</p>
          <p className="text-sm text-gray-500 mt-2">ili kliknite za odabir</p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            accept=".edf"
          />
        </div>
      </div>

      {/* Status */}
      {loading && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center gap-2">
          <FaHeartbeat className="w-5 h-5 animate-pulse text-blue-600" />
          <span className="text-blue-600">Obrada u tijeku...</span>
        </div>
      )}

      {isLoadingChunk && (
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg flex items-center gap-2">
          <FaHeartbeat className="w-5 h-5 animate-pulse text-yellow-600" />
          <span className="ml-2 text-yellow-600">Učitavanje...</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg flex items-center gap-2">
          <FaInfoCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      {/* Prikaz informacija o EDF fajlu */}
      {fileInfo && (
        <div className="mt-8 space-y-8">
          {/* Glavne metrike */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaWaveSquare className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">Kanali</h3>
              </div>
              <p className="text-2xl font-bold">{fileInfo.channels.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaHeartbeat className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold">Sample rate</h3>
              </div>
              {/* Prikaz prvog sample rate-a ili prilagođeno ako ih ima više */}
              <p className="text-2xl font-bold">{fileInfo.sampleRates[0]} Hz</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaClock className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold">Trajanje</h3>
              </div>
              <p className="text-2xl font-bold">{fileInfo.duration.toFixed(1)}s</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaInfoCircle className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold">Početak</h3>
              </div>
              <p className="text-lg">{fileInfo.startTime}</p>
            </div>
          </div>

          {/* Detaljne informacije i graf */}
          {/* Multi-channel toggle */}
          <div className="mb-4 flex items-center">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={multiChannelMode}
                  onChange={toggleMultiChannelMode}
                />
                <div className={`block w-14 h-8 rounded-full transition ${multiChannelMode ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${multiChannelMode ? 'transform translate-x-6' : ''}`}></div>
              </div>
              <div className="ml-3 text-gray-700 font-medium">
                Multi-Channel Display
              </div>
            </label>
          </div>

          {/* Channel Selection */}
          {fileInfo && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Select Channels:</h3>
              
              {multiChannelMode ? (
                // Checkbox list for multi-channel mode
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {fileInfo.channels.map((channel) => (
                    <label key={channel} className="flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox h-5 w-5 text-blue-600"
                        checked={selectedChannels.includes(channel)}
                        onChange={() => handleChannelSelect(channel)}
                        disabled={selectedChannels.length >= 5 && !selectedChannels.includes(channel)}
                      />
                      <span className="ml-2 text-gray-700">{channel}</span>
                    </label>
                  ))}
                </div>
              ) : (
                // Dropdown for single-channel mode
                <select
                  value={selectedChannel || ''}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  {fileInfo.channels.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
              )}
              
              {multiChannelMode && (
                <p className="mt-2 text-sm text-gray-500">
                  {selectedChannels.length}/5 channels selected
                </p>
              )}
            </div>
          )}

          {/* Statistika */}
          {channelStats && (
            <div className="mb-4 text-sm bg-gray-50 p-4 rounded-lg grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div><b>Prosjek:</b> {channelStats.mean.toFixed(4)}</div>
              <div><b>Medijan:</b> {channelStats.median.toFixed(4)}</div>
              <div><b>Min:</b> {channelStats.min.toFixed(4)}</div>
              <div><b>Max:</b> {channelStats.max.toFixed(4)}</div>
              <div><b>Std dev:</b> {channelStats.stddev.toFixed(4)}</div>
            </div>
          )}

          {/* Graf na cijeloj širini */}
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-medium"></h4>
              <button
                onClick={handleFullNightView}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                Pregled cijele snimke
              </button>
            </div>

            <div className="relative h-[500px] w-full">
              {isLoadingChunk && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10 rounded-lg">
                  <FaHeartbeat className="w-8 h-8 animate-pulse text-blue-500" />
                  <span className="ml-2 text-blue-700">Učitavanje...</span>
                </div>
              )}
              <Line
                ref={chartRef}
                data={chartJSData}
                options={chartOptions}
                onDoubleClick={handleChartDoubleClick} // Dodano za double-click zoom
                height ={500} // Postavljeno visina grafa
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}