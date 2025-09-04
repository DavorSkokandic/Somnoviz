import React from 'react';
import { FaUpload } from 'react-icons/fa';

type UploadZoneProps = {
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (file: File) => void;
  handleClick: () => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
};

const UploadZone: React.FC<UploadZoneProps> = ({ fileInputRef, handleFileUpload, handleClick, handleDrop }) => (
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
);

export default UploadZone;