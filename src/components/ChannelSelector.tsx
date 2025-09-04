import React from 'react';

type ChannelSelectorProps = {
  fileInfo: {
    channels: string[];
  };
  multiChannelMode: boolean;
  selectedChannel: string | null;
  selectedChannels: string[];
  toggleMultiChannelMode: () => void;
  setSelectedChannel: (channel: string) => void;
  handleChannelSelect: (channel: string) => void;
};

const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  fileInfo,
  multiChannelMode,
  selectedChannel,
  selectedChannels,
  toggleMultiChannelMode,
  setSelectedChannel,
  handleChannelSelect,
}) => (
  <>
    <div className="mb-4 flex items-center">
      <label className="flex items-center cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={multiChannelMode}
            onChange={toggleMultiChannelMode}
          />
          <div className={`block w-14 h-8 rounded-full transition ${multiChannelMode ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
          <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${multiChannelMode ? 'transform translate-x-6' : ''}`}></div>
        </div>
        <div className="ml-3 text-gray-700 font-medium">
          Multi-Channel Display
        </div>
      </label>
    </div>
    <div className="mb-6">
      <h3 className="text-lg font-medium mb-2">Select Channels:</h3>
      {multiChannelMode ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {fileInfo.channels.map((channel, index) => (
            <label key={`${channel}-${index}`} className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-blue-600"
                checked={selectedChannels.includes(channel)}
                onChange={() => handleChannelSelect(channel)}
                disabled={selectedChannels.length >= 5 && !selectedChannels.includes(channel)}
              />
              <span className="ml-2 text-gray-700">{channel}</span>
            </label>
          ))}
        </div>
      ) : (
        <select
          value={selectedChannel || ''}
          onChange={(e) => setSelectedChannel(e.target.value)}
          className="w-full p-2 border rounded-md"
        >
          {fileInfo.channels.map((channel, index) => (
            <option key={`${channel}-${index}`} value={channel}>
              {channel}
            </option>
          ))}
        </select>
      )}
      {multiChannelMode && (
        <p className="mt-2 text-sm text-gray-500">
          {selectedChannels.length}/5 channels selected
        </p>
      )}
    </div>
  </>
);

export default ChannelSelector;