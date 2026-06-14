#!/usr/bin/env python3
"""
Secure pastebin/notepad — auto-save editor, zero dependencies, Python 3 stdlib.
Stores text as .txt files, binds to localhost, served behind nginx.

Deployed at: dki.beanee.eu.org/text/
Server:      /opt/pastebin/server.py
Data:        /var/lib/pastebin/data/
Service:     pastebin.service (systemd)
"""
import html
import json
import secrets
import string
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs
from pathlib import Path

DATA_DIR = Path("/var/lib/pastebin/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
HOST = "127.0.0.1"
PORT = 8765
KEY_CHARS = string.ascii_lowercase + string.digits
MAX_KEY_LEN = 32
MAX_CONTENT_LEN = 2 * 1024 * 1024  # 2 MB

CSS = """
:root{--bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#c9d1d9;--muted:#8b949e;--accent:#58a6ff;--danger:#f85149}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);overflow:hidden;height:100vh}
textarea{display:block;width:100vw;height:100vh;background:var(--bg);color:var(--text);border:none;padding:32px 28px 28px 32px;font-family:'JetBrains Mono','Fira Code',Consolas,monospace;font-size:14px;line-height:1.7;resize:none;outline:none;tab-size:4;position:fixed;top:0;left:0}
textarea::placeholder{color:var(--muted);opacity:0.5}
.badge{position:fixed;bottom:20px;right:20px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 14px;font-size:12px;color:var(--muted);font-family:'JetBrains Mono','Fira Code',Consolas,monospace;cursor:pointer;z-index:10;opacity:0.55;transition:opacity .2s,border-color .2s}
.badge:hover{opacity:1;border-color:var(--accent)}
.badge .key{color:var(--accent)}
.status{position:fixed;bottom:50px;right:20px;font-size:11px;color:var(--muted);z-index:10;opacity:0;transition:opacity .3s;pointer-events:none}
.status.show{opacity:1}
.status.saved{color:#3fb950}
.status.error{color:var(--danger)}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface);border:1px solid var(--danger);color:var(--danger);padding:10px 24px;border-radius:8px;font-size:13px;opacity:0;transition:all .25s;pointer-events:none;z-index:100;max-width:500px}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
"""


def render_page(title, body):
    return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">\n<title>" + html.escape(title) + "</title>\n<style>" + CSS + "</style>\n</head>\n<body>\n" + body + "\n</html>"


def generate_key(length=6):
    return "".join(secrets.choice(KEY_CHARS) for _ in range(length))


def valid_key(key):
    return 0 < len(key) <= MAX_KEY_LEN and all(c in string.ascii_letters + string.digits + "-_" for c in key)


def save_note(key, content):
    (DATA_DIR / f"{key}.txt").write_text(content, encoding="utf-8")


def load_note(key):
    fp = DATA_DIR / f"{key}.txt"
    return fp.read_text(encoding="utf-8") if fp.exists() else ""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    # ── routing ──────────────────────────────────────────
    def do_GET(self):
        try:
            path = self.path.rstrip("/") or "/"
            if path == "/":
                self._serve_index()
            else:
                key = path.lstrip("/")
                if valid_key(key):
                    self._serve_note(key)
                else:
                    self._json_error(404, "Not found")
        except Exception:
            self._json_error(500, "Internal error")

    def do_POST(self):
        try:
            path = self.path.rstrip("/") or "/"
            body = self._read_body()
            content = self._extract_content(body)

            if len(content) > MAX_CONTENT_LEN:
                self._json_error(413, "Content too large")
                return

            if path == "/":
                key = generate_key()
                save_note(key, content)
                self._json(201, {"key": key, "url": "/" + key})
            else:
                key = path.lstrip("/")
                if not valid_key(key):
                    self._json_error(404, "Not found")
                    return
                save_note(key, content)
                self._json(200, {"saved": True})
        except Exception:
            self._json_error(500, "Internal error")

    # ── helpers ──────────────────────────────────────────
    def _read_body(self):
        cl = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(cl).decode("utf-8", errors="replace") if cl else ""

    def _extract_content(self, body):
        ct = self.headers.get("Content-Type", "")
        if "application/x-www-form-urlencoded" in ct:
            return parse_qs(body).get("content", [""])[0]
        if "application/json" in ct:
            try:
                return json.loads(body).get("content", "")
            except json.JSONDecodeError:
                return ""
        return body

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _json_error(self, code, msg):
        self._json(code, {"error": msg})

    def _html(self, code, html_str):
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(html_str.encode())

    # ── pages ───────────────────────────────────────────
    def _serve_index(self):
        """Create a new empty note and redirect."""
        key = generate_key()
        save_note(key, "")
        self.send_response(302)
        self.send_header("Location", "/text/" + key)
        self.end_headers()

    def _serve_note(self, key):
        content = load_note(key)
        safe_content = html.escape(content, quote=False)
        safe_key = html.escape(key)
        body = (
            '<textarea id="editor" placeholder="Start typing…" autofocus>' + safe_content + '</textarea>'
            '<div class="badge" onclick="copyUrl()" title="Click to copy URL">#'
            '<span class="key">' + safe_key + '</span></div>'
            '<div class="status" id="status"></div>'
            '<div class="toast" id="toast"></div>'
            '<script>'
            'var KEY="' + safe_key + '";'
            'var editor=document.getElementById("editor");'
            'var status=document.getElementById("status");'
            'var toast=document.getElementById("toast");'
            'var saveTimer=null,lastSaved=editor.value,saveCount=0;'
            'function showToast(msg){toast.textContent=msg;toast.className="toast show";setTimeout(function(){toast.className="toast"},3500);}'
            'function showStatus(text,cls){status.textContent=text;status.className="status show "+(cls||"");if(text)setTimeout(function(){status.className="status"},2000);}'
            'function doSave(){'
            'var c=editor.value;if(c===lastSaved)return;'
            'saveCount++;var myCount=saveCount;'
            'showStatus("saving…","");'
            'fetch("/text/"+KEY,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"content="+encodeURIComponent(c)})'
            '.then(function(r){if(!r.ok)throw Error(r.status);return r.json();})'
            '.then(function(d){if(myCount!==saveCount)return;lastSaved=c;showStatus("saved","saved");})'
            '.catch(function(e){if(myCount!==saveCount)return;showStatus("save failed","error");showToast("Save failed — "+e.message);});'
            '}'
            'editor.addEventListener("input",function(){clearTimeout(saveTimer);showStatus("","");saveTimer=setTimeout(doSave,600);});'
            'function copyUrl(){'
            'navigator.clipboard.writeText("https://dki.beanee.eu.org/text/"+KEY).then('
            'function(){showStatus("URL copied!","saved");},'
            'function(){showToast("Copy failed");});'
            '}'
            '</script>'
        )
        self._html(200, render_page("dki pastebin — " + key, body))


if __name__ == "__main__":
    print(f"pastebin server → http://{HOST}:{PORT}")
    HTTPServer((HOST, PORT), Handler).serve_forever()
