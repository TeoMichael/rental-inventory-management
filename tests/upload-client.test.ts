import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Photo, Profile } from "../src/lib/types";
import { deletePhoto, uploadPhotos } from "../src/lib/repository";

const state = vi.hoisted(() => ({
  user: {
    uid: "owner-1",
    email: "owner@example.com",
    emailVerified: true,
    getIdToken: vi.fn(),
  },
  property: { id: "property-1", ownerId: "owner-1", archived: false },
  tenancies: [] as { id: string; data: () => Record<string, unknown> }[],
}));
vi.mock("../src/lib/firebase", () => ({
  getFirebase: () => ({ auth: { currentUser: state.user }, db: {} }),
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, collection: string, id: string) => ({
    id,
    path: `${collection}/${id}`,
  }),
  getDoc: async () => ({
    id: "property-1",
    exists: () => true,
    data: () => state.property,
  }),
  getDocs: async () => ({ docs: state.tenancies }),
  query: vi.fn(),
  where: vi.fn(),
  runTransaction: vi.fn(),
}));

const profile: Profile = {
  id: "owner-1",
  name: "Owner",
  email: "owner@example.com",
  role: "landlord",
  createdAt: "2026-10-09T00:00:00.000Z",
};
const files = [
  new File(["photo one"], "sofa front.png", { type: "image/png" }),
  new File(["photo two"], "sofa back.png", { type: "image/png" }),
];
function photo(index: number): Photo {
  return {
    id: `photo-${index}`,
    name: files[index].name,
    path: `properties/property-1/${state.user.uid}/photo-${index}`,
    url: `https://ik.imagekit.io/test/photo-${index}`,
    createdAt: "2026-10-09T00:00:00.000Z",
  };
}
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  state.user.uid = "owner-1";
  state.user.email = "owner@example.com";
  state.user.emailVerified = true;
  state.user.getIdToken.mockReset().mockResolvedValue("current-firebase-token");
  state.property = { id: "property-1", ownerId: "owner-1", archived: false };
  state.tenancies = [];
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("photo repository integration", () => {
  it("uploads multiple raw files sequentially with the current session and preserves photo metadata", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(photo(0)))
      .mockResolvedValueOnce(Response.json(photo(1)));
    expect(await uploadPhotos(profile, "property-1", files)).toEqual([
      photo(0),
      photo(1),
    ]);
    expect(state.user.getIdToken).toHaveBeenCalledTimes(2);
    files.forEach((file, index) => {
      const [url, request] = fetchMock.mock.calls[index];
      expect(url).toBe("/api/photos?propertyId=property-1");
      expect(request?.body).toBe(file);
      expect(request?.headers).toEqual({
        Authorization: "Bearer current-firebase-token",
        "Content-Type": file.type,
        "X-File-Name": encodeURIComponent(file.name),
      });
    });
  });

  it("rejects another landlord's property before contacting the upload endpoint", async () => {
    state.property.ownerId = "owner-2";
    await expect(uploadPhotos(profile, "property-1", files)).rejects.toThrow(
      "permission",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the verified tenant's active tenancy to the trusted endpoint", async () => {
    state.user.uid = "tenant-1";
    state.user.email = "tenant@example.com";
    state.tenancies = [
      {
        id: "tenancy-active",
        data: () => ({
          propertyId: "property-1",
          status: "Active",
          archived: false,
        }),
      },
    ];
    fetchMock.mockResolvedValueOnce(Response.json(photo(0)));
    await uploadPhotos(
      { ...profile, id: "tenant-1", role: "tenant", email: state.user.email },
      "property-1",
      [files[0]],
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/photos?propertyId=property-1&tenancyId=tenancy-active",
    );
  });

  it("fails before uploading for an unverified tenant", async () => {
    state.user.emailVerified = false;
    await expect(
      uploadPhotos({ ...profile, role: "tenant" }, "property-1", files),
    ).rejects.toThrow("Verify your email");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports retained unattached files when a later upload fails", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(photo(0)))
      .mockResolvedValueOnce(
        Response.json({ error: "Photo service unavailable" }, { status: 502 }),
      );
    await expect(uploadPhotos(profile, "property-1", files)).rejects.toThrow(
      "Uploaded files were retained but were not attached",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects an endpoint response from a different property", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        ...photo(0),
        path: "properties/property-2/owner-1/photo-0",
      }),
    );
    await expect(
      uploadPhotos(profile, "property-1", [files[0]]),
    ).rejects.toThrow("Photos must belong to this property");
  });

  it("retains image bytes when photo metadata is removed", async () => {
    await deletePhoto(profile, photo(0));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
