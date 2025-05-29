import { useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react"; // ikona
import { useData } from "../context/DataContext";

type ParsedData = string[][];

export default function CSVUpload() {
  const [csvData, setCsvData] = useState<ParsedData>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
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
