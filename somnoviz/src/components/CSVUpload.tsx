import { useState } from "react";
import Papa from "papaparse";
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
    }

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if(event.dataTransfer.files.length > 0) {
            const file = event.dataTransfer.files[0];
            if (file.type === "text/csv") {
                handleFileUpload(file);
            } else {
                alert("Please upload a valid CSV file.");
            }
        }
    }

    return(
        <div>
            {/*Upload Area*/}
            <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-400 p-6 rounded-lg text-center cursor-pointer hover:bg-gray-50"
                onClick={() => document.getElementById("fileInput")?.click()}
                >
                    <p className="text-gray-600 mb-2">Drag and drop a CSV file here, or click to select a file</p>
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
                        ></input>
            </div>

            {/*Preview Area*/}
            {csvData.length > 0 && (
                <div className="mt-6 overflow-x-auto max-h-96">
                <p className="font-semibold mb-2">Preview: {fileName}</p>
                <table className="table-auto border border-gray-300 w-full text-sm">
                    <thead>
                    <tr>
                        {csvData[0].map((col, idx) => (
                        <th key={idx} className="border px-2 py-1 bg-gray-200">{col}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {csvData.slice(1, 6).map((row, i) => (
                        <tr key={i}>
                        {row.map((cell, j) => (
                            <
                                td key={j} className="border px-2 py-1">{cell}</td>
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

