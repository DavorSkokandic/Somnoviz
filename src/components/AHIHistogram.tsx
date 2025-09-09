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
        display: false, // We'll use our own title in the panel header
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#e2e8f0', // slate-200 for dark theme
          font: {
            size: 12,
            weight: 'normal'
          },
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)', // slate-900 with opacity
        titleColor: '#f1f5f9', // slate-100
        bodyColor: '#e2e8f0', // slate-200
        borderColor: '#475569', // slate-600
        borderWidth: 1,
        cornerRadius: 8,
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
        grid: {
          color: '#374151', // slate-700 for grid lines
          drawBorder: false,
        },
        title: {
          display: true,
          text: 'Event Duration (seconds)',
          color: '#e2e8f0', // slate-200
          font: {
            weight: 'bold',
            size: 12
          }
        },
        ticks: {
          color: '#cbd5e1', // slate-300
          maxRotation: 45,
          minRotation: 0,
          font: {
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: '#374151', // slate-700 for grid lines
          drawBorder: false,
        },
        title: {
          display: true,
          text: 'Number of Events',
          color: '#e2e8f0', // slate-200
          font: {
            weight: 'bold',
            size: 12
          }
        },
        beginAtZero: true,
        ticks: {
          color: '#cbd5e1', // slate-300
          precision: 0,
          font: {
            size: 11
          }
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
      <div className="text-center py-12">
        <p className="text-slate-400 text-lg">No events to display</p>
        <p className="text-slate-500 text-sm mt-2">Run AHI analysis to generate event data</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Summary - Professional Style */}
      {statistics && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wide">Statistical Summary</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{statistics.count}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Count</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{statistics.mean}s</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Mean</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{statistics.median}s</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Median</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{statistics.min}-{statistics.max}s</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Range</div>
            </div>
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
