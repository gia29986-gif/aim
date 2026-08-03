/**
 * src/services/attendanceService.js
 * ==================================
 * Service chứa toàn bộ business logic chấm công & tính lương.
 * Hỗ trợ: Nhắn tắt, tự phân tích ngày/tháng/năm tùy chỉnh.
 */

'use strict';

const storageService = require('./storageService');
const timeUtils      = require('../utils/timeUtils');

// ─── Giá lương mặc định (VNĐ/giờ) ──────────────────────────────────────────
const RATE_INSIDE  = 30000; // 30.000đ / giờ ca trong (t)
const RATE_OUTSIDE = 35000; // 35.000đ / giờ ca ngoài (n)

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

/**
 * Trích xuất Ngày/Tháng/Năm từ câu nhắn (VD: "02/08", "2/8/2026", "02-08")
 */
function extractCustomDate(text) {
  const currentYear = new Date().getFullYear();
  // Match định dạng DD/MM/YYYY hoặc DD/MM hoặc DD-MM
  const dateMatch = text.match(/(?:ngày\s*)?(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}|\d{2}))?/i);

  if (dateMatch) {
    const day   = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    let year  = dateMatch[3] ? dateMatch[3] : currentYear;
    if (year.length === 2) year = `20${year}`;

    return `${day}/${month}/${year}`;
  }

  return null; // Không có ngày đi kèm -> dùng ngày hôm nay
}

/**
 * Phân tích số giờ làm (trong/ngoài) từ câu nhắn tắt
 */
function parseDirectHours(text) {
  // Loại bỏ phần ngày tháng trước khi soi số giờ
  const cleanedText = text.replace(/(?:ngày\s*)?\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/gi, '').trim().toLowerCase();

  let insideHours = 0;
  let outsideHours = 0;
  let matched = false;

  // Pattern 1: "4t 2n", "4 trong 2 ngoài", "4h t 2h n"
  const combinedMatch = cleanedText.match(/(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*(?:trong|t)\s*(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*(?:ngoài|n)\b/i);
  if (combinedMatch) {
    insideHours = parseFloat(combinedMatch[1]);
    outsideHours = parseFloat(combinedMatch[2]);
    matched = true;
  } else {
    // Pattern 2: "2n 4t", "2 ngoài 4 trong"
    const reversedMatch = cleanedText.match(/(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*(?:ngoài|n)\s*(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*(?:trong|t)\b/i);
    if (reversedMatch) {
      outsideHours = parseFloat(reversedMatch[1]);
      insideHours = parseFloat(reversedMatch[2]);
      matched = true;
    } else {
      // Pattern 3: Chỉ nhắn ca trong (VD: "6trong", "6t", "5ht")
      const insideMatch = cleanedText.match(/(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*(?:trong|t)\b/i);
      if (insideMatch) {
        insideHours = parseFloat(insideMatch[1]);
        matched = true;
      }

      // Pattern 4: Chỉ nhắn ca ngoài (VD: "4ngoài", "4n", "3hn")
      const outsideMatch = cleanedText.match(/(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*(?:ngoài|n)\b/i);
      if (outsideMatch) {
        outsideHours = parseFloat(outsideMatch[1]);
        matched = true;
      }

      // Pattern 5: Chỉ nhắn số tiếng thuần túy (VD: "6 tiếng", "6h") -> Mặc định ca trong
      if (!matched) {
        const plainHoursMatch = cleanedText.match(/^(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)$/i);
        if (plainHoursMatch) {
          insideHours = parseFloat(plainHoursMatch[1]);
          matched = true;
        }
      }
    }
  }

  if (matched) {
    return {
      matched: true,
      insideHours,
      outsideHours,
      totalHours: insideHours + outsideHours,
    };
  }

  return { matched: false };
}

const PATTERNS = {
  CHECKIN  : /^\/?(checkin|in)\b/i,
  CHECKOUT : /^\/?(checkout|out)\b/i,
  BAOCAO   : /^\/(baocao|report|bc)\b/i,
  HELP     : /^\/(help|huongdan|hd)\b/i,
};

function parseCommand(text) {
  const trimmed = text.trim();

  if (PATTERNS.CHECKIN.test(trimmed))  return { command: 'checkin' };
  if (PATTERNS.CHECKOUT.test(trimmed)) return { command: 'checkout' };
  if (PATTERNS.BAOCAO.test(trimmed))   return { command: 'baocao' };
  if (PATTERNS.HELP.test(trimmed))     return { command: 'help' };

  const direct = parseDirectHours(trimmed);
  if (direct.matched) {
    const customDate = extractCustomDate(trimmed);
    return { command: 'direct_hours', hoursData: direct, customDate };
  }

  return { command: 'unknown' };
}

/**
 * Xử lý nhập giờ làm trực tiếp
 */
async function handleDirectHours({ userId, displayName, groupId, hoursData, customDate, rawText }) {
  try {
    const { insideHours, outsideHours, totalHours } = hoursData;

    const insideSalary  = insideHours * RATE_INSIDE;
    const outsideSalary = outsideHours * RATE_OUTSIDE;
    const totalSalary   = insideSalary + outsideSalary;

    const nowStr  = timeUtils.formatNow();
    // Nếu có ngày nhập kèm thì lấy ngày đó, ngược lại lấy ngày HÔM NAY
    const targetDateStr = customDate || timeUtils.formatDate();

    // Ghi trực tiếp vào GitHub Storage
    await storageService.saveAttendanceRecord({
      systemTime   : nowStr,
      date         : targetDateStr,     // 👈 Ngày được ghi nhận chuẩn xác
      userId       : userId,
      displayName  : displayName,
      groupId      : groupId || '',
      type         : 'Nhập giờ trực tiếp',
      insideHours  : insideHours,
      outsideHours : outsideHours,
      totalHours   : totalHours,
      insideSalary : insideSalary,
      outsideSalary: outsideSalary,
      totalSalary  : totalSalary,      // 👈 Số tiền lương VNĐ
      note         : rawText,
    });

    return (
      `💰 Ghi nhận ca làm thành công!\n` +
      `👤 Nhân viên : ${displayName}\n` +
      `📅 Ngày      : ${targetDateStr}\n` +
      `⏱️  Giờ làm   : ${insideHours}h trong | ${outsideHours}h ngoài (Tổng: ${totalHours}h)\n` +
      `💵 Tiền lương: ${formatVND(totalSalary)}`
    );
  } catch (err) {
    console.error('[AttendanceSvc] Lỗi xử lý nhập giờ:', err.message);
    return '❌ Có lỗi xảy ra khi lưu ca làm. Vui lòng thử lại sau.';
  }
}

async function handleCheckin({ userId, displayName, groupId }) {
  try {
    const pending = await storageService.getPendingCheckin(userId);
    if (pending) {
      return `⚠️ ${displayName} ơi, bạn đã checkin lúc ${pending.checkinTime} rồi!`;
    }

    const now = timeUtils.nowVN();
    const checkinTimeStr = timeUtils.formatTime(now);
    const dateStr        = timeUtils.formatDate(now);

    await storageService.saveAttendanceRecord({
      systemTime  : timeUtils.formatNow(),
      date        : dateStr,
      userId      : userId,
      displayName : displayName,
      groupId     : groupId || '',
      type        : 'Checkin',
      checkinTime : checkinTimeStr,
      checkoutTime: '',
      totalHours  : 0,
      totalSalary : 0,
      note        : 'Vào ca',
    });

    return (
      `✅ Checkin thành công!\n` +
      `👤 Nhân viên : ${displayName}\n` +
      `🕐 Giờ vào   : ${checkinTimeStr}\n` +
      `📅 Ngày      : ${dateStr}`;
  } catch (err) {
    console.error('[AttendanceSvc] Lỗi checkin:', err.message);
    return '❌ Có lỗi xảy ra khi checkin.';
  }
}

async function handleCheckout({ userId, displayName, groupId }) {
  try {
    const pending = await storageService.getPendingCheckin(userId);
    if (!pending) {
      return `⚠️ ${displayName} ơi, bạn chưa checkin hôm nay!`;
    }

    const now = timeUtils.nowVN();
    const checkoutTimeStr = timeUtils.formatTime(now);

    const moment = require('moment-timezone');
    const checkinMoment = moment.tz(
      `${timeUtils.formatDate()} ${pending.checkinTime}`,
      'DD/MM/YYYY HH:mm:ss',
      timeUtils.TIMEZONE
    );

    const totalHours = timeUtils.calcWorkHours(checkinMoment, now);
    const totalSalary = totalHours * RATE_INSIDE;

    await storageService.updateCheckoutRecord(
      userId,
      checkoutTimeStr,
      totalHours,
      `Checkout (Lương: ${formatVND(totalSalary)})`
    );

    return (
      `🏁 Checkout thành công!\n` +
      `👤 Nhân viên  : ${displayName}\n` +
      `⏱️  Tổng giờ   : ${totalHours} giờ\n` +
      `💵 Tiền lương : ${formatVND(totalSalary)}\n` +
      `📅 Ngày       : ${timeUtils.formatDate()}`;
  } catch (err) {
    console.error('[AttendanceSvc] Lỗi checkout:', err.message);
    return '❌ Có lỗi xảy ra khi checkout.';
  }
}

async function handleBaoCao({ userId, displayName }) {
  try {
    const { totalHours, totalSalary, days, records } = await storageService.getMonthlyReport(userId);

    if (!records || records.length === 0) {
      return `📊 Báo cáo ${timeUtils.getCurrentMonthLabel()}\n👤 ${displayName}\n\nChưa có dữ liệu tháng này.`;
    }

    return (
      `📊 BÁO CÁO LƯƠNG ${timeUtils.getCurrentMonthLabel()}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Nhân viên   : ${displayName}\n` +
      `📅 Số ca làm   : ${days} ca\n` +
      `⏱️  Tổng giờ    : ${totalHours} giờ\n` +
      `💰 TỔNG LƯƠNG  : ${formatVND(totalSalary || 0)}\n` +
      `━━━━━━━━━━━━━━━━━━━━`;
  } catch (err) {
    console.error('[AttendanceSvc] Lỗi báo cáo:', err.message);
    return '❌ Không thể lấy báo cáo lúc này.';
  }
}

function handleHelp(displayName) {
  return (
    `🤖 HƯỚNG DẪN ĐIỂM DANH & TÍNH LƯƠNG\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 Xin chào ${displayName}!\n\n` +
    `📌 CÚ PHÁP NHẮN TẮT (TỰ TÍNH LƯƠNG):\n` +
    `  • "4t 2n" → 4h ca trong + 2h ca ngoài hôm nay\n` +
    `  • "02/08 4t 2n" → Chấm công bù cho ngày 02/08\n` +
    `  • "6t" hoặc "6h" → 6h ca trong\n\n` +
    `📌 LỆNH HỆ THỐNG:\n` +
    `  • /baocao → Báo cáo tổng tiền lương`
  );
}

async function processMessage({ userId, displayName, groupId, messageText }) {
  if (!messageText) return null;

  const parsed = parseCommand(messageText);

  console.log(`[AttendanceSvc] Lệnh: "${parsed.command}" | User: ${displayName}`);

  switch (parsed.command) {
    case 'direct_hours':
      return handleDirectHours({
        userId,
        displayName,
        groupId,
        hoursData: parsed.hoursData,
        customDate: parsed.customDate,
        rawText: messageText,
      });

    case 'checkin':
      return handleCheckin({ userId, displayName, groupId });

    case 'checkout':
      return handleCheckout({ userId, displayName, groupId });

    case 'baocao':
      return handleBaoCao({ userId, displayName });

    case 'help':
      return handleHelp(displayName);

    default:
      return null;
  }
}

module.exports = {
  processMessage,
  parseCommand,
  handleCheckin,
  handleCheckout,
  handleBaoCao,
  handleHelp,
};
