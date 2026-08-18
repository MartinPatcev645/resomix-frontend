/**
 * A phone photo must reach the cropper, not a rejection.
 *
 * The old picker validated instead of normalising: type ∈ {jpeg,png,webp}, ≤ 3 MB, and each side
 * within 100–4000 px. A plain 12 MP iPhone photo is 4032×3024, so it failed the dimension rule by 32
 * pixels — every default iPhone shot bounced, and the fix on offer was "go shrink it yourself".
 *
 * `prepare` now downscales instead. These tests pin the boundary between the two jobs it still does:
 * what it refuses OUTRIGHT (and therefore without paying to load the ~19 KB imaging library), and
 * what it hands on to be downscaled. The downscale itself is stubbed — pica needs a real canvas and
 * web workers, neither of which jsdom has — so what is under test here is the DECISION, not the pixel
 * maths. That split is deliberate: the decision is what regressed before, and it is what a reader
 * needs to be able to change safely.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` because vi.mock is lifted above every other statement in the file — a plain
// `const` declared here would still be in its temporal dead zone when the factory runs.
const { downscale } = vi.hoisted(() => ({ downscale: vi.fn() }));

// Mocked by PATH, not by the "image-blob-reduce" package name: that package is a dependency of
// `packages/hooks`, so it does not resolve from this app at all and a mock keyed on its name matches
// nothing — the real library loads and dies on jsdom's missing `URL.createObjectURL`. This path is
// the same module `usePlaylistCover` imports as "./coverImage", so the mock lands.
//
// `importActual` keeps the real constants: stubbing them here would make the "matches Alwyzon"
// assertion below assert against itself.
// The path must be a literal — `vi.mock` is hoisted statically, so a `const` holding it is not yet
// defined when the call runs and the mock silently registers against nothing.
vi.mock("../../../../packages/hooks/src/Playlist/coverImage", async (importActual) => ({
  // The ".js" here is the TYPE reference only, which node16 module resolution requires to be
  // extensioned; the runtime path above stays extensionless for Vite to resolve.
  ...(await importActual<typeof import("../../../../packages/hooks/src/Playlist/coverImage.js")>()),
  prepareForCrop: downscale,
}));

import { usePlaylistCover } from "@resomix/hooks";
import { MAX_COVER_BYTES, COVER_SIZE } from "@resomix/hooks";

/** A File of a given declared type and byte length — the two things `prepare` gates on up front. */
function fakeFile(type: string, bytes: number, name = "photo"): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

const MB = 1024 * 1024;

describe("preparing a picked cover", () => {
  beforeEach(() => {
    downscale.mockReset();
    downscale.mockResolvedValue(new Blob(["downscaled"], { type: "image/jpeg" }));
  });

  it("accepts a full-size iPhone photo instead of rejecting it", async () => {
    // 12 MP, ~4 MB — over the OLD 3 MB rule and over its 4000 px rule. It must now sail through to
    // the downscaler, which is the entire point of the change.
    const { result } = renderHook(() => usePlaylistCover("pl-1", false));

    let prepared!: Awaited<ReturnType<typeof result.current.prepare>>;
    await act(async () => {
      prepared = await result.current.prepare(fakeFile("image/jpeg", 4 * MB, "IMG_0042.JPG"));
    });

    expect(prepared.ok).toBe(true);
    expect(prepared.blob).toBeInstanceOf(Blob);
    expect(downscale).toHaveBeenCalledOnce();
  });

  it("accepts any image type the browser offers, not a hand-picked three", async () => {
    const { result } = renderHook(() => usePlaylistCover("pl-1", false));

    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff", "image/avif"]) {
      let prepared!: Awaited<ReturnType<typeof result.current.prepare>>;
      await act(async () => {
        prepared = await result.current.prepare(fakeFile(type, 2 * MB));
      });
      expect(prepared.ok, `${type} should be accepted`).toBe(true);
    }
  });

  it("refuses a non-image without loading the imaging library", async () => {
    const { result } = renderHook(() => usePlaylistCover("pl-1", false));

    let prepared!: Awaited<ReturnType<typeof result.current.prepare>>;
    await act(async () => {
      prepared = await result.current.prepare(fakeFile("application/pdf", 1 * MB, "invoice.pdf"));
    });

    expect(prepared.ok).toBe(false);
    expect(prepared.error).toMatch(/image/i);
    // Cheap checks come first: there is no reason to fetch a code-split chunk to reject a PDF.
    expect(downscale).not.toHaveBeenCalled();
  });

  it("refuses a file over the ceiling, and says what the ceiling is", async () => {
    const { result } = renderHook(() => usePlaylistCover("pl-1", false));

    let prepared!: Awaited<ReturnType<typeof result.current.prepare>>;
    await act(async () => {
      prepared = await result.current.prepare(fakeFile("image/jpeg", MAX_COVER_BYTES + 1));
    });

    expect(prepared.ok).toBe(false);
    expect(prepared.error).toContain("15 MB");
    expect(downscale).not.toHaveBeenCalled();
  });

  it("treats the ceiling as inclusive", async () => {
    const { result } = renderHook(() => usePlaylistCover("pl-1", false));

    let prepared!: Awaited<ReturnType<typeof result.current.prepare>>;
    await act(async () => {
      prepared = await result.current.prepare(fakeFile("image/jpeg", MAX_COVER_BYTES));
    });

    expect(prepared.ok).toBe(true);
  });

  it("turns an undecodable format into advice, not a stack trace", async () => {
    // A HEIC picked on Android: the browser has no decoder, so the downscale throws. The message has
    // to name a way forward, because "failed" is not something a user can act on.
    downscale.mockRejectedValue(new Error("decode-failed"));
    const { result } = renderHook(() => usePlaylistCover("pl-1", false));

    let prepared!: Awaited<ReturnType<typeof result.current.prepare>>;
    await act(async () => {
      prepared = await result.current.prepare(fakeFile("image/heic", 3 * MB, "IMG_0042.HEIC"));
    });

    expect(prepared.ok).toBe(false);
    expect(prepared.error).toMatch(/JPEG|PNG|WebP/i);
  });

  it("lowers the busy flag even when preparing fails", async () => {
    // A stuck spinner over the cover with no way back is worse than the error itself.
    downscale.mockRejectedValue(new Error("decode-failed"));
    const { result } = renderHook(() => usePlaylistCover("pl-1", false));

    await act(async () => {
      await result.current.prepare(fakeFile("image/jpeg", 2 * MB));
    });

    expect(result.current.isPreparing).toBe(false);
  });
});

describe("the shared cover constants", () => {
  it("matches Alwyzon's byte ceiling", () => {
    // Alwyzon: `_MAX_COVER_BYTES = 15 * 1024 * 1024`. If these drift the client either rejects
    // uploads the server would have taken, or promises ones it will refuse.
    expect(MAX_COVER_BYTES).toBe(15 * 1024 * 1024);
  });

  it("stores a 500 px square", () => {
    // Comfortably above the largest place a cover is drawn (the desktop hero at 120 CSS px) even at
    // 3× device pixel ratio.
    expect(COVER_SIZE).toBe(500);
  });
});
