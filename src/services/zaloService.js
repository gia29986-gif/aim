/**
 * src/services/zaloService.js
 * ===========================
 * Service giao tiếp với Zalo API.
 * Hỗ trợ cả 2 nền tảng:
 *   1. Zalo Bot Platform (Zalo Bot Manager / Bot Creator) -> bot-api.zaloplatforms.com
 *   2. Zalo Official Account (Zalo OA API v2.0) -> openapi.zalo.me
 */

'use strict';

const axios = require('axios');
const env   = require('../config/env');

const BOT_PLATFORM_BASE_URL = 'https://bot-api.zaloplatforms.com';
const OA_BASE_URL           = env.ZALO_API_URL || 'https://openapi.zalo.me/v2.0/oa';

/**
 * Kiểm tra xem Token có phải dạng Zalo Bot Manager (Bot Platform) hay không.
 * Token Bot Manager có dạng: <bot_id>:<secret_key> (ví dụ: 9833768127...:WyqAmgIcu...)
 */
function isBotPlatformToken(token) {
  return typeof token === 'string' && token.includes(':');
}

/**
 * Gửi tin nhắn qua Zalo Bot Platform (Bot Manager)
 * Endpoint: POST https://bot-api.zaloplatforms.com/bot<TOKEN>/sendMessage
 */
async function sendBotPlatformMessage(chatId, message) {
  const token = (env.ZALO_BOT_TOKEN || '').trim();
  const url   = `${BOT_PLATFORM_BASE_URL}/bot${token}/sendMessage`;

  const payload = {
    chat_id: String(chatId),
    text   : message,
  };

  const response = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.data && response.data.ok === false) {
    console.warn(`[ZaloService] ⚠️ Zalo Bot Manager báo lỗi:`, response.data);
  } else {
    console.log(`[ZaloService] ✅ Đã gửi tin qua Zalo Bot Manager đến chat: ${chatId}`);
  }

  return response.data;
}

/**
 * Gửi tin nhắn qua Zalo OA API (Official Account)
 * Endpoint: POST https://openapi.zalo.me/v2.0/oa/message
 */
async function sendOAMessage(recipientObj, message) {
  const payload = {
    recipient: recipientObj,
    message  : { text: message },
  };

  const response = await axios.post(
    `${OA_BASE_URL}/message`,
    payload,
    {
      headers: {
        'access_token': env.ZALO_BOT_TOKEN,
        'Content-Type' : 'application/json',
      },
    }
  );

  if (response.data && response.data.error !== 0) {
    console.warn(`[ZaloService] Cảnh báo Zalo OA:`, response.data);
  } else {
    console.log(`[ZaloService] ✅ Đã gửi tin qua Zalo OA`);
  }

  return response.data;
}

/**
 * Gửi tin nhắn đến User cá nhân
 */
async function sendMessageToUser(userId, message) {
  try {
    if (isBotPlatformToken(env.ZALO_BOT_TOKEN)) {
      return await sendBotPlatformMessage(userId, message);
    }
    return await sendOAMessage({ user_id: String(userId) }, message);
  } catch (err) {
    console.error(
      `[ZaloService] ❌ Lỗi gửi tin đến user ${userId}:`,
      err.response?.data || err.message
    );
    throw err;
  }
}

/**
 * Gửi tin nhắn vào Nhóm (Group)
 */
async function sendMessageToGroup(groupId, message) {
  try {
    if (isBotPlatformToken(env.ZALO_BOT_TOKEN)) {
      return await sendBotPlatformMessage(groupId, message);
    }
    return await sendOAMessage({ group_id: String(groupId) }, message);
  } catch (err) {
    console.error(
      `[ZaloService] ❌ Lỗi gửi tin vào nhóm ${groupId}:`,
      err.response?.data || err.message
    );
    throw err;
  }
}

/**
 * Gửi phản hồi thông minh (tự động chọn nhóm hoặc cá nhân)
 */
async function sendReply(userId, groupId, message) {
  const targetId = groupId || userId;
  if (isBotPlatformToken(env.ZALO_BOT_TOKEN)) {
    return sendBotPlatformMessage(targetId, message);
  }
  if (groupId) {
    return sendMessageToGroup(groupId, message);
  }
  return sendMessageToUser(userId, message);
}

/**
 * Lấy profile người dùng
 */
async function getUserProfile(userId) {
  if (isBotPlatformToken(env.ZALO_BOT_TOKEN)) {
    return { user_id: userId, name: 'Người dùng Zalo' };
  }
  try {
    const response = await axios.get(`${OA_BASE_URL}/profile`, {
      headers: { 'access_token': env.ZALO_BOT_TOKEN },
      params : { user_id: userId },
    });

    if (response.data && response.data.error === 0) {
      return response.data.data;
    }
    return null;
  } catch (err) {
    console.error(`[ZaloService] Không lấy được profile user ${userId}:`, err.message);
    return null;
  }
}

/**
 * Gửi Quick Replies
 */
async function sendQuickReplies(userId, text, quickReplies) {
  if (isBotPlatformToken(env.ZALO_BOT_TOKEN)) {
    return sendBotPlatformMessage(userId, text);
  }
  try {
    const payload = {
      recipient: { user_id: String(userId) },
      message  : {
        text         : text,
        quick_replies: quickReplies.map(qr => ({
          content_type: 'text',
          title        : qr.title,
          payload      : qr.payload,
        })),
      },
    };

    const response = await axios.post(
      `${OA_BASE_URL}/message`,
      payload,
      { headers: { 'access_token': env.ZALO_BOT_TOKEN, 'Content-Type': 'application/json' } }
    );

    return response.data;
  } catch (err) {
    return sendMessageToUser(userId, text);
  }
}

module.exports = {
  sendMessageToUser,
  sendMessageToGroup,
  sendReply,
  getUserProfile,
  sendQuickReplies,
};
