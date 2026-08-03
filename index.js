/**
 * index.js - Entry Point
 * Zalo Bot Chấm Công & Quản Lý Ca Làm Việc
 * ==========================================
 * Khởi động Express server, đăng ký routes,
 * và lắng nghe webhook từ Zalo.
 */

'use strict';

// Load biến môi trường từ .env (local dev)
require('dotenv').config();

const express    = require('express');
const bodyParser = require('body-parser');
const morgan     = require('morgan');

const env               = require('./src/config/env');
const webhookController = require('./src/controllers/webhookController');

// ─── Khởi tạo Express App ──────────────────────────────────────────────────
const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────
// Parse JSON body từ webhook Zalo
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging (tắt khi test để giảm noise)
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Health Check Route ────────────────────────────────────────────────────
// Render/Railway/UptimeRobot ping route này để giữ service luôn sống
app.get('/', (req, res) => {
  res.status(200).json({
    status  : 'ok',
    message : '🤖 Zalo Attendance Bot is running!',
    version : '1.0.0',
    uptime  : process.uptime().toFixed(2) + 's',
    time    : new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status  : 'ok',
    message : 'Bot is running...',
    uptime  : process.uptime().toFixed(2) + 's',
    time    : new Date().toISOString(),
  });
});

// ─── Webhook Route ─────────────────────────────────────────────────────────
// Zalo OA gửi sự kiện đến POST /webhook
app.post('/webhook', webhookController.handleWebhook);

// Zalo có thể gửi GET để verify webhook (tùy cấu hình OA)
app.get('/webhook', (req, res) => {
  console.log('[Webhook] GET verify request:', req.query);
  res.status(200).send('Webhook verified!');
});

// ─── 404 Handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err.message);
  res.status(500).json({
    error   : 'Internal Server Error',
    message : env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = env.PORT;

app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🤖 ZALO ATTENDANCE BOT - STARTED          ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Port    : ${PORT.toString().padEnd(35)}║`);
  console.log(`║  Env     : ${env.NODE_ENV.padEnd(35)}║`);
  console.log(`║  Time    : ${new Date().toLocaleString('vi-VN').padEnd(35)}║`);
  console.log('╚══════════════════════════════════════════════╝');

  // ─── Self-Ping Keep Alive (Chống Sleep Render Free 24/7) ───────────────
  if (env.APP_URL) {
    const axios = require('axios');
    const pingUrl = `${env.APP_URL.replace(/\/$/, '')}/health`;
    console.log(`[Keep-Alive] 🔄 Tự động ping 10 phút/lần tới: ${pingUrl}`);

    setInterval(async () => {
      try {
        const res = await axios.get(pingUrl, { timeout: 10000 });
        console.log(`[Keep-Alive] 🟢 Ping thành công: status ${res.status}`);
      } catch (err) {
        console.warn(`[Keep-Alive] ⚠️ Ping thất bại: ${err.message}`);
      }
    }, 10 * 60 * 1000); // 10 phút / lần
  }
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app; // Export cho testing
