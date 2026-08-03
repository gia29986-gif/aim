/**
 * src/services/attendanceService.js
 * ==================================
 * Service chứa toàn bộ business logic chấm công.
 * Phân tích lệnh, xử lý check-in/out, báo cáo,
 * và điều phối ghi dữ liệu lên GitHub (storageService).
 */

'use strict';

const storageService = require('./storageService');
const timeUtils      = require('../utils/timeUtils');

// ─── Regex patterns để nhận dạng lệnh từ văn bản tự do ──────────────────
const PATTERNS = {
  // Lệnh chuẩn: /in, /checkin, /out, /checkout, /baocao
  CHECKIN  : /^\/?(checkin|in)\b/i,
  CHECKOUT : /^\/?(checkout|out)\b/i,
  BAOCAO   : /^\/(baocao|report|bc)\b/i,
  HELP     : /^\/(help|huongdan|hd)\b/i,

  // Tự do: "Checkin 08:30", "check in lúc 8h30"
  FREE_CHECKIN : /(?:checkin|check\s*in|bắt\s*đầu|vào\s*ca|bắt\s*đầu\s*làm)[\s:]+(\d{1,2}[h:]\d{0,2}|\d{1,2})/i,

  // Tự do: "Checkout 17:00", "ra ca lúc 17h"
  FREE_CHECKOUT: /(?:checkout|check\s*out|kết\s*thúc|ra\s*ca|tan\s*ca)[\s:]+(\d{1,2}[h:]\d{0,2}|\d{1,2})/i,

  // Khoảng giờ: "Làm từ 8h đến 17h", "Từ 8:00 đến 17:00"
  TIME_RANGE: /(?:làm\s*)?từ\s+(\d{1,2}[h:]\d{0,2}|\d{1,2})\s+(?:đến|đến lúc|tới|to)\s+(\d{1,2}[h:]\d{0,2}|\d{1,2})/i,
};

/**
 * Phân tích một đoạn text và xác định loại lệnh + thông tin thời gian.
 * @param {string} text - Nội dung tin nhắn
 * @returns {{ command: string, checkinTime: string|null, checkoutTime: string|null }}
 */
function parseCommand(text) {
  const trimmed = text.trim();

  // --- Lệnh chuẩn ---
  if (PATTERNS.CHECKIN.test(trimmed))  return { command: 'checkin',  checkinTime: null, checkoutTime: null };
  if (PATTERNS.CHECKOUT.test(trimmed)) return { command: 'checkout', checkinTime: null, checkoutTime: null };
  if (PATTERNS.BAOCAO.test(trimmed))   return { command: 'baocao',   checkinTime: null, checkoutTime: null };
  if (PATTERNS.HELP.test(trimmed))     return { command: 'help',     checkinTime: null, checkoutTime: null };

  // --- Khoảng giờ: Làm từ 8h đến 17h ---
  const rangeMatch = trimmed.match(PATTERNS.TIME_RANGE);
  if (rangeMatch) {
    return {
      command      : 'timerange',
      checkinTime  : rangeMatch[1],
      checkoutTime : rangeMatch[2],
    };
  }

  // --- Checkin tự do: Checkin 08:30 ---
  const freeCheckin = trimmed.match(PATTERNS.FREE_CHECKIN);
  if (freeCheckin) {
    return { command: 'checkin', checkinTime: freeCheckin[1], checkoutTime: null };
  }

  // --- Checkout tự do: Checkout 17:00 ---
  const freeCheckout = trimmed.match(PATTERNS.FREE_CHECKOUT);
  if (freeCheckout) {
    return { command: 'checkout', checkinTime: null, checkoutTime: freeCheckout[1] };
  }

  return { command: 'unknown', checkinTime: null, checkoutTime: null };
}

/**
 * Xử lý lệnh CHECKIN.
 * - Kiểm tra đã checkin chưa (nếu rồi thì cảnh báo)
 * - Ghi dòng mới vào Google Sheets
 * - Trả về tin nhắn phản hồi
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.displayName
 * @param {string|null} params.groupId
 * @param {string|null} params.customTime - Giờ tùy chỉnh từ text tự do (VD: "08:30")
 * @returns {Promise<string>} Tin nhắn phản hồi
 */
async function handleCheckin({ userId, displayName, groupId, customTime }) {
  try {
    // Kiểm tra đã checkin chưa
    const pending = await storageService.getPendingCheckin(userId);
    if (pending) {
      return (
        `⚠️ ${displayName} ơi, bạn đã checkin lúc ${pending.checkinTime} rồi!\n` +
        `Nhập /out hoặc /checkout để kết thúc ca làm việc trước khi checkin mới nhé.`
      );
    }

    // Xác định thời điểm checkin
    const now = timeUtils.nowVN();
    let checkinMoment = now;

    if (customTime) {
      const parsed = timeUtils.buildMomentFromTime(customTime, now);
      if (parsed) {
        checkinMoment = parsed;
      }
    }

    const checkinTimeStr = timeUtils.formatTime(checkinMoment);
    const dateStr        = timeUtils.formatDate(checkinMoment);
    const systemTimeStr  = timeUtils.formatNow();

    // Ghi vào GitHub Storage
    await storageService.saveAttendanceRecord({
      systemTime  : systemTimeStr,
      date        : dateStr,
      userId      : userId,
      displayName : displayName,
      groupId     : groupId || '',
      type        : 'Checkin',
      checkinTime : checkinTimeStr,
      checkoutTime: '',
      totalHours  : '',
      note        : customTime ? `Giờ tùy chỉnh: ${customTime}` : '',
    });

    // Tin nhắn phản hồi
    return (
      `✅ Checkin thành công!\n` +
      `👤 Nhân viên : ${displayName}\n` +
      `🕐 Giờ vào   : ${checkinTimeStr}\n` +
      `📅 Ngày      : ${dateStr}\n\n` +
      `Chúc bạn làm việc hiệu quả! 💪\n` +
      `Nhập /out khi kết thúc ca làm việc.`
    );
  } catch (err) {
    console.error('[AttendanceSvc] Lỗi xử lý checkin:', err.message);
    return '❌ Có lỗi xảy ra khi ghi nhận checkin. Vui lòng thử lại sau.';
  }
}

/**
 * Xử lý lệnh CHECKOUT.
 * - Kiểm tra đã checkin chưa (nếu chưa thì cảnh báo)
 * - Tính tổng số giờ làm
 * - Cập nhật dòng checkin trong Sheets
 * - Trả về tin nhắn phản hồi
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.displayName
 * @param {string|null} params.groupId
 * @param {string|null} params.customTime - Giờ checkout tùy chỉnh
 * @returns {Promise<string>}
 */
async function handleCheckout({ userId, displayName, groupId, customTime }) {
  try {
    // Tìm checkin chưa hoàn thành
    const pending = await storageService.getPendingCheckin(userId);
    if (!pending) {
      return (
        `⚠️ ${displayName} ơi, bạn chưa checkin hôm nay!\n` +
        `Nhập /in hoặc /checkin để bắt đầu ca làm việc trước.`
      );
    }

    // Xác định thời điểm checkout
    const now = timeUtils.nowVN();
    let checkoutMoment = now;

    if (customTime) {
      const parsed = timeUtils.buildMomentFromTime(customTime, now);
      if (parsed) checkoutMoment = parsed;
    }

    // Parse giờ checkin từ sheet để tính tổng giờ
    const moment        = require('moment-timezone');
    const checkinMoment = moment.tz(
      `${timeUtils.formatDate()} ${pending.checkinTime}`,
      'DD/MM/YYYY HH:mm:ss',
      timeUtils.TIMEZONE
    );

    const checkoutTimeStr = timeUtils.formatTime(checkoutMoment);
    const totalHours      = timeUtils.calcWorkHours(checkinMoment, checkoutMoment);

    // Cập nhật bản ghi trong GitHub Storage
    const updated = await storageService.updateCheckoutRecord(
      userId,
      checkoutTimeStr,
      totalHours,
      customTime ? `Giờ tùy chỉnh: ${customTime}` : ''
    );

    // Nếu không cập nhật được, ghi bản ghi mới
    if (!updated) {
      await storageService.saveAttendanceRecord({
        systemTime  : timeUtils.formatNow(),
        date        : timeUtils.formatDate(),
        userId      : userId,
        displayName : displayName,
        groupId     : groupId || '',
        type        : 'Checkout',
        checkinTime : pending.checkinTime || '',
        checkoutTime: checkoutTimeStr,
        totalHours  : totalHours.toString(),
        note        : 'Ghi riêng (không tìm thấy dòng checkin)',
      });
    }

    // Tin nhắn phản hồi
    const hoursFormatted = timeUtils.formatHours(totalHours);
    return (
      `🏁 Checkout thành công!\n` +
      `👤 Nhân viên  : ${displayName}\n` +
      `🕐 Giờ vào    : ${pending.checkinTime}\n` +
      `🕔 Giờ ra     : ${checkoutTimeStr}\n` +
      `⏱️  Tổng giờ   : ${hoursFormatted} (${totalHours} giờ)\n` +
      `📅 Ngày       : ${timeUtils.formatDate()}\n\n` +
      `Cảm ơn bạn đã làm việc hôm nay! 🎉`
    );
  } catch (err) {
    console.error('[AttendanceSvc] Lỗi xử lý checkout:', err.message);
    return '❌ Có lỗi xảy ra khi ghi nhận checkout. Vui lòng thử lại sau.';
  }
}

/**
 * Xử lý khoảng giờ tự do: "Làm từ 8h đến 17h".
 * Ghi cả checkin và checkout trong một lần.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.displayName
 * @param {string|null} params.groupId
 * @param {string} params.checkinTimeStr  - Giờ bắt đầu (raw string)
 * @param {string} params.checkoutTimeStr - Giờ kết thúc (raw string)
 * @returns {Promise<string>}
 */
async function handleTimeRange({ userId, displayName, groupId, checkinTimeStr, checkoutTimeStr }) {
  try {
    const now            = timeUtils.nowVN();
    const checkinMoment  = timeUtils.buildMomentFromTime(checkinTimeStr, now);
    const checkoutMoment = timeUtils.buildMomentFromTime(checkoutTimeStr, now);

    if (!checkinMoment || !checkoutMoment) {
      return '❌ Không thể phân tích giờ làm. Ví dụ đúng: "Làm từ 8h đến 17h"';
    }

    const checkinFmt  = timeUtils.formatTime(checkinMoment);
    const checkoutFmt = timeUtils.formatTime(checkoutMoment);
    const totalHours  = timeUtils.calcWorkHours(checkinMoment, checkoutMoment);

    if (totalHours <= 0) {
      return `⚠️ Giờ kết thúc (${checkoutFmt}) phải sau giờ bắt đầu (${checkinFmt}).`;
    }

    const systemTime = timeUtils.formatNow();
    const dateStr    = timeUtils.formatDate();

    await sheetsService.saveAttendanceRecord({
      systemTime  : systemTime,
      date        : dateStr,
      userId      : userId,
      displayName : displayName,
      groupId     : groupId || '',
      type        : 'Checkin → Checkout',
      checkinTime : checkinFmt,
      checkoutTime: checkoutFmt,
      totalHours  : totalHours.toString(),
      note        : 'Nhập khoảng giờ tự do',
    });

    const hoursFormatted = timeUtils.formatHours(totalHours);
    return (
      `✅ Đã ghi nhận ca làm việc!\n` +
      `👤 Nhân viên  : ${displayName}\n` +
      `🕐 Giờ vào    : ${checkinFmt}\n` +
      `🕔 Giờ ra     : ${checkoutFmt}\n` +
      `⏱️  Tổng giờ   : ${hoursFormatted} (${totalHours} giờ)\n` +
      `📅 Ngày       : ${dateStr}`
    );
  } catch (err) {
    console.error('[AttendanceSvc] Lỗi xử lý khoảng giờ:', err.message);
    return '❌ Có lỗi xảy ra. Vui lòng thử lại sau.';
  }
}

/**
 * Xử lý lệnh /baocao - Báo cáo tổng giờ làm trong tháng.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.displayName
 * @returns {Promise<string>}
 */
async function handleBaoCao({ userId, displayName }) {
  try {
    const { totalHours, days, records } = await storageService.getMonthlyReport(userId);

    if (records.length === 0) {
      return (
        `📊 Báo cáo ${timeUtils.getCurrentMonthLabel()}\n` +
        `👤 ${displayName}\n\n` +
        `Chưa có dữ liệu chấm công trong tháng này.`
      );
    }

    const hoursFormatted = timeUtils.formatHours(totalHours);

    // Lấy 5 bản ghi gần nhất để hiển thị
    const recent = records.slice(-5).reverse();
    const recentText = recent
      .map(r => `  • ${r.date}: ${r.checkin || '?'} → ${r.checkout || '?'} (${r.totalHours}h)`)
      .join('\n');

    return (
      `📊 Báo cáo ${timeUtils.getCurrentMonthLabel()}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Nhân viên  : ${displayName}\n` +
      `📅 Số ngày làm : ${days} ngày\n` +
      `⏱️  Tổng giờ   : ${hoursFormatted}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 5 ca gần nhất:\n${recentText}`
    );
  } catch (err) {
    console.error('[AttendanceSvc] Lỗi lấy báo cáo:', err.message);
    return '❌ Không thể lấy báo cáo lúc này. Vui lòng thử lại sau.';
  }
}

/**
 * Trả về tin nhắn hướng dẫn sử dụng bot.
 * @param {string} displayName
 * @returns {string}
 */
function handleHelp(displayName) {
  return (
    `🤖 HƯỚNG DẪN SỬ DỤNG BOT CHẤM CÔNG\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 Xin chào ${displayName}!\n\n` +
    `📌 CÁC LỆNH CƠ BẢN:\n` +
    `  • /in hoặc /checkin\n` +
    `    → Bắt đầu ca làm việc\n\n` +
    `  • /out hoặc /checkout\n` +
    `    → Kết thúc ca, tự tính giờ\n\n` +
    `  • /baocao\n` +
    `    → Xem tổng giờ làm tháng này\n\n` +
    `📌 LỆNH TỰ DO:\n` +
    `  • "Checkin 08:30"\n` +
    `  • "Checkout 17:00"\n` +
    `  • "Làm từ 8h đến 17h"\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 Dữ liệu được lưu vào Google Sheets tự động!`
  );
}

/**
 * Điểm vào chính: xử lý toàn bộ tin nhắn nhận được.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.displayName
 * @param {string|null} params.groupId
 * @param {string} params.messageText
 * @returns {Promise<string|null>} Tin nhắn phản hồi, hoặc null nếu không xử lý
 */
async function processMessage({ userId, displayName, groupId, messageText }) {
  if (!messageText) return null;

  const { command, checkinTime, checkoutTime } = parseCommand(messageText);

  console.log(
    `[AttendanceSvc] Lệnh: "${command}" | User: ${displayName} (${userId})` +
    (groupId ? ` | Nhóm: ${groupId}` : '')
  );

  switch (command) {
    case 'checkin':
      return handleCheckin({ userId, displayName, groupId, customTime: checkinTime });

    case 'checkout':
      return handleCheckout({ userId, displayName, groupId, customTime: checkoutTime });

    case 'timerange':
      return handleTimeRange({
        userId,
        displayName,
        groupId,
        checkinTimeStr : checkinTime,
        checkoutTimeStr: checkoutTime,
      });

    case 'baocao':
      return handleBaoCao({ userId, displayName });

    case 'help':
      return handleHelp(displayName);

    default:
      return null; // Không phải lệnh bot, bỏ qua
  }
}

module.exports = {
  processMessage,
  parseCommand,
  handleCheckin,
  handleCheckout,
  handleTimeRange,
  handleBaoCao,
  handleHelp,
};
