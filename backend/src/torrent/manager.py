import asyncio
import hashlib
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

from ..core.config import get_config
from .magnet import parse_magnet, resolve_magnet

logger = logging.getLogger(__name__)


def _patch_aiotorrent_trackers():
    """Monkey-patch aiotorrent's UDPTracker.parse_announce to handle short responses."""
    try:
        from aiotorrent.core.trackers import UDPTracker

        original_parse_announce = UDPTracker.parse_announce

        def _safe_parse_announce(self, response: bytes):
            if len(response) < 20:
                logger.warning(f"Tracker returned short response ({len(response)} bytes), skipping")
                return {"action": 0, "transaction_id": 0, "interval": 0, "leechers": 0, "seeders": 0, "peers": []}
            return original_parse_announce(self, response)

        UDPTracker.parse_announce = _safe_parse_announce
        logger.info("Patched aiotorrent UDPTracker.parse_announce for short-response safety")
    except Exception as e:
        logger.warning(f"Failed to patch aiotorrent trackers: {e}")


_patch_aiotorrent_trackers()


class TorrentManager:
    def __init__(self):
        self.config = get_config()
        self._active: dict[str, dict[str, Any]] = {}
        self._callbacks: dict[str, list[Callable]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None
        self._running = False

    def start(self):
        self.config.ensure_dirs()
        self._running = True
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            self._loop = asyncio.new_event_loop()
        logger.info("TorrentManager started")

    def stop(self):
        self._running = False
        for ih in list(self._active.keys()):
            self._active[ih]["cancelled"] = True
        logger.info("TorrentManager stopped")

    def is_magnet(self, uri: str) -> bool:
        return uri.startswith("magnet:?")

    @staticmethod
    def is_torrent_file(path: str) -> bool:
        return path.lower().endswith(".torrent")

    async def resolve_magnet_uri(self, magnet_uri: str) -> Path:
        return await resolve_magnet(
            magnet_uri,
            save_dir=self.config.torrent_dir,
            timeout=self.config.torrent_dht_timeout,
        )

    async def start_download(
        self,
        source: str,
        info_hash: str = "",
        name: str = "",
        torrent_path: Path | None = None,
        notify: Callable[[dict[str, Any]], None] | None = None,
    ) -> str:
        from aiotorrent import DownloadStrategy, Torrent

        if self.is_magnet(source):
            try:
                ih_bytes, name, _ = parse_magnet(source)
                info_hash = ih_bytes.hex()
            except Exception:
                info_hash = hashlib.sha256(source.encode()).hexdigest()[:20]
        elif not info_hash:
            info_hash = hashlib.sha256(source.encode()).hexdigest()[:20]

        state: dict[str, Any] = {
            "info_hash": info_hash,
            "name": name or source,
            "status": "queued",
            "progress": 0.0,
            "speed": "",
            "eta": "",
            "peers": 0,
            "total_size": 0,
            "downloaded": 0,
            "files": [],
            "output_path": "",
            "error_message": "",
            "cancelled": False,
        }
        self._active[info_hash] = state

        if notify:
            self._callbacks.setdefault(info_hash, []).append(notify)

        async def _run():
            try:
                if self.is_magnet(source):
                    state["status"] = "resolving"
                    self._emit(info_hash)
                    logger.info(f"[{info_hash[:8]}] Resolving magnet URI...")
                    torrent_path = await self.resolve_magnet_uri(source)
                    state["name"] = torrent_path.stem
                    logger.info(f"[{info_hash[:8]}] Resolved to {torrent_path}")

                if torrent_path:
                    logger.info(f"[{info_hash[:8]}] Initializing torrent from {torrent_path}")
                    torrent = Torrent(str(torrent_path))
                    await torrent.init(dht_enabled=True)
                    logger.info(f"[{info_hash[:8]}] Torrent initialized, starting download")

                    state["status"] = "downloading"
                    state["total_size"] = torrent.torrent_info.get("size", 0) or 0
                    state["files"] = [
                        {"path": str(f), "size": 0}
                        for f in (torrent.files or [])
                    ]
                    self._emit(info_hash)

                    save_dir = self.config.torrent_dir / (torrent.torrent_info.get("name", "download"))
                    save_dir.mkdir(parents=True, exist_ok=True)

                    for _idx, file_obj in enumerate(torrent.files or []):
                        if state["cancelled"]:
                            state["status"] = "cancelled"
                            self._emit(info_hash)
                            return

                        state["current_file"] = str(file_obj)
                        self._emit(info_hash)

                        await torrent.download(file_obj, strategy=DownloadStrategy.SEQUENTIAL)

                        written = 0
                        for f in (torrent.files or []):
                            if hasattr(f, 'get_bytes_written'):
                                written += f.get_bytes_written()
                        state["downloaded"] = written

                        active_peers = 0
                        for p in torrent.peers:
                            if hasattr(p, 'has_handshaked') and p.has_handshaked:
                                active_peers += 1
                        state["peers"] = active_peers
                        state["progress"] = min(state["downloaded"] / max(state["total_size"], 1), 1.0)
                        self._emit(info_hash)

                    if not state["cancelled"]:
                        state["status"] = "completed"
                        state["progress"] = 1.0
                        state["output_path"] = str(save_dir)
                        self._emit(info_hash)
                        logger.info(f"[{info_hash[:8]}] Download completed")

            except Exception as e:
                state["status"] = "error"
                state["error_message"] = str(e)
                self._emit(info_hash)
                logger.error(f"[{info_hash[:8]}] Torrent download failed: {e}", exc_info=True)

        task = asyncio.create_task(_run())
        self._active[info_hash]["_task"] = task
        return info_hash

    def get_status(self, info_hash: str) -> dict[str, Any] | None:
        entry = self._active.get(info_hash)
        if entry:
            return {k: v for k, v in entry.items() if not k.startswith("_")}
        return None

    def get_all(self) -> list[dict[str, Any]]:
        result = []
        for entry in self._active.values():
            clean = {k: v for k, v in entry.items() if not k.startswith("_")}
            result.append(clean)
        return result

    def cancel(self, info_hash: str):
        entry = self._active.get(info_hash)
        if entry:
            entry["cancelled"] = True
            entry["status"] = "cancelled"

    def remove(self, info_hash: str):
        entry = self._active.pop(info_hash, None)
        if entry:
            entry["cancelled"] = True
        self._callbacks.pop(info_hash, None)

    def subscribe(self, info_hash: str, callback: Callable[[dict[str, Any]], None]):
        self._callbacks.setdefault(info_hash, []).append(callback)

    def _emit(self, info_hash: str):
        state = self._active.get(info_hash)
        if not state:
            return
        clean = {k: v for k, v in state.items() if not k.startswith("_")}
        for cb in self._callbacks.get(info_hash, []):
            try:
                cb(clean)
            except Exception as e:
                logger.error(f"Torrent callback error: {e}")


_manager: TorrentManager | None = None


def get_manager() -> TorrentManager:
    global _manager
    if _manager is None:
        _manager = TorrentManager()
    return _manager
