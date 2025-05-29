import { useState } from "react";
import Papa from "papaparse";

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
                <div className="mt-6">
                    <h2 className="text-xl font-semibold mb-4">CSV Data Preview: {fileName}</h2>
                    <table className="min-w-full bg-white border border-gray-200">
                        <thead>
                            <tr>
                                {csvData[0].map((header, index) => (
                                    <th key={index} className="border px-4 py-2">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {csvData.slice(1).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="border px-4 py-2">{cell}</td>
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

