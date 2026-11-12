[CmdletBinding()]
param(
    [string]$AfterEffectsVersion,
    [string]$AfterEffectsPath,
    [string]$PreferencesRoot = (Join-Path $env:APPDATA 'Adobe\After Effects')
)

$ErrorActionPreference = 'Stop'

function Get-AtalhosSHA256([string]$File) {
    $stream = [IO.File]::OpenRead($File)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','') }
    finally { $algorithm.Dispose(); $stream.Dispose() }
}

function Get-AtalhosAEFiles {
    @('Atalhos AE.jsx','zz Atalhos AE - NULL.jsx','Atalhos AE-assets\null-action.jsxinc',
      'Atalhos AE-assets\adjustment.png','Atalhos AE-assets\airrack-text.png','Atalhos AE-assets\camera.png',
      'Atalhos AE-assets\copy-ease.png','Atalhos AE-assets\experimental-3d-text.png','Atalhos AE-assets\flicker-text.png',
      'Atalhos AE-assets\hologram-text.png','Atalhos AE-assets\null.png','Atalhos AE-assets\paste-ease.png')
}

function New-AtalhosAEPlan([string]$SourceRoot,[string]$ApplicationRoot,[string]$UserPreferencesRoot,[string]$Version) {
    $source = [IO.Path]::GetFullPath($SourceRoot)
    $application = [IO.Path]::GetFullPath($ApplicationRoot)
    if (-not (Test-Path -LiteralPath (Join-Path $application 'Support Files\AfterFX.exe') -PathType Leaf)) {
        throw 'Escolha a pasta Adobe After Effects que contem Support Files\AfterFX.exe.'
    }
    foreach ($relative in Get-AtalhosAEFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $source $relative) -PathType Leaf)) {
            throw "Pacote incompleto: $relative. Extraia o ZIP inteiro antes de instalar."
        }
    }
    $scripts = Join-Path $application 'Support Files\Scripts'
    $officialPanels = Join-Path $scripts 'ScriptUI Panels'
    $userPanels = Join-Path $UserPreferencesRoot ($Version + '\Scripts\ScriptUI Panels')
    $panelRoots = @()
    if (Test-Path -LiteralPath (Join-Path $userPanels 'Atalhos AE.jsx') -PathType Leaf) { $panelRoots += $userPanels }
    if (Test-Path -LiteralPath (Join-Path $officialPanels 'Atalhos AE.jsx') -PathType Leaf) { $panelRoots += $officialPanels }
    if (-not $panelRoots.Count) { $panelRoots = @($officialPanels) }
    $entries = @()
    foreach ($panelRoot in $panelRoots) {
        foreach ($relative in (Get-AtalhosAEFiles | Where-Object { $_ -ne 'zz Atalhos AE - NULL.jsx' })) {
            $entries += [PSCustomObject]@{ Source=(Join-Path $source $relative); Target=(Join-Path $panelRoot $relative) }
        }
    }
    $entries += [PSCustomObject]@{Source=(Join-Path $source 'zz Atalhos AE - NULL.jsx');Target=(Join-Path $scripts 'zz Atalhos AE - NULL.jsx')}
    $entries += [PSCustomObject]@{Source=(Join-Path $source 'Atalhos AE-assets\null-action.jsxinc');Target=(Join-Path $scripts 'Atalhos AE-assets\null-action.jsxinc')}
    [PSCustomObject]@{ Entries=$entries; Panels=$panelRoots; Scripts=$scripts; Application=$application; Preferences=$UserPreferencesRoot; Version=$Version }
}

function Invoke-AtalhosAEPlan($Plan,[string]$BackupRoot) {
    # Back up only exact files owned by this plugin; never remove a directory,
    # alter keyboard preferences or register a global effect in the Adobe app.
    $backup = Join-Path ([IO.Path]::GetFullPath($BackupRoot)) ((Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8))
    $records = @()
    foreach ($entry in $Plan.Entries) {
        $sourceHash = Get-AtalhosSHA256 $entry.Source
        $exists = Test-Path -LiteralPath $entry.Target
        if ($exists) {
            $current = Get-Item -LiteralPath $entry.Target
            if ($current.PSIsContainer -or ($current.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Destino inesperado: $($entry.Target)" }
        }
        $records += [PSCustomObject]@{Source=$entry.Source;Target=$entry.Target;Hash=$sourceHash;Existed=$exists;Backup=$null;Written=$false}
    }
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    for ($i=0;$i -lt $records.Count;$i++) {
        if ($records[$i].Existed) {
            $records[$i].Backup = Join-Path $backup ($i.ToString('00')+'-'+[IO.Path]::GetFileName($records[$i].Target))
            Copy-Item -LiteralPath $records[$i].Target -Destination $records[$i].Backup
            if ((Get-AtalhosSHA256 $records[$i].Target) -ne (Get-AtalhosSHA256 $records[$i].Backup)) { throw 'Nao foi possivel verificar o backup. Nenhum arquivo do plugin foi substituido.' }
        }
    }
    $temp = $null
    try {
        foreach ($record in $records) {
            $directory = Split-Path -Parent $record.Target
            New-Item -ItemType Directory -Path $directory -Force | Out-Null
            $temp = Join-Path $directory ('.AtalhosAE-install-'+[Guid]::NewGuid().ToString('N')+'.tmp')
            Copy-Item -LiteralPath $record.Source -Destination $temp
            if ((Get-AtalhosSHA256 $temp) -ne $record.Hash) { throw 'A copia ficou diferente da origem.' }
            if ($record.Existed) { [IO.File]::Replace($temp,$record.Target,[NullString]::Value) }
            else { [IO.File]::Move($temp,$record.Target) }
            $temp = $null; $record.Written = $true
            if ((Get-AtalhosSHA256 $record.Target) -ne $record.Hash) { throw 'A verificacao do arquivo instalado falhou.' }
        }
    } catch {
        $failure = $_
        foreach ($record in $records) {
            if (-not $record.Written) { continue }
            try {
                if ((Get-AtalhosSHA256 $record.Target) -ne $record.Hash) { continue }
                if ($record.Existed) { Copy-Item -LiteralPath $record.Backup -Destination $record.Target -Force }
                else { Remove-Item -LiteralPath $record.Target -Force }
            } catch { Write-Warning "Confira o backup em $backup antes de tentar novamente." }
        }
        throw $failure
    } finally {
        if ($temp -and (Test-Path -LiteralPath $temp)) { Remove-Item -LiteralPath $temp -Force }
    }
    [PSCustomObject]@{ Backup=$backup; Count=$records.Count; Panels=$Plan.Panels; Scripts=$Plan.Scripts }
}

function Start-AtalhosAEInstall {
    $source = $PSScriptRoot
    $adobe = Join-Path $env:ProgramFiles 'Adobe'
    if ($AfterEffectsPath) { $candidates = @(Get-Item -LiteralPath $AfterEffectsPath) }
    else {
        $candidates = @(Get-ChildItem -LiteralPath $adobe -Directory | Where-Object {
            $_.Name -like 'Adobe After Effects *' -and $_.Name -notmatch '(?i)beta' -and
            (Test-Path -LiteralPath (Join-Path $_.FullName 'Support Files\AfterFX.exe'))
        } | Sort-Object Name -Descending)
    }
    if ($AfterEffectsVersion) {
        $requested = $AfterEffectsVersion
        if ($requested -match '^\d{2}(?:\.\d+)?$') { $year = 2000+[int]($requested.Split('.')[0]) }
        elseif ($requested -match '^20\d\d$') { $year = [int]$requested }
        else { throw 'Use uma versao como 27.0 ou um ano como 2027.' }
        $candidates = @($candidates | Where-Object { $_.Name -match [string]$year })
    }
    if (-not $candidates.Count) { throw 'After Effects nao encontrado. Instale o After primeiro ou use -AfterEffectsPath com a pasta da instalacao.' }
    $application = $candidates[0]
    $yearMatch = [regex]::Match($application.Name,'20\d\d')
    $nativeVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo((Join-Path $application.FullName 'Support Files\AfterFX.exe'))
    $major = $nativeVersion.FileMajorPart
    if ($major -lt 1 -and $yearMatch.Success) { $major = [int]$yearMatch.Value-2000 }
    if ($major -lt 1) { throw 'Nao foi possivel identificar a versao do After Effects.' }
    $version = "$major.0"
    if ($AfterEffectsVersion -match '^\d{2}\.\d+$') { $version = $AfterEffectsVersion }
    elseif (Test-Path -LiteralPath $PreferencesRoot) {
        $userVersion = Get-ChildItem -LiteralPath $PreferencesRoot -Directory | Where-Object { $_.Name -match ('^'+$major+'\.\d+$') } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
        if ($userVersion) { $version = $userVersion.Name }
    }
    $plan = New-AtalhosAEPlan $source $application.FullName $PreferencesRoot $version
    if (Get-Process AfterFX -ErrorAction SilentlyContinue) { throw 'Salve o trabalho e feche o After Effects antes de instalar. O instalador nao fecha o aplicativo sozinho.' }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        $arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"'),'-AfterEffectsPath',('"'+$application.FullName+'"'),'-PreferencesRoot',('"'+$PreferencesRoot+'"'))
        if ($AfterEffectsVersion) { $arguments += @('-AfterEffectsVersion',('"'+$AfterEffectsVersion+'"')) }
        # Visible by design: this is the interactive installer the user opened.
        $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -Wait -PassThru
        exit $process.ExitCode
    }
    $result = Invoke-AtalhosAEPlan $plan (Join-Path $PreferencesRoot 'Atalhos AE Backups')
    Write-Host "Atalhos AE instalado: $($application.Name)." -ForegroundColor Cyan
    Write-Host "Backup: $($result.Backup)"
    Write-Host 'Abra o After > Janela > Atalhos AE. Os projetos e atalhos existentes nao foram alterados.'
    Write-Host 'N (uma vez): Editar > Atalhos do teclado > zz Atalhos AE - NULL > atribuir N e remover o conflito do N original.'
    Write-Host 'Letras dinamicas usam sliders nativos quando o controle agrupado nao esta registrado. O instalador nao altera arquivos internos do After.'
    Write-Host 'Deep Glow 2 e fontes precisam ser instalados separadamente apenas para os botoes que os exigem.'
}

# Dot-sourcing exposes the pure planning/copy helpers to isolated tests only.
if ($MyInvocation.InvocationName -ne '.') { Start-AtalhosAEInstall }
