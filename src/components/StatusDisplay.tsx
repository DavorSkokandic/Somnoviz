import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

type StatusDisplayProps = {
  loading: boolean;
  isLoadingChunk: boolean;
  error: string | null;
};

const StatusDisplay: React.FC<StatusDisplayProps> = ({ loading, isLoadingChunk, error }) => (
  <>
    {loading && (
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <div className="flex flex-col">
          <span className="text-blue-700 font-medium">Processing EDF file...</span>
          <span className="text-blue-600 text-sm">Analyzing signal data and extracting channel information</span>
        </div>
      </div>
    )}
    {isLoadingChunk && (
      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
        <div className="flex flex-col">
          <span className="text-amber-700 font-medium">Loading data...</span>
          <span className="text-amber-600 text-sm">Fetching signal data for visualization</span>
        </div>
      </div>
    )}
    {error && (
      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
        <div className="flex flex-col">
          <span className="text-red-700 font-medium">Error</span>
          <span className="text-red-600 text-sm">{error}</span>
        </div>
      </div>
    )}
  </>
);

export default StatusDisplay;