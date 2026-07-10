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

vi.mock("@/components/dashboard/system-status", () => ({
  SystemStatus: () => null,
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });

  it("renders sidebar navigation items", () => {
    render(<App />);
    expect(screen.getByText("Downloads")).toBeDefined();
    expect(screen.getByText("Torrents")).toBeDefined();
    expect(screen.getByText("Image Tools")).toBeDefined();
  });

  it("shows dashboard by default", () => {
    render(<App />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
  });
});
