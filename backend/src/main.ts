import { Connection } from "@solana/web3.js";
import { assertConfig, config } from "./config.js";
import { query } from "./db.js";
import { schemaSql } from "./schema.js";
import { createServer } from "./server.js";
import { startHumbleTrustIndexer, startRaydiumIndexer } from "./indexer.js";

assertConfig();
await query(schemaSql);

const connection = new Connection(config.solanaRpcHttp, {
  commitment: "confirmed",
  wsEndpoint: config.solanaRpcWs,
});

startHumbleTrustIndexer(connection);
startRaydiumIndexer(connection);

const { server } = createServer();
server.listen(config.port, () => {
  console.log(`HumbleTrust backend listening on :${config.port} (${config.network})`);
});
