// Calculate recommended bin count using Sturges' rule
export function calculateRecommendedBins(dataCount: number): number {
  if (dataCount === 0) return 5;
  return Math.ceil(Math.log2(dataCount)) + 1;
}

// Calculate histogram bins and frequencies
export function calculateHistogram(durations: number[], binCount: number) {
  if (durations.length === 0) return { bins: [], frequencies: [], labels: [] };
  
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const binWidth = (max - min) / binCount;
  
  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * binWidth,
    end: min + (i + 1) * binWidth,
    count: 0
  }));
  
  // Count durations in each bin
  durations.forEach(duration => {
    const binIndex = Math.min(Math.floor((duration - min) / binWidth), binCount - 1);
    bins[binIndex].count++;
  });
  
  return {
    bins,
    frequencies: bins.map(bin => bin.count),
    labels: bins.map(bin => `${bin.start.toFixed(1)}-${bin.end.toFixed(1)}s`)
  };
}
