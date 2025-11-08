# Beta Testing & Development Workflow

## 📋 Branch Structure

```
master (main)  →  Production-ready (future public release)
    ↑
   beta        →  Beta testing (internal testers, every 2-3 days)
    ↑
   dev         →  Daily development (your active work)
```

## 🔄 Daily Workflow

### Working on Features (Use `dev` branch)
```powershell
# 1. Make sure you're on dev
git checkout dev

# 2. Work on your features, fix bugs, etc.
# (make changes to code)

# 3. Commit frequently
git add .
git commit -m "feat: add new feature X"
git commit -m "fix: resolve issue Y"
```

### Pushing to Beta (Every 2-3 Days)
```powershell
# 1. Make sure dev is committed
git checkout dev
git add .
git commit -m "Latest changes for beta release"

# 2. Merge into beta
git checkout beta
git merge dev

# 3. Tag the beta release
git tag -a beta-v0.1.0 -m "Beta release v0.1.0"

# 4. Build and distribute
# (Run build commands - see below)

# 5. Go back to dev for more work
git checkout dev
```

## 📱 Building Beta Versions

### Android Beta (APK)
```powershell
cd mobile
eas build --profile preview --platform android
# or for local build:
npx expo run:android --variant release
```

### iOS Beta (TestFlight)
```powershell
cd mobile
eas build --profile preview --platform ios
# Submit to TestFlight:
eas submit --platform ios
```

## 🚀 Distribution Options

### Option 1: **Expo EAS (Recommended - Easiest)**
- ✅ Automatic builds in cloud
- ✅ OTA updates for quick fixes
- ✅ Easy distribution via link
- Cost: Free tier available

```powershell
# Setup (one time)
npm install -g eas-cli
eas login
eas build:configure

# Build for beta testers
eas build --profile preview --platform all
```

### Option 2: **Google Play Internal Testing**
- ✅ Up to 100 internal testers
- ✅ Quick approval (minutes)
- Distribute via Google Play Console

### Option 3: **TestFlight (iOS)**
- ✅ Up to 10,000 external testers
- ✅ Apple's official beta platform
- Requires Apple Developer account ($99/year)

### Option 4: **Firebase App Distribution**
- ✅ Free
- ✅ Works for Android & iOS
- ✅ Email-based distribution

## 🔖 Version Numbering

Use semantic versioning for beta:
```
beta-v0.1.0  → First beta
beta-v0.1.1  → Bug fixes
beta-v0.2.0  → New features
beta-v1.0.0  → Ready for production
```

## 📝 Commit Message Convention

```
feat: add user profile screen
fix: resolve login crash
chore: update dependencies
refactor: improve API performance
docs: update README
style: fix eslint warnings
test: add unit tests for auth
```

## 🎯 Example Timeline

**Day 1-2 (dev):**
- Work on features
- Fix bugs
- Test locally
- Commit frequently

**Day 3 (beta):**
- Merge `dev` → `beta`
- Build APK/IPA
- Distribute to testers
- Create release notes

**Day 4-5 (dev):**
- Continue new features
- Fix beta tester feedback
- Prepare for next beta

## 🐛 Hotfix Workflow

If beta testers find critical bugs:
```powershell
# Fix directly on beta
git checkout beta
# (make fix)
git add .
git commit -m "hotfix: critical auth bug"

# Merge back to dev
git checkout dev
git merge beta
```

## 📊 Current Status

- ✅ Git initialized
- ✅ Branches created: `master`, `beta`, `dev`
- ✅ Currently on: `dev` (ready for development)
- ⏳ Next step: Set up build system (EAS/Firebase)

## 🎮 Quick Commands Reference

```powershell
# Switch branches
git checkout dev      # Daily work
git checkout beta     # Beta releases
git checkout master   # Production (future)

# Save your work
git add .
git commit -m "Your message"

# See status
git status
git log --oneline -5

# Push to beta
git checkout beta
git merge dev
git tag -a beta-v0.X.X -m "Release notes"
```

## 🔗 Push to GitHub (Optional but Recommended)

```powershell
# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/spotiireate.git
git push -u origin --all
git push --tags
```

This enables:
- ✅ Backup
- ✅ Team collaboration
- ✅ GitHub Actions (auto builds)
- ✅ Issue tracking
