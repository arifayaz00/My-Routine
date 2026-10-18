"""Optional Telegram broadcast (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID). Never blocks or fails a request."""
import logging
import threading

import httpx

from ..config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

log = logging.getLogger("notify")


def _send(text: str) -> None:
    try:
        r = httpx.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                       json={"chat_id": TELEGRAM_CHAT_ID, "text": text}, timeout=10)
        r.raise_for_status()
    except Exception as exc:  # noqa: BLE001 - alerts are best effort
        log.warning("Telegram alert failed: %s", type(exc).__name__)


def broadcast(text: str) -> None:
    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        threading.Thread(target=_send, args=(text,), daemon=True).start()
