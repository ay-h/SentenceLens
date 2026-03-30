# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

English Reading Helper is a pure Node.js Electron desktop application. It was migrated from a Python FastAPI backend to a Node.js Express.js backend, eliminating Python dependencies.

**Architecture**: Electron main process → Express.js backend (port 8000) → React frontend

## Common Commands

### Development
```bash
npm start              # Run Electron app
npm run dev           # Run in dev mode
```

### Building
```bash
npm run build-frontend    # Build React frontend to renderer/
npm run build             # Build full app (frontend + installer)
npm run build-win         # Build Windows installer
npm run build-mac         # Build macOS DMG
npm run build-linux       # Build Linux AppImage
```

## Architecture

### Main Process (main.js)
- Manages Electron window lifecycle
- Spawns Express.js server as child process
- Handles data directory management and migration
- Server runs on port 8000, health check at `/api/health`
- Server logs to `{data_dir}/logs/server.log`

### Backend (server/)
- **server/app.js**: Express.js REST API, matches Python FastAPI routes exactly
- **server/models/database.js**: SQLite using sql.js (pure JS WASM, no compilation)
- **server/services/ocr.js**: tesseract.js v7 with local eng.traineddata
- **server/services/llm.js**: OpenAI SDK for analysis and translation
- **server/services/sentenceSplit.js**: Sentence splitting logic

### Frontend
- React + Vite + TailwindCSS
- Builds to `renderer/` directory (loaded by Electron)
- Communicates with backend via `http://127.0.0.1:8000/api/*`
- State management via React Context

### Data Storage
- **Data directory**: Configurable via UI, defaults to `{userData}/english-reading-helper/`
- **Database**: SQLite (`{data_dir}/database.db`) using sql.js
- **Uploads**: `{data_dir}/uploads/`
- **Logs**: `{data_dir}/logs/server.log`

## Key Technical Details

### Server Process Management
The Express.js server runs as a child process spawned by main.js. When modifying server code:
1. The server needs to be restarted (app handles this automatically in dev)
2. In production, changes require app rebuild
3. Server logs to console and `server.log` with timezone-aware timestamps

### Database (sql.js)
- Pure JavaScript WASM implementation of SQLite
- Database file is manually saved/loaded (not connection-based)
- Automatic save debounced to 500ms after writes
- Schema matches Python version exactly with proper foreign key cascades

### OCR (tesseract.js v7)
- Uses static `Tesseract.recognize()` API for reliability
- Local `eng.traineddata` bundled to prevent network fetches
- Falls back to temporary worker if persistent worker fails
- Language data directory: project root (2 levels up from server/services/)

### LLM Integration
- OpenAI SDK v4.x with configurable endpoint
- Supports DeepSeek, local LLMs, or any OpenAI-compatible API
- Sentence analysis uses JSON mode for structured output
- Translation uses batch processing with caching

## Build Configuration

### electron-builder
- **asar**: Enabled (but unpacks server, node_modules, eng.traineddata)
- **asarUnpack**: server/**/*, node_modules/**/*, eng.traineddata
- **Windows**: NSIS installer with custom directory selection
- **macOS**: DMG in Education category
- **Linux**: AppImage in Education category

### Frontend Build
- Vite builds to `renderer/` directory
- Loaded via `loadFile()` in main.js
- Must build before electron-builder for production

## API Routes Reference

- `GET /api/health` - Health check
- `POST /api/sessions` - Create session
- `GET /api/sessions` - List sessions
- `GET /api/sessions/:id` - Get session
- `PUT /api/sessions/:id/title` - Update session title
- `DELETE /api/sessions/:id` - Delete session (cascades to records)
- `GET /api/sessions/:id/records` - Get session records
- `GET /api/records/:id` - Get record with analyses
- `GET /api/records/:id/sentences` - Get record sentences
- `PUT /api/records/:id/name` - Update record name
- `DELETE /api/records/:id` - Delete record
- `POST /api/upload` - Upload image + OCR (multipart form)
- `POST /api/text` - Process text input
- `POST /api/analyze` - Analyze sentence (LLM)
- `POST /api/analysis/delete` - Delete analysis by sentence
- `GET /api/analysis/test/:record_id` - Test endpoint
- `POST /api/translate` - Translate text (LLM, batch with cache)
- `GET /api/records/:id/translations` - Get record translations
- `GET /api/llm-config` - Get LLM config
- `POST /api/llm-config` - Save LLM config

## Important Files

- `main.js` - Electron main process, server spawning, IPC handlers
- `preload.js` - IPC context bridge (if exists)
- `package.json` - App config, electron-builder settings
- `server/app.js` - Express routes and middleware
- `server/models/database.js` - SQLite operations
- `server/services/ocr.js` - OCR worker and recognition
- `server/services/llm.js` - LLM API calls
- `server/services/prompt_template.txt` - Sentence analysis prompt
- `eng.traineddata` - Tesseract English language data (must bundle)
