# zip-project.ps1
param(
    [string]$SourcePath = ".",
    [string]$OutputZip  = "project.zip"
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$source  = (Resolve-Path $SourcePath).Path
$zipPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputZip))

# Extensiones a ignorar
$excludedExtensions = @('.spr', '.dat')

# Eliminar zip previo si existe
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')

Get-ChildItem -Path $source -Recurse -File | Where-Object {
    $relativePath = $_.FullName.Substring($source.Length + 1)
    $parts        = $relativePath -split [regex]::Escape([IO.Path]::DirectorySeparatorChar)

    $excluded = $false

    # Excluir el propio archivo ZIP de salida
    if ($_.FullName -eq $zipPath) { $excluded = $true }

    # Excluir: node_modules, carpetas/archivos que comiencen con punto
    foreach ($part in $parts) {
        if ($part -eq "node_modules" -or $part -match '^\.' ) {
            $excluded = $true
            break
        }
    }

    # Excluir archivos "nul"
    if ($_.Name -match '^nul(\..+)?$') { $excluded = $true }

    # Excluir por extensión
    if ($excludedExtensions -contains $_.Extension.ToLower()) { $excluded = $true }

    -not $excluded
} | ForEach-Object {
    $entryName = $_.FullName.Substring($source.Length + 1)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, $_.FullName, $entryName, 'Optimal'
    ) | Out-Null
}

$zip.Dispose()
Write-Host "✅ ZIP creado: $zipPath"