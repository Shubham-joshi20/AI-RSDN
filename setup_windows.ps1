$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    throw "Python was not found. Install Python 3.11+ and enable Add Python to PATH."
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating Python virtual environment at .venv"
    python -m venv .venv
}

Write-Host "Installing Windows-compatible backend dependencies"
& ".venv\Scripts\python.exe" -m pip install --upgrade pip
& ".venv\Scripts\python.exe" -m pip install -r requirements.txt

Write-Host "Checking the backend"
& ".venv\Scripts\python.exe" -m unittest discover -s tests -v

Write-Host "Environment ready. Start the backend with .\run_backend_windows.ps1"
Write-Host "Start the frontend in another terminal with: cd FrontEnd; npm install; npm run dev"
