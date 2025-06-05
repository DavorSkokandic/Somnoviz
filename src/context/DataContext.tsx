import React from 'react';
import { createContext, useState, useContext } from 'react';
import type { ReactNode } from 'react';

export type EDFPreview = {
  channels: string[];
  sampleRate: number;
  duration: number;
  previewData: { [channel: string]: number[] };
};

interface DataContextType {
  edfPreview: EDFPreview | null;
  setEdfPreview: React.Dispatch<React.SetStateAction<EDFPreview | null>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [edfPreview, setEdfPreview] = useState<EDFPreview | null>(null);

  return (
    <DataContext.Provider value={{ edfPreview, setEdfPreview }}>
      {children}
    </DataContext.Provider>
  );
};

// Custom hook za lakše korišćenje konteksta
export const useDataContext = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};
