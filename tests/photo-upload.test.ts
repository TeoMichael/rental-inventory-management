import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { POST } from "../src/app/api/photos/route";

const MAX_BYTES = 8 * 1024 * 1024;
const PROJECT = "test-rental-project";
const ENDPOINT = "https://ik.imagekit.io/test-account";
const PRIVATE_KEY = "test-only-private-key";
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
type RecordData = Record<string, string | boolean>;
const state = {
  account: {} as Record<string, unknown>,
  documents: new Map<string, RecordData>(),
  requests: [] as { url: string; init: RequestInit }[],
  imageStatus: 200,
  imageOverrides: {} as Record<string, unknown>,
  documentStatus: 200,
  accountStatus: 200,
};

function token(overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: state.account.localId,
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    auth_time: now - 60,
    exp: now + 3600,
    ...overrides,
  };
  return `${Buffer.from('{"alg":"RS256"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.test-signature`;
}

function firestoreDocument(data: RecordData) {
  return {
    fields: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        typeof value === "boolean"
          ? { booleanValue: value }
          : { stringValue: value },
      ]),
    ),
  };
}

const fetchMock = vi.fn(
  async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    state.requests.push({ url, init });
    if (url.includes("/accounts:lookup")) {
      return Response.json(
        state.accountStatus === 200
          ? { users: [state.account] }
          : { error: "Invalid token" },
        { status: state.accountStatus },
      );
    }
    if (url.includes("/documents/")) {
      const path = url.split("/documents/")[1];
      const data = state.documents.get(path);
      return Response.json(data ? firestoreDocument(data) : {}, {
        status: data ? state.documentStatus : 404,
      });
    }
    if (url === "https://upload.imagekit.io/api/v1/files/upload") {
      const form = init.body as FormData;
      const path = `${form.get("folder")}/${form.get("fileName")}`;
      return Response.json(
        {
          fileId: "imagekit-file-123",
          filePath: path,
          url: `${ENDPOINT}${path}`,
          fileType: "image",
          size: (form.get("file") as Blob).size,
          ...state.imageOverrides,
        },
        { status: state.imageStatus },
      );
    }
    throw new Error(`Unexpected service URL: ${url}`);
  },
);

function request(
  options: {
    auth?: string | null;
    query?: string;
    mime?: string;
    name?: string;
    bytes?: Uint8Array<ArrayBuffer>;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers({
    "Content-Type": options.mime ?? "image/png",
    "x-file-name": options.name ?? encodeURIComponent("Sofa café.png"),
    ...options.headers,
  });
  if (options.auth !== null)
    headers.set("Authorization", options.auth ?? `Bearer ${token()}`);
  return new Request(
    `http://localhost:3000/api/photos?${options.query ?? "propertyId=property-1"}`,
    {
      method: "POST",
      headers,
      body: options.bytes ?? PNG,
    },
  );
}

function tenant() {
  state.account = {
    localId: "tenant-1",
    email: "tenant@example.com",
    emailVerified: true,
    validSince: "1",
  };
  state.documents.set("users/tenant-1", {
    id: "tenant-1",
    email: "tenant@example.com",
    role: "tenant",
  });
  state.documents.set("tenancies/tenancy-1", {
    id: "tenancy-1",
    propertyId: "property-1",
    ownerId: "owner-1",
    tenantEmail: "tenant@example.com",
    status: "Active",
    archived: false,
  });
}

function imageRequests() {
  return state.requests.filter((entry) =>
    entry.url.startsWith("https://upload.imagekit.io/"),
  );
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "test-api-key");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", PROJECT);
  vi.stubEnv("IMAGEKIT_PRIVATE_KEY", PRIVATE_KEY);
  vi.stubEnv("IMAGEKIT_URL_ENDPOINT", ENDPOINT);
  vi.stubEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATORS", "false");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  state.account = {
    localId: "owner-1",
    email: "owner@example.com",
    emailVerified: false,
    validSince: "1",
  };
  state.documents.clear();
  state.documents.set("users/owner-1", {
    id: "owner-1",
    email: "owner@example.com",
    role: "landlord",
  });
  state.documents.set("properties/property-1", {
    id: "property-1",
    ownerId: "owner-1",
    archived: false,
  });
  state.requests = [];
  state.imageStatus = 200;
  state.imageOverrides = {};
  state.documentStatus = 200;
  state.accountStatus = 200;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("photo upload authorization", () => {
  it("keeps credentials out of upstream failure diagnostics and responses", async () => {
    const bearer = token();
    const encodedKey = btoa(`${PRIVATE_KEY}:`);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(
      new Error(
        `Unsupported fetch: ${PRIVATE_KEY} ${encodedKey} Bearer ${bearer} https://upstream.example/private`,
      ),
    );
    const response = await POST(request({ auth: `Bearer ${bearer}` }));
    expect(response.status).toBe(503);
    const visible = JSON.stringify([await response.json(), warning.mock.calls]);
    for (const value of [PRIVATE_KEY, encodedKey, bearer, "upstream.example"])
      expect(visible).not.toContain(value);
    expect(visible).toContain("Unsupported fetch");
    expect(visible).toContain("[redacted]");
  });

  it("uses the Firebase user's bearer for rules-protected reads and returns only photo metadata", async () => {
    const bearer = token();
    const response = await POST(request({ auth: `Bearer ${bearer}` }));
    expect(response.status).toBe(200);
    const photo = await response.json();
    expect(photo.name).toBe("Sofa café.png");
    expect(Object.keys(photo).sort()).toEqual([
      "createdAt",
      "id",
      "name",
      "path",
      "url",
    ]);
    expect(photo.path).toBe(`properties/property-1/owner-1/${photo.id}`);
    expect(photo.url).toBe(`${ENDPOINT}/${photo.path}`);
    expect(photo.createdAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(photo)).not.toContain(PRIVATE_KEY);
    expect(JSON.stringify(photo)).not.toContain(bearer);
    for (const entry of state.requests.filter((entry) =>
      entry.url.includes("/documents/"),
    )) {
      expect(new Headers(entry.init.headers).get("Authorization")).toBe(
        `Bearer ${bearer}`,
      );
      expect(entry.init.cache).toBe("no-store");
    }
    const outgoing = imageRequests()[0];
    expect(new Headers(outgoing.init.headers).get("Authorization")).toBe(
      `Basic ${btoa(`${PRIVATE_KEY}:`)}`,
    );
    const form = outgoing.init.body as FormData;
    expect(form.get("folder")).toBe("/properties/property-1/owner-1");
    expect(form.get("fileName")).toBe(photo.id);
    expect(form.get("overwriteFile")).toBe("false");
    expect(form.get("useUniqueFileName")).toBe("false");
    expect(form.has("transformation")).toBe(false);
    expect(form.has("signature")).toBe(false);
  });

  it.each([null, "Bearer forged", "Basic fake"])(
    "rejects missing or malformed credentials %s",
    async (auth) => {
      expect((await POST(request({ auth }))).status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects a token rejected by Firebase", async () => {
    state.accountStatus = 400;
    expect((await POST(request())).status).toBe(401);
    expect(state.requests).toHaveLength(1);
  });

  it.each(["disabled", "revoked", "expired", "wrong-project", "wrong-user"])(
    "rejects %s sessions",
    async (caseName) => {
      const claims: Record<string, unknown> = {};
      if (caseName === "disabled") state.account.disabled = true;
      if (caseName === "revoked")
        state.account.validSince = String(Math.floor(Date.now() / 1000));
      if (caseName === "expired")
        claims.exp = Math.floor(Date.now() / 1000) - 1;
      if (caseName === "wrong-project") claims.aud = "other-project";
      if (caseName === "wrong-user") claims.sub = "other-user";
      expect(
        (await POST(request({ auth: `Bearer ${token(claims)}` }))).status,
      ).toBe(401);
      expect(imageRequests()).toHaveLength(0);
    },
  );

  it.each(["different-owner", "archived", "rules-denied", "role-escalation"])(
    "denies property access: %s",
    async (caseName) => {
      if (caseName === "different-owner")
        state.documents.get("properties/property-1")!.ownerId = "other-owner";
      if (caseName === "archived")
        state.documents.get("properties/property-1")!.archived = true;
      if (caseName === "rules-denied") state.documentStatus = 403;
      if (caseName === "role-escalation")
        state.documents.get("users/owner-1")!.role = "administrator";
      expect((await POST(request())).status).toBe(403);
      expect(imageRequests()).toHaveLength(0);
    },
  );

  it("permits a verified tenant with an active matching tenancy", async () => {
    tenant();
    const response = await POST(
      request({ query: "propertyId=property-1&tenancyId=tenancy-1" }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).path).toContain(
      "properties/property-1/tenant-1/",
    );
  });

  it.each([
    "unverified",
    "missing-tenancy",
    "Upcoming",
    "Completed",
    "Cancelled",
    "archived",
    "wrong-property",
    "wrong-owner",
    "wrong-email",
    "profile-email",
  ])("denies tenant upload: %s", async (caseName) => {
    tenant();
    const tenancy = state.documents.get("tenancies/tenancy-1")!;
    if (caseName === "unverified") state.account.emailVerified = false;
    if (["Upcoming", "Completed", "Cancelled"].includes(caseName))
      tenancy.status = caseName;
    if (caseName === "archived") tenancy.archived = true;
    if (caseName === "wrong-property") tenancy.propertyId = "property-2";
    if (caseName === "wrong-owner") tenancy.ownerId = "owner-2";
    if (caseName === "wrong-email") tenancy.tenantEmail = "other@example.com";
    if (caseName === "profile-email")
      state.documents.get("users/tenant-1")!.email = "other@example.com";
    const query =
      caseName === "missing-tenancy"
        ? "propertyId=property-1"
        : "propertyId=property-1&tenancyId=tenancy-1";
    expect((await POST(request({ query }))).status).toBe(403);
    expect(imageRequests()).toHaveLength(0);
  });

  it("uses fixed local emulators only when explicitly enabled outside production", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATORS", "true");
    expect((await POST(request())).status).toBe(200);
    expect(state.requests[0].url).toMatch(/^http:\/\/127\.0\.0\.1:9099\//);
    expect(state.requests[1].url).toMatch(/^http:\/\/127\.0\.0\.1:8080\//);
    vi.stubEnv("NODE_ENV", "production");
    const count = state.requests.length;
    expect((await POST(request())).status).toBe(503);
    expect(state.requests).toHaveLength(count);
  });
});

describe("binary upload boundaries and retention", () => {
  it.each([
    ["image/png", PNG],
    ["image/jpeg", new Uint8Array([255, 216, 255, 224, 0, 1])],
    [
      "image/webp",
      new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]),
    ],
  ])("accepts supported %s signatures", async (mime, bytes) => {
    expect((await POST(request({ mime, bytes }))).status).toBe(200);
  });

  it("accepts exactly 8 MiB", async () => {
    const bytes = new Uint8Array(MAX_BYTES);
    bytes.set(PNG);
    expect((await POST(request({ bytes }))).status).toBe(200);
    expect(
      ((imageRequests()[0].init.body as FormData).get("file") as Blob).size,
    ).toBe(MAX_BYTES);
  });

  it("rejects an oversized stream without Content-Length before ImageKit receives bytes", async () => {
    let cancelled = false;
    const bytes = new Uint8Array(MAX_BYTES);
    bytes.set(PNG);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled = true;
      },
    });
    const normal = request();
    const streamed = new Request(normal.url, {
      method: "POST",
      headers: normal.headers,
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect((await POST(streamed)).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(imageRequests()).toHaveLength(0);
  });

  it.each([
    { bytes: new Uint8Array(), status: 400 },
    { bytes: new Uint8Array([60, 115, 118, 103, 62]), status: 400 },
    { mime: "image/svg+xml", status: 400 },
    { mime: "image/jpeg", status: 400 },
    { name: "%not-encoded", status: 400 },
    { name: encodeURIComponent("bad\nname.png"), status: 400 },
    { query: "propertyId=../other", status: 400 },
    {
      query: "propertyId=property-1&folder=other-owner&overwriteFile=true",
      status: 400,
    },
    { query: "propertyId=property-1&propertyId=property-2", status: 400 },
    { headers: { "Content-Length": String(MAX_BYTES + 1) }, status: 413 },
  ])(
    "rejects invalid request %# before saving an image",
    async ({ status, ...options }) => {
      expect((await POST(request(options))).status).toBe(status);
      expect(imageRequests()).toHaveLength(0);
    },
  );

  it.each([429, 500])(
    "sanitizes ImageKit failure %s and performs no cleanup/deletion",
    async (status) => {
      state.imageStatus = status;
      state.imageOverrides = { error: `Private credential ${PRIVATE_KEY}` };
      const response = await POST(request());
      expect(response.status).toBe(502);
      const body = await response.json();
      expect(Object.keys(body)).toEqual(["error"]);
      expect(JSON.stringify(body)).not.toContain(PRIVATE_KEY);
      expect(imageRequests()).toHaveLength(1);
      expect(
        state.requests.some((entry) => entry.init.method === "DELETE"),
      ).toBe(false);
    },
  );

  it.each([
    { filePath: "/properties/other-owner/existing-photo" },
    { url: "https://another.example.com/photo" },
    { fileId: "" },
    { fileId: " \t\r\n" },
    { fileType: "non-image" },
    { size: PNG.byteLength + 1 },
  ])(
    "rejects inconsistent provider metadata %# while retaining the uploaded bytes",
    async (overrides) => {
      state.imageOverrides = overrides;
      const response = await POST(request());
      expect(response.status).toBe(502);
      expect((await response.json()).error).toContain("retained");
      expect(imageRequests()).toHaveLength(1);
    },
  );

  it("fails closed when the private server configuration is missing", async () => {
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "");
    expect((await POST(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sanitizes account-service transport errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error(`Sensitive ${PRIVATE_KEY}`));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(PRIVATE_KEY);
    expect(imageRequests()).toHaveLength(0);
  });
});
