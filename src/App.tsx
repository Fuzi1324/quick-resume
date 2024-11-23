import React, { useEffect, useState } from 'react';
import ProcessList from './components/ProcessList';
import StatusBar from './components/StatusBar';
import Controls from './components/Controls';
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

const REFRESH_COOLDOWN = 500; // Minimale Zeit zwischen Aktualisierungen in ms

const App: React.FC = () => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [processFilter, setProcessFilter] = useState('');
  const [showOnlyGames, setShowOnlyGames] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

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

  // Effekt, um Prozesse periodisch zu aktualisieren
  useEffect(() => {
    refreshProcesses();
    const interval = setInterval(refreshProcesses, 2000);
    return () => clearInterval(interval);
  }, []);

  const showStatus = (message: string, error = false) => {
    setStatusMessage(message);
    setIsError(error);
  };

  // Effekt, um die Statusmeldung nach 3 Sekunden auszublenden
  useEffect(() => {
    if (statusMessage) {
      const timeout = setTimeout(() => {
        setStatusMessage('');
        setIsError(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [statusMessage]);

  // Hilfsfunktion zur Erkennung von Spielen
  const isGameProcess = (process: ProcessInfo): boolean => {
    const knownGames = [
      'theescapists2',
      'minecraft',
      'rocketleague',
      'csgo',
      'dota2',
      'gta5',
      'gtav',
      'ark',
      'shootergame', // ARK's executable name
    ];

    const gameKeywords = [
      'game',
      'play',
      'player',
      'score',
      'level',
      'mission',
      'survival',
      'evolved',
    ];

    const name = (process.Name || '').toLowerCase();
    const title = (process.WindowTitle || '').toLowerCase();

    if (knownGames.some((game) => name.includes(game))) {
      return true;
    }

    if (gameKeywords.some((keyword) => title.includes(keyword) || name.includes(keyword))) {
      return true;
    }

    return false;
  };

  // Hilfsfunktion zum Filtern von Prozessen
  const matchesFilter = (process: ProcessInfo, filter: string): boolean => {
    if (!filter) {
      if (showOnlyGames) {
        return isGameProcess(process);
      }
      return true;
    }

    filter = filter.toLowerCase();
    const name = (process.Name || '').toLowerCase();
    const title = (process.WindowTitle || '').toLowerCase();

    const matchesSearchFilter = name.includes(filter) || title.includes(filter);

    if (showOnlyGames) {
      return matchesSearchFilter && isGameProcess(process);
    }

    return matchesSearchFilter;
  };

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

  // Handler für den Prozessfilter
  const handleProcessFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProcessFilter(event.target.value.trim());
  };

  // Handler für den Games-Only-Schalter
  const handleGamesOnlyToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowOnlyGames(event.target.checked);
  };

  // Filtern der Prozesse
  const filteredProcesses = processes.filter((process) => {
    if (process.IsSuspended) {
      return matchesFilter(process, processFilter);
    } else {
      return matchesFilter(process, processFilter);
    }
  });

  // Aufteilen in aktive und suspendierte Prozesse
  const activeProcesses = filteredProcesses.filter((process) => !process.IsSuspended);
  const suspendedProcesses = filteredProcesses.filter((process) => process.IsSuspended);

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
          title="All Processes"
          processes={activeProcesses}
          onSuspend={suspendProcessByName}
          onResume={resumeProcessByName}
        />

        <ProcessList
          title="Suspended Processes"
          processes={suspendedProcesses}
          onSuspend={suspendProcessByName}
          onResume={resumeProcessByName}
        />
      </div>
    </div>
  );
};

export default App;