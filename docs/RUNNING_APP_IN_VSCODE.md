# 🚀 Running Flutter App Without Leaving VS Code

> Complete guide to building & running Flutter directly in VS Code

---

## ✅ Option 1: Run on Android Emulator (NO Android Studio Download Needed)

### Step 1: Install Flutter Extension in VS Code
```
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search: "Flutter"
4. Install: "Flutter" by Dart Code
5. Reload VS Code
```

### Step 2: Check Flutter Installation
```
Open Terminal in VS Code (Ctrl+`)
Run: flutter doctor
```

Look for:
- ✅ Flutter SDK
- ✅ Dart SDK
- 🟡 Android toolchain (will show Android SDK path)

### Step 3: Set Up Android Emulator (Easiest Path)

**Option A: Use Android Studio (one-time setup)**
```bash
# Download Android Studio (free)
# https://developer.android.com/studio

# After install:
1. Open Android Studio
2. Tools → Device Manager
3. Create Virtual Device
4. Select: Pixel 4, Android 13+
5. Click "Play" to start emulator
```

**Option B: Command Line Only (No Android Studio)**
```bash
# If Flutter detected Android SDK, run:
flutter emulators

# List available emulators:
flutter emulators --launch <emulator_id>
```

### Step 4: Run App in VS Code Terminal

```bash
# Terminal 1: Start emulator (if not running)
flutter emulators --launch pixel_4_api_33

# Wait ~30 seconds for emulator to boot...

# Terminal 2: Run app
cd ratesangeet
flutter run -d emulator-5554
```

**That's it!** App opens in emulator, you stay in VS Code.

---

## ✅ Option 2: Run on Physical Android Phone (BEST - No Emulator)

### Step 1: Enable Developer Mode on Phone

```
On your Android phone:
1. Settings → About phone
2. Tap "Build number" 7 times
3. Go back to Settings → Developer Options
4. Turn ON: "USB Debugging"
5. Plug phone into computer via USB
6. Allow USB debugging when prompted
```

### Step 2: Verify Connection

```bash
# In VS Code terminal:
flutter devices

# Should show:
# emulator-5554  • Android Emulator   • android-x86    • Android 13.0
# YOUR-PHONE     • Android Device     • android-arm64  • Android 13.0
```

### Step 3: Run on Physical Phone

```bash
# Run on connected phone (VS Code terminal)
flutter run -d YOUR-PHONE-ID

# Or just run (if only one device):
flutter run
```

**✨ App runs on your phone, code stays in VS Code!**

---

## ✅ Option 3: Run on iPhone (Mac Only)

```bash
# Terminal in VS Code:
flutter run -d ios

# Or launch on specific iPhone:
flutter devices  # See available devices
flutter run -d "iPhone 14"
```

---

## 🔧 Running Inside VS Code (Hot Reload)

### Terminal 1: Run App
```bash
cd ratesangeet
flutter run
```

### Terminal 2: Make Code Changes
```bash
# While app is running, edit any file
# Then in Terminal 1, type:
r          # Hot reload (fast, keeps state)
R          # Full restart (rebuilds, clears state)
q          # Quit
```

---

## 📱 VS Code Integration Features

### 1. Flutter Test Tree (Left Sidebar)
```
Click: Testing tab in VS Code left sidebar
├─ Run all tests
├─ Run single test
└─ Debug test
```

### 2. Debug Mode
```
1. Set breakpoint (click line number)
2. Run app in debug mode:
   flutter run -d <device>
3. Use Debug Console (bottom panel)
4. Step through code (F10, F11, etc.)
```

### 3. Flutter DevTools (Inside VS Code)
```
While app running in terminal:
1. Terminal → Run Task → Flutter: Open DevTools
2. Opens browser with DevTools (performance, layout, logs)
```

### 4. Device Switching
```bash
# List all connected devices
flutter devices

# Switch to different device
flutter run -d <device_id>
```

---

## 🚫 What You DON'T Need

| Tool | Needed? | Why |
|------|---------|-----|
| Android Studio IDE | ❌ No | Flutter CLI handles everything |
| Xcode IDE (Mac) | ❌ No | Flutter CLI handles build |
| Android Emulator GUI | ❌ No | `flutter emulators` controls it |
| iOS Simulator GUI | ❌ No | `flutter run` handles it |

---

## ⚡ Quick Start Commands (Copy-Paste)

### First Time Setup
```bash
# 1. Install Flutter (follow official guide)
# https://flutter.dev/docs/get-started/install

# 2. Check installation
flutter doctor

# 3. Create project
flutter create ratesangeet
cd ratesangeet

# 4. Get dependencies
flutter pub get
```

### Running the App

#### On Physical Phone (EASIEST)
```bash
# Plug in phone, enable USB debug
flutter devices           # Verify connection
flutter run               # Run on phone
```

#### On Android Emulator
```bash
flutter emulators                      # List emulators
flutter emulators --launch pixel_4     # Start emulator
flutter run -d emulator-5554           # Run app
```

#### On iOS Simulator (Mac)
```bash
flutter run -d ios
```

---

## 🎯 Recommended Setup (Minimal Clicks)

### Installation (One Time)
```bash
# 1. Download Flutter SDK
# https://flutter.dev/docs/get-started/install

# 2. Add to PATH
# https://flutter.dev/docs/get-started/install/windows (or your OS)

# 3. In VS Code, install Flutter extension
# (search "Flutter" in Extensions tab)

# 4. Verify:
flutter doctor
```

### Every Development Session
```bash
# Terminal in VS Code:
flutter run

# Make changes, press 'r' to hot reload
# Done! Never leave VS Code.
```

---

## 🔍 Troubleshooting (Common Issues)

### "No devices found"
```bash
# Check connected devices
flutter devices

# If empty:
# - Phone: Enable USB debug, plug in, authorize prompt
# - Emulator: flutter emulators --launch <name>
```

### "Android SDK not found"
```bash
# Flutter can auto-download it:
flutter run

# Or manually:
flutter config --android-sdk-path C:\path\to\android\sdk
```

### "flutter command not found"
```bash
# Add Flutter to PATH:
# Windows: https://flutter.dev/docs/get-started/install/windows
# Mac: export PATH="$PATH:~/flutter/bin"
# Linux: export PATH="$PATH:~/flutter/bin"

# Verify:
flutter --version
```

### "Device offline"
```bash
# USB connection issue
flutter devices
# If phone shows "offline":
# 1. Disconnect USB
# 2. Disconnect phone from computer
# 3. Reconnect phone
# 4. Authorize USB debug again
```

---

## 📊 Development Workflow (Inside VS Code)

```
┌──────────────────────────────┐
│  VS Code Terminal            │
│  $ flutter run -d phone      │
│  ✅ App running on phone     │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│  Edit code in VS Code        │
│  (editor on left)            │
│  (terminal on bottom)        │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│  In terminal, press 'r'      │
│  App reloads instantly       │
│  Changes appear on phone     │
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│  Repeat! Never leave VS Code │
└──────────────────────────────┘
```

---

## ✨ Best Experience

### Setup (First Time)
1. Install Flutter SDK (~2 GB)
2. Install VS Code Flutter extension
3. Connect physical phone OR set up emulator

### Development (Every Session)
```bash
# Terminal in VS Code
flutter run

# Edit code on left, see changes on right
# Press 'r' after each edit
# Press 'q' to quit
```

**That's it. You never need Android Studio or any IDE.**

---

## 🎯 Cheat Sheet

| Task | Command |
|------|---------|
| Start app | `flutter run` |
| Hot reload | Press `r` in terminal |
| Full restart | Press `R` in terminal |
| Stop app | Press `q` in terminal |
| List devices | `flutter devices` |
| Create project | `flutter create myapp` |
| Add dependency | `flutter pub add package_name` |
| Format code | `dart format .` |
| Analyze code | `flutter analyze` |
| Run tests | `flutter test` |

---

## 🚀 Ready to Go!

You now have **everything you need to develop Flutter apps inside VS Code** without Android Studio or complex IDEs.

**Next Step**: Follow `docs/FLUTTER_SETUP.md` to initialize your project.

Happy coding! 🎉
