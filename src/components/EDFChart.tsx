import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js';
import type { ChartOptions, ChartData } from 'chart.js';
import { FaHeartbeat } from 'react-icons/fa';

type EDFChartProps = {
  chartRef: React.RefObject<ChartJS<'line'> | null>;
  chartJSData: ChartData<'line'>;
  chartOptions: ChartOptions<'line'>;
  isLoadingChunk: boolean;
  handleChartDoubleClick: (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => void;
  height?: number;
};

const EDFChart: React.FC<EDFChartProps> = ({ chartRef, chartJSData, chartOptions, isLoadingChunk, handleChartDoubleClick, height = 500 }) => (
  <div className="relative w-full" style={{ height: `${height}px` }}>
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
      onDoubleClick={handleChartDoubleClick}
      height={height}
    />
  </div>
);

export default EDFChart;