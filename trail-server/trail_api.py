"""Stateless verification for the three-game trail.

The signing key and ending are loaded from a private service credential.
The public site receives a clue only after the server replays a valid round.
"""
from base64 import urlsafe_b64decode, urlsafe_b64encode
from binascii import Error as Base64Error
from functools import lru_cache
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import os
from pathlib import Path
import re
import secrets
from time import time
import unicodedata

GAMES = ("hanoi", "tictactoe", "2048")
LINES = ((0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7),
         (2, 5, 8), (0, 4, 8), (2, 4, 6))
ROUND_SECONDS = 2 * 60 * 60
STAMP_SECONDS = 60 * 24 * 60 * 60
MAX_BODY = 16384


def hanoi_start(seed):
    pegs = [[], [], []]
    for disk in range(4, 0, -1):
        peg = (seed % 2) if disk == 4 else (seed // (3 ** disk)) % 3
        pegs[peg].append(disk)
    return pegs


def verify_hanoi(seed, actions):
    pegs = hanoi_start(seed)
    for index, action in enumerate(actions):
        if (not isinstance(action, list) or len(action) != 2
                or any(type(peg) is not int or not 0 <= peg < 3 for peg in action)):
            return False
        start, end = action
        if start == end or not pegs[start] or pegs[end] and pegs[end][-1] < pegs[start][-1]:
            return False
        pegs[end].append(pegs[start].pop())
        if len(pegs[2]) == 4:
            return index == len(actions) - 1
    return False


def ttt_result(board):
    for a, b, c in LINES:
        if board[a] and board[a] == board[b] == board[c]:
            return board[a]
    return "draw" if all(board) else None


def placed(board, index, player):
    return board[:index] + (player,) + board[index + 1:]


@lru_cache(maxsize=24000)
def ttt_score(board, player, depth):
    result = ttt_result(board)
    if result:
        return 10 - depth if result == "X" else depth - 10 if result == "O" else 0
    other = "O" if player == "X" else "X"
    scores = (ttt_score(placed(board, i, player), other, depth + 1)
              for i, mark in enumerate(board) if not mark)
    return max(scores) if player == "X" else min(scores)


def verify_ttt(seed, actions):
    board = ("",) * 9
    for turn, index in enumerate(actions):
        if type(index) is not int or not 0 <= index < 9 or board[index]:
            return False
        board = placed(board, index, "X")
        result = ttt_result(board)
        if result:
            return result in ("X", "draw") and turn == len(actions) - 1
        candidates = [(ttt_score(placed(board, i, "O"), "X", 1), i)
                      for i, mark in enumerate(board) if not mark]
        best = min(score for score, _ in candidates)
        ties = [i for score, i in candidates if score == best]
        # The original game's minimax scoring is preserved. Only its tie-break is seeded.
        pick = ties[(seed + (turn * 2 + 1) * 7) % len(ties)]
        board = placed(board, pick, "O")
        if ttt_result(board):
            return False
    return False


class Tiles:
    def __init__(self, seed):
        self.grid = [0] * 16
        self.seed = seed
        self.spawn()
        self.spawn()

    def random(self):
        self.seed = (self.seed * 1664525 + 1013904223) & 0xffffffff
        return self.seed / (1 << 32)

    def spawn(self):
        empty = [i for i, value in enumerate(self.grid) if not value]
        if empty:
            index = empty[int(self.random() * len(empty))]
            self.grid[index] = 2 if self.random() < .9 else 4

    def move(self, direction):
        new = [0] * 16
        for line in range(4):
            cells = [step * 4 + line if direction in (0, 2) else line * 4 + step
                     for step in range(4)]
            if direction in (1, 2):
                cells.reverse()
            remaining = [self.grid[i] for i in cells if self.grid[i]]
            output = []
            step = 0
            while step < len(remaining):
                if step + 1 < len(remaining) and remaining[step] == remaining[step + 1]:
                    output.append(remaining[step] * 2)
                    step += 2
                else:
                    output.append(remaining[step])
                    step += 1
            for index, value in zip(cells, output):
                new[index] = value
        if new == self.grid:
            return False
        self.grid = new
        self.spawn()
        return True


def verify_2048(seed, actions):
    game = Tiles(seed)
    for index, direction in enumerate(actions):
        if type(direction) is not int or not 0 <= direction < 4 or not game.move(direction):
            return False
        if max(game.grid) >= 128:
            return index == len(actions) - 1
    return False


VERIFY = {"hanoi": verify_hanoi, "tictactoe": verify_ttt, "2048": verify_2048}
ATTEMPT_LIMITS = {"hanoi": 180, "tictactoe": 5, "2048": 600}


class Trail:
    def __init__(self, key, ending):
        self.key = key
        self.ending = ending

    def sign(self, claims):
        payload = urlsafe_b64encode(json.dumps(claims, separators=(",", ":")).encode()).rstrip(b"=")
        signature = hmac.new(self.key, payload, sha256).hexdigest()
        return payload.decode("ascii") + "." + signature

    def read(self, ticket, player, kind):
        if not isinstance(ticket, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,800}\.[0-9a-f]{64}", ticket):
            return None
        payload, signature = ticket.split(".")
        expected = hmac.new(self.key, payload.encode("ascii"), sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        try:
            data = json.loads(urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        except (Base64Error, ValueError):
            return None
        if data.get("kind") != kind or data.get("player") != player or data.get("exp", 0) <= time():
            return None
        return data

    def completed(self, player, stamps):
        if not isinstance(stamps, dict):
            return []
        return [game for game in GAMES if (data := self.read(stamps.get(game), player, "stamp"))
                and data.get("game") == game]

    def digits(self, player):
        return [1 + hmac.new(self.key, f"trail-clue:{player}:{game}".encode(), sha256).digest()[0] % 9
                for game in GAMES]

    def state(self, player, stamps):
        completed = self.completed(player, stamps)
        a, b, c = self.digits(player)
        clues = (
            f"从第 2 层走到第 {2 + a} 层。每次只上一层，一共要上几次？",
            f"四个角各拿走一枚棋子。原来有 {4 + b} 枚，现在还剩几枚？",
            f"把总和 {4 * c} 平均分成四份。每一份是多少？",
        )
        return {"clues": {game: clues[i] for i, game in enumerate(GAMES) if game in completed}}

    def run(self, body):
        if not isinstance(body, dict):
            return 400, {"error": "bad_request"}
        player = body.get("player")
        if not isinstance(player, str) or not re.fullmatch(r"[0-9a-f]{32}", player):
            return 400, {"error": "bad_player"}

        operation = body.get("op")
        game = body.get("game")
        if operation == "state":
            return 200, self.state(player, body.get("stamps"))
        if operation == "round" and game in GAMES:
            seed = secrets.randbits(32)
            ticket = self.sign({"kind": "round", "player": player, "game": game,
                                "seed": seed, "exp": int(time()) + ROUND_SECONDS})
            setup = {"pegs": hanoi_start(seed)} if game == "hanoi" else {"seed": seed}
            return 200, {"ticket": ticket, "setup": setup}
        if operation == "award" and game in GAMES:
            round_data = self.read(body.get("ticket"), player, "round")
            if not round_data or round_data.get("game") != game:
                return 403, {"error": "expired_round"}
            actions = body.get("actions")
            if not isinstance(actions, list) or not 0 < len(actions) <= ATTEMPT_LIMITS[game]:
                return 422, {"error": "invalid_round"}
            if not VERIFY[game](round_data["seed"], actions):
                return 422, {"error": "invalid_round"}
            return 200, {"stamp": self.sign({"kind": "stamp", "player": player, "game": game,
                                            "exp": int(time()) + STAMP_SECONDS})}
        if operation == "finish":
            if len(self.completed(player, body.get("stamps"))) != len(GAMES):
                return 403, {"error": "missing_clues"}
            code = body.get("code")
            code = unicodedata.normalize("NFKC", code).strip() if isinstance(code, str) else ""
            answer = "".join(map(str, self.digits(player)))
            if not re.fullmatch(r"[0-9]{3}", code) or not hmac.compare_digest(code, answer):
                return 422, {"error": "wrong_code"}
            return 200, {"ending": self.ending}
        return 400, {"error": "bad_request"}


def serve(trail, origins, port):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            self.request.settimeout(8)
            super().setup()

        def reply(self, status, payload=None):
            response = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else b""
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Vary", "Origin")
            origin = self.headers.get("Origin")
            if origin in origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            if response:
                self.wfile.write(response)

        def do_GET(self):
            if self.path == "/health":
                self.reply(200, {"ok": True})
            else:
                self.reply(404, {"error": "not_found"})

        def do_OPTIONS(self):
            if self.path == "/trail-api/v1" and self.headers.get("Origin") in origins:
                self.reply(204)
            else:
                self.reply(403, {"error": "forbidden"})

        def do_POST(self):
            if self.path != "/trail-api/v1" or self.headers.get("Origin") not in origins:
                self.reply(403, {"error": "forbidden"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= MAX_BODY:
                    self.reply(413, {"error": "bad_request"})
                    return
                body = json.loads(self.rfile.read(length))
            except (ValueError, TimeoutError, RecursionError):
                self.reply(400, {"error": "bad_request"})
                return
            self.reply(*trail.run(body))

    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    credential_dir = os.environ.get("CREDENTIALS_DIRECTORY")
    config = Path(credential_dir) / "trail.json" if credential_dir else Path(os.environ["TRAIL_CONFIG"])
    settings = json.loads(config.read_text())
    key = bytes.fromhex(settings["signing_key"])
    if len(key) < 32:
        raise ValueError("Trail API signing key must contain at least 32 random bytes")
    serve(Trail(key, settings["ending"]), set(settings["origins"]), int(settings.get("port", 8771)))
