import { useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import axios from "axios";
//import { useData } from "../context/DataContext";

type ParsedData = string[][];

export default function CSVUpload() {
  const [csvData, setCsvData] = useState<ParsedData>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean | null>(null);

  const handleFileUpload = (file: File) => {
    setFileName(file.name);

    // Prvo parsiramo lokalno za prikaz
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data as ParsedData);
      },
      error: (error) => {
        console.error("Error parsing CSV file:", error);
      },
    });

    // Zatim šaljemo backendu
    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    axios
      .post("http://localhost:5000/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => {
        console.log("Upload successful:", res.data);
        setUploadSuccess(true);
      })
      .catch((err) => {
        console.error("Upload error:", err);
        setUploadSuccess(false);
      })
      .finally(() => setUploading(false));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type === "text/csv") {
        handleFileUpload(file);
      } else {
        alert("Molimo učitaj CSV datoteku.");
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Upload zona */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById("fileInput")?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-10 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer text-center"
      >
        <div className="flex flex-col items-center justify-center text-gray-600">
          <Upload className="w-10 h-10 mb-4" />
          <p className="text-lg font-medium">Drag & drop CSV datoteku ovdje</p>
          <p className="text-sm text-gray-400">ili klikni za odabir s računala</p>
        </div>
        <input
          type="file"
          id="fileInput"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
      </div>

      {/* Status poruke */}
      <div className="mt-4 text-center">
        {uploading && <p className="text-blue-600">Učitavanje...</p>}
        {uploadSuccess === true && (
          <p className="text-green-600">Uspješno učitano na server ✅</p>
        )}
        {uploadSuccess === false && (
          <p className="text-red-600">Greška pri učitavanju na server ❌</p>
        )}
      </div>

      {/* Pregled CSV podataka */}
      {csvData.length > 0 && (
        <div className="mt-8 overflow-x-auto max-h-[400px] border border-gray-200 rounded-xl bg-white shadow">
          <div className="px-4 py-3 border-b bg-gray-100 text-gray-700 font-semibold text-sm">
            Pregled datoteke: {fileName}
          </div>
          <table className="min-w-full text-sm text-gray-700">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                {csvData[0].map((col, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2 text-left font-semibold border-b border-gray-300"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvData.slice(1, 6).map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 border-b border-gray-200">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
