# Quick Resume

Quick Resume is a Windows application that brings console-like quick resume functionality to PC games and applications. Inspired by the Xbox Series X|S feature, it allows you to suspend and resume processes instantly, preserving their state.

## Features

- Suspend running processes to free up system resources
- Resume processes exactly where you left off
- Modern Electron-based user interface
- Lightweight and efficient
- Windows native process handling through PowerShell

## Installation

You can install Quick Resume using the provided installer:

1. Download the latest `Quick Resume Setup.exe` from the releases page
2. Run the installer
3. Follow the installation wizard
4. Launch Quick Resume from the desktop shortcut or start menu

## Usage

1. Launch Quick Resume
2. The application will show a list of running processes
3. To suspend a process:
   - Select the process from the list
   - Click the "Suspend" button
4. To resume a process:
   - Select the suspended process
   - Click the "Resume" button

## Building from Source

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Windows 10/11

### Build Steps

1. Clone the repository:
```bash
git clone https://github.com/yourusername/Quick_Resume.git
cd Quick_Resume
```

2. Install dependencies:
```bash
npm install
```

3. Run the application in development mode:
```bash
npm start
```

4. Build the installer:
```bash
npm run build
```

The installer will be created in the `dist` folder.

## Technical Details

Quick Resume uses:
- Electron for the user interface
- PowerShell scripts for process manipulation
- Windows native APIs for process handling

## License

This project is licensed under the MIT License - see the [license.txt](license.txt) file for details.

## Security Note

Quick Resume requires administrative privileges to suspend and resume processes. This is necessary for the core functionality to work properly.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

Use this software at your own risk. While we've tested it extensively, suspending processes can potentially lead to data loss if used incorrectly. Always save your work before suspending any application.

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.
