import React from 'react';

interface StatusBarProps {
  message: string;
  isError: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ message, isError }) => {
  if (!message) return null;

  return (
    <div id="status" className={isError ? 'error' : 'success'}>
      {message}
    </div>
  );
};

export default StatusBar;