import base64
import binascii
import contextlib
import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import sqlite3
import time
import uuid
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

import assistant_backend


ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("APP_DATA_DIR", Path.home() / ".smart-ai-planner"))
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", DATA_DIR / "planner.sqlite3"))
MAX_BODY_BYTES = 32_000
MAX_WORKSPACE_BYTES = 256_000
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
SESSION_SECONDS = 60 * 60 * 24 * 7
PASSWORD_ITERATIONS = 310_000
SESSION_COOKIE = "planner_session"
ALLOWED_UPLOAD_EXTENSIONS = {
    "pdf", "doc", "docx", "ppt", "pptx", "txt", "md", "jpg", "jpeg", "png"
}


def connect_database():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextlib.contextmanager
def database():
    connection = connect_database()
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_database():
    with database() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS workspaces (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                data TEXT NOT NULL DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS materials (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                size INTEGER NOT NULL,
                mime_type TEXT NOT NULL,
                subject_name TEXT NOT NULL,
                uploaded_at TEXT NOT NULL,
                data BLOB NOT NULL
            );
            """
        )


def is_secure_resource_url(value):
    try:
        parsed = urlsplit(value)
        return (
            parsed.scheme == "https"
            and bool(parsed.hostname)
            and parsed.username is None
            and parsed.password is None
        )
    except ValueError:
        return False


class PlannerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _send_json(self, status_code, payload, headers=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if headers:
            for name, value in headers.items():
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, status_code, body, content_type, headers=None):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if headers:
            for name, value in headers.items():
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self, limit=MAX_BODY_BYTES):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Invalid request size."})
            return None
        if content_length <= 0 or content_length > limit:
            self._send_json(413, {"error": "The request is empty or too large."})
            return None
        try:
            data = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request must contain valid JSON."})
            return None
        if not isinstance(data, dict):
            self._send_json(400, {"error": "Request must be a JSON object."})
            return None
        return data

    def _session_user(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except (ValueError, TypeError):
            return None
        morsel = cookie.get(SESSION_COOKIE)
        if morsel is None:
            return None
        token_hash = hashlib.sha256(morsel.value.encode("utf-8")).hexdigest()
        now = int(time.time())
        with database() as connection:
            row = connection.execute(
                """SELECT users.id, users.email
                   FROM sessions JOIN users ON users.id = sessions.user_id
                   WHERE sessions.token_hash = ? AND sessions.expires_at > ?""",
                (token_hash, now),
            ).fetchone()
            connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
        return row

    def _require_user(self):
        user = self._session_user()
        if user is None:
            self._send_json(401, {"error": "Please sign in to continue."})
        return user

    def _create_session(self, user_id):
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        expires_at = int(time.time()) + SESSION_SECONDS
        with database() as connection:
            connection.execute(
                "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                (token_hash, user_id, expires_at),
            )
        secure = " Secure;" if os.environ.get("COOKIE_SECURE") == "1" else ""
        return f"{SESSION_COOKIE}={token}; HttpOnly; SameSite=Strict;{secure} Path=/; Max-Age={SESSION_SECONDS}"

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/assistant/status":
            if self._require_user() is None:
                return
            try:
                status = assistant_backend.get_status()
            except assistant_backend.AssistantError as error:
                self._send_json(error.status_code, {"error": str(error)})
                return
            self._send_json(200, status)
            return
        if path == "/api/auth/session":
            user = self._session_user()
            self._send_json(200, {
                "authenticated": user is not None,
                "email": user["email"] if user is not None else None
            })
            return
        if path == "/api/workspace":
            user = self._require_user()
            if user is None:
                return
            with database() as connection:
                row = connection.execute(
                    "SELECT data FROM workspaces WHERE user_id = ?", (user["id"],)
                ).fetchone()
                materials = connection.execute(
                    """SELECT id, name, size, mime_type AS type, subject_name AS subjectName,
                              uploaded_at AS uploadedAt
                       FROM materials WHERE user_id = ? ORDER BY uploaded_at DESC""",
                    (user["id"],),
                ).fetchall()
            data = json.loads(row["data"]) if row else {}
            data["email"] = user["email"]
            data["materials"] = [dict(item) for item in materials]
            self._send_json(200, data)
            return
        if path.startswith("/api/materials/"):
            user = self._require_user()
            if user is None:
                return
            material_id = unquote(path[len("/api/materials/"):])
            with database() as connection:
                row = connection.execute(
                    """SELECT name, mime_type, data FROM materials
                       WHERE id = ? AND user_id = ?""",
                    (material_id, user["id"]),
                ).fetchone()
            if row is None:
                self._send_json(404, {"error": "Study material not found."})
                return
            safe_name = row["name"].replace('"', "")
            self._send_bytes(200, row["data"], row["mime_type"], {
                "Content-Disposition": f'inline; filename="{safe_name}"'
            })
            return
        super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path in {"/api/auth/register", "/api/auth/login"}:
            self._handle_auth(path)
            return
        if path == "/api/auth/logout":
            cookie = SimpleCookie()
            cookie.load(self.headers.get("Cookie", ""))
            morsel = cookie.get(SESSION_COOKIE)
            if morsel:
                token_hash = hashlib.sha256(morsel.value.encode("utf-8")).hexdigest()
                with database() as connection:
                    connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
            self._send_json(200, {"ok": True}, {
                "Set-Cookie": (
                    f"{SESSION_COOKIE}=; HttpOnly; SameSite=Strict;"
                    f"{' Secure;' if os.environ.get('COOKIE_SECURE') == '1' else ''} Path=/; Max-Age=0"
                )
            })
            return
        if path == "/api/materials":
            self._handle_material_upload()
            return
        if path == "/api/assistant/chat":
            self._handle_assistant_chat()
            return
        self._send_json(404, {"error": "Endpoint not found."})

    def do_PUT(self):
        if urlsplit(self.path).path != "/api/workspace":
            self._send_json(404, {"error": "Endpoint not found."})
            return
        user = self._require_user()
        if user is None:
            return
        data = self._read_json(MAX_WORKSPACE_BYTES)
        if data is None:
            return
        allowed = {"profile", "study", "completedTasks", "studySessions", "reminders", "resources"}
        if set(data) - allowed:
            self._send_json(400, {"error": "Workspace contains unsupported fields."})
            return
        profile = data.get("profile", {})
        study = data.get("study", {})
        if (
            not isinstance(profile, dict)
            or not isinstance(study, dict)
            or not isinstance(data.get("completedTasks", {}), dict)
            or not isinstance(data.get("studySessions", {}), dict)
            or not isinstance(data.get("reminders", []), list)
            or not isinstance(data.get("resources", []), list)
        ):
            self._send_json(400, {"error": "Workspace data has an invalid format."})
            return
        for resource in data.get("resources", []):
            if (
                not isinstance(resource, dict)
                or not isinstance(resource.get("url"), str)
                or not is_secure_resource_url(resource["url"])
            ):
                self._send_json(400, {"error": "Study links must use HTTPS."})
                return
        with database() as connection:
            connection.execute(
                """INSERT INTO workspaces (user_id, data) VALUES (?, ?)
                   ON CONFLICT(user_id) DO UPDATE SET data = excluded.data""",
                (user["id"], json.dumps(data, ensure_ascii=False)),
            )
        self._send_json(200, {"ok": True})

    def do_DELETE(self):
        path = urlsplit(self.path).path
        if not path.startswith("/api/materials/"):
            self._send_json(404, {"error": "Endpoint not found."})
            return
        user = self._require_user()
        if user is None:
            return
        material_id = unquote(path[len("/api/materials/"):])
        with database() as connection:
            cursor = connection.execute(
                "DELETE FROM materials WHERE id = ? AND user_id = ?",
                (material_id, user["id"]),
            )
        if cursor.rowcount == 0:
            self._send_json(404, {"error": "Study material not found."})
            return
        self._send_json(200, {"ok": True})

    def _handle_auth(self, path):
        data = self._read_json()
        if data is None:
            return
        email = data.get("email")
        password = data.get("password")
        if (
            not isinstance(email, str)
            or len(email.strip()) > 254
            or "@" not in email
            or not isinstance(password, str)
            or len(password) < 8
            or len(password) > 1024
        ):
            self._send_json(400, {"error": "Enter a valid email and a password of at least 8 characters."})
            return
        email = email.strip().lower()
        with database() as connection:
            user = connection.execute(
                "SELECT id, email, password_salt, password_hash FROM users WHERE email = ?",
                (email,),
            ).fetchone()
            if path.endswith("/register"):
                if user:
                    self._send_json(409, {"error": "An account with that email already exists."})
                    return
                salt = secrets.token_bytes(16)
                password_hash = hashlib.pbkdf2_hmac(
                    "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
                )
                cursor = connection.execute(
                    """INSERT INTO users (email, password_salt, password_hash, created_at)
                       VALUES (?, ?, ?, ?)""",
                    (email, salt, password_hash, int(time.time())),
                )
                user_id = cursor.lastrowid
                connection.execute(
                    "INSERT INTO workspaces (user_id, data) VALUES (?, '{}')", (user_id,)
                )
            else:
                if not user:
                    self._send_json(401, {"error": "Email or password is incorrect."})
                    return
                candidate = hashlib.pbkdf2_hmac(
                    "sha256", password.encode("utf-8"),
                    user["password_salt"], PASSWORD_ITERATIONS
                )
                if not hmac.compare_digest(candidate, user["password_hash"]):
                    self._send_json(401, {"error": "Email or password is incorrect."})
                    return
                user_id = user["id"]
        self._send_json(200, {"email": email}, {
            "Set-Cookie": self._create_session(user_id)
        })

    def _handle_assistant_chat(self):
        if self._require_user() is None:
            return
        data = self._read_json()
        if data is None:
            return
        message = data.get("message")
        if not isinstance(message, str) or not message.strip() or len(message) > assistant_backend.MAX_MESSAGE_CHARS:
            self._send_json(400, {
                "error": f"Enter a question of 1 to {assistant_backend.MAX_MESSAGE_CHARS} characters."
            })
            return
        history = data.get("history", [])
        if not isinstance(history, list) or len(history) > assistant_backend.MAX_HISTORY_MESSAGES:
            self._send_json(400, {"error": "Conversation history is invalid or too long. Start a new conversation."})
            return
        for item in history:
            if (
                not isinstance(item, dict)
                or not isinstance(item.get("role"), str)
                or item.get("role") not in {"user", "model"}
                or not isinstance(item.get("text"), str)
                or not item["text"].strip()
                or len(item["text"]) > assistant_backend.MAX_MESSAGE_CHARS
            ):
                self._send_json(400, {"error": "Conversation history contains an invalid message."})
                return
        try:
            result = assistant_backend.generate_reply(message.strip(), history)
        except assistant_backend.AssistantError as error:
            self._send_json(error.status_code, {"error": str(error)})
            return
        self._send_json(200, result)

    def _handle_material_upload(self):
        user = self._require_user()
        if user is None:
            return
        data = self._read_json(MAX_UPLOAD_BYTES * 2)
        if data is None:
            return
        name = data.get("name")
        encoded = data.get("data")
        subject_name = data.get("subjectName", "")
        if (
            not isinstance(name, str)
            or not name.strip()
            or len(name) > 255
            or not isinstance(encoded, str)
            or not isinstance(subject_name, str)
            or len(subject_name) > 60
        ):
            self._send_json(400, {"error": "Study material details are invalid."})
            return
        safe_name = name.replace("\\", "/").split("/")[-1].strip()
        safe_name = "".join(character for character in safe_name if ord(character) >= 32 and ord(character) != 127)
        if not safe_name:
            self._send_json(400, {"error": "Study material name is invalid."})
            return
        extension = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
        if extension not in ALLOWED_UPLOAD_EXTENSIONS:
            self._send_json(400, {"error": "This study material file type is not supported."})
            return
        try:
            file_bytes = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error):
            self._send_json(400, {"error": "Study material data is invalid."})
            return
        if not file_bytes or len(file_bytes) > MAX_UPLOAD_BYTES:
            self._send_json(413, {"error": "Study materials must be between 1 byte and 5 MB."})
            return
        material_id = uuid.uuid4().hex
        uploaded_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        mime_type = mimetypes.guess_type(safe_name)[0] or "application/octet-stream"
        with database() as connection:
            connection.execute(
                """INSERT INTO materials
                   (id, user_id, name, size, mime_type, subject_name, uploaded_at, data)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    material_id, user["id"], safe_name, len(file_bytes),
                    mime_type, subject_name.strip(), uploaded_at, file_bytes
                ),
            )
        self._send_json(201, {
            "id": material_id, "name": safe_name, "size": len(file_bytes),
            "type": mime_type, "subjectName": subject_name.strip(),
            "uploadedAt": uploaded_at
        })

if __name__ == "__main__":
    initialize_database()
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "127.0.0.1")
    server = ThreadingHTTPServer((host, port), PlannerHandler)
    server.daemon_threads = True
    print(f"Smart AI Planner running at http://{host}:{port}")
    print(f"SQLite database: {DATABASE_PATH}")
    server.serve_forever()
