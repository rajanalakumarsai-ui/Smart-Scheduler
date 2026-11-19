# Smart AI Planner

## Run locally

1. Install Python 3.9 or newer.
2. In PowerShell, open this folder and start the server:

   ```powershell
   python server.py
   ```

3. Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Do not open `index.html` directly; the app uses the server for its API.
4. Create an account. Profiles, study plans, progress, reminders, saved links, and uploaded study materials are stored in SQLite on the server.

The database defaults to `%USERPROFILE%\.smart-ai-planner\planner.sqlite3`. Set `APP_DATA_DIR` to use another data folder, or set `DATABASE_PATH` to choose a specific SQLite file.

## AI search assistant

The standalone assistant uses Ollama to generate answers locally and DuckDuckGo for web search. Install [Ollama for Windows](https://ollama.com/download/windows), open Ollama, then download the default model:

```powershell
ollama pull llama3.2:3b
```

Start the planner server in PowerShell:

```powershell
python server.py
```

Sign in to the planner, then choose **AI search assistant** from the dashboard sidebar, or open [http://127.0.0.1:8000/assistant.html](http://127.0.0.1:8000/assistant.html). The assistant does not need an API key.

If Ollama is not running, start the Ollama app. Search queries are sent to DuckDuckGo; conversation history and answer generation stay with the local Ollama service. Chat history is not saved to the planner database. Set `OLLAMA_MODEL` if you want to use a different model already installed in Ollama.

## Deployment notes

The server listens on `127.0.0.1` by default. `HOST` and `PORT` can be set for a trusted deployment environment. Use HTTPS and set `COOKIE_SECURE=1` when deploying behind a TLS-terminating proxy. This small built-in server is intended for local use or trusted environments, not as a hardened public production service.

Existing browser-only accounts and data are not migrated automatically. Create a new account on the server to begin saving data there.
