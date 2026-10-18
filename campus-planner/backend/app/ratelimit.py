"""Small in-memory sliding-window limiter (per process). Behind several workers, use nginx
limit_req (configured in frontend/nginx.conf) as the shared layer; this one protects per email."""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class Limiter:
    def __init__(self) -> None:
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, key: str, limit: int, window: int) -> None:
        now = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and q[0] <= now - window:
                q.popleft()
            if len(q) >= limit:
                retry = int(window - (now - q[0])) + 1
                raise HTTPException(429, "Too many attempts. Please wait a few minutes and try again.",
                                    headers={"Retry-After": str(retry)})
            q.append(now)
            if len(self.hits) > 10_000:  # drop idle keys
                for k in [k for k, v in self.hits.items() if not v]:
                    del self.hits[k]

    def reset(self) -> None:
        with self.lock:
            self.hits.clear()


limiter = Limiter()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
