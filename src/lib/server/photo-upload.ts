import "server-only";
import type { Photo } from "../types";

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type MimeType = (typeof MIME_TYPES)[number];
type JsonObject = Record<string, unknown>;
type Configuration = {
  apiKey: string;
  projectId: string;
  privateKey: string;
  urlEndpoint: string;
  authBase: string;
  firestoreBase: string;
};

class UploadError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function configuration(): Configuration {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  const emulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
  if (
    !apiKey ||
    !projectId ||
    !privateKey ||
    !endpoint ||
    !/^[a-z0-9-]{6,63}$/.test(projectId) ||
    (emulator && process.env.NODE_ENV === "production")
  ) {
    throw new UploadError(503, "Photo uploads are not configured.");
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new UploadError(503, "Photo uploads are not configured.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new UploadError(503, "Photo uploads are not configured.");
  }
  return {
    apiKey,
    projectId,
    privateKey,
    urlEndpoint: url.href.replace(/\/$/, ""),
    authBase: emulator
      ? "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
      : "https://identitytoolkit.googleapis.com/v1",
    firestoreBase: emulator
      ? "http://127.0.0.1:8080/v1"
      : "https://firestore.googleapis.com/v1",
  };
}

async function fetchService(
  url: string,
  init: RequestInit,
  provider: "firebase" | "imagekit",
) {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    // Workers supports manual redirects. Reject them before any credential can
    // be forwarded to another origin, matching the Node redirect-error policy.
    if (response.status >= 300 && response.status < 400)
      throw new Error("Upstream redirects are not allowed.");
    if (response.status >= 500)
      console.warn("Photo upstream response failed", {
        provider,
        status: response.status,
      });
    return response;
  } catch (error) {
    let detail = error instanceof Error ? error.message : "Unknown fetch error";
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const authorization = new Headers(init.headers).get("Authorization");
    let idToken: unknown;
    if (typeof init.body === "string") {
      try {
        idToken = object(JSON.parse(init.body)).idToken;
      } catch {}
    }
    for (const value of [
      privateKey,
      privateKey ? btoa(`${privateKey}:`) : undefined,
      authorization,
      authorization?.replace(/^(Bearer|Basic) /, ""),
      idToken,
    ]) {
      if (typeof value === "string" && value)
        detail = detail.replaceAll(value, "[redacted]");
    }
    detail = detail
      .replace(/https?:\/\/\S+/g, "[upstream URL]")
      .replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "[redacted]",
      )
      .slice(0, 240);
    console.warn("Photo upstream request failed", { provider, detail });
    throw new UploadError(
      provider === "imagekit" ? 502 : 503,
      provider === "imagekit"
        ? "The photo service is unavailable. Please retry."
        : "Account verification is unavailable. Please retry.",
    );
  }
}

async function responseObject(
  response: Response,
  status: number,
  message: string,
): Promise<JsonObject> {
  try {
    return object(await response.json());
  } catch {
    throw new UploadError(status, message);
  }
}

function authenticatedClaims(
  token: string,
  account: JsonObject,
  config: Configuration,
) {
  // Google has already authenticated this exact token. Decoding here only checks
  // project/session restrictions; decoded claims alone never authorize a request.
  let claims: JsonObject;
  try {
    const segment = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(
      segment.padEnd(Math.ceil(segment.length / 4) * 4, "="),
    );
    claims = object(
      JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(decoded, (character) => character.charCodeAt(0)),
        ),
      ),
    );
  } catch {
    throw new UploadError(401, "Please sign in again before uploading photos.");
  }
  const seconds = Math.floor(Date.now() / 1000);
  const validSince =
    account.validSince === undefined ? 0 : Number(account.validSince);
  if (
    account.disabled === true ||
    typeof account.localId !== "string" ||
    !ID_PATTERN.test(account.localId) ||
    claims.sub !== account.localId ||
    claims.aud !== config.projectId ||
    claims.iss !== `https://securetoken.google.com/${config.projectId}` ||
    typeof claims.exp !== "number" ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= seconds ||
    typeof claims.auth_time !== "number" ||
    !Number.isFinite(claims.auth_time) ||
    claims.auth_time > seconds + 300 ||
    claims.auth_time <= 0 ||
    !Number.isFinite(validSince) ||
    claims.auth_time < validSince ||
    typeof account.email !== "string" ||
    !account.email
  ) {
    throw new UploadError(401, "Please sign in again before uploading photos.");
  }
  return {
    uid: account.localId,
    email: account.email,
    verified: account.emailVerified === true,
  };
}

async function accountFor(token: string, config: Configuration) {
  const response = await fetchService(
    `${config.authBase}/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
    "firebase",
  );
  if ([400, 401, 403].includes(response.status))
    throw new UploadError(401, "Please sign in again before uploading photos.");
  if (!response.ok)
    throw new UploadError(
      503,
      "Account verification is unavailable. Please retry.",
    );
  const payload = await responseObject(
    response,
    503,
    "Account verification is unavailable. Please retry.",
  );
  if (!Array.isArray(payload.users) || payload.users.length !== 1)
    throw new UploadError(401, "Please sign in again before uploading photos.");
  return authenticatedClaims(token, object(payload.users[0]), config);
}

async function readDocument(
  collection: string,
  id: string,
  token: string,
  config: Configuration,
) {
  // A user's ID token keeps every read subject to the existing Firestore rules.
  const response = await fetchService(
    `${config.firestoreBase}/projects/${config.projectId}/databases/(default)/documents/${collection}/${id}`,
    { headers: { Authorization: `Bearer ${token}` } },
    "firebase",
  );
  if (response.status === 401)
    throw new UploadError(401, "Please sign in again before uploading photos.");
  if ([403, 404].includes(response.status))
    throw new UploadError(
      403,
      "You do not have permission to upload photos here.",
    );
  if (!response.ok)
    throw new UploadError(
      503,
      "Account verification is unavailable. Please retry.",
    );
  return object(
    (
      await responseObject(
        response,
        503,
        "Account verification is unavailable. Please retry.",
      )
    ).fields,
  );
}

function stringField(fields: JsonObject, name: string): string | undefined {
  const value = object(fields[name]).stringValue;
  return typeof value === "string" ? value : undefined;
}
function booleanField(fields: JsonObject, name: string): boolean | undefined {
  const value = object(fields[name]).booleanValue;
  return typeof value === "boolean" ? value : undefined;
}

async function authorize(
  propertyId: string,
  tenancyId: string | null,
  token: string,
  config: Configuration,
) {
  const account = await accountFor(token, config);
  const profile = await readDocument("users", account.uid, token, config);
  const role = stringField(profile, "role");
  if (
    stringField(profile, "id") !== account.uid ||
    stringField(profile, "email") !== account.email ||
    !["landlord", "tenant"].includes(role ?? "") ||
    (role === "tenant" && !account.verified)
  ) {
    throw new UploadError(403, "Your account cannot upload photos here.");
  }
  const property = await readDocument("properties", propertyId, token, config);
  const ownerId = stringField(property, "ownerId");
  if (
    stringField(property, "id") !== propertyId ||
    booleanField(property, "archived") !== false ||
    !ownerId
  ) {
    throw new UploadError(
      403,
      "This property is unavailable for photo uploads.",
    );
  }
  if (role === "landlord") {
    if (ownerId !== account.uid)
      throw new UploadError(
        403,
        "You do not have permission to upload photos here.",
      );
  } else {
    if (!tenancyId)
      throw new UploadError(
        403,
        "An active tenancy is required to upload photos.",
      );
    const tenancy = await readDocument("tenancies", tenancyId, token, config);
    if (
      stringField(tenancy, "id") !== tenancyId ||
      stringField(tenancy, "propertyId") !== propertyId ||
      stringField(tenancy, "ownerId") !== ownerId ||
      stringField(tenancy, "tenantEmail") !== account.email ||
      stringField(tenancy, "status") !== "Active" ||
      booleanField(tenancy, "archived") !== false
    ) {
      throw new UploadError(
        403,
        "An active tenancy is required to upload photos.",
      );
    }
  }
  return account.uid;
}

function imageMime(header: Uint8Array, length: number): MimeType | undefined {
  if (
    length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  )
    return "image/jpeg";
  if (
    length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => header[index] === value,
    )
  )
    return "image/png";
  if (
    length >= 12 &&
    header[0] === 82 &&
    header[1] === 73 &&
    header[2] === 70 &&
    header[3] === 70 &&
    header[8] === 87 &&
    header[9] === 69 &&
    header[10] === 66 &&
    header[11] === 80
  )
    return "image/webp";
}

async function readPhoto(request: Request, mime: MimeType) {
  const declaredSize = request.headers.get("Content-Length");
  if (
    declaredSize !== null &&
    (!/^\d+$/.test(declaredSize) || !Number.isSafeInteger(Number(declaredSize)))
  )
    throw new UploadError(400, "The photo request is invalid.");
  if (declaredSize !== null && Number(declaredSize) > MAX_BYTES)
    throw new UploadError(413, "Each photo must be no larger than 8 MB.");
  if (!request.body) throw new UploadError(400, "Choose a nonempty photo.");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const header = new Uint8Array(12);
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > MAX_BYTES - total) {
        await reader.cancel().catch(() => undefined);
        throw new UploadError(413, "Each photo must be no larger than 8 MB.");
      }
      if (total < header.length)
        header.set(value.subarray(0, header.length - total), total);
      total += value.byteLength;
      chunks.push(new Uint8Array(value));
    }
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError(400, "The photo could not be read. Please retry.");
  } finally {
    reader.releaseLock();
  }
  if (!total) throw new UploadError(400, "Choose a nonempty photo.");
  if (imageMime(header, total) !== mime)
    throw new UploadError(
      400,
      "Photos must be JPEG, PNG, or WebP images matching their file type.",
    );
  return { chunks, size: total };
}

function multipartPhoto(
  file: { chunks: Uint8Array<ArrayBuffer>[]; size: number },
  mime: MimeType,
  id: string,
  folder: string,
) {
  const boundary = `keyline-${crypto.randomUUID()}`;
  const encode = new TextEncoder();
  const start = encode.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${id}"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const values = {
    fileName: id,
    folder,
    useUniqueFileName: "false",
    overwriteFile: "false",
  };
  const end = encode.encode(
    "\r\n" +
      Object.entries(values)
        .map(
          ([name, value]) =>
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        )
        .join("") +
      `--${boundary}--\r\n`,
  );
  // The complete bounded file was validated before constructing this stream.
  // Reuse those bytes instead of serializing a Blob through FormData again.
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(start);
      for (const chunk of file.chunks) controller.enqueue(chunk);
      controller.enqueue(end);
      controller.close();
    },
  });
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
    length: start.byteLength + file.size + end.byteLength,
  };
}

async function uploadPhoto(request: Request): Promise<Photo> {
  const authorization = request.headers.get("Authorization") ?? "";
  if (
    authorization.length > 16_384 ||
    !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(
      authorization,
    )
  )
    throw new UploadError(401, "Please sign in before uploading photos.");
  const parameters = new URL(request.url).searchParams;
  const propertyId = parameters.get("propertyId");
  const tenancyId = parameters.get("tenancyId");
  if (
    !propertyId ||
    !ID_PATTERN.test(propertyId) ||
    (tenancyId !== null && !ID_PATTERN.test(tenancyId)) ||
    parameters.getAll("propertyId").length !== 1 ||
    parameters.getAll("tenancyId").length > 1 ||
    [...parameters.keys()].some(
      (key) => key !== "propertyId" && key !== "tenancyId",
    )
  )
    throw new UploadError(400, "Choose a valid property for the photo.");
  let name: string;
  try {
    const encoded = request.headers.get("x-file-name") ?? "";
    if (encoded.length > 3_000) throw new Error();
    name = decodeURIComponent(encoded).trim();
  } catch {
    throw new UploadError(400, "The photo filename is invalid.");
  }
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name))
    throw new UploadError(
      400,
      "Use a photo filename of 255 characters or fewer.",
    );
  const mime = request.headers.get("Content-Type")?.trim().toLowerCase();
  if (!MIME_TYPES.includes(mime as MimeType))
    throw new UploadError(400, "Photos must be JPEG, PNG, or WebP images.");
  const config = configuration();
  const uid = await authorize(
    propertyId,
    tenancyId,
    authorization.slice(7),
    config,
  );
  const file = await readPhoto(request, mime as MimeType);
  const id = crypto.randomUUID();
  const path = `properties/${propertyId}/${uid}/${id}`;
  const multipart = multipartPhoto(
    file,
    mime as MimeType,
    id,
    `/properties/${propertyId}/${uid}`,
  );
  const uploadRequest: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${config.privateKey}:`)}`,
      "Content-Type": multipart.contentType,
      "Content-Length": String(multipart.length),
    },
    body: multipart.body,
    // Node requires this for stream bodies; Workers accepts the same request.
    duplex: "half",
  };
  const response = await fetchService(
    IMAGEKIT_UPLOAD_URL,
    uploadRequest,
    "imagekit",
  );
  if (!response.ok)
    throw new UploadError(
      502,
      "The photo service could not save this photo. Please retry later.",
    );
  const saved = await responseObject(
    response,
    502,
    "The photo service returned an invalid response.",
  );
  const canonicalUrl = `${config.urlEndpoint}/${path}`;
  if (
    typeof saved.fileId !== "string" ||
    !saved.fileId.trim() ||
    saved.fileId.length > 128 ||
    saved.filePath !== `/${path}` ||
    saved.url !== canonicalUrl ||
    saved.fileType !== "image" ||
    saved.size !== file.size ||
    canonicalUrl.length > 2048
  ) {
    throw new UploadError(
      502,
      "The photo service returned an invalid response. The upload was retained; please retry.",
    );
  }
  // The MVP uses URL/path identity and retains originals. Keep its existing
  // metadata shape so ten-photo records fit Firestore's rules evaluation budget.
  return {
    id,
    path,
    name,
    url: canonicalUrl,
    createdAt: new Date().toISOString(),
  };
}

export async function handlePhotoUpload(request: Request): Promise<Response> {
  try {
    return Response.json(await uploadPhoto(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const failure =
      error instanceof UploadError
        ? error
        : new UploadError(503, "Photo uploads are unavailable. Please retry.");
    return Response.json(
      { error: failure.message },
      { status: failure.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
