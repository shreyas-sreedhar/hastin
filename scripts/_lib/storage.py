import os
from pathlib import Path

from ._lib_root import REPO_ROOT


def backend() -> str:
    return os.environ.get("STORAGE_BACKEND", "local")


def local_root() -> Path:
    override = os.environ.get("LOCAL_STORAGE_ROOT")
    if override:
        return Path(override).resolve()
    return REPO_ROOT / "storage"


def write_bytes(key: str, data: bytes) -> tuple[str, str]:
    """Write bytes to the configured backend. Returns (backend, key)."""
    b = backend()
    if b == "local":
        path = local_root() / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return ("local", key)
    if b == "r2":
        raise NotImplementedError("R2 backend not yet implemented")
    raise ValueError(f"unknown STORAGE_BACKEND: {b}")


def read_bytes(storage_backend: str, key: str) -> bytes:
    if storage_backend == "local":
        return (local_root() / key).read_bytes()
    if storage_backend == "r2":
        raise NotImplementedError("R2 backend not yet implemented")
    raise ValueError(f"unknown storage_backend: {storage_backend}")
