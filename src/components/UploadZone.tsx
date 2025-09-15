import React from 'react';
import { Upload } from 'lucide-react';

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
    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-all duration-200 cursor-pointer group"
  >
    <div className="flex flex-col items-center text-slate-600">
      <Upload className="w-12 h-12 mb-4 text-slate-400 group-hover:text-blue-500 transition-colors duration-200" />
      <p className="text-lg font-semibold text-slate-700 group-hover:text-slate-900">Drop EDF file here</p>
      <p className="text-sm text-slate-500 mt-2">or click to select file</p>
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