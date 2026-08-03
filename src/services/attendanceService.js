/**
 * src/services/attendanceService.js
 * ==================================
 * Service chứa toàn bộ business logic chấm công & tính lương.
 */

'use strict';

const storageService = require('./storageService');
const timeUtils      = require('../utils/timeUtils');

// ─── Giá lương mặc định (VNĐ/giờ) ──────────────────────────────────────────
const RATE_INSIDE  = 30000; // 30.000đ / giờ ca trong
const RATE_OUTSIDE = 35000; // 35.000đ / giờ ca ngoài

// ─── Helper định dạng tiền VNĐ ──────────────────────────────────────────────
function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

/**
 * Phân tích cú pháp nhắn giờ làm trực tiếp (VD: "4 trong 2 ngoài", "6h", "5 tiếng trong")
 */
function parseDirectHours(text) {
  const trimmed = text.trim().toLowerCase();
  
  let insideHours = 0;
  let outsideHours = 0;
  let matched = false;

  // Pattern 1: "4 trong 2 ngoài" hoặc "4h trong 2h ngoài"
  const combinedMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*trong\s*(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*ngoài/i);
  if (combinedMatch) {
    insideHours = parseFloat(combinedMatch[1]);
    outsideHours = parseFloat(combinedMatch[2]);
    matched = true;
  } else {
    // Pattern 2: "2 ngoài 4 trong"
    const reversedMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*ngoài\s*(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*trong/i);
    if (reversedMatch) {
      outsideHours = parseFloat(reversedMatch[1]);
      insideHours = parseFloat(reversedMatch[2]);
      matched = true;
    } else {
      // Pattern 3: Chỉ nhắn ca trong (VD: "6 trong", "5h trong")
      const insideMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*trong\b/i);
      if (insideMatch) {
        insideHours = parseFloat(insideMatch[1]);
        matched = true;
      }

      // Pattern 4: Chỉ nhắn ca ngoài (VD: "4 ngoài", "3 tiếng ngoài")
      const outsideMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)?\s*ngoài\b/i);
      if (outsideMatch) {
        outsideHours = parseFloat(outsideMatch[1]);
        matched = true;
      }

      // Pattern 5: Chỉ nhắn số tiếng thuần túy (VD: "6 tiếng", "8h", "7.5 giờ") -> Mặc định là ca trong
      if (!matched) {
        const plainHoursMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:tiếng|h|giờ)$/i);
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

// ─── Regex patterns cho các lệnh hệ thống khác ───────────────────────────
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

  // Thử phân tích cú pháp nhắn giờ làm trực tiếp
  const direct = parseDirectHours(trimmed);
  if (direct.matched) {
    return { command: 'direct_hours', hoursData: direct };
  }

  return { command: 'unknown' };
}

/**
 * Xử lý nhập giờ làm trực tiếp (VD: 4 trong 2 ngoài)
 */
async function handleDirectHours({ userId, displayName, groupId, hoursData, rawText }) {
  try {
    const { insideHours, outsideHours, totalHours } = hoursData;

    const insideSalary  = insideHours * RATE_INSIDE;
    const outsideSalary = outsideHours * RATE_OUTSIDE;
    const totalSalary   = insideSalary + outsideSalary;

    const nowStr  = timeUtils.formatNow();
    const dateStr = timeUtils.formatDate();

    // Ghi trực tiếp vào GitHub Storage
    await storageService.saveAttendanceRecord({
      systemTime   : nowStr,
      date         : dateStr,
      userId       : userId,
      displayName  : displayName,
      groupId      : groupId || '',
      type         : 'Nhập giờ trực tiếp',
      insideHours  : insideHours,
      outsideHours : outsideHours,
      totalHours   : totalHours,
      insideSalary : insideSalary,
      outsideSalary: outsideSalary,
      totalSalary  : totalSalary,      // 👈 Lưu tổng tiền lương VNĐ vào đây
      note         : rawText,
    });

    return (
      `💰 Ghi nhận ca làm thành công!\n` +
      `👤 Nhân viên : ${displayName}\n` +
      `⏱️  Giờ làm   : ${insideHours}h trong | ${outsideHours}h ngoài (Tổng: ${totalHours}h)\n` +
      `💵 Tiền lương: ${formatVND(totalSalary)}\n` +
      `📅 Ngày      : ${dateStr}`
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
      `📅 Ngày      : ${dateStr}`
    );
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
    const totalSalary = totalHours * RATE_INSIDE; // Mặc định ca trong

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
      `📅 Ngày       : ${timeUtils.formatDate()}`
    );
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
      `━━━━━━━━━━━━━━━━━━━━`
    );
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
    `📌 NHẮN GIỜ LÀM TRỰC TIẾP (TỰ TÍNH LƯƠNG):\n` +
    `  • "4 trong 2 ngoài" → Tính 4h ca trong + 2h ca ngoài\n` +
    `  • "6 tiếng" hoặc "6h" → Tính 6h ca trong\n\n` +
    `📌 LỆNH HỆ THỐNG:\n` +
    `  • /in hoặc /checkin → Bắt đầu ca\n` +
    `  • /out hoặc /checkout → Kết thúc ca\n` +
    `  • /baocao → Xem tổng lương tháng này`
  );
}

async function processMessage({ userId, displayName, groupId, messageText })
