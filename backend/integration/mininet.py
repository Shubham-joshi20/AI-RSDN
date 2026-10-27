from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class MininetStatus:
    available: bool
    executable: str | None
    detail: str


class MininetAdapter:
    """Starts and stops the real Linux Mininet topology when available."""

    def __init__(self, topology_script: str | Path | None = None) -> None:
        self.topology_script = Path(topology_script or "network/nsfnet_topology.py")
        self.process: subprocess.Popen[str] | None = None

    def status(self) -> MininetStatus:
        executable = shutil.which("mn")
        if executable is None:
            return MininetStatus(False, None, "Mininet is unavailable; use Ubuntu/WSL2 with Open vSwitch.")
        return MininetStatus(True, executable, "Mininet command is available.")

    def start(self, controller_ip: str = "127.0.0.1", controller_port: int = 6653) -> dict[str, object]:
        status = self.status()
        if not status.available:
            raise RuntimeError(status.detail)
        if self.process and self.process.poll() is None:
            return {"status": "running", "pid": self.process.pid}
        command = [
            status.executable or "mn",
            "--custom",
            str(self.topology_script),
            "--topo",
            "nsfnet",
            "--controller",
            "remote",
            "--controller-ip",
            controller_ip,
            "--controller-port",
            str(controller_port),
            "--switch",
            "ovsk,protocols=OpenFlow13",
        ]
        self.process = subprocess.Popen(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        return {"status": "starting", "pid": self.process.pid, "command": command}

    def stop(self) -> dict[str, str]:
        if self.process and self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=10)
            self.process = None
            return {"status": "stopped"}
        return {"status": "not_running"}
