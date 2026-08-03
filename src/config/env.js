/**
 * src/config/env.js
 * =================
 * Tập trung quản lý và validate tất cả biến môi trường.
 * Throw lỗi ngay khi khởi động nếu thiếu biến bắt buộc.
 */

'use strict';

/**
 * Đọc biến môi trường và áp dụng giá trị mặc định.
 * @param {string} key   - Tên biến môi trường
 * @param {string} [def] - Giá trị mặc định (nếu có)
 * @returns {string}
 */
function get(key, def = '') {
  return process.env[key] || def;
}

// ─── Export cấu hình ──────────────────────────────────────────────────────
const env = {
  // Server
  PORT     : parseInt(get('PORT', '3000'), 10),
  NODE_ENV : get('NODE_ENV', 'development'),

  // Zalo Bot
  ZALO_BOT_TOKEN : get(
    'ZALO_BOT_TOKEN',
    '983376812717887946:WyqAmgIcuTpKDrhzOVwiKJSzfmXwcJltfHDfwukqpKRwOefhnpOClzZWnwoABrcR'
  ),

  // GitHub Storage
  GITHUB_TOKEN     : get('GITHUB_TOKEN', ''),
  GITHUB_OWNER     : get('GITHUB_OWNER', ''),
  GITHUB_REPO      : get('GITHUB_REPO', ''),
  GITHUB_BRANCH    : get('GITHUB_BRANCH', 'main'),
  GITHUB_DATA_PATH : get('GITHUB_DATA_PATH', 'data/attendance.json'),

  // App Public URL for Keep-Alive Ping (VD: https://zalo-bot.onrender.com)
  APP_URL: get('APP_URL', get('RENDER_EXTERNAL_URL', '')),

  // Timezone
  TIMEZONE: get('TIMEZONE', 'Asia/Ho_Chi_Minh'),

  // Zalo API Base URL
  ZALO_API_URL: 'https://openapi.zalo.me/v2.0/oa',
};

// ─── Validate khi khởi động ───────────────────────────────────────────────
(function validate() {
  const required = [
    ['ZALO_BOT_TOKEN', env.ZALO_BOT_TOKEN],
    ['GITHUB_TOKEN',   env.GITHUB_TOKEN],
    ['GITHUB_OWNER',   env.GITHUB_OWNER],
    ['GITHUB_REPO',    env.GITHUB_REPO],
  ];

  const missing = required.filter(([, v]) => !v).map(([k]) => k);

  if (missing.length > 0) {
    console.error('[ENV] ❌ Thiếu biến môi trường bắt buộc:');
    missing.forEach(k => console.error(`   - ${k}`));
    console.error('[ENV] → Kiểm tra file .env hoặc Environment Variables trên cloud.');

    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  } else {
    console.log(
      `[ENV] ✅ Cấu hình OK: NODE_ENV=${env.NODE_ENV}, PORT=${env.PORT}, ` +
      `Repo=${env.GITHUB_OWNER}/${env.GITHUB_REPO} (${env.GITHUB_BRANCH})`
    );
  }
})();

module.exports = env;
