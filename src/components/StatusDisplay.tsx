import React from 'react';
import { FaHeartbeat, FaInfoCircle } from 'react-icons/fa';

type StatusDisplayProps = {
  loading: boolean;
  isLoadingChunk: boolean;
  error: string | null;
};

const StatusDisplay: React.FC<StatusDisplayProps> = ({ loading, isLoadingChunk, error }) => (
  <>
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
  </>
);

export default StatusDisplay;