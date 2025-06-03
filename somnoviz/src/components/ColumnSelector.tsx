import {useData} from "../context/DataContext";
import { useState, useEffect } from "react";

export default function ColumnSelector() {
    const { csvData, selectedColumns, setSelectedColumns } = useData();
    const headers = csvData.length > 0 ? csvData[0] : [];

    const [timeColumn, setTimeColumn] = useState<string | undefined>(selectedColumns?.time);
    const [variableColumns, setVariableColumns] = useState<string[]>(selectedColumns?.variables ?? []);

    useEffect(() => {
        if (setSelectedColumns) {
            setSelectedColumns({
                time: timeColumn,
                variables: variableColumns
            });
        }
        }, [timeColumn, variableColumns]);
    	
        const toggleVariable = (column: string) => {
            if(variableColumns.includes(column)) {
                setVariableColumns(variableColumns.filter(col => col !== column));
            }
            else {
                setVariableColumns([...variableColumns, column]);
            }
        };
    
    if (headers.length === 0) return null;

     return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-2">Odabir kolona</h2>

      <div className="mb-4">
        <label className="block font-medium mb-1">Vrijeme:</label>
        <select
          className="border p-2 rounded w-full"
          value={timeColumn}
          onChange={(e) => setTimeColumn(e.target.value)}
        >
          <option value="">-- Odaberi kolonu --</option>
          {headers.map((col, idx) => (
            <option key={idx} value={col}>
              {col || `Kolona ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-medium mb-1">Mjerne varijable (može više odabira):</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
           {headers.map((col, idx) => {
            const label = col || `Kolona ${idx + 1}`;
            return (
              <label key={idx} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={variableColumns.includes(col)}
                  onChange={() => toggleVariable(col)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>
             {/* Pregled izbora */}
        {(timeColumn || variableColumns.length > 0) && (
            <div className="mt-4 bg-gray-100 p-3 rounded">
                <p><strong>Vrijeme:</strong> {timeColumn || "Nije odabrano"}</p>
                <p><strong>Varijable:</strong> {variableColumns.length > 0 ? variableColumns.join(", ") : "Nema odabranih"}</p>
            </div>
        )}

    </div>

  );
}