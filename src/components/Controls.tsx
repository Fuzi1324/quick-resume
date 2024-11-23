import React from 'react';

interface ControlsProps {
  processFilter: string;
  onProcessFilterChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  showOnlyGames: boolean;
  onShowOnlyGamesChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const Controls: React.FC<ControlsProps> = ({
  processFilter,
  onProcessFilterChange,
  showOnlyGames,
  onShowOnlyGamesChange,
}) => {
  return (
    <div className="controls-section">
      <div className="search-control">
        <input
          type="text"
          id="processFilter"
          className="search-box"
          placeholder="Filter processes..."
          value={processFilter}
          onChange={onProcessFilterChange}
        />
      </div>
      <div className="toggle-control">
        <div className="toggle-wrapper">
          <span className="toggle-text">Show only Games</span>
          <label className="toggle-container">
            <input
              type="checkbox"
              id="gamesOnlyToggle"
              checked={showOnlyGames}
              onChange={onShowOnlyGamesChange}
            />
            <span className="toggle-label"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default Controls;