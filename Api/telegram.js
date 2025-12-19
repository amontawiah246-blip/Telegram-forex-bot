const axios = require('axios');

// ========== YOUR CREDENTIALS ==========
const DEEPSEEK_API_KEY = "sk-d1034c6b0feb497d9aeae0887bac7deb";
const TELEGRAM_TOKEN = "8174278161:AAHYh-6ksQmptsQ4OOK5aSvOGhB5h-vyYQk";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ========== SIMPLE FOREX DATA ==========
async function getForexPrice(pair) {
  try {
    const base = pair.substring(0, 3); // EUR, GBP, USD, etc
    const target = pair.substring(3);  // USD, JPY, CHF, etc
    
    const url = `https://api.exchangerate.host/latest?base=${base}&symbols=${target}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    if (response.data && response.data.rates) {
      return Object.values(response.data.rates)[0];
    }
  } catch (error) {
    console.log("Price API error, using fallback");
  }
  
  // Fallback prices
  const fallback = {
    "EURUSD": 1.0850, "GBPUSD": 1.2650, "USDJPY": 148.50,
    "USDCHF": 0.9050, "AUDUSD": 0.6550, "USDCAD": 1.3500,
    "NZDUSD": 0.6100, "EURJPY": 160.00, "GBPJPY": 187.00
  };
  
  return fallback[pair] || 1.0;
}

// ========== AI ANALYSIS ==========
async function analyzeWithAI(pair, timeframe, price) {
  try {
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [{
          role: "user",
          content: `Analyze ${pair} ${timeframe} at price ${price}. Give trading signal: BUY, SELL, or HOLD with entry, stop loss, take profit. Return as JSON with fields: signal, entry, stop_loss, take_profit, analysis`
        }],
        temperature: 0.3,
        max_tokens: 500
      },
      {
        headers: {
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );
    
    const content = response.data.choices[0].message.content;
    
    // Extract JSON
    try {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}') + 1;
      const jsonStr = content.substring(start, end);
      return JSON.parse(jsonStr);
    } catch {
      return {
        signal: "HOLD",
        entry: price.toFixed(5),
        stop_loss: (price * 0.998).toFixed(5),
        take_profit: (price * 1.002).toFixed(5),
        analysis: "Market analysis in progress"
      };
    }
  } catch (error) {
    console.log("AI analysis error:", error.message);
    return null;
  }
}

// ========== TELEGRAM FUNCTIONS ==========
async function sendMessage(chatId, text, keyboard = null) {
  try {
    const data = {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown"
    };
    
    if (keyboard) {
      data.reply_markup = { inline_keyboard: keyboard };
    }
    
    await axios.post(`${TELEGRAM_API}/sendMessage`, data, { timeout: 10000 });
    return true;
  } catch (error) {
    console.log("Send message error:", error.message);
    return false;
  }
}

// ========== BOT MENUS ==========
async function showMainMenu(chatId) {
  const keyboard = [
    [{ text: "📈 GET FOREX SIGNAL", callback_data: "show_pairs" }],
    [{ text: "📊 MARKET INFO", callback_data: "market_info" }],
    [{ text: "ℹ️ HELP", callback_data: "help_info" }]
  ];
  
  await sendMessage(
    chatId,
    `🤖 *FOREX AI SIGNAL BOT*\\n\\nI provide AI-powered forex trading signals based on real market analysis.\\n\\nClick *GET FOREX SIGNAL* to start!`,
    keyboard
  );
}

async function showPairSelection(chatId) {
  const pairs = [
    ["EUR/USD", "GBP/USD", "USD/JPY"],
    ["USD/CHF", "AUD/USD", "USD/CAD"],
    ["NZD/USD", "EUR/JPY", "GBP/JPY"]
  ];
  
  const keyboard = pairs.map(row =>
    row.map(pair => ({
      text: pair,
      callback_data: `pair_${pair.replace("/", "")}_1min`
    }))
  );
  
  keyboard.push([{ text: "🔙 BACK", callback_data: "main_menu" }]);
  
  await sendMessage(
    chatId,
    "📊 *Select Currency Pair:*\\n\\nChoose a pair to analyze:",
    keyboard
  );
}

async function showTimeframeSelection(chatId, pair) {
  const timeframes = [
    ["1 Minute", "5 Minutes", "15 Minutes"],
    ["30 Minutes", "1 Hour", "4 Hours"],
    ["1 Day", "1 Week"]
  ];
  
  const keyboard = timeframes.map(row =>
    row.map(tf => ({
      text: tf,
      callback_data: `signal_${pair}_${tf.toLowerCase().replace(" ", "")}`
    }))
  );
  
  keyboard.push([{ text: "🔙 BACK", callback_data: "show_pairs" }]);
  
  const pairName = pair.replace(/([A-Z]{3})([A-Z]{3})/, "$1/$2");
  
  await sendMessage(
    chatId,
    `Selected: *${pairName}*\\n\\n⏰ *Select Timeframe:*`,
    keyboard
  );
}

async function generateSignal(chatId, pair, timeframe) {
  const pairName = pair.replace(/([A-Z]{3})([A-Z]{3})/, "$1/$2");
  
  await sendMessage(
    chatId,
    `⏳ *Analyzing ${pairName} ${timeframe}...*\\n\\nFetching market data and AI analysis...`
  );
  
  // Get current price
  const price = await getForexPrice(pair);
  
  if (!price) {
    await sendMessage(chatId, "❌ Could not fetch market data. Please try again.");
    return;
  }
  
  // Analyze with AI
  const signal = await analyzeWithAI(pair, timeframe, price);
  
  if (!signal) {
    await sendMessage(chatId, "❌ AI analysis failed. Please try again.");
    return;
  }
  
  // Format signal
  const emoji = signal.signal === "BUY" ? "🟢" : signal.signal === "SELL" ? "🔴" : "🟡";
  
  const message = `
${emoji} *FOREX TRADING SIGNAL* ${emoji}
══════════════════════════

• *Pair:* \\\`${pairName}\\\`
• *Timeframe:* \\\`${timeframe}\\\`
• *Current Price:* \\\`${price.toFixed(5)}\\\`
• *Signal:* \\\`${signal.signal}\\\`

🎯 *TRADING LEVELS*
• Entry: \\\`${signal.entry}\\\`
• Stop Loss: \\\`${signal.stop_loss}\\\`
• Take Profit: \\\`${signal.take_profit}\\\`

📊 *ANALYSIS*
${signal.analysis}

══════════════════════════
🤖 *AI Forex Signal Bot*
  `;
  
  await sendMessage(chatId, message);
  await showMainMenu(chatId);
}

// ========== MAIN HANDLER ==========
module.exports = async (req, res) => {
  try {
    // Allow CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method === 'POST') {
      const update = req.body;
      
      // Handle webhook setup
      if (update.message && update.message.text === '/setwebhook') {
        const webhookUrl = `https://${req.headers.host}/api/telegram`;
        try {
          await axios.post(`${TELEGRAM_API}/setWebhook?url=${webhookUrl}`);
          return res.json({ ok: true, message: `Webhook set to ${webhookUrl}` });
        } catch (error) {
          return res.json({ ok: false, error: error.message });
        }
      }
      
      // Handle /start command
      if (update.message && update.message.text === '/start') {
        const chatId = update.message.chat.id;
        await showMainMenu(chatId);
        return res.json({ ok: true });
      }
      
      // Handle callback queries (button clicks)
      if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;
        
        // Answer callback query first
        try {
          await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
            callback_query_id: update.callback_query.id
          });
        } catch (error) {
          console.log("Answer callback error:", error.message);
        }
        
        // Handle different callback data
        if (data === 'main_menu' || data === 'back_to_menu') {
          await showMainMenu(chatId);
        }
        else if (data === 'show_pairs') {
          await showPairSelection(chatId);
        }
        else if (data === 'market_info') {
          await sendMessage(chatId, "📊 *Market Information*\\n\\n• Real-time forex analysis\\n• AI-powered signals\\n• Multiple timeframes\\n• 9 currency pairs available");
        }
        else if (data === 'help_info') {
          await sendMessage(chatId, "ℹ️ *Help*\\n\\n1. Click *GET FOREX SIGNAL*\\n2. Choose currency pair\\n3. Select timeframe\\n4. Get AI trading signal\\n\\n🤖 Bot updates automatically.");
        }
        else if (data.startsWith('pair_')) {
          // Format: pair_EURUSD_1min
          const parts = data.split('_');
          const pair = parts[1]; // EURUSD
          await showTimeframeSelection(chatId, pair);
        }
        else if (data.startsWith('signal_')) {
          // Format: signal_EURUSD_1minute
          const parts = data.split('_');
          const pair = parts[1]; // EURUSD
          const timeframe = parts[2]; // 1minute
          await generateSignal(chatId, pair, timeframe);
        }
        
        return res.json({ ok: true });
      }
      
      return res.json({ ok: true });
    }
    
    // GET request - show info
    return res.json({
      message: "🤖 Forex AI Telegram Bot",
      status: "Active",
      webhook: `Set to: https://${req.headers.host}/api/telegram`,
      endpoints: {
        telegram: "/api/telegram (POST)",
        info: "/api/telegram (GET)"
      }
    });
    
  } catch (error) {
    console.error("Bot error:", error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
