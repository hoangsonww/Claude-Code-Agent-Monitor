/**
 * @file editors.test.ts
 * @description Verifies editor preference validation and folder URI safety across
 * POSIX/Windows paths, corrupt storage, and local versus remote sessions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  editorFolderUrl,
  editorUnavailableReason,
  parseEditorPrefs,
  saveEditorPrefs,
  type EditorId,
} from "../editors";

beforeEach(() => localStorage.clear());

describe("editor preferences", () => {
  it.each([null, "invalid", "null", "[]", "42"])("handles absent or corrupt storage: %s", (raw) => {
    expect(parseEditorPrefs(raw)).toEqual({ enabled: [], defaultId: null });
  });

  it("drops unknown editors and duplicates and repairs a removed default", () => {
    expect(
      parseEditorPrefs(
        JSON.stringify({
          enabled: ["cursor", "cursor", "javascript", 1, null, "vscode"],
          defaultId: "removed",
        })
      )
    ).toEqual({ enabled: ["cursor", "vscode"], defaultId: "cursor" });
    expect(
      parseEditorPrefs(JSON.stringify({ enabled: ["cursor", "vscode"], defaultId: "vscode" }))
        .defaultId
    ).toBe("vscode");
    expect(
      parseEditorPrefs(JSON.stringify({ enabled: [], defaultId: "vscode" })).defaultId
    ).toBeNull();
  });

  it("saves validated preferences and emits a same-tab update", () => {
    const listener = vi.fn();
    window.addEventListener("ccam-editors-changed", listener);
    try {
      expect(saveEditorPrefs({ enabled: ["cursor"], defaultId: "cursor" })).toBe(true);
      expect(parseEditorPrefs(localStorage.getItem("ccam-editors"))).toEqual({
        enabled: ["cursor"],
        defaultId: "cursor",
      });
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("ccam-editors-changed", listener);
    }
  });

  it("reports storage write failure", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      expect(saveEditorPrefs({ enabled: ["vscode"], defaultId: "vscode" })).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("editor folder links", () => {
  it("encodes spaces, unicode, query/fragment delimiters and literal percent signs", () => {
    const url = editorFolderUrl("vscode", "/Users/dev/my project/中文#foo?x=%20");
    expect(url).toBe("vscode://file/Users/dev/my%20project/%E4%B8%AD%E6%96%87%23foo%3Fx%3D%2520/");
    expect(new URL(url!).search).toBe("");
    expect(new URL(url!).hash).toBe("");
  });

  it("supports Windows drive paths and root directories", () => {
    expect(editorFolderUrl("cursor", "C:\\Users\\dev\\my project")).toBe(
      "cursor://file/C:/Users/dev/my%20project/"
    );
    expect(editorFolderUrl("vscode", "D:/code/")).toBe("vscode://file/D:/code/");
    expect(editorFolderUrl("vscode", "/")).toBe("vscode://file/");
  });

  it.each([
    null,
    "",
    "relative/path",
    "~/code",
    "//host/share",
    "\\\\host\\share",
    "/bad\npath",
    "/bad\u0000path",
    "/bad\\path",
    "/bad\ud800",
  ])("rejects unsupported paths: %s", (path) => {
    expect(editorFolderUrl("vscode", path)).toBeNull();
  });

  it("never accepts arbitrary URI schemes", () => {
    expect(editorFolderUrl("javascript" as EditorId, "/code")).toBeNull();
  });

  it("blocks remote data and non-loopback dashboard origins", () => {
    expect(editorUnavailableReason({ cwd: "/code", source: "remote-1" }, "localhost")).toBe(
      "remote"
    );
    expect(editorUnavailableReason({ cwd: "/code", source: "local" }, "server.example.com")).toBe(
      "remote"
    );
    expect(editorUnavailableReason({ cwd: "/code" }, "127.0.0.1.evil.com")).toBe("remote");
    for (const host of ["localhost", "127.0.0.1", "::1", "[::1]"]) {
      expect(editorUnavailableReason({ cwd: "/code" }, host)).toBeNull();
    }
    expect(editorUnavailableReason({ cwd: null }, "localhost")).toBe("missingFolder");
  });
});
