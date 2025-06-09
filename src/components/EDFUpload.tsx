import { useRef, useState, useMemo } from "react";
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
  sampleRate: number;
  duration: number;
  startTime: string;
  patientInfo: string;
  recordingInfo: string;
  previewData: { [channel: string]: number[] };
};

// Formatiranje vremena
function addSeconds(date: Date, seconds: number): Date {
  const newDate = new Date(date.getTime() + seconds * 1000);
  return newDate;
}

function mean(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(arr: number[]) {
  if (!arr.length) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}

export default function EDFUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileInfo, setFileInfo] = useState<EDFFileInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<EDFFileInfo>(
        "http://localhost:5000/api/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setFileInfo(response.data);
      setSelectedChannel(response.data.channels[0]);
    } catch {
      setError("Greška pri obradi EDF fajla. Provjerite format i pokušajte ponovo.");
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

  // Priprema podataka za graf
  const chartData = useMemo(() => {
    if (!selectedChannel || !fileInfo) return { labels: [], datasets: [] };
    const dataArr = fileInfo.previewData[selectedChannel] || [];
    const startTime = new Date(fileInfo.startTime);
     if (isNaN(startTime.getTime())) return { labels: [], datasets: [] };

    const labels = dataArr.map((_, i) => {
      const newDate = addSeconds(startTime, i / fileInfo.sampleRate);
      return newDate;
    });

    return {
      labels,
      datasets: [
        {
          label: selectedChannel,
          data: dataArr,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.5)",
          tension: 0.4,
        },
      ],
    };
  }, [selectedChannel, fileInfo]);

  // Statistika za odabrani kanal
  const channelStats = useMemo(() => {
    if (!selectedChannel || !fileInfo) return null;
    const arr = fileInfo.previewData[selectedChannel] || [];
    return {
      mean: mean(arr),
      median: median(arr),
      min: arr.length ? Math.min(...arr) : 0,
      max: arr.length ? Math.max(...arr) : 0,
      stddev: stddev(arr),
    };
  }, [selectedChannel, fileInfo]);

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
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          accept=".edf"
        />
      </div>

      {/* Status */}
      {loading && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center gap-2">
          <FaHeartbeat className="w-5 h-5 animate-pulse text-blue-600" />
          <span className="text-blue-600">Obrada u tijeku...</span>
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
              <p className="text-2xl font-bold">{fileInfo.sampleRate} Hz</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FaInfoCircle className="w-5 h-5 text-gray-600" />
                Metapodaci
              </h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">Pacijent</dt>
                  <dd className="font-medium">{fileInfo.patientInfo}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Snimanje</dt>
                  <dd className="font-medium">{fileInfo.recordingInfo}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FaWaveSquare className="w-5 h-5 text-gray-600" />
                Odabrani kanal
              </h3>
              <select
                value={selectedChannel || ""}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full p-2 border rounded-md mb-4"
              >
                {fileInfo.channels.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>

              {/* Statistika */}
              {channelStats && (
                <div className="mb-4 text-sm bg-gray-50 p-3 rounded">
                  <div><b>Prosjek:</b> {channelStats.mean.toFixed(4)}</div>
                  <div><b>Medijan:</b> {channelStats.median.toFixed(4)}</div>
                  <div><b>Min:</b> {channelStats.min.toFixed(4)}</div>
                  <div><b>Max:</b> {channelStats.max.toFixed(4)}</div>
                  <div><b>Std dev:</b> {channelStats.stddev.toFixed(4)}</div>
                </div>
              )}

              <div className="h-64">
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
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
                          title: (items) => {
                            const date = new Date(items[0].label);
                            return date.toLocaleTimeString();
                          }
                        }
                      },
                      
                      zoom: {
                        zoom: {
                          wheel: {
                            enabled: true,
                          },
                          pinch: {
                            enabled: true
                          },
                          mode: 'x',
                        }
                      }
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
