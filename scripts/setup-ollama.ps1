$ErrorActionPreference = "Stop"

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
  throw "Ollama is not installed. Install it from https://ollama.com/download, then run this script again."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$modelFile = Join-Path $repoRoot "ollama\Modelfile"

Write-Host "Downloading the lightweight Gemma 3 1B base model (about 815 MB)..."
& $ollama.Source pull gemma3:1b

Write-Host "Creating the Acme Jobs evidence-first local model..."
& $ollama.Source create acme-jobs -f $modelFile

Write-Host "Local model ready. Keep Ollama running and set LOCAL_AI_MODEL=acme-jobs."
& $ollama.Source list
