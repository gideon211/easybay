import re
import os
import struct
import hashlib
import asyncio
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, parse_qs, unquote

from fastbencode import bencode, bdecode

from ..core.config import get_config

logger = logging.getLogger(__name__)


PEER_ID = b"-EZ0001-" + os.urandom(12)


def parse_magnet(magnet_uri: str) -> tuple[bytes, str, list[str]]:
    if not magnet_uri.startswith("magnet:?"):
        raise ValueError("Not a magnet URI")

    parsed = urlparse(magnet_uri)
    params = parse_qs(parsed.query)

    info_hash: Optional[bytes] = None
    name = "unknown"
    trackers: list[str] = []

    xt_values = params.get("xt", [])
    for xt in xt_values:
        if xt.startswith("urn:btih:"):
            raw = xt[len("urn:btih:"):]
            if len(raw) == 40:
                info_hash = bytes.fromhex(raw)
            elif len(raw) == 32:
                import base64
                info_hash = base64.b32decode(raw)
            break

    if info_hash is None:
        raise ValueError("No valid info_hash (xt=urn:btih:) in magnet URI")

    for tr in params.get("tr", []):
        trackers.append(unquote(tr))

    for xs in params.get("xs", []):
        trackers.append(unquote(xs))

    default_trackers = [
        "udp://tracker.opentrackr.org:1337/announce",
        "udp://tracker.openbittorrent.com:6969/announce",
        "udp://9.rarbg.to:2710/announce",
        "http://tracker.internetwarriors.net:1337/announce",
    ]
    for dt in default_trackers:
        if dt not in trackers:
            trackers.append(dt)

    return info_hash, name, trackers


def build_torrent_file(metadata: bytes, name: str) -> bytes:
    info_dict = bdecode(metadata)
    torrent = {
        b"info": info_dict,
        b"announce": b"udp://tracker.opentrackr.org:1337/announce",
    }
    return bencode(torrent)


def _skip_bencode(data: bytes, start: int = 0) -> int:
    if start >= len(data):
        return start
    t = data[start]
    if t == ord("i"):
        end = data.index(ord("e"), start + 1)
        return end + 1
    if t == ord("d") or t == ord("l"):
        pos = start + 1
        while pos < len(data) and data[pos] != ord("e"):
            if t == ord("d"):
                if data[pos] >= ord("0") and data[pos] <= ord("9"):
                    colon = data.index(ord(":"), pos)
                    length = int(data[pos:colon])
                    pos = colon + 1 + length
            pos = _skip_bencode(data, pos)
            if pos >= len(data):
                return len(data)
        return pos + 1 if pos < len(data) and data[pos] == ord("e") else pos
    if ord("0") <= t <= ord("9"):
        colon = data.index(ord(":"), start)
        length = int(data[start:colon])
        return colon + 1 + length
    return len(data)


async def resolve_magnet(
    magnet_uri: str,
    save_dir: Optional[Path] = None,
    timeout: int = 30,
) -> Path:
    config = get_config()
    save_dir = save_dir or config.torrent_dir
    save_dir.mkdir(parents=True, exist_ok=True)

    info_hash, name, trackers = parse_magnet(magnet_uri)
    ih_hex = info_hash.hex()
    logger.info(f"Resolving magnet: info_hash={ih_hex}, name={name}")

    peers: set[tuple[str, int]] = set()

    try:
        from aiotorrent.DHTv4 import SimpleDHTCrawler
        crawler = SimpleDHTCrawler(info_hash)
        dht_peers = await _run_dht_crawl(crawler, timeout)
        peers.update(dht_peers)
        logger.info(f"DHT found {len(dht_peers)} peers")
    except Exception as e:
        logger.warning(f"DHT peer discovery failed: {e}")

    for tracker_url in trackers[:5]:
        try:
            tracker_peers = await _contact_tracker(tracker_url, info_hash, timeout=5)
            peers.update(tracker_peers)
        except Exception as e:
            logger.debug(f"Tracker {tracker_url} failed: {e}")

    if not peers:
        raise RuntimeError(f"No peers found for magnet URI (info_hash={ih_hex})")

    metadata = None
    for ip, port in list(peers)[:30]:
        try:
            metadata = await _download_metadata_from_peer(
                ip, port, info_hash, timeout=config.torrent_metadata_timeout
            )
            if metadata:
                logger.info(f"Metadata downloaded from {ip}:{port}")
                break
        except Exception as e:
            logger.debug(f"Metadata from {ip}:{port} failed: {e}")

    if metadata is None:
        raise RuntimeError(f"Could not download metadata from any peer")

    torrent_data = build_torrent_file(metadata, name)
    safe_name = "".join(c for c in name if c.isalnum() or c in (" ", "-", "_")).strip()[:80]
    torrent_path = save_dir / f"{safe_name}_{ih_hex[:12]}.torrent"
    torrent_path.write_bytes(torrent_data)
    logger.info(f"Saved torrent file: {torrent_path}")
    return torrent_path


async def _run_dht_crawl(crawler, timeout: int) -> set[tuple[str, int]]:
    async def crawl():
        for _ in range(timeout // 2):
            await asyncio.sleep(2)
            if crawler.FOUND_PEERS:
                return
    task = asyncio.create_task(crawl())
    try:
        await asyncio.wait_for(task, timeout=timeout)
    except asyncio.TimeoutError:
        pass
    return set(crawler.FOUND_PEERS)


async def _contact_tracker(tracker_url: str, info_hash: bytes, timeout: int = 5) -> set[tuple[str, int]]:
    parsed = urlparse(tracker_url)
    if parsed.scheme in ("http", "https"):
        return await _contact_http_tracker(tracker_url, info_hash, timeout)
    if parsed.scheme == "udp":
        pass
    return set()


async def _contact_http_tracker(url: str, info_hash: bytes, timeout: int = 5) -> set[tuple[str, int]]:
    import urllib.request
    params = {
        "info_hash": info_hash,
        "peer_id": PEER_ID,
        "port": 6881,
        "uploaded": 0,
        "downloaded": 0,
        "left": 1,
        "event": "started",
        "compact": 1,
    }
    from urllib.parse import urlencode
    full_url = f"{url}?{urlencode(params, doseq=True)}"
    req = urllib.request.Request(full_url)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    response = bdecode(data)
    peers_data = response.get(b"peers", b"")
    peers: set[tuple[str, int]] = set()
    if isinstance(peers_data, bytes):
        for i in range(0, len(peers_data), 6):
            if i + 6 > len(peers_data):
                break
            ip = ".".join(str(b) for b in peers_data[i:i+4])
            port = struct.unpack(">H", peers_data[i+4:i+6])[0]
            peers.add((ip, port))
    return peers


async def _download_metadata_from_peer(
    ip: str, port: int, info_hash: bytes, timeout: int = 10
) -> Optional[bytes]:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port), timeout=5
        )
    except (OSError, asyncio.TimeoutError):
        return None

    try:
        reserved = b"\x00\x00\x00\x00\x00\x10\x00\x00"
        handshake = (
            struct.pack(">B", 19)
            + b"BitTorrent protocol"
            + reserved
            + info_hash
            + PEER_ID
        )
        writer.write(handshake)
        await asyncio.wait_for(writer.drain(), timeout=5)

        resp = await asyncio.wait_for(reader.readexactly(68), timeout=5)
        if resp[0] != 19 or resp[1:20] != b"BitTorrent protocol" or resp[28:48] != info_hash:
            return None

        bitfield_len_data = await asyncio.wait_for(reader.readexactly(4), timeout=5)
        bitfield_len = struct.unpack(">I", bitfield_len_data)[0]
        if bitfield_len > 0:
            await asyncio.wait_for(reader.readexactly(bitfield_len), timeout=5)

        writer.write(_build_ext_handshake())
        await asyncio.wait_for(writer.drain(), timeout=5)

        metadata_size = None
        metadata_pieces: dict[int, bytes] = {}

        while True:
            try:
                msg_len_data = await asyncio.wait_for(reader.readexactly(4), timeout=timeout)
            except (asyncio.TimeoutError, asyncio.IncompleteReadError):
                break

            msg_len = struct.unpack(">I", msg_len_data)[0]
            if msg_len == 0:
                continue

            msg_data = await asyncio.wait_for(reader.readexactly(msg_len), timeout=timeout)
            msg_id = msg_data[0]

            if msg_id != 20:
                continue

            ext_id = msg_data[1]
            payload = msg_data[2:]

            try:
                ext_msg = bdecode(payload[:payload.index(b"e") + 1]) if b"e" in payload else {}
            except Exception:
                continue

            if ext_id == 0:
                ext_m = ext_msg.get(b"m", {})
                metadata_size = ext_msg.get(b"metadata_size")
                ut_metadata_id = ext_m.get(b"ut_metadata", 1)
                if isinstance(metadata_size, int) and metadata_size > 0:
                    total = (metadata_size + 16383) // 16384
                    for i in range(total):
                        writer.write(_build_metadata_request(i, ut_metadata_id))
                    await asyncio.wait_for(writer.drain(), timeout=5)

            elif ext_id == ut_metadata_id:
                msg_type = ext_msg.get(b"msg_type")
                piece = ext_msg.get(b"piece")
                if msg_type == 1 and isinstance(piece, int):
                    dict_end = _skip_bencode(payload, 0)
                    piece_data = payload[dict_end:]
                    metadata_pieces[piece] = piece_data

            if metadata_size and len(metadata_pieces) >= (metadata_size + 16383) // 16384:
                break

        if metadata_pieces and metadata_size:
            full = b"".join(metadata_pieces[i] for i in sorted(metadata_pieces))
            full = full[:metadata_size]
            if hashlib.sha1(full).digest() == info_hash:
                return full
        return None

    except Exception as e:
        logger.debug(f"Metadata download error from {ip}:{port}: {e}")
        return None
    finally:
        try:
            writer.close()
        except Exception:
            pass


def _build_ext_handshake(metadata_size: int = 0) -> bytes:
    msg = {b"m": {b"ut_metadata": 1}, b"metadata_size": metadata_size, b"v": b"EasyBay"}
    payload = bencode(msg)
    return struct.pack(">IB", len(payload) + 2, 20) + struct.pack(">B", 0) + payload


def _build_metadata_request(piece: int, ext_id: int = 1) -> bytes:
    msg = {b"msg_type": 0, b"piece": piece}
    payload = bencode(msg)
    return struct.pack(">IB", len(payload) + 2, 20) + struct.pack(">B", ext_id) + payload
