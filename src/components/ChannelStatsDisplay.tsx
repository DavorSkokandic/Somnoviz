import React from 'react';

type ChannelStats = {
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
};

type ChannelStatsDisplayProps = {
  channelStats: Record<string, ChannelStats>;
};

const ChannelStatsDisplay: React.FC<ChannelStatsDisplayProps> = ({ channelStats }) => {
  if (!channelStats || Object.keys(channelStats).length === 0) return null;
  return (
    <div className="mb-4 text-sm bg-gray-50 p-4 rounded-lg">
      {Object.keys(channelStats).map((channel) => (
        <div key={channel} className="mb-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <strong>{channel}</strong>
          <div><b>Prosjek:</b> {channelStats[channel].mean.toFixed(2)}</div>
          <div><b>Medijan:</b> {channelStats[channel].median.toFixed(2)}</div>
          <div><b>Min:</b> {channelStats[channel].min.toFixed(2)}</div>
          <div><b>Max:</b> {channelStats[channel].max.toFixed(2)}</div>
          <div><b>Std dev:</b> {channelStats[channel].stddev.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
};

export default ChannelStatsDisplay;