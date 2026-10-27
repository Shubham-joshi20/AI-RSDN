$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\FrontEnd"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install Node.js 18+ and reopen PowerShell."
}

if (-not (Test-Path "node_modules")) {
    npm install
}

npm run dev
