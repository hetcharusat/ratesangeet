# 🎯 Spotify Dashboard Redirect URIs - Complete List

## ⚠️ ADD ALL OF THESE TO SPOTIFY DASHBOARD

Go to: https://developer.spotify.com/dashboard
- Select: **Ratesangeet** app
- Client ID: `30d78a30cd9f435eba6edbaa4a427041`
- Click: **Edit Settings**
- Section: **Redirect URIs**

---

## ✅ Copy-Paste These (One Per Line)

### 1. Local Development (Web)
```
http://localhost:8081
```
**Purpose**: Expo web dev server (local testing via localhost)

```
http://127.0.0.1:8081
```
**Purpose**: Expo web dev server (local testing via 127.0.0.1)  
**Why both?**: Users may access via either URL - both must work

---

### 2. Mobile Deep Link
```
ratesangeet://callback
```
**Purpose**: iOS + Android deep linking  
**Why?**: Custom scheme for mobile app redirect

---

### 3. Production (Server)
```
https://ratesangeet.onrender.com/api/auth/callback
```
**Purpose**: Production web + mobile token exchange  
**Why?**: Render server endpoint for OAuth callback

---

## 📝 Summary

**Total URIs**: 4  
**Development**: 2 (localhost + 127.0.0.1)  
**Mobile**: 1 (deep link)  
**Production**: 1 (server)

---

## ✅ Verification Checklist

After adding URIs to Spotify Dashboard:

- [ ] Click **"Save"** button at bottom of modal
- [ ] Verify all 4 URIs appear in the list
- [ ] No typos (case-sensitive, no trailing slashes)
- [ ] Port matches Expo (usually 8081, check console)

---

## 🧪 Test Each Environment

### Test Local Web
```powershell
cd mobile
npm run start
# Access: http://127.0.0.1:8081
# Test login flow
```

### Test Mobile
```powershell
cd mobile
npm run start
# Scan QR code on device
# Test login flow
```

### Test Production
```
# After deploying to Render
# Open mobile app (production build)
# Test login flow
```

---

## 🚨 Common Mistakes

❌ **Using `localhost` instead of `127.0.0.1`**  
→ Spotify will reject: "INVALID_CLIENT"

❌ **Wrong port** (e.g., 8080 instead of 8081)  
→ Redirect URI mismatch error

❌ **Trailing slash** (e.g., `http://127.0.0.1:8081/`)  
→ Exact match required

❌ **Forgetting to click "Save"**  
→ Changes not applied

❌ **HTTP for production** (e.g., `http://ratesangeet.onrender.com`)  
→ Must use HTTPS for production

---

## 📚 Reference

- [Spotify Redirect URI Requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- [Full Production Auth Guide](./PRODUCTION_AUTH_GUIDE.md)
- [Quick Setup Checklist](./CRITICAL_AUTH_SETUP.md)

---

**Last Updated**: November 13, 2025  
**Status**: ✅ Production Ready
