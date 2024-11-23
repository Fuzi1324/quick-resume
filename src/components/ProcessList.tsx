import React from 'react';
import ProcessItem from './ProcessItem';

interface ProcessInfo {
  Name: string;
  Id: number;
  WindowTitle: string;
  IsSuspended: boolean;
}

interface ProcessListProps {
  title: string;
  processes: ProcessInfo[];
  onSuspend: (processName: string) => void;
  onResume: (processName: string) => void;
}

const ProcessList: React.FC<ProcessListProps> = ({ title, processes, onSuspend, onResume }) => {
  return (
    <div className="process-list">
      <h3>{title}</h3>
      <div className="scrollable-list">
        {processes.map((process) => (
          <ProcessItem
            key={process.Id}
            process={process}
            onSuspend={onSuspend}
            onResume={onResume}
          />
        ))}
      </div>
    </div>
  );
};

export default ProcessList;