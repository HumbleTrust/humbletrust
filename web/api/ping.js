module.exports = (req, res) => {
  res.json({ pong: true, ts: Date.now() });
};
