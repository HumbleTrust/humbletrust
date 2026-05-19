import { BorshEventCoder, Idl } from "@coral-xyz/anchor";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidateIdls = [
  path.resolve(__dirname, "../../target/idl/humbletrust_v2.json"),
  path.resolve(__dirname, "../../app/src/lib/idl_v2.json"),
];

export const loadIdl = (): Idl => {
  const found = candidateIdls.find((file) => fs.existsSync(file));
  if (!found) throw new Error("Cannot find humbletrust_v2 IDL.");
  return JSON.parse(fs.readFileSync(found, "utf8")) as Idl;
};

export const idl = loadIdl();
const eventCoder = new BorshEventCoder(idl);

export interface DecodedAnchorEvent {
  name: string;
  data: Record<string, unknown>;
}

const EVENT_PREFIX = "Program data: ";

export const parseAnchorEvents = (logs: string[]): DecodedAnchorEvent[] => {
  const events: DecodedAnchorEvent[] = [];
  for (const log of logs) {
    if (!log.startsWith(EVENT_PREFIX)) continue;
    const raw = log.slice(EVENT_PREFIX.length);
    const decoded = eventCoder.decode(raw);
    if (decoded) {
      events.push({ name: decoded.name, data: decoded.data as Record<string, unknown> });
    }
  }
  return events;
};

export const toBase58 = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof (value as { toBase58?: unknown }).toBase58 === "function") {
    return (value as { toBase58: () => string }).toBase58();
  }
  return String(value);
};

export const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value && typeof (value as { toString?: unknown }).toString === "function") {
    return Number((value as { toString: () => string }).toString());
  }
  return 0;
};
