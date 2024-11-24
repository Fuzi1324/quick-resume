import React, { useEffect, useState } from 'react';
import ProcessList from './components/ProcessList';
import StatusBar from './components/StatusBar';
import Controls from './components/Controls';
import { isGameByName } from './services/gameService';
import './App.css';

declare global {
  interface Window {
    processControl: {
      suspendProcess: (processName: string) => Promise<any>;
      resumeProcess: (processName: string) => Promise<any>;
      getAllProcesses: () => Promise<any>;
    };
  }
}

interface ProcessInfo {
  Name: string;
  Id: number;
  WindowTitle: string;
  IsSuspended: boolean;
}

const REFRESH_COOLDOWN = 300; // Minimale Zeit zwischen Aktualisierungen in ms

const App: React.FC = () => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [processFilter, setProcessFilter] = useState('');
  const [showOnlyGames, setShowOnlyGames] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [filteredActiveProcesses, setFilteredActiveProcesses] = useState<ProcessInfo[]>([]);
  const [filteredSuspendedProcesses, setFilteredSuspendedProcesses] = useState<ProcessInfo[]>([]);

  const refreshProcesses = async () => {
    if (isRefreshing) return;

    const now = Date.now();
    if (now - lastRefreshTime < REFRESH_COOLDOWN) {
      return;
    }

    setIsRefreshing(true);

    try {
      const result = await window.processControl.getAllProcesses();
      if (result.Success && result.Data) {
        const allProcesses: ProcessInfo[] = Array.isArray(result.Data) ? result.Data : [result.Data];
        setProcesses(allProcesses);
      } else {
        showStatus('Fehler beim Laden der Prozesse', true);
      }
    } catch (error: any) {
      showStatus(error.message || 'Ein Fehler ist aufgetreten', true);
    } finally {
      setIsRefreshing(false);
      setLastRefreshTime(Date.now());
    }
  };

  useEffect(() => {
    refreshProcesses();
    const interval = setInterval(refreshProcesses, 2000);
    return () => clearInterval(interval);
  }, []);

  const showStatus = (message: string, error = false) => {
    setStatusMessage(message);
    setIsError(error);
  };

  useEffect(() => {
    if (statusMessage) {
      const timeout = setTimeout(() => {
        setStatusMessage('');
        setIsError(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [statusMessage]);

  const isGameProcess = async (process: ProcessInfo): Promise<boolean> => {
    const name = (process.Name || '').toLowerCase();

    try {
      return await isGameByName(name);
    } catch (error) {
      console.error('Fehler bei der Spielerkennung:', error);
      return false;
    }
  };

  useEffect(() => {
    const filterProcesses = async () => {
      const activeProcs: ProcessInfo[] = [];
      const suspendedProcs: ProcessInfo[] = [];

      for (const process of processes) {
        // Textfilter anwenden
        const name = (process.Name || '').toLowerCase();
        const title = (process.WindowTitle || '').toLowerCase();
        const filter = processFilter.toLowerCase();
        const matchesTextFilter = !filter || name.includes(filter) || title.includes(filter);

        if (!matchesTextFilter) continue;

        // Prozess zur entsprechenden Liste hinzufügen
        if (process.IsSuspended) {
          suspendedProcs.push(process);
        } else {
          // Nur bei aktiven Prozessen den Games-Filter anwenden
          if (!showOnlyGames || await isGameProcess(process)) {
            activeProcs.push(process);
          }
        }
      }

      setFilteredActiveProcesses(activeProcs);
      setFilteredSuspendedProcesses(suspendedProcs);
    };

    filterProcesses();
  }, [processes, processFilter, showOnlyGames]);

  const suspendProcessByName = async (processName: string) => {
    if (!processName) {
      showStatus('Bitte geben Sie einen Prozessnamen ein', true);
      return;
    }

    try {
      const result = await window.processControl.suspendProcess(processName);
      if (result.Success) {
        showStatus(`Prozess "${processName}" wurde erfolgreich suspendiert`, false);
        await refreshProcesses();
      } else {
        showStatus(result.Message || `Fehler beim Suspendieren von "${processName}"`, true);
      }
    } catch (error: any) {
      showStatus(error.message || 'Ein Fehler ist aufgetreten', true);
    }
  };

  const resumeProcessByName = async (processName: string) => {
    if (!processName) {
      showStatus('Bitte geben Sie einen Prozessnamen ein', true);
      return;
    }

    try {
      const result = await window.processControl.resumeProcess(processName);
      if (result.Success) {
        showStatus(`Prozess "${processName}" wurde erfolgreich fortgesetzt`, false);
        await refreshProcesses();
      } else {
        showStatus(result.Message || `Fehler beim Fortsetzen von "${processName}"`, true);
      }
    } catch (error: any) {
      showStatus(error.message || 'Ein Fehler ist aufgetreten', true);
    }
  };

  const handleProcessFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProcessFilter(event.target.value.trim());
  };

  const handleGamesOnlyToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowOnlyGames(event.target.checked);
  };

  return (
    <div className="container">
      <h1>Quick Resume Control</h1>

      <StatusBar message={statusMessage} isError={isError} />

      <Controls
        processFilter={processFilter}
        onProcessFilterChange={handleProcessFilterChange}
        showOnlyGames={showOnlyGames}
        onShowOnlyGamesChange={handleGamesOnlyToggle}
      />

      <div className="list-container">
        <ProcessList
          title="Active Processes"
          processes={filteredActiveProcesses}
          onSuspend={suspendProcessByName}
          onResume={resumeProcessByName}
        />

        <ProcessList
          title="Suspended Processes"
          processes={filteredSuspendedProcesses}
          onSuspend={suspendProcessByName}
          onResume={resumeProcessByName}
        />
      </div>
    </div>
  );
};

export default App;