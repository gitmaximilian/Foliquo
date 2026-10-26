"""Build a deterministic POSIX archive from an already verified staging directory."""
import gzip
import os
import pathlib
import subprocess
import sys
import tarfile

stage = pathlib.Path(sys.argv[1]).resolve()
artifact = pathlib.Path(sys.argv[2]).resolve()
epoch = int(os.environ.get("SOURCE_DATE_EPOCH") or subprocess.check_output(
    ["git", "log", "-1", "--format=%ct"], text=True).strip())
with artifact.open("wb") as output, gzip.GzipFile(filename="", fileobj=output, mode="wb", mtime=epoch) as compressed:
    with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
        for path in sorted(stage.rglob("*")):
            if path.is_symlink():
                raise ValueError("Symbolic links are forbidden in distributions")
            info = archive.gettarinfo(str(path), arcname=path.relative_to(stage).as_posix())
            info.uid = info.gid = 0
            info.uname = info.gname = ""
            info.mtime = epoch
            info.pax_headers = {}
            info.mode = 0o755 if path.is_dir() or os.access(path, os.X_OK) else 0o644
            if path.is_file():
                with path.open("rb") as source:
                    archive.addfile(info, source)
            else:
                archive.addfile(info)
