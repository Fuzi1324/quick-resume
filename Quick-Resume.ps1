# PowerShell script for suspending and resuming processes via the Windows API

param(
    [Parameter()]
    [string]$Command,
    [Parameter()]
    [string]$ProcessName,
    [Parameter()]
    [switch]$Silent = $false
)

# Set output encoding to UTF8 and disable progress output
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Function to handle output
function Write-Output-Message {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    
    if (-not $Silent) {
        $Global:OutputMessages += @{
            Type = $Type
            Message = $Message
            Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        }
    }
}

# Definition of suspend and resume functions via Windows API
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class ProcessControl
{
    [DllImport("ntdll.dll")]
    public static extern int NtSuspendProcess(IntPtr processHandle);

    [DllImport("ntdll.dll")]
    public static extern int NtResumeProcess(IntPtr processHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(int processAccess, bool bInheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool EnableWindow(IntPtr hWnd, bool enable);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool IsWindow(IntPtr hWnd);
}
"@

# Constants for window manipulation
$Global:WINDOW_CONSTANTS = @{
    GWL_STYLE = -16
    WS_VISIBLE = 0x10000000
    WS_MINIMIZE = 0x20000000
    WS_MAXIMIZEBOX = 0x00010000
    WS_MINIMIZEBOX = 0x00020000
    WS_SYSMENU = 0x00080000
    WS_CAPTION = 0x00C00000
    SWP_FRAMECHANGED = 0x0020
    SWP_NOMOVE = 0x0002
    SWP_NOSIZE = 0x0001
    SWP_NOZORDER = 0x0004
}

# File path for storing suspended process information
$Global:STATE_FILE = Join-Path $PSScriptRoot "suspended_processes.json"
$Global:SuspendedProcesses = @{}
$Global:OutputMessages = @()

function Initialize-State {
    Write-Output-Message "Initializing state..."
    Write-Output-Message "Looking for state file at: $Global:STATE_FILE"
    
    $Global:SuspendedProcesses = @{}
    
    if (Test-Path $Global:STATE_FILE) {
        try {
            Write-Output-Message "Found state file, loading..."
            $json = Get-Content $Global:STATE_FILE -Raw -Encoding UTF8
            $data = $json | ConvertFrom-Json
            $validProcesses = @{}
            
            foreach ($item in $data.PSObject.Properties) {
                try {
                    $processId = [int]$item.Name
                    $process = Get-Process -Id $processId -ErrorAction Stop
                    
                    Write-Output-Message "Found process $($item.Value.ProcessName) (ProcessId: $processId)"
                    
                    # Überprüfe, ob der Prozess tatsächlich suspendiert ist
                    $handle = [ProcessControl]::OpenProcess(0x1F0FFF, $false, $processId)
                    if ($handle -ne [IntPtr]::Zero) {
                        Write-Output-Message "Process handle valid, checking window..."
                        
                        # Prozess ist tatsächlich suspendiert, füge ihn zur Liste hinzu
                        $windowHandle = [IntPtr]::new([long]$item.Value.WindowHandle)
                        if ([ProcessControl]::IsWindow($windowHandle)) {
                            $validProcesses[$processId] = @{
                                ProcessName = $item.Value.ProcessName
                                WindowHandle = $windowHandle
                                WindowStyle = [int]$item.Value.WindowStyle
                                WindowTitle = $item.Value.WindowTitle
                                SuspendTime = [DateTime]::Parse($item.Value.SuspendTime)
                            }
                            Write-Output-Message "Successfully restored state for $($item.Value.ProcessName) (ProcessId: $processId)"
                        }
                        else {
                            Write-Output-Message "Window handle invalid for $($item.Value.ProcessName) (ProcessId: $processId)" -Type "Warning"
                        }
                        
                        [ProcessControl]::CloseHandle($handle)
                    }
                    else {
                        Write-Output-Message "Could not open process $($item.Value.ProcessName) (ProcessId: $processId)" -Type "Warning"
                    }
                }
                catch {
                    Write-Output-Message "Error processing $($item.Value.ProcessName) (ProcessId: $processId): $_" -Type "Error"
                }
            }
            
            $Global:SuspendedProcesses = $validProcesses
            
            if ($Global:SuspendedProcesses.Count -gt 0) {
                Write-Output-Message "Successfully restored $($Global:SuspendedProcesses.Count) suspended processes"
                Write-Output-Message "Restored processes:"
                foreach ($proc in $Global:SuspendedProcesses.GetEnumerator()) {
                    Write-Output-Message "- $($proc.Value.ProcessName) (ProcessId: $($proc.Key))"
                }
            }
            else {
                Write-Output-Message "No valid suspended processes found"
                if (Test-Path $Global:STATE_FILE) {
                    Remove-Item $Global:STATE_FILE -Force
                    Write-Output-Message "Removed invalid state file"
                }
            }
        }
        catch {
            Write-Output-Message "Error loading state file: $_" -Type "Error"
            if (Test-Path $Global:STATE_FILE) {
                Remove-Item $Global:STATE_FILE -Force
                Write-Output-Message "Removed corrupted state file"
            }
        }
    }
    else {
        Write-Output-Message "No state file found at: $Global:STATE_FILE"
    }
    
    Write-Output-Message "Initialization complete"
}

function Save-State {
    try {
        Write-Output-Message "Saving state to: $Global:STATE_FILE"
        $data = [ordered]@{}
        
        foreach ($key in $Global:SuspendedProcesses.Keys) {
            $proc = $Global:SuspendedProcesses[$key]
            if ($proc -and $proc.WindowHandle) {
                # Konvertiere den Key zu einem String
                $stringKey = $key.ToString()
                $data[$stringKey] = @{
                    ProcessName = $proc.ProcessName
                    WindowHandle = $proc.WindowHandle.ToInt64()
                    WindowStyle = $proc.WindowStyle
                    WindowTitle = $proc.WindowTitle
                    SuspendTime = $proc.SuspendTime.ToString("o")  # ISO 8601 Format für bessere Kompatibilität
                }
            }
        }
        
        if ($data.Count -gt 0) {
            # Stelle sicher, dass das Verzeichnis existiert
            $directory = Split-Path -Parent $Global:STATE_FILE
            if (!(Test-Path $directory)) {
                New-Item -ItemType Directory -Path $directory -Force | Out-Null
            }
            
            $jsonString = ConvertTo-Json -InputObject $data -Depth 10
            [System.IO.File]::WriteAllText($Global:STATE_FILE, $jsonString, [System.Text.Encoding]::UTF8)
            Write-Output-Message "Successfully saved state for $($data.Count) processes"
            Write-Output-Message "State file saved to: $Global:STATE_FILE"
        }
        else {
            Write-Output-Message "No processes to save"
            if (Test-Path $Global:STATE_FILE) {
                Remove-Item $Global:STATE_FILE -Force
                Write-Output-Message "Removed empty state file"
            }
        }
    }
    catch {
        Write-Output-Message "Error saving state: $_" -Type "Error"
        Write-Output-Message "Path attempted: $Global:STATE_FILE"
    }
}

function Hide-Window {
    param ([IntPtr]$windowHandle)
    
    try {
        $style = [ProcessControl]::GetWindowLong($windowHandle, $WINDOW_CONSTANTS.GWL_STYLE)
        if ($style -eq 0) { return $false }
        
        $newStyle = $style -band -bnot (
            $WINDOW_CONSTANTS.WS_VISIBLE -bor
            $WINDOW_CONSTANTS.WS_MINIMIZE -bor
            $WINDOW_CONSTANTS.WS_MAXIMIZEBOX -bor
            $WINDOW_CONSTANTS.WS_MINIMIZEBOX -bor
            $WINDOW_CONSTANTS.WS_SYSMENU -bor
            $WINDOW_CONSTANTS.WS_CAPTION
        )
        
        $result = [ProcessControl]::SetWindowLong($windowHandle, $WINDOW_CONSTANTS.GWL_STYLE, $newStyle)
        if ($result -eq 0) { return $false }
        
        [ProcessControl]::SetWindowPos(
            $windowHandle,
            [IntPtr]::Zero,
            0, 0, 0, 0,
            $WINDOW_CONSTANTS.SWP_NOMOVE -bor
            $WINDOW_CONSTANTS.SWP_NOSIZE -bor
            $WINDOW_CONSTANTS.SWP_NOZORDER -bor
            $WINDOW_CONSTANTS.SWP_FRAMECHANGED
        )
        
        return [ProcessControl]::ShowWindow($windowHandle, 0)
    }
    catch {
        Write-Output-Message "Error hiding window: $_" -Type "Error"
        return $false
    }
}

function Show-Window {
    param (
        [IntPtr]$windowHandle,
        [int]$style
    )
    
    try {
        if (![ProcessControl]::IsWindow($windowHandle)) { return $false }
        
        [ProcessControl]::SetWindowLong($windowHandle, $WINDOW_CONSTANTS.GWL_STYLE, $style)
        
        [ProcessControl]::SetWindowPos(
            $windowHandle,
            [IntPtr]::Zero,
            0, 0, 0, 0,
            $WINDOW_CONSTANTS.SWP_NOMOVE -bor
            $WINDOW_CONSTANTS.SWP_NOSIZE -bor
            $WINDOW_CONSTANTS.SWP_NOZORDER -bor
            $WINDOW_CONSTANTS.SWP_FRAMECHANGED
        )
        
        return [ProcessControl]::ShowWindow($windowHandle, 9)
    }
    catch {
        Write-Output-Message "Error showing window: $_" -Type "Error"
        return $false
    }
}

function Suspend-Process {
    param ([string]$procname)
    
    Write-Output-Message "Attempting to suspend process: $procname"
    $processes = Get-Process -Name $procname -ErrorAction SilentlyContinue
    
    if (!$processes) {
        Write-Output-Message "Process not found: $procname" -Type "Error"
        return $false
    }
    
    foreach ($proc in $processes) {
        if ($Global:SuspendedProcesses.ContainsKey($proc.Id)) {
            Write-Output-Message "Process already suspended: $procname (PID: $($proc.Id))" -Type "Warning"
            continue
        }
        
        $windowHandle = $proc.MainWindowHandle
        if ($windowHandle -eq [IntPtr]::Zero) {
            Write-Output-Message "No main window found for process: $procname (PID: $($proc.Id))" -Type "Warning"
            continue
        }
        
        try {
            $style = [ProcessControl]::GetWindowLong($windowHandle, $WINDOW_CONSTANTS.GWL_STYLE)
            if ($style -eq 0) {
                Write-Output-Message "Could not get window style for process: $procname" -Type "Error"
                continue
            }
            
            if (Hide-Window $windowHandle) {
                $handle = [ProcessControl]::OpenProcess(0x1F0FFF, $false, $proc.Id)
                if ($handle -ne [IntPtr]::Zero) {
                    $result = [ProcessControl]::NtSuspendProcess($handle)
                    [ProcessControl]::CloseHandle($handle)
                    
                    if ($result -eq 0) {
                        $Global:SuspendedProcesses[$proc.Id] = @{
                            ProcessName = $proc.ProcessName
                            WindowHandle = $windowHandle
                            WindowStyle = $style
                            WindowTitle = $proc.MainWindowTitle
                            SuspendTime = Get-Date
                        }
                        Save-State
                        Write-Output-Message "Successfully suspended process: $procname (PID: $($proc.Id))"
                    } else {
                        Write-Output-Message "Failed to suspend process: $procname (PID: $($proc.Id))" -Type "Error"
                    }
                } else {
                    Write-Output-Message "Failed to open process: $procname (PID: $($proc.Id))" -Type "Error"
                }
            }
        }
        catch {
            Write-Output-Message "Error suspending process: $_" -Type "Error"
        }
    }
    
    return $true
}

function Resume-Process {
    param ([string]$procname)
    
    Write-Output-Message "Attempting to resume process: $procname"
    $processesToResume = $Global:SuspendedProcesses.GetEnumerator() | Where-Object { $_.Value.ProcessName -eq $procname }
    
    if (!$processesToResume) {
        Write-Output-Message "No suspended process found: $procname" -Type "Error"
        return $false
    }
    
    foreach ($proc in $processesToResume) {
        try {
            $handle = [ProcessControl]::OpenProcess(0x1F0FFF, $false, $proc.Key)
            if ($handle -ne [IntPtr]::Zero) {
                $result = [ProcessControl]::NtResumeProcess($handle)
                [ProcessControl]::CloseHandle($handle)
                
                if ($result -eq 0) {
                    Show-Window $proc.Value.WindowHandle $proc.Value.WindowStyle
                    $Global:SuspendedProcesses.Remove($proc.Key)
                    Save-State
                    Write-Output-Message "Successfully resumed process: $($proc.Value.ProcessName) (PID: $($proc.Key))"
                } else {
                    Write-Output-Message "Failed to resume process: $($proc.Value.ProcessName) (PID: $($proc.Key))" -Type "Error"
                }
            } else {
                Write-Output-Message "Failed to open process: $($proc.Value.ProcessName) (PID: $($proc.Key))" -Type "Error"
            }
        }
        catch {
            Write-Output-Message "Error resuming process: $_" -Type "Error"
        }
    }
    
    return $true
}

function Get-ProcessInfo {
    param (
        [Parameter(Mandatory=$true)]
        [System.Diagnostics.Process]$Process
    )

    $isSuspended = $false
    if ($Global:SuspendedProcesses.ContainsKey($Process.Id)) {
        $isSuspended = $true
    }

    return @{
        Name = $Process.ProcessName
        Id = $Process.Id
        WindowTitle = $Process.MainWindowTitle
        IsSuspended = $isSuspended
    }
}

function Get-AllProcessesStatus {
    Write-Output-Message "Getting status of all processes..."
    
    $processes = @()
    
    # Get all processes with window titles
    Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object {
        $processes += Get-ProcessInfo -Process $_
    }
    
    # Add any suspended processes that might not have window titles anymore
    foreach ($procId in $Global:SuspendedProcesses.Keys) {
        $existingProc = $processes | Where-Object { $_.Id -eq $procId }
        if (-not $existingProc) {
            $processes += @{
                Name = $Global:SuspendedProcesses[$procId].ProcessName
                Id = $procId
                WindowTitle = $Global:SuspendedProcesses[$procId].WindowTitle
                IsSuspended = $true
            }
        }
    }
    
    return $processes
}

# Initialize variables
$Global:OutputMessages = @()
$Global:STATE_FILE = Join-Path $PSScriptRoot "suspended_processes.json"
$Global:SuspendedProcesses = @{}

# Initialize state
Initialize-State

# Execute command based on parameter
$result = switch ($Command) {
    "Suspend-Process" {
        if ($ProcessName) {
            Suspend-Process -procname $ProcessName
            @{
                Success = $true
                Message = "Process suspended successfully"
                ProcessName = $ProcessName
                Logs = $Global:OutputMessages
            }
        } else {
            @{
                Success = $false
                Message = "No process name specified"
                Logs = $Global:OutputMessages
            }
        }
    }
    "Resume-Process" {
        if ($ProcessName) {
            Resume-Process -procname $ProcessName
            @{
                Success = $true
                Message = "Process resumed successfully"
                ProcessName = $ProcessName
                Logs = $Global:OutputMessages
            }
        } else {
            @{
                Success = $false
                Message = "No process name specified"
                Logs = $Global:OutputMessages
            }
        }
    }
    "Get-AppsStatus" {
        $processes = Get-AllProcessesStatus
        @{
            Success = $true
            Data = @($processes)
            Logs = $Global:OutputMessages
        }
    }
    default {
        @{
            Success = $false
            Message = "Invalid command specified"
            Logs = $Global:OutputMessages
        }
    }
}

# Ensure only JSON output and no other output
try {
    $jsonOutput = $result | ConvertTo-Json -Depth 10 -Compress
    $jsonOutput
} catch {
    @{
        Success = $false
        Message = "Error converting output to JSON: $_"
        Logs = $Global:OutputMessages
    } | ConvertTo-Json -Compress
}