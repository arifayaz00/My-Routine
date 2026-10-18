"""In-process pub/sub behind the Server-Sent-Events endpoint.

`notify()` is safe to call from ordinary (sync, threadpool) route handlers.
Single process only: with several uvicorn workers/containers replace it with Redis pub/sub
or Postgres LISTEN/NOTIFY - the SSE route itself stays unchanged.
"""
import asyncio
import json

_subscribers: set[asyncio.Queue] = set()
_loop: asyncio.AbstractEventLoop | None = None


def subscribe() -> asyncio.Queue:
    global _loop
    _loop = asyncio.get_running_loop()
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _subscribers.discard(q)


def _deliver(msg: str) -> None:
    for q in list(_subscribers):
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass


def notify(event: str, data: dict) -> None:
    if _loop is None or not _subscribers:
        return
    msg = f"event: {event}\ndata: {json.dumps(data)}\n\n"
    _loop.call_soon_threadsafe(_deliver, msg)
