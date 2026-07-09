from rich.console import Console
from rich.panel import Panel
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeRemainingColumn,
)

from ..core.models import DownloadStatus, ProgressInfo


class ProgressDisplay:
    def __init__(self):
        self.console = Console()
        self.progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
            console=self.console
        )
        self.task_id = None
        self.live = None

    def start(self, filename: str):
        self.live = Panel(self.progress, title="Downloading", border_style="blue")
        self.task_id = self.progress.add_task(filename, total=100)

    def update(self, info: ProgressInfo):
        if self.task_id is None:
            return

        if info.status == DownloadStatus.DOWNLOADING:
            self.progress.update(self.task_id, completed=info.progress * 100)
        elif info.status == DownloadStatus.COMPLETED:
            self.progress.update(self.task_id, completed=100)
        elif info.status == DownloadStatus.FAILED:
            self.console.print(f"[red]Error: {info.filename}[/red]")

    def stop(self):
        self.progress.stop()
