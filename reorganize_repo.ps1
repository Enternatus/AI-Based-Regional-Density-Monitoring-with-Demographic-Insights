# Run this from your repo root in PowerShell:
# C:\Users\santa\OneDrive\Documents\AI DENSITY CROWD MONITORING>
#
# It only moves files with NO cross-imports (safe to relocate).
# gender_monitor.py, unsettled_fallback.py, search_person.py,
# find_person.py, crowd_monitor.py, test_gender_monitor.py stay in
# root -- they import each other by same-directory module lookup
# and would break if split into subfolders.

# 1. Debug/one-off scripts -> debug/
New-Item -ItemType Directory -Force -Path debug | Out-Null
$debugFiles = @(
    "debug_crops.py",
    "debug_crops_closerange.py",
    "extract_recording_frames.py",
    "gender_test_on_crop.py",
    "test_attributes.py",
    "test_closerange_gender.py",
    "test_deepface_closerange.py",
    "test_detect.py",
    "test_detect_closerange.py",
    "test_gender.py",
    "test_photo.py",
    "inspect_attributes.py"
)
foreach ($f in $debugFiles) {
    if (Test-Path $f) {
        git mv $f "debug/$f"
        Write-Host "moved $f -> debug/$f"
    } else {
        Write-Host "skip (not present): $f"
    }
}

# 2. Drop regenerable/leftover binaries from tracking (still on disk,
#    just untracked going forward)
$dropFromGit = @("yolov8n.pt", "current_person.jpg", "test_frame.jpg", "test_photo.jpg")
foreach ($f in $dropFromGit) {
    if (Test-Path $f) {
        git rm --cached $f
        Write-Host "untracked: $f"
    }
}

# 3. docs/
New-Item -ItemType Directory -Force -Path docs | Out-Null
Write-Host "Now copy technical_overview.md into docs/ manually, then: git add docs/technical_overview.md"

# 4. .gitignore
@"
__pycache__/
*.pyc
.venv/
venv/

# Auto-downloaded / regenerable
yolov8n.pt

# Debug/scratch output
debug_crops/
debug_crops_closerange/
person_crops/
backups/
test_frame.jpg
test_photo.jpg
current_person.jpg

# Raw frame dumps (large, regenerable via frames_to_video*.py)
mall_dataset/
P1E_S1_C1/
recording_frames/
"@ | Out-File -Encoding utf8 .gitignore

# 5. requirements.txt (best-effort from observed imports -- check
#    versions against what's actually installed with: pip freeze)
@"
ultralytics
opencv-python
numpy
torch
deepface
onnxruntime
uniface
pytest
"@ | Out-File -Encoding utf8 requirements.txt

git add -A
Write-Host ""
Write-Host "=== Staged. Review with: git status / git diff --cached ==="
Write-Host "Still needed before committing:"
Write-Host "  1. Copy fairface_model/ folder into repo root (currently MISSING -- gender_monitor.py cannot run without it)"
Write-Host "  2. Copy attribute_recognition/ folder in if you want the clothing-detection groundwork included"
Write-Host "  3. Overwrite gender_monitor.py, search_person.py with the updated versions from this chat"
Write-Host "  4. Add unsettled_fallback.py, find_person.py, technical_overview.md (into docs/) if not already present"
Write-Host "  5. git commit -m 'Reorganize repo, add missing model deps, .gitignore, requirements.txt'"
Write-Host "  6. git push"
