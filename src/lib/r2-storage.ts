import "server-only";
import { createHash, createHmac } from "node:crypto";
import { getR2Env, hasR2VideoStorage } from "@/lib/env";

type Method = "GET" | "HEAD" | "PUT" | "DELETE";

function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodePath(key: string) {
  return key.split("/").map(encode).join("/");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function timestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

export function createR2PresignedUrl(method: Method, key: string, expiresSeconds = 600, now = new Date()) {
  const config = getR2Env();
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encode(config.bucketName)}/${encodePath(key)}`;
  const amzDate = timestamp(now);
  const date = amzDate.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;

  const query = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(Math.max(1, Math.min(604800, expiresSeconds)))],
    ["X-Amz-SignedHeaders", "host"],
  ] as const;

  const canonicalQuery = [...query]
    .map(([name, value]) => [encode(name), encode(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  const dateKey = hmac(`AWS4${config.secretAccessKey}`, date);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function inspectR2Object(key: string) {
  if (!hasR2VideoStorage()) return { exists: false as const };
  const response = await fetch(createR2PresignedUrl("HEAD", key, 120), { method: "HEAD", redirect: "manual" });
  if (response.status === 404) return { exists: false as const };
  if (!response.ok) throw new Error(`R2 HEAD failed with HTTP ${response.status}`);
  return {
    exists: true as const,
    size: Number(response.headers.get("content-length") ?? 0),
    contentType: response.headers.get("content-type") ?? undefined,
  };
}

export async function deleteR2Object(key: string) {
  if (!hasR2VideoStorage()) return;
  const response = await fetch(createR2PresignedUrl("DELETE", key, 120), { method: "DELETE", redirect: "manual" });
  if (!response.ok && response.status !== 404) throw new Error(`R2 DELETE failed with HTTP ${response.status}`);
}
