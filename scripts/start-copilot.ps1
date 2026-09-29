param(
  [ValidateRange(1024, 65535)][int]$Port = 3010,
  [switch]$SkipNetworkCheck
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) {
  $nodeCommand.Source
} else {
  Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}

if (-not (Test-Path -LiteralPath $nodePath)) {
  throw "Node.js was not found. Open this project in Codex once, or install Node.js."
}

Set-Location -LiteralPath $projectRoot
if (-not $SkipNetworkCheck) {
  & $nodePath (Join-Path $PSScriptRoot "check-ai-network.mjs")
  if ($LASTEXITCODE -ne 0) {
    throw "Live AI chat cannot start in this process. Resolve the network error above. For browsing-only use, pass -SkipNetworkCheck."
  }
}
Write-Host "有家料理 Copilot is starting..."
Write-Host "Guest: http://127.0.0.1:$Port/visit"
Write-Host "Chef table: http://127.0.0.1:$Port/copilot/table"
Write-Host "Copilot: http://127.0.0.1:$Port/copilot"
Write-Host "Tailscale phone: http://100.108.132.20:$Port/visit"
Write-Host "Keep this window open while using the app."
& $nodePath ".\node_modules\next\dist\bin\next" start -H 0.0.0.0 -p $Port
