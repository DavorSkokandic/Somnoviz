import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js';
import type { ChartOptions, ChartData } from 'chart.js';
import { Loader2 } from 'lucide-react';

type EDFChartProps = {
  chartRef: React.RefObject<ChartJS<'line'> | null>;
  chartJSData: ChartData<'line'>;
  chartOptions: ChartOptions<'line'>;
  isLoadingChunk: boolean;
  handleChartDoubleClick: (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => void;
  handleChartClick?: (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => void;
  height?: number;
};

const EDFChart: React.FC<EDFChartProps> = ({ chartRef, chartJSData, chartOptions, isLoadingChunk, handleChartDoubleClick, handleChartClick, height = 500 }) => (
  <div className="relative w-full" style={{ height: `${height}px` }}>
    {isLoadingChunk && (
      <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-10 rounded-lg">
        <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-lg shadow-lg border">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-blue-700 font-medium">Loading chart data...</span>
        </div>
      </div>
    )}
    <Line
      ref={chartRef}
      data={chartJSData}
      options={chartOptions}
      onDoubleClick={handleChartDoubleClick}
      onClick={handleChartClick}
      height={height}
    />
  </div>
);

export default EDFChart;