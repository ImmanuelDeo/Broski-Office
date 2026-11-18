$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (Get-Command python -ErrorAction SilentlyContinue) { & python server.py @args }
elseif (Get-Command py -ErrorAction SilentlyContinue) { & py -3 server.py @args }
else { throw 'Python 3.10+ diperlukan. Instal Python dari python.org lalu jalankan kembali.' }
