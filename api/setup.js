module.exports = (req, res) => {
  res.json({
    ok: true,
    message: "Schema is managed via Supabase dashboard SQL editor",
  });
};
