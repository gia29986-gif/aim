/**
 * src/controllers/webhookController.js
 * ======================================
 * Controller xử lý toàn bộ sự kiện webhook từ Zalo OA.
 *
 * Zalo gửi sự kiện qua POST /webhook với các event_name:
 *   - "user_send_text"         : Tin nhắn text từ user
 *   - "user_send_sticker"      : Sticker (bỏ qua)
 *   - "user_send_image"        : Ảnh (bỏ qua)
 *   - "follow"                 : User follow OA
 *   - "unfollow"               : User unfollow OA
 *   - "user_joined_group"      : Thành viên mới vào nhóm
 *   - "join_oa"                : User nhắn tin lần đầu
 *   - "oa_send_text"           : Bot tự gửi (bỏ qua để tránh vòng lặp)
 *
 * PHÂN BIỆT TIN NHẮN CÁ NHÂN & NHÓM:
 *   - Tin nhắn cá nhân: payload.sender.id = userId, không có group_id
 *   - Tin nhắn nhóm:    payload.message.group_id = groupId
 */

'use strict';

const attendanceService = require('../services/attendanceService');
const zaloService       = require('../services/zaloService');
const timeUtils         = require('../utils/timeUtils');

// ─── Hằng số ──────────────────────────────────────────────────────────────
// Tên/ID bot để tránh tự trả lời chính mình (điền bot ID nếu biết)
const BOT_IDS_BLACKLIST = [];

// ─── Helper: Trích xuất thông tin từ payload Zalo ────────────────────────
/**
 * Parse payload từ Zalo webhook thành object chuẩn hóa.
 * Zalo OA có nhiều cấu trúc payload khác nhau tùy event_name.
 *
 * @param {Object} body - req.body từ Express
 * @returns {{ eventName, userId, displayName, groupId, messageText, timestamp }}
 */
function parseZaloPayload(body) {
  const event = body || {};

  // Zalo Bot Platform (Bot Manager) bọc tin nhắn trong event.message
  const messageObj = event.message || {};
  const chatObj    = messageObj.chat || event.chat || {};
  const fromObj    = messageObj.from || event.from || event.sender || {};
  const follower   = event.follower || {};
  const userJoined = event.user || {};

  // event_name xác định loại sự kiện
  const eventName = (
    event.event_name ||
    event.type       ||
    event.name       ||
    (messageObj.text || event.text ? 'user_send_text' : 'unknown')
  ).toLowerCase();

  // Timestamp
  const timestamp = event.timestamp || (messageObj.date ? messageObj.date * 1000 : Date.now());

  // Tìm Chat ID / User ID (Zalo Bot Manager dùng chat.id hoặc from.id)
  const userId = (
    chatObj.id          ||
    fromObj.id          ||
    event.user_id_by_app||
    follower.id         ||
    userJoined.id       ||
    event.user_id       ||
    event.userId        ||
    event.from_id       ||
    event.sender_id     ||
    event.senderId      ||
    (event.recipient && event.recipient.id) ||
    ''
  ).toString();

  const displayName = (
    fromObj.display_name     ||
    fromObj.name             ||
    (fromObj.first_name ? `${fromObj.first_name} ${fromObj.last_name || ''}`.trim() : '') ||
    follower.display_name   ||
    follower.name           ||
    userJoined.display_name ||
    userJoined.name         ||
    event.display_name      ||
    'Người dùng Zalo'
  );

  let messageText = (
    messageObj.text     ||
    event.message_text  ||
    event.text          ||
    ''
  ).trim();

  // Tự động loại bỏ tất cả các tag @người_dùng
  messageText = messageText
    .replace(/^@?Bot\s*ghi\s*lương\s*/i, '')
    .replace(/@[^@\d\/]+(?=\s*\d|\s*\/|\s*$)/gi, '')
    .replace(/@\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Group ID - Nếu chat là group hoặc supergroup
  const isGroupChat = chatObj.type === 'group' || chatObj.type === 'supergroup';
  const groupId = isGroupChat
    ? chatObj.id
    : (messageObj.group_id || event.group_id || event.recipient?.group_id || null);

  return {
    eventName,
    userId,
    displayName,
    groupId   : groupId ? groupId.toString() : null,
    messageText,
    timestamp,
  };
}

// ─── Handler: Tin nhắn text ───────────────────────────────────────────────
/**
 * Xử lý sự kiện tin nhắn text từ user (cá nhân hoặc nhóm).
 * @param {Object} parsed - Kết quả từ parseZaloPayload
 */
async function handleTextMessage(parsed) {
  const { userId, displayName, groupId, messageText, timestamp } = parsed;

  const timeStr = timeUtils.fromTimestamp(timestamp).format('HH:mm:ss DD/MM/YYYY');
  const context = groupId ? `[Nhóm: ${groupId}]` : '[Cá nhân]';

  console.log(
    `[Webhook] ${context} ${displayName} (${userId}) lúc ${timeStr}: "${messageText}"`
  );

  if (!messageText) return;

  // Bỏ qua nếu không có userId hợp lệ
  if (!userId) {
    console.warn('[Webhook] ⚠️ Nhận được tin nhắn không có userId, bỏ qua.');
    return;
  }

  // Xử lý lệnh qua attendanceService
  const replyText = await attendanceService.processMessage({
    userId,
    displayName,
    groupId,
    messageText,
  });

  // Nếu bot nhận dạng được lệnh, gửi phản hồi
  if (replyText) {
    await zaloService.sendReply(userId, groupId, replyText);
  }
}

// ─── Handler: Thành viên mới vào nhóm ────────────────────────────────────
/**
 * Xử lý sự kiện user_joined_group - Chào mừng thành viên mới.
 * @param {Object} parsed
 */
async function handleUserJoinedGroup(parsed) {
  const { userId, displayName, groupId } = parsed;

  console.log(
    `[Webhook] 🎉 Thành viên mới: ${displayName} (${userId}) ` +
    `vào nhóm ${groupId || 'không rõ'}`
  );

  if (!userId) return;

  const welcomeMsg =
    `🥳 Chào mừng *${displayName}* đã gia nhập nhóm!\n\n` +
    `Tôi là Bot Chấm Công của nhóm. Tôi sẽ giúp bạn theo dõi giờ làm việc.\n\n` +
    `📌 Bắt đầu bằng cách nhập:\n` +
    `  • /in hoặc /checkin → Bắt đầu ca làm\n` +
    `  • /out hoặc /checkout → Kết thúc ca làm\n` +
    `  • /baocao → Xem tổng giờ tháng này\n` +
    `  • /help → Hướng dẫn đầy đủ\n\n` +
    `Chúc bạn làm việc hiệu quả! 💪`;

  // Gửi vào nhóm nếu có groupId, ngược lại gửi cá nhân
  if (groupId) {
    await zaloService.sendMessageToGroup(groupId, welcomeMsg);
  } else {
    await zaloService.sendMessageToUser(userId, welcomeMsg);
  }
}

// ─── Handler: User follow OA ──────────────────────────────────────────────
/**
 * Xử lý khi user follow OA lần đầu.
 * @param {Object} parsed
 */
async function handleFollow(parsed) {
  const { userId, displayName } = parsed;

  console.log(`[Webhook] ➕ Follow mới: ${displayName} (${userId})`);

  if (!userId) return;

  const welcomeMsg =
    `👋 Xin chào ${displayName}!\n\n` +
    `Cảm ơn bạn đã kết nối với Bot Chấm Công! 🤖\n\n` +
    `📌 Các lệnh cơ bản:\n` +
    `  • /in → Bắt đầu ca làm việc\n` +
    `  • /out → Kết thúc ca làm việc\n` +
    `  • /baocao → Báo cáo tháng\n` +
    `  • /help → Xem hướng dẫn đầy đủ\n\n` +
    `Hãy nhập /in khi bắt đầu làm việc nhé! 💼`;

  await zaloService.sendMessageToUser(userId, welcomeMsg);
}

// ─── Handler: User unfollow OA ────────────────────────────────────────────
/**
 * Xử lý khi user unfollow OA.
 * @param {Object} parsed
 */
async function handleUnfollow(parsed) {
  const { userId, displayName } = parsed;
  console.log(`[Webhook] ➖ Unfollow: ${displayName} (${userId})`);
  // Không gửi tin nhắn vì user đã unfollow
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────
/**
 * Middleware Express xử lý tất cả sự kiện POST /webhook từ Zalo.
 * Phải trả về HTTP 200 NHANH CHÓNG rồi xử lý bất đồng bộ sau,
 * nếu không Zalo sẽ retry và tạo vòng lặp.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleWebhook(req, res) {
  // Trả về 200 ngay lập tức để Zalo không retry
  res.status(200).json({ error: 0, message: 'ok' });

  try {
    const body = req.body;

    // Log raw payload để debug cấu hình Zalo
    console.log('[Webhook] Raw payload:', JSON.stringify(body, null, 2));

    if (!body) {
      console.warn('[Webhook] ⚠️ Payload rỗng, bỏ qua.');
      return;
    }

    // Parse payload thành object chuẩn hóa
    const parsed = parseZaloPayload(body);

    // Bỏ qua nếu userId nằm trong blacklist (bot ID)
    if (BOT_IDS_BLACKLIST.includes(parsed.userId)) {
      console.log(`[Webhook] 🤖 Bỏ qua tin nhắn từ bot: ${parsed.userId}`);
      return;
    }

    // Route theo loại sự kiện
    switch (parsed.eventName) {
      // ── Tin nhắn text ──────────────────────────────────────────
      case 'message.text.received':
      case 'user_send_text':
      case 'user_send_message':
      case 'message':
        await handleTextMessage(parsed);
        break;

      // ── Thành viên mới vào nhóm ────────────────────────────────
      case 'user_joined_group':
      case 'join_group':
      case 'group_member_joined':
        await handleUserJoinedGroup(parsed);
        break;

      // ── Follow / Unfollow OA ───────────────────────────────────
      case 'follow':
      case 'user_follow_oa':
        await handleFollow(parsed);
        break;

      case 'unfollow':
      case 'user_unfollow_oa':
        await handleUnfollow(parsed);
        break;

      // ── Bot tự gửi: Bỏ qua để tránh vòng lặp ─────────────────
      case 'oa_send_text':
      case 'oa_send_message':
        console.log('[Webhook] 🔄 Bot tự gửi, bỏ qua.');
        break;

      // ── Sticker / Ảnh / File: Không xử lý ─────────────────────
      case 'user_send_sticker':
      case 'user_send_image':
      case 'user_send_gif':
      case 'user_send_file':
        console.log(`[Webhook] 📎 Bỏ qua sự kiện media: ${parsed.eventName}`);
        break;

      default:
        console.log(`[Webhook] ❓ Sự kiện không xác định: "${parsed.eventName}"`);
        break;
    }
  } catch (err) {
    // Đã trả 200 rồi nên chỉ log lỗi, không ảnh hưởng client
    console.error('[Webhook] ❌ Lỗi xử lý webhook:', err.stack || err.message);
  }
}

module.exports = {
  handleWebhook,
  parseZaloPayload, // Export để test
};
