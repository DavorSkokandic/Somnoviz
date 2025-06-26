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
  const [currentZoomStart, setCurrentZoomStart] = useState<number>(0); // Početni uzorak
  //const [currentZoomEnd, setCurrentZoomEnd] = useState<number>(0);     // Završni uzorak
  const [isLoadingChunk, setIsLoadingChunk] = useState<boolean>(false);
  const [clickedZoomTime, setClickedZoomTime] = useState<Date | null>(null);
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
      setCurrentZoomStart(startSample);
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
  300
);

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
        const initialNumSamples = fileInfo.previewData[channel]?.length || 500;

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
  if (!fileInfo) return;

  const start = 0;
  const end = fileInfo.duration;
  setViewport({ start, end });

  if (multiChannelMode && selectedChannels.length > 0) {
    debouncedFetchMultiChunks(start, end); // koristi debounced poziv za više kanala
  } else if (!multiChannelMode && selectedChannel) {
    const channelIndex = fileInfo.channels.indexOf(selectedChannel);
    if (channelIndex === -1) return;

    const sampleRate = fileInfo.sampleRates[channelIndex];
    const numSamples = Math.floor(fileInfo.duration * sampleRate);

    debouncedFetchEdfChunk(
      fileInfo.tempFilePath,
      selectedChannel,
      0,
      numSamples,
      sampleRate,
      2000
    );
  }
};
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
        //setCurrentZoomEnd(previewDataArr.length);
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


const debouncedFetchMultiChunks = useDebouncedCallback(
  async (start: number, end: number) => {
    if (!fileInfo || selectedChannels.length === 0) return;

    
    const sampleRate = fileInfo.sampleRates[0]; // pretpostavka: isti za sve
    const duration = fileInfo.duration;

    // ❗ Osiguraj granice uzorkovanja
    const boundedStart = Math.max(0, start);
    const boundedEnd = Math.min(duration, end);

    const startSample = Math.floor(boundedStart * sampleRate);
    const numSamples = Math.max(0,Math.floor(boundedEnd - boundedStart) * sampleRate);
    if (numSamples <= 0) return;
    
    for (const channel of selectedChannels) {
      try {
        const response = await axios.get<{
          data: number[];
          stats?: ChannelStats;
        }>(`http://localhost:5000/api/upload/edf-chunk-downsample`, {
          params: {
            filePath: fileInfo.tempFilePath,
            channel,
            start_sample: startSample,
            num_samples: numSamples,
            target_points: 2000, // Maksimalan broj uzoraka za dohvaćanje
          },
        });

        const chunkData = response.data?.data || [];

        if (chunkData.length === 0) {
          console.warn(`Nema podataka za kanal ${channel}, preskačem...`);
          continue;
        }
        const startTime = new Date(fileInfo.startTime);
        const labels = chunkData.map((_: number, i: number) => addSeconds(startTime, start + i / sampleRate));

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
      } catch (err) {
        console.error(`Greška pri dohvaćanju podataka za kanal ${channel}:`, err);
      }
    }
  },
  500
);
// Generiraj boje za točke ako je SpO2 kanal

const chartJSData = useMemo(() => {
  if (!fileInfo) return { labels: [], datasets: [] };

  if (!multiChannelMode || selectedChannels.length === 0) {
    if (!chartDataState || !selectedChannel) return { labels: [], datasets: [] };

    const isSpo2 = selectedChannel.toLowerCase().includes("spo2");
    const pointColors = isSpo2
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

  // Uvijek koristi label za vrijeme s prvog kanala
  const firstChannel = selectedChannels[0];
  const baseLabels = channelData[firstChannel]?.labels || [];

  return {
    labels: baseLabels,
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
        yAxisID: `y-${index}`,
      };
    }),
  };
}, [multiChannelMode, selectedChannels, channelData, chartDataState, selectedChannel, fileInfo]);



  const handleZoomOrPan = useCallback((startSample: number, endSample: number) => {
  if (!fileInfo || !selectedChannel) return;
  
  if (isNaN(startSample) || isNaN(endSample) || startSample < 0 || endSample <= startSample) return;
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
 const chartOptions: ChartOptions<'line'> = useMemo(() => {
  if (!fileInfo || (!selectedChannel && selectedChannels.length === 0)) return {};

  const isMulti = multiChannelMode;
  const sampleRate = selectedChannel
    ? fileInfo.sampleRates[fileInfo.channels.indexOf(selectedChannel)]
    : fileInfo.sampleRates[0];

  const startTime = new Date(fileInfo.startTime).getTime();

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
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
          },
        },
        title: {
          display: true,
          text: 'Vrijeme',
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
      tooltip: {
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            if (!fileInfo || !sampleRate) return items[0].label ?? '';
            const dataIndex = items[0].dataIndex;
            const absoluteSampleIndex = currentZoomStart + dataIndex;
            const timeInSeconds = absoluteSampleIndex / sampleRate;
            const date = addSeconds(new Date(fileInfo.startTime), timeInSeconds);
            return date.toLocaleTimeString('hr-HR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              fractionalSecondDigits: 3,
            } as Intl.DateTimeFormatOptions);
          },
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          onPanComplete: ({ chart }) => {
            const xScale = chart.scales.x;
            const min = xScale.min as number;
            const max = xScale.max as number;

            const newStart = (min - startTime) / 1000;
            const newEnd = (max - startTime) / 1000;

            if (newEnd - newStart < 1) return;

            setViewport({ start: newStart, end: newEnd });

            if (isMulti) {
              debouncedFetchMultiChunks(newStart, newEnd);
            } else {
              const fetchStartSample = Math.floor(newStart * sampleRate);
              const fetchNumSamples = Math.ceil((newEnd - newStart) * sampleRate);
              debouncedFetchEdfChunk(
                fileInfo.tempFilePath,
                selectedChannel!,
                fetchStartSample,
                fetchNumSamples,
                sampleRate
              );
            }
          },
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x',
          onZoomComplete: ({ chart }) => {
            const xScale = chart.scales.x;
            const min = xScale.min as number;
            const max = xScale.max as number;

            const newStart = (min - startTime) / 1000;
            const newEnd = (max - startTime) / 1000;

            if (newEnd - newStart < 1) return;

            setViewport({ start: newStart, end: newEnd });

            if (isMulti) {
              debouncedFetchMultiChunks(newStart, newEnd);
            } else {
              const fetchStartSample = Math.floor(newStart * sampleRate);
              const fetchNumSamples = Math.ceil((newEnd - newStart) * sampleRate);
              debouncedFetchEdfChunk(
                fileInfo.tempFilePath,
                selectedChannel!,
                fetchStartSample,
                fetchNumSamples,
                sampleRate
              );
            }
          },
        },
      },
      legend: {
        display: true,
      },
    },
    onClick: (event) => {
      if (typeof event.x === 'number' && chartRef.current) {
        const x = chartRef.current.scales['x'].getValueForPixel(event.x);
        if (typeof x === 'number') {
          setClickedZoomTime(new Date(x));
        }
      }
    },
  };
}, [
  fileInfo,
  selectedChannel,
  selectedChannels,
  multiChannelMode,
  debouncedFetchEdfChunk,
  debouncedFetchMultiChunks,
  currentZoomStart,
]);




// State for zoom time (double-clicked time on chart)

useEffect(() => {
  if (!clickedZoomTime || !fileInfo) return;

  const zoomRange = 30; // sekundi
  const center = clickedZoomTime.getTime() / 1000;
  const start = Math.max(0, center - zoomRange);
  const end = Math.min(fileInfo.duration, center + zoomRange);

  setViewport({ start, end });
  debouncedFetchMultiChunks(start, end);
}, [clickedZoomTime, fileInfo, debouncedFetchMultiChunks]);
  // Ažuriranje statistike za odabrani kanal (sada na temelju dohvaćenih podataka)


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
                  {fileInfo.channels.map((channel, index) => (
                    <label key={`${channel}-${index}`}className="flex items-center">
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
                  {fileInfo.channels.map((channel, index) => (
                     <option key={`${channel}-${index}`} value={channel}>
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
          {channelStats && Object.keys(channelStats).length > 0 && (
            <div className="mb-4 text-sm bg-gray-50 p-4 rounded-lg">
              {Object.keys(channelStats).map((channel) => (
                <div key={channel} className="mb-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <strong>{channel}</strong>
                  <div><b>Prosjek:</b> {channelStats[channel].mean.toFixed(2)}</div>
                  <div><b>Medijan:</b> {channelStats[channel].median.toFixed(2)}</div>
                  <div><b>Min:</b> {channelStats[channel].min.toFixed(2)}</div>
                  <div><b>Max:</b> {channelStats[channel].max.toFixed(2)}</div>
                  <div><b>Std dev:</b> {channelStats[channel].stddev.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Graf na cijeloj širini */}
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-medium"></h4>
              <button
                onClick={handleFullNightView}
                 className="bg-black text-white px-6 py-2
                            rounded -xl shadow-md hover:from-blue-700 hover:via-indigo-800 hover:to-blue-950 hover:scale-105
                            transition duration-200 font-semibold tracking-wide flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
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


// setViewport is now managed by useState above, so this function is not needed and can be removed.
