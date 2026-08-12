import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAndroidDevice, saveDownloadToDevice } from "@/lib/device-download";

describe("Android device downloads", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("recognizes Android browsers without matching desktop user agents", () => {
    expect(isAndroidDevice("Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe(true);
    expect(isAndroidDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
  });

  it("hands a completed download to the browser download manager", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    saveDownloadToDevice(42);

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.getAttribute("href")).toBe("/api/downloads/42/stream");
    expect(anchor.hasAttribute("download")).toBe(true);
    expect(document.body.contains(anchor)).toBe(false);
  });
});
