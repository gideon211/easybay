import { getDownloadStreamUrl } from "@/lib/api";

export function isAndroidDevice(userAgent = navigator.userAgent): boolean {
  return /Android/i.test(userAgent);
}

export function saveDownloadToDevice(downloadId: number): void {
  // Browsers do not allow web applications to choose arbitrary Android filesystem paths. An
  // attachment navigation is the standards-compatible handoff to Android's download manager,
  // which saves the video in the browser's configured Downloads/local-storage location.
  const anchor = document.createElement("a");
  anchor.href = getDownloadStreamUrl(downloadId);
  anchor.download = "";
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
