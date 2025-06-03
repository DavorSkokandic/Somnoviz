// src/components/ColumnSelector.tsx
import { useEffect, useState } from "react";

interface ColumnSelectorProps {
  headers: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  presets?: { [name: string]: string[] };
}

export default function ColumnSelector({
  headers,
  selected,
  onChange,
  presets = {},
}: ColumnSelectorProps) {
  const [localSelection, setLocalSelection] = useState<string[]>(selected);

  useEffect(() => {
    onChange(localSelection);
  }, [localSelection]);

  const toggleColumn = (col: string) => {
    setLocalSelection((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const applyPreset = (presetColumns: string[]) => {
    setLocalSelection(presetColumns.filter((col) => headers.includes(col)));
  };

  return (
    <div className="p-4 border rounded-lg shadow bg-white mb-4">
      <h3 className="font-semibold mb-2">Odaberi stupce za analizu</h3>

      {/* Preseti */}
      {Object.entries(presets).map(([name, cols]) => (
        <button
          key={name}
          className="text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded mr-2 mb-2"
          onClick={() => applyPreset(cols)}
        >
          {name}
        </button>
      ))}

      {/* Checkbox lista */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        {headers.map((col) => (
          <label key={col} className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={localSelection.includes(col)}
              onChange={() => toggleColumn(col)}
            />
            <span>{col}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
