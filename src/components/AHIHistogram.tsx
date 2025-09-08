import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { calculateHistogram, calculateRecommendedBins } from '../utils/histogramUtils';

type AHIEvent = {
  type: 'apnea' | 'hypopnea';
  start_time: number;
  end_time: number;
  duration: number;
  severity: string;
  spo2_drop?: number;
};

type AHIHistogramProps = {
  events: AHIEvent[];
  binCount: number;
  showSeparateTypes: boolean;
};


const AHIHistogram: React.FC<AHIHistogramProps> = ({ events, binCount, showSeparateTypes }) => {
  const histogramData = useMemo(() => {
    if (!events || events.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    if (showSeparateTypes) {
      // Separate histograms for apnea and hypopnea
      const apneaEvents = events.filter(e => e.type === 'apnea');
      const hypopneaEvents = events.filter(e => e.type === 'hypopnea');
      
      const apneaDurations = apneaEvents.map(e => e.duration);
      const hypopneaDurations = hypopneaEvents.map(e => e.duration);
      
      // Use combined range for consistent binning
      const allDurations = events.map(e => e.duration);
      const min = Math.min(...allDurations);
      const max = Math.max(...allDurations);
      const binWidth = (max - min) / binCount;
      
      const bins = Array.from({ length: binCount }, (_, i) => ({
        start: min + i * binWidth,
        end: min + (i + 1) * binWidth
      }));
      
      const apneaFreq = new Array(binCount).fill(0);
      const hypopneaFreq = new Array(binCount).fill(0);
      
      apneaDurations.forEach(duration => {
        const binIndex = Math.min(Math.floor((duration - min) / binWidth), binCount - 1);
        apneaFreq[binIndex]++;
      });
      
      hypopneaDurations.forEach(duration => {
        const binIndex = Math.min(Math.floor((duration - min) / binWidth), binCount - 1);
        hypopneaFreq[binIndex]++;
      });
      
      return {
        labels: bins.map(bin => `${bin.start.toFixed(1)}-${bin.end.toFixed(1)}`),
        datasets: [
          {
            label: `Apnea Events (${apneaEvents.length})`,
            data: apneaFreq,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: 'rgba(220, 38, 38, 1)',
            borderWidth: 1,
          },
          {
            label: `Hypopnea Events (${hypopneaEvents.length})`,
            data: hypopneaFreq,
            backgroundColor: 'rgba(249, 115, 22, 0.7)',
            borderColor: 'rgba(234, 88, 12, 1)',
            borderWidth: 1,
          }
        ]
      };
    } else {
      // Combined histogram
      const durations = events.map(e => e.duration);
      const histogram = calculateHistogram(durations, binCount);
      
      return {
        labels: histogram.labels,
        datasets: [
          {
            label: `All Events (${events.length})`,
            data: histogram.frequencies,
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgba(37, 99, 235, 1)',
            borderWidth: 1,
          }
        ]
      };
    }
  }, [events, binCount, showSeparateTypes]);

  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Event Duration Distribution',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      legend: {
        display: true,
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            const percentage = events.length > 0 ? ((value / events.length) * 100).toFixed(1) : '0';
            return `${label}: ${value} events (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Event Duration (seconds)',
          font: {
            weight: 'bold'
          }
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: {
        title: {
          display: true,
          text: 'Number of Events',
          font: {
            weight: 'bold'
          }
        },
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  }), [events.length]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!events || events.length === 0) return null;
    
    const durations = events.map(e => e.duration);
    const sorted = [...durations].sort((a, b) => a - b);
    
    const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    
    return {
      count: events.length,
      mean: mean.toFixed(1),
      median: median.toFixed(1),
      min: Math.min(...durations).toFixed(1),
      max: Math.max(...durations).toFixed(1),
      q1: q1.toFixed(1),
      q3: q3.toFixed(1),
      recommended_bins: calculateRecommendedBins(events.length)
    };
  }, [events]);

  if (!events || events.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h4 className="text-lg font-semibold mb-4">📊 Event Duration Histogram</h4>
        <p className="text-gray-500 text-center py-8">No events to display</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <h4 className="text-lg font-semibold mb-4">📊 Event Duration Histogram</h4>
      
      {/* Statistics Summary */}
      {statistics && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h5 className="text-sm font-semibold text-gray-700 mb-2">Statistical Summary</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Count:</span>
              <span className="ml-1 font-medium">{statistics.count}</span>
            </div>
            <div>
              <span className="text-gray-600">Mean:</span>
              <span className="ml-1 font-medium">{statistics.mean}s</span>
            </div>
            <div>
              <span className="text-gray-600">Median:</span>
              <span className="ml-1 font-medium">{statistics.median}s</span>
            </div>
            <div>
              <span className="text-gray-600">Range:</span>
              <span className="ml-1 font-medium">{statistics.min}-{statistics.max}s</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-blue-600">
            💡 Recommended bins: {statistics.recommended_bins} (using Sturges' rule)
          </div>
        </div>
      )}
      
      {/* Chart */}
      <div style={{ height: '400px' }}>
        <Bar data={histogramData} options={chartOptions} />
      </div>
    </div>
  );
};

export default AHIHistogram;
