// SIMPLE TELEGRAM FOREX BOT
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const update = req.body;
    
    // Handle /start command
    if (update.message && update.message.text === '/start') {
      // We'll add Telegram API later
      return res.json({ ok: true, message: "Bot received /start" });
    }
    
    return res.json({ ok: true });
  }
  
  // GET request shows info
  return res.json({
    message: "🤖 Forex AI Bot Webhook",
    status: "Ready for setup",
    instructions: "1. Deploy to Vercel 2. Set webhook 3. Message /start to bot"
  });
};
