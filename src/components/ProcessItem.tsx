import React from 'react';

interface ProcessInfo {
  Name: string;
  Id: number;
  WindowTitle: string;
  IsSuspended: boolean;
}

interface ProcessItemProps {
  process: ProcessInfo;
  onSuspend: (processName: string) => void;
  onResume: (processName: string) => void;
}

const ProcessItem: React.FC<ProcessItemProps> = ({ process, onSuspend, onResume }) => {
  const handleActionClick = () => {
    if (process.IsSuspended) {
      onResume(process.Name);
    } else {
      onSuspend(process.Name);
    }
  };

  return (
    <div className={`process-item ${process.IsSuspended ? 'suspended' : ''}`}>
      <div className="process-info">
        {process.WindowTitle && <div className="process-name">{process.WindowTitle}</div>}
        <div className="process-details">
          {process.Name} (PID: {process.Id || 'N/A'})
        </div>
      </div>
      <div className="process-actions">
        <button
          className={process.IsSuspended ? 'resume' : 'suspend'}
          onClick={handleActionClick}
        >
          {process.IsSuspended ? 'Resume' : 'Suspend'}
        </button>
      </div>
    </div>
  );
};

export default ProcessItem;