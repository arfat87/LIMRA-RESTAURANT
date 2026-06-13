$ErrorActionPreference = "Stop"

# Paths
$ProjectRoot = "C:\MY_ALL_ITEM\ALL_PROJECT\biuld with Ai\limra restuarant\E-COMMERSE LIMRA website\LIMRA APP"
$TempDir = "$env:TEMP\gradle_build"
$GradleZip = "$TempDir\gradle-8.7-bin.zip"
$GradleExtractDir = "$TempDir\gradle-8.7"
$GradleBat = "$GradleExtractDir\gradle-8.7\bin\gradle.bat"

# Set Android SDK path
$env:ANDROID_HOME = "C:\Users\salim\AppData\Local\Android\Sdk"
Write-Host "Using Android SDK at: $env:ANDROID_HOME"

# Set Java SDK path from Android Studio bundled JBR
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
Write-Host "Using Java SDK at: $env:JAVA_HOME"

# Check if SDK exists
if (-not (Test-Path $env:ANDROID_HOME)) {
    Write-Error "Android SDK not found at $env:ANDROID_HOME. Please ensure Android SDK is installed."
}

# Create temp directory
if (-not (Test-Path $TempDir)) {
    New-Item -ItemType Directory -Path $TempDir | Out-Null
}

# Download Gradle if not already present
if (-not (Test-Path $GradleZip)) {
    Write-Host "Downloading Gradle 8.7... This may take a moment."
    Invoke-WebRequest -Uri "https://services.gradle.org/distributions/gradle-8.7-bin.zip" -OutFile $GradleZip
    Write-Host "Download complete."
}

# Extract Gradle if not already present
if (-not (Test-Path $GradleBat)) {
    Write-Host "Extracting Gradle..."
    Expand-Archive -Path $GradleZip -DestinationPath $GradleExtractDir -Force
    Write-Host "Extraction complete."
}

# Compile the Android Project
Write-Host "Compiling Android project using Gradle..."
Set-Location -Path $ProjectRoot
& $GradleBat clean assembleDebug

# Locate and copy APK
$ApkSrc = "$ProjectRoot\app\build\outputs\apk\debug\app-debug.apk"
$ApkDest = "$ProjectRoot\LIMRA_RESTAURANT.apk"

if (Test-Path $ApkSrc) {
    Copy-Item -Path $ApkSrc -Destination $ApkDest -Force
    Write-Host "--------------------------------------------------------"
    Write-Host "BUILD SUCCESSFUL!"
    Write-Host "APK location: $ApkDest"
    Write-Host "--------------------------------------------------------"
} else {
    Write-Error "Build finished but APK was not found at $ApkSrc"
}
