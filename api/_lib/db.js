const { createClient } = require("@supabase/supabase-js");

let client;
const getClient = () => {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return client;
};

module.exports = { getClient };
