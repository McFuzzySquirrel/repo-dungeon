import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const STORE_FILE = 'secure-storage.json';

type StoreShape = Record<string, string>;

function getStorePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE);
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf-8');
    return JSON.parse(raw) as StoreShape;
  } catch {
    return {};
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getStorePath(), JSON.stringify(store), { encoding: 'utf-8', mode: 0o600 });
}

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }
  return safeStorage.encryptString(value).toString('base64');
}

function decrypt(value: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }

  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return null;
  }
}

export async function getSecureStorageItem(key: string): Promise<string | null> {
  const store = await readStore();
  const value = store[key];
  if (!value) {
    return null;
  }
  return decrypt(value);
}

export async function setSecureStorageItem(key: string, value: string): Promise<void> {
  const store = await readStore();
  store[key] = encrypt(value);
  await writeStore(store);
}

export async function removeSecureStorageItem(key: string): Promise<void> {
  const store = await readStore();
  delete store[key];
  await writeStore(store);
}
