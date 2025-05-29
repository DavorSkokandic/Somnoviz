import { createContext, useContext, useState, } from "react";
import type { ReactNode } from "react";

type CSVRow = string[];
type CSVData = CSVRow[];

interface DataContextType {
    csvData: CSVData;
    setCsvData: (data: CSVData) => void;
    fileName: string | null;
    setFileName: (name: string | null) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const [csvData, setcsvData] = useState<CSVData>([]);
    const [fileName, setFileName] = useState<string | null>(null);

    return(
        <DataContext.Provider value={{ csvData, setCsvData: setcsvData, fileName, setFileName }}>
            {children}
        </DataContext.Provider>
    )

}
export const useData = (): DataContextType => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error("useData must be used within a DataProvider");
    }
    return context;
}
