import sys
from pathlib import Path
from typing import Optional
from rich.console import Console
from rich.table import Table
import typer

from ..core.models import Quality, VideoType
from ..core.detector import detect_video_type, is_valid_url
from ..core.downloader import Downloader
from ..core.config import get_config
from .progress import ProgressDisplay

app = typer.Typer(
    name="easybay",
    help="Download videos from YouTube, TikTok, Instagram, and Twitter",
    add_completion=False
)
console = Console()


def version_callback(value: bool):
    if value:
        console.print("[bold green]easybay v0.1.0[/bold green]")
        raise typer.Exit()


@app.callback()
def main(
    version: Optional[bool] = typer.Option(None, "--version", "-v", callback=version_callback, help="Show version"),
):
    pass


@app.command()
def download(
    url: str = typer.Argument(..., help="URL to download"),
    quality: str = typer.Option("best", "--quality", "-q", help="Video quality: best, worst, 1080p, 720p, 480p, audio"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Output directory"),
):
    if not is_valid_url(url):
        console.print("[red]Error: Invalid URL format[/red]")
        raise typer.Exit(1)

    video_type = detect_video_type(url)
    console.print(f"[blue]Detected:[/blue] {video_type.value.title()} video")

    try:
        q = Quality(quality.lower())
    except ValueError:
        console.print(f"[red]Error: Invalid quality '{quality}'[/red]")
        console.print(f"[yellow]Valid options: {', '.join(q.value for q in Quality)}[/yellow]")
        raise typer.Exit(1)

    output_dir = Path(output) if output else get_config().download_dir
    progress = ProgressDisplay()

    def on_progress(info):
        if info.status.value == "downloading":
            if progress.task_id is None:
                progress.start(info.filename or url)
            progress.update(info)
        elif info.status.value == "completed":
            progress.update(info)
        elif info.status.value == "failed":
            progress.update(info)

    downloader = Downloader(progress_callback=on_progress)

    try:
        with progress.progress:
            result = downloader.download(url, q, output_dir)

        if result.success:
            console.print(f"\n[green]Download complete![/green]")
            console.print(f"File: {result.filepath}")
        else:
            console.print(f"\n[red]Download failed: {result.error}[/red]")
            raise typer.Exit(1)

    except KeyboardInterrupt:
        console.print("\n[yellow]Download cancelled[/yellow]")
        raise typer.Exit(130)
    except Exception as e:
        console.print(f"\n[red]Unexpected error: {e}[/red]")
        raise typer.Exit(1)


@app.command()
def info(
    url: str = typer.Argument(..., help="URL to get info about"),
):
    if not is_valid_url(url):
        console.print("[red]Error: Invalid URL format[/red]")
        raise typer.Exit(1)

    video_type = detect_video_type(url)
    console.print(f"[blue]URL:[/blue] {url}")
    console.print(f"[blue]Type:[/blue] {video_type.value.title()}")
    console.print(f"[blue]Platform:[/blue] {video_type.value}")


@app.command()
def formats(
    url: str = typer.Argument(..., help="URL to list available formats"),
):
    console.print(f"[yellow]Fetching formats for: {url}[/yellow]")
    try:
        import yt_dlp
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            if info and 'formats' in info:
                table = Table(title="Available Formats")
                table.add_column("ID", style="cyan")
                table.add_column("Extension", style="green")
                table.add_column("Resolution", style="magenta")
                table.add_column("FPS", style="yellow")
                table.add_column("Size", style="blue")

                for f in info['formats']:
                    table.add_row(
                        f.get('format_id', 'N/A'),
                        f.get('ext', 'N/A'),
                        f.get('resolution', 'N/A'),
                        str(f.get('fps', 'N/A')),
                        f.get('filesize', 'N/A') and f"{f['filesize'] / 1024 / 1024:.1f}MB" if f.get('filesize') else 'N/A'
                    )
                console.print(table)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
