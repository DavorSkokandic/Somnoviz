import React from 'react';
import { Loader2, AlertCircle, CheckCircle, Clock, Database, Activity } from 'lucide-react';

type StatusDisplayProps = {
  loading: boolean;
  isLoadingChunk: boolean;
  error: string | null;
};

const StatusDisplay: React.FC<StatusDisplayProps> = ({ loading, isLoadingChunk, error }) => (
  <>
    {loading && (
      <div className="mt-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <Database className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-blue-700 font-semibold">Processing EDF File</span>
            </div>
            <p className="text-blue-600 text-sm">Analyzing signal data and extracting channel information</p>
          
          </div>
        </div>
      </div>
    )}
    {isLoadingChunk && (
      <div className="mt-4 p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg">
            <Activity className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span className="text-amber-700 font-semibold">Loading Signal Data</span>
            </div>
            <p className="text-amber-600 text-sm">Fetching high-resolution data for visualization</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-500">
              <Clock className="w-3 h-3" />
              <span>Optimizing for real-time display...</span>
            </div>
          </div>
        </div>
      </div>
    )}
    {error && (
      <div className="mt-4 p-6 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-700 font-semibold">Processing Error</span>
            </div>
            <p className="text-red-600 text-sm">{error}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
              <CheckCircle className="w-3 h-3" />
              <span>Please check file format and try again</span>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
);

export default StatusDisplay;