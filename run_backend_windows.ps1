$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "The virtual environment is missing. Run .\setup_windows.ps1 first."
    exit 1
}

& ".venv\Scripts\python.exe" -m backend.server
