# A47L - Fireflies Transcript Sync App

**made with heart by [Atomic 47 Labs Inc](https://atomic47.co)**

Download and manage your Fireflies transcripts from your desktop! A modern web application for downloading and managing your Fireflies.ai meeting transcripts locally.

## 🎯 Overview

This Progressive Web App (PWA) enables Fireflies.ai Business account users to download, organize, and synchronize their complete meeting history to their local computer. The application runs directly in Chrome/Edge browsers and uses the File System Access API to save files to your hard drive.

## ✨ Features

- 📥 **Bulk Downloads**: Download all your meetings with one click
- 📁 **Smart Organization**: Automatic folder structure by year/month/meeting
- 🔄 **Sync Tracking**: Know exactly what's synced and what isn't
- ⚡ **Resume Capability**: Recover from failures and continue downloads
- 🎨 **Modern UI**: Clean, responsive interface built with React and Tailwind CSS
- 💾 **Local Storage**: IndexedDB for state management and metadata
- 🔐 **Secure**: API key encryption using Web Crypto API
- 🌐 **PWA**: Install as desktop app for better experience

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 18.x or higher
- **Supported Browsers**: 
  - Chrome 86+
  - Edge 86+
  - Opera 72+
- **Fireflies Account**: Business tier with API access
- **Fireflies API Key**: Required to connect to your Fireflies account

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to app directory
cd fireflies-downloader/app

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `https://localhost:5173` (HTTPS required for File System Access API).

### Development with HTTPS

Since the File System Access API requires a secure context, the development server must use HTTPS:

```bash
# Generate self-signed certificate (one-time setup)
npm run cert:generate

# Run dev server with HTTPS
npm run dev
```

## 📁 Project Structure

```
src/
├── components/     # React components
├── lib/            # Core libraries
│   ├── api/        # Fireflies API client
│   ├── db/         # Dexie.js database
│   ├── storage/    # File System Access API wrapper
│   └── utils/      # Utility functions
├── hooks/          # React hooks
├── stores/         # Zustand state management
├── types/          # TypeScript type definitions
├── constants/      # App constants and configuration
└── test/           # Test utilities and setup
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

## 🧪 Testing

We use Vitest for unit and integration testing:

```bash
# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## 🏗️ Development Status

### Phase 0: Foundation ✅ COMPLETE
- [x] Project setup with Vite, React, TypeScript
- [x] Tailwind CSS configuration
- [x] Dexie.js database schema
- [x] Browser compatibility detection
- [x] TypeScript type definitions
- [x] Testing infrastructure with Vitest

### Phase 1: Core Foundation (In Progress)
- [ ] Fireflies API client
- [ ] Authentication system
- [ ] Rate limiting
- [ ] Meeting discovery engine
- [ ] Error handling framework

### Phase 2: Download Engine (Upcoming)
- [ ] File System Access API integration
- [ ] Download queue system
- [ ] File generators (JSON, MD, DOCX)
- [ ] Progress tracking
- [ ] Resume/recovery logic

### Phase 3-5: See [phased-plan.md](../phased-plan.md) for details

## 📚 Documentation

- [PRD](../fireflies-downloader-prd.md) - Full Product Requirements Document
- [Phased Plan](../phased-plan.md) - Detailed implementation plan
- [API Documentation](./docs/api.md) - Fireflies API integration guide (coming soon)
- [Architecture](./docs/architecture.md) - System architecture overview (coming soon)

## 🔐 Security

- API keys are encrypted using Web Crypto API before storage
- All API communications use HTTPS
- No sensitive data logged to console
- Content Security Policy (CSP) implemented
- Regular dependency security audits

## 🌐 Browser Requirements

This application requires:
- **File System Access API**: For saving files directly to disk
- **IndexedDB**: For local data storage
- **Web Crypto API**: For API key encryption
- **Fetch API**: For network requests
- **Service Worker**: For PWA functionality (optional)

Only Chromium-based browsers currently support the File System Access API. Firefox and Safari support is planned when these browsers add the required APIs.

## 📝 Configuration

### Environment Variables

Create a `.env` file in the app directory:

```env
VITE_FIREFLIES_API_URL=https://api.fireflies.ai/graphql
VITE_APP_VERSION=1.0.0
```

### API Key Setup

1. Log in to your Fireflies.ai account
2. Navigate to Settings > API Keys
3. Generate a new API key
4. Enter the key in the application settings

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and coding standards.

## 📄 License

[License details to be added]

## 🐛 Known Issues

- File System Access API permissions may be reset when clearing browser data
- Large audio files (>1GB) may take significant time to download
- IndexedDB has browser-specific quota limits

## 🗺️ Roadmap

### v1.1
- Scheduled automatic syncs
- Cloud backup integration (S3, Google Drive)
- Full-text search within transcripts
- Meeting analytics dashboard

### v2.0
- Multi-account management
- Firefox/Safari support (when APIs available)
- Mobile app versions
- Collaborative features

## 📞 Support

For issues and questions:
- Open an issue in the repository
- Check the [FAQ](./docs/FAQ.md)
- Review the [Troubleshooting Guide](./docs/troubleshooting.md)

## 🙏 Acknowledgments

- Fireflies.ai for the meeting transcription service
- Dexie.js for the excellent IndexedDB wrapper
- The Chromium team for the File System Access API

---

**Version**: 1.0.0  
**Status**: Phase 0 Complete - In Active Development  
**Last Updated**: September 30, 2025
