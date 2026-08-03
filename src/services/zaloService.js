/**
 * src/services/zaloService.js
 * ===========================
 * Service giao tiếp với Zalo OA API v2.0.
 * Cung cấp các hàm gửi tin nhắn text, reply tin nhắn
 * cho cả chat cá nhân và nhóm.
 */

'use strict';

const axios = require('axios');
const env   = require('../config/env');

const BASE_URL = env.ZALO_API_URL; // https://openapi.zalo.me/v2.0/oa

/**
 * Header xác thực chuẩn cho mọi request đến Zalo API.
 */
function getHeaders() {
  return {
    'access_token': env.ZALO_BOT_TOKEN,
    'Content-Type' : 'application/json',
  };
}

/**
 * Gửi tin nhắn text đến người dùng cá nhân (chat 1-1).
 * @param {string} userId  - Zalo User ID của người nhận
 * @param {string} message - Nội dung tin nhắn
 * @returns {Promise<object>} Response từ Zalo API
 */
async function sendMessageToUser(userId, message) {
  try {
    const payload = {
      recipient: { user_id: String(userId) },
      message  : { text: message },
    };

    const response = await axios.post(
      `${BASE_URL}/message`,
      payload,
      { headers: getHeaders() }
    );

    if (response.data && response.data.error !== 0) {
      console.warn(
        `[ZaloService] Cảnh báo gửi tin đến user ${userId}:`,
        response.data
      );
    } else {
      console.log(`[ZaloService] ✅ Đã gửi tin đến user: ${userId}`);
    }

    return response.data;
  } catch (err) {
    console.error(
      `[ZaloService] ❌ Lỗi gửi tin đến user ${userId}:`,
      err.response?.data || err.message
    );
    throw err;
  }
}

/**
 * Gửi tin nhắn text vào nhóm (Group).
 * @param {string} groupId - ID của nhóm Zalo
 * @param {string} message - Nội dung tin nhắn
 * @returns {Promise<object>}
 */
async function sendMessageToGroup(groupId, message) {
  try {
    const payload = {
      recipient: { group_id: String(groupId) },
      message  : { text: message },
    };

    const response = await axios.post(
      `${BASE_URL}/message`,
      payload,
      { headers: getHeaders() }
    );

    if (response.data && response.data.error !== 0) {
      console.warn(
        `[ZaloService] Cảnh báo gửi tin vào nhóm ${groupId}:`,
        response.data
      );
    } else {
      console.log(`[ZaloService] ✅ Đã gửi tin vào nhóm: ${groupId}`);
    }

    return response.data;
  } catch (err) {
    console.error(
      `[ZaloService] ❌ Lỗi gửi tin vào nhóm ${groupId}:`,
      err.response?.data || err.message
    );
    throw err;
  }
}

/**
 * Gửi tin nhắn thông minh: tự động chọn gửi vào nhóm hoặc cá nhân.
 * @param {string} userId   - Zalo User ID
 * @param {string|null} groupId - Group ID (nếu có, ưu tiên gửi vào nhóm)
 * @param {string} message  - Nội dung
 * @returns {Promise<object>}
 */
async function sendReply(userId, groupId, message) {
  if (groupId) {
    return sendMessageToGroup(groupId, message);
  }
  return sendMessageToUser(userId, message);
}

/**
 * Lấy thông tin profile người dùng Zalo.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getUserProfile(userId) {
  try {
    const response = await axios.get(`${BASE_URL}/profile`, {
      headers: getHeaders(),
      params : { user_id: userId },
    });

    if (response.data && response.data.error === 0) {
      return response.data.data;
    }
    return null;
  } catch (err) {
    console.error(
      `[ZaloService] Không lấy được profile user ${userId}:`,
      err.message
    );
    return null;
  }
}

/**
 * Gửi tin nhắn có nút tương tác (Quick Replies) đến user cá nhân.
 * @param {string} userId
 * @param {string} text
 * @param {Array<{title: string, payload: string}>} quickReplies
 * @returns {Promise<object>}
 */
async function sendQuickReplies(userId, text, quickReplies) {
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
      `${BASE_URL}/message`,
      payload,
      { headers: getHeaders() }
    );

    return response.data;
  } catch (err) {
    console.error('[ZaloService] Lỗi gửi quick replies:', err.message);
    // Fallback: gửi text thường nếu quick replies lỗi
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
