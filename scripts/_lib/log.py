import logging
from pathlib import Path

from ._lib_root import REPO_ROOT


def get_logger(name: str) -> logging.Logger:
    logs_dir = REPO_ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)

    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    fh = logging.FileHandler(logs_dir / f"{name}.log")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    return logger
