import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App";

vi.mock("@/hooks/use-downloads", () => ({
  useDownloads: () => ({
    downloads: [],
    loading: false,
    error: null,
    addDownload: vi.fn(),
    removeDownload: vi.fn(),
    pauseDownload: vi.fn(),
    resumeDownload: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-torrents", () => ({
  useTorrents: () => ({
    torrents: [],
    loading: false,
    error: null,
    addTorrent: vi.fn(),
    removeTorrent: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the heading", () => {
    render(<App />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe("EasyBay");
  });

  it("renders tab buttons", () => {
    render(<App />);
    expect(screen.getByText("Social Downloads")).toBeDefined();
    expect(screen.getByText("Torrents")).toBeDefined();
  });

  it("shows download form by default", () => {
    render(<App />);
    expect(screen.getByText("Social Downloads")).toBeDefined();
  });
});
