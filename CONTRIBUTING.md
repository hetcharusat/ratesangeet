# Contributing to Spotify Music Tracker

First off, thank you for considering contributing to Spotify Music Tracker! 🎵

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Project Structure](#project-structure)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear descriptive title**
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, Node version, mobile device)

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md).

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear descriptive title**
- **Detailed description** of the proposed feature
- **Use cases** and examples
- **Mockups or wireframes** if applicable

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

### Pull Requests

1. **Fork the repository** and create your branch from `dev`
2. **Make your changes** following our style guidelines
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Submit a pull request** using our template

## 🚀 Development Setup

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Spotify Developer Account
- Expo CLI for mobile development

### Initial Setup

1. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ratesangeet.git
   cd ratesangeet
   ```

2. **Install dependencies**:
   ```bash
   # Server
   cd server
   npm install
   
   # Mobile
   cd ../mobile
   npm install
   ```

3. **Set up environment variables**:
   
   Create `server/.env`:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REDIRECT_URI=your_redirect_uri
   JWT_SECRET=your_jwt_secret
   PORT=5000
   ```

4. **Start development servers**:
   ```bash
   # Server (from root)
   npm run start:server
   
   # Mobile (from root)
   npm run start:mobile
   ```

### Testing

```bash
# Run server tests
cd server
npm test

# Run mobile tests
cd mobile
npm test
```

### Building

```bash
# Build Android APK
cd mobile
eas build --platform android --profile production
```

## 📝 Pull Request Process

1. **Branch naming**: Use descriptive names
   - `feature/add-playlist-support`
   - `fix/album-progress-calculation`
   - `docs/update-api-reference`

2. **Commit messages**: Follow conventional commits
   - `feat: add playlist scrobbling`
   - `fix: resolve MongoDB connection race condition`
   - `docs: update contributing guidelines`
   - `refactor: extract scrobble logic to service`

3. **Before submitting**:
   - ✅ Code follows style guidelines (TypeScript strict mode)
   - ✅ Self-review completed
   - ✅ Comments added for complex logic
   - ✅ Documentation updated
   - ✅ Tests pass locally
   - ✅ No console.log statements (use proper logging)

4. **PR description**: Use the template and include:
   - What changes were made
   - Why these changes were needed
   - Screenshots/videos if UI changes
   - Related issue number(s)

5. **Review process**:
   - At least one maintainer approval required
   - All CI checks must pass
   - Conflicts must be resolved
   - Changes may be requested

## 🎨 Style Guidelines

### TypeScript/JavaScript

- **Strict TypeScript**: Use `strict` mode, avoid `any`
- **Naming conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for components and classes
  - `UPPER_SNAKE_CASE` for constants
- **Formatting**: Use project's ESLint config
- **Imports**: Group by external, internal, relative
- **Comments**: Explain "why", not "what"

### React Native

- **Functional components** with hooks
- **TypeScript interfaces** for props
- **Styled components** or theme system
- **Avoid inline styles** when possible
- **Accessible components** (use accessibility props)

### Backend

- **RESTful API design**
- **Proper error handling** with meaningful messages
- **Async/await** over promises chains
- **Validate inputs** with middleware
- **Mongoose models** with TypeScript types

### Database

- **Indexes** for frequently queried fields
- **Lean queries** for read-only operations
- **Projection** to select only needed fields
- **Aggregation pipelines** for complex queries

### Git

- **No secrets** in commits (use .env)
- **Small, focused commits**
- **Descriptive commit messages**
- **Rebase** to keep history clean (when appropriate)

## 🏗️ Project Structure

```
ratesangeet/
├── mobile/                 # React Native app
│   ├── src/
│   │   ├── screens/       # UI screens
│   │   ├── components/    # Reusable components
│   │   ├── navigation/    # React Navigation
│   │   ├── context/       # React Context providers
│   │   ├── services/      # API client
│   │   ├── storage/       # SQLite local storage
│   │   ├── theme/         # Colors and styling
│   │   └── types/         # TypeScript types
│   └── app.json
│
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── models/        # Mongoose schemas
│   │   ├── middleware/    # Express middleware
│   │   ├── jobs/          # Background jobs
│   │   └── index.ts       # Server entry point
│   └── package.json
│
├── docs/                   # Documentation
│   ├── 01-getting-started/
│   ├── 02-architecture/
│   ├── 03-features/
│   ├── 04-design/
│   ├── 05-authentication/
│   ├── 06-deployment/
│   └── 07-improvements/
│
└── .github/
    ├── workflows/          # CI/CD workflows
    └── ISSUE_TEMPLATE/    # Issue templates
```

## 🔑 Key Architectural Decisions

### Hybrid Storage Model

- **Local (SQLite)**: Full scrobble history, offline-first
- **Cloud (MongoDB)**: Public data, aggregated stats
- See: `docs/02-architecture/HYBRID_STORAGE.md`

### Scrobbling Algorithm

- **40% threshold**: Track considered "scrobbled" at 40% played
- **Deduplication**: 10-second rounded timestamps
- **Skip detection**: Grace margin and pause handling
- See: `docs/02-architecture/SMART_SCROBBLE_ALGORITHM.md`

### MongoDB Connection

- **Singleton pattern**: One connection for entire server
- **Event listeners**: Monitor disconnections
- **Background jobs**: Use shared connection (no separate connect/disconnect)
- See: `docs/07-improvements/STABILITY_IMPROVEMENTS.md`

## 🐛 Common Issues

### Server won't start

- Check MongoDB connection string
- Verify all environment variables set
- Ensure port 5000 is available

### Mobile app won't connect

- Check API URL in `mobile/src/config/index.ts`
- Verify server is running
- Try clearing Expo cache: `expo start -c`

### Build failures

- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node version: Node 18+ required
- Verify EAS configuration: `eas.json`

## 📚 Additional Resources

- [Documentation Index](docs/INDEX.md)
- [Quickstart Guide](docs/01-getting-started/QUICKSTART.md)
- [API Reference](docs/02-architecture/PROJECT_SUMMARY.md)
- [Deployment Guide](docs/06-deployment/RENDER_DEPLOYMENT.md)

## ❓ Questions?

- Open a [GitHub Discussion](https://github.com/hetcharusat/ratesangeet/discussions)
- Check existing [Issues](https://github.com/hetcharusat/ratesangeet/issues)
- Review [Documentation](docs/INDEX.md)

## 🎉 Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort!

---

**Happy Coding!** 🎵✨
