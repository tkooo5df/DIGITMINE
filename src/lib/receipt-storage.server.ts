import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
  region: string;
  publicBaseUrl?: string;
  forcePathStyle: boolean;
};

type UploadTargetInput = {
  objectKey: string;
  contentType?: string;
};

type BuildObjectKeyInput = {
  userId: string;
  orderId: string;
  fileName: string;
};

let storageClient: S3Client | undefined;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing storage environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string) {
  return process.env[name] || undefined;
}

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function encodeObjectKey(objectKey: string) {
  return objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getStorageConfig(): StorageConfig {
  return {
    accessKeyId: getRequiredEnv("RECEIPTS_S3_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("RECEIPTS_S3_SECRET_ACCESS_KEY"),
    bucket: getRequiredEnv("RECEIPTS_S3_BUCKET"),
    endpoint: getOptionalEnv("RECEIPTS_S3_ENDPOINT"),
    region: process.env.RECEIPTS_S3_REGION || "auto",
    publicBaseUrl: getOptionalEnv("RECEIPTS_PUBLIC_BASE_URL"),
    forcePathStyle: process.env.RECEIPTS_S3_FORCE_PATH_STYLE === "true",
  };
}

function getStorageClient() {
  if (!storageClient) {
    const config = getStorageConfig();
    storageClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint ? normalizeUrl(config.endpoint) : undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return storageClient;
}

function sanitizeExtension(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  return ext.replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
}

export function buildReceiptObjectKey({ userId, orderId, fileName }: BuildObjectKeyInput) {
  const extension = sanitizeExtension(fileName);
  return `receipts/${userId}/${orderId}-${Date.now()}.${extension}`;
}

export async function getReceiptAccessUrl(objectKey: string, expiresIn = 60 * 60 * 24) {
  const config = getStorageConfig();

  if (config.publicBaseUrl) {
    return `${trimTrailingSlash(normalizeUrl(config.publicBaseUrl))}/${encodeObjectKey(objectKey)}`;
  }

  const client = getStorageClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
    { expiresIn },
  );
}

export async function createReceiptUploadTarget({ objectKey, contentType }: UploadTargetInput) {
  const config = getStorageConfig();
  const client = getStorageClient();

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ContentType: contentType || "application/octet-stream",
    }),
    { expiresIn: 60 * 15 },
  );

  const viewUrl = await getReceiptAccessUrl(objectKey, 60 * 60 * 24 * 30);

  return {
    bucket: config.bucket,
    objectKey,
    uploadUrl,
    viewUrl,
  };
}

export async function uploadReceiptBytes(args: {
  body: ArrayBuffer | Uint8Array;
  objectKey: string;
  contentType?: string;
}) {
  const config = getStorageConfig();
  const client = getStorageClient();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: args.objectKey,
      Body: args.body instanceof Uint8Array ? args.body : new Uint8Array(args.body),
      ContentType: args.contentType || "application/octet-stream",
    }),
  );
}

export async function deleteReceiptObjects(objectKeys: string[]) {
  const filteredKeys = objectKeys.filter(Boolean);
  if (!filteredKeys.length) return;

  const config = getStorageConfig();
  const client = getStorageClient();

  await client.send(
    new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: {
        Objects: filteredKeys.map((Key) => ({ Key })),
      },
    }),
  );
}

