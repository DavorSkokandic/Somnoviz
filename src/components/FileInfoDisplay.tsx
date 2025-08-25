import React from 'react';
import { FaWaveSquare, FaHeartbeat, FaClock, FaInfoCircle } from 'react-icons/fa';

type FileInfo = {
  channels: string[];
  sampleRates: number[];
  duration: number;
  startTime: string;
};

type FileInfoDisplayProps = {
  fileInfo: FileInfo;
};

const FileInfoDisplay: React.FC<FileInfoDisplayProps> = ({ fileInfo }) => (
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
);

export default FileInfoDisplay;