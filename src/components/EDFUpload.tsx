import { useState } from "react";
import { Upload } from "lucide-react";
import axios from "axios";

type EDFPreview = {
  channels: string[];
  sampleRate: number;
  duration: number;
  previewData: { [channel: string]: number[] };
};

export default function EDFUpload() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean | null>(null);
  const [edfPreview, setEdfPreview] = useState<EDFPreview | null>(null);

  const handleFileUpload = (file: File) => {
    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    axios
      .post("http://localhost:5000/api/upload/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => {
        setEdfPreview(res.data.data);
        setUploadSuccess(true);
      })
      .catch(() => setUploadSuccess(false))
      .finally(() => setUploading(false));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.name.endsWith(".edf")) {
        handleFileUpload(file);
      } else {
        alert("Molimo učitaj EDF datoteku.");
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById("fileInput")?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-10 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer text-center"
      >
        <div className="flex flex-col items-center justify-center text-gray-600">
          <Upload className="w-10 h-10 mb-4" />
          <p className="text-lg font-medium">Drag & drop EDF datoteku ovdje</p>
          <p className="text-sm text-gray-400">ili klikni za odabir s računala</p>
        </div>
        <input
          type="file"
          id="fileInput"
          accept=".edf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
      </div>

      <div className="mt-4 text-center">
        {uploading && <p className="text-blue-600">Učitavanje...</p>}
        {uploadSuccess === true && (
          <p className="text-green-600">Uspješno učitano na server ✅</p>
        )}
        {uploadSuccess === false && (
          <p className="text-red-600">Greška pri učitavanju na server ❌</p>
        )}
      </div>

      {edfPreview && (
        <div className="mt-8 overflow-x-auto max-h-[400px] border border-gray-200 rounded-xl bg-white shadow">
          <div className="px-4 py-3 border-b bg-gray-100 text-gray-700 font-semibold text-sm">
            Pregled datoteke: {fileName}
          </div>
          <div className="p-4">
            <p><b>Kanali:</b> {edfPreview.channels.join(", ")}</p>
            <p><b>Sample rate:</b> {edfPreview.sampleRate} Hz</p>
            <p><b>Trajanje:</b> {edfPreview.duration} sekundi</p>
            <div className="mt-4">
              <b>Prvih 10 uzoraka po kanalu:</b>
              <table className="min-w-full text-sm text-gray-700 mt-2">
                <thead>
                  <tr>
                    <th className="px-3 py-2">Kanal</th>
                    {[...Array(10)].map((_, i) => (
                      <th key={i} className="px-3 py-2">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {edfPreview.channels.map((ch) => (
                    <tr key={ch}>
                      <td className="px-3 py-2 font-bold">{ch}</td>
                      {edfPreview.previewData[ch]?.slice(0, 10).map((v, idx) => (
                        <td key={idx} className="px-3 py-2">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
