import { assertConfig } from "./config.js";
import { query, closeDb } from "./db.js";
import { schemaSql } from "./schema.js";

assertConfig();
await query(schemaSql);
await closeDb();
console.log("HumbleTrust backend schema is ready.");
