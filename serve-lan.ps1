# Serve the Leather Inventory app on your home network only (Windows)
#
# Run this from the app folder on your home computer (e.g. the Aurora):
#   Right-click serve-lan.ps1 -> "Run with PowerShell"
#   (If it complains about listening, right-click -> "Run as administrator" once.)
#
# It serves the app on your LAN IP, port 8000 — reachable from any device on
# the same Wi-Fi (your phone at the bench), and NOT from the internet: nothing
# is port-forwarded, and the listener binds to your LAN address only.
#
# Open on your phone: http://<LAN-IP>:8000  (the script prints the exact URL)
# Add to Home Screen from there so it opens like an app.
# Stop it with Ctrl+C. Start it again any time you want the app available.
#
# Notes:
# - Windows Firewall may ask the first time: allow it on Private networks only.
# - Your LAN IP can change when the router reboots; re-run the script and it
#   prints the current address.
# - The app's lock screen works over plain http:// on your LAN (it has a
#   built-in hashing fallback), so no HTTPS setup is needed at home.

$ErrorActionPreference = "Stop"

$port = 8000

# Listening on your LAN address needs administrator rights. If we're not
# elevated, re-launch ourselves as admin so the window doesn't just vanish.
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting administrator rights (needed to listen on your network)..."
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

# Find this machine's LAN IPv4 address (skip loopback / virtual adapters best we can)
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } |
    Select-Object -First 1 -ExpandProperty IPAddress)

if (-not $lanIp) {
    Write-Host "Could not find a LAN IP address. Are you connected to Wi-Fi / Ethernet?"
    Read-Host "Press Enter to close"
    exit 1
}

$prefix = "http://$lanIp`:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "Could not start listening on $prefix"
    Write-Host "Right-click serve-lan.ps1 and choose 'Run as administrator', then try again."
    Read-Host "Press Enter to close"
    exit 1
}

$mime = @{
    ".html" = "text/html"
    ".js"   = "text/javascript"
    ".css"  = "text/css"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

Write-Host ""
Write-Host "Leather Inventory is live on your home network:"
Write-Host "  http://$lanIp`:$port/"
Write-Host ""
Write-Host "Only devices on your Wi-Fi can reach it. Press Ctrl+C to stop."
Write-Host ""

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request  = $context.Request
    $response = $context.Response

    $path = $request.Url.LocalPath.TrimStart("/")
    if ([string]::IsNullOrEmpty($path)) { $path = "index.html" }

    # Files live next to this script, whatever folder PowerShell started in
    # (an elevated window starts in C:\Windows\System32, not here).
    $root = $PSScriptRoot
    $fullPath = Join-Path $root $path
    if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $response.StatusCode = 403
        $response.Close()
        continue
    }

    if (Test-Path $fullPath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
        $response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        $response.ContentLength64 = $msg.Length
        $response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $response.Close()
}
