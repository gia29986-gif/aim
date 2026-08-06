/**
 * src/services/attendanceService.js
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

function extractCustomDate(text) {
  const currentYear = new Date().getFullYear();
  const dateMatch = text.match(/(?:ngày\s*)?(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}|\d{2}))?/i);

  if (dateMatch) {
    const day   = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    let year  = dateMatch[3] ? dateMatch[3] : currentYear;
    if (String(year).length === 2) year = `20${year}`;

    return `${day}/${month}/${year}`;
  }

  return null;
}

function parseDirectHours(text) {
  const cleanedText = text.replace(/(?:ngày\s*)?\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/gi, '').trim().toLowerCase();

  const parseHourToken = (hoursText, minutesText) => {
    const hours = Number(String(hoursText).replace(',', '.'));
    if (!Number.isFinite(hours)) return null;

    if (!minutesText) {
      return Math.round(hours * 100) / 100;
    }

    const minutes = Number(minutesText);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 60) {
      return null;
    }

    return Math.round((hours + minutes / 60) * 100) / 100;
  };

  const timeUnit = '(?:tiếng|tieng|giờ|gio|h|g)';
  const minuteUnit = '(?:phút|phut|p|m)';
  const timePattern = `(\\d+(?:[\\.,]\\d+)?)\\s*(?:${timeUnit}\\s*(\\d{1,2})\\s*${minuteUnit}?)?`;

  const parseByLabel = (labelPattern) => {
    const regex = new RegExp(`${timePattern}\\s*${labelPattern}(?![a-zA-Z\\u00C0-\\u024F\\u1E00-\\u1EFF])`, 'gi');
    let total = 0;
    let hasMatch = false;
    let match;

    while ((match = regex.exec(cleanedText)) !== null) {
      const parsed = parseHourToken(match[1], match[2]);
      if (parsed !== null) {
        total += parsed;
        hasMatch = true;
      }
    }

    return { hours: Math.round(total * 100) / 100, matched: hasMatch };
  };

  const inside = parseByLabel('(?:trong\\s*nhà|trong\\s*nha|trong|t)');
  const outside = parseByLabel('(?:ngoài\\s*trời|ngoai\\s*troi|ngoài|ngoai|n)');

  let insideHours = inside.hours;
  let outsideHours = outside.hours;
  let matched = inside.matched || outside.matched;

  if (!matched) {
    const plainHoursMatch = cleanedText.match(
      new RegExp(`^(?:báo\\s*giờ|bao\\s*gio|báo|bao|hôm\\s*nay|hom\\s*nay|làm|lam|ca)?\\s*${timePattern}\\s*${timeUnit}$`, 'i')
    );
    if (plainHoursMatch) {
      const parsed = parseHourToken(plainHoursMatch[1], plainHoursMatch[2]);
      if (parsed !== null) {
        insideHours = parsed;
        matched = true;
      }
    }
  }

  if (matched) {
    return {
      matched: true,
      insideHours,
      outsideHours,
      totalHours: Math.round((insideHours + outsideHours) * 100) / 100,
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

async function handleDirectHours({ userId, displayName, groupId, hoursData, customDate, rawText }) {
  try {
    const { insideHours, outsideHours, totalHours } = hoursData;

    const insideSalary  = insideHours * RATE_INSIDE;
    const outsideSalary = outsideHours * RATE_OUTSIDE;
    const totalSalary   = insideSalary + outsideSalary;

    const nowStr  = timeUtils.formatNow();
    const targetDateStr = customDate || timeUtils.formatDate();

    await storageService.saveAttendanceRecord({
      systemTime   : nowStr,
      date         : targetDateStr,
      userId       : userId,
      displayName  : displayName,
      groupId      : groupId || '',
      type         : 'Nhập giờ trực tiếp',
      insideHours  : insideHours,
      outsideHours : outsideHours,
      totalHours   : totalHours,
      insideSalary : insideSalary,
      outsideSalary: outsideSalary,
      totalSalary  : totalSalary,
      note         : rawText,
    });

    return `💰 Ghi nhận ca làm thành công!\n👤 Nhân viên : ${displayName}\n📅 Ngày      : ${targetDateStr}\n⏱️  Giờ làm   : ${insideHours}h trong | ${outsideHours}h ngoài (Tổng: ${totalHours}h)\n💵 Tiền lương: ${formatVND(totalSalary)}`;
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

    return `✅ Checkin thành công!\n👤 Nhân viên : ${displayName}\n🕐 Giờ vào   : ${checkinTimeStr}\n📅 Ngày      : ${dateStr}`;
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

    return `🏁 Checkout thành công!\n👤 Nhân viên  : ${displayName}\n⏱️  Tổng giờ   : ${totalHours} giờ\n💵 Tiền lương : ${formatVND(totalSalary)}\n📅 Ngày       : ${timeUtils.formatDate()}`;
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

    return `📊 BÁO CÁO LƯƠNG ${timeUtils.getCurrentMonthLabel()}\n━━━━━━━━━━━━━━━━━━━━\n👤 Nhân viên   : ${displayName}\n📅 Số ca làm   : ${days} ca\n⏱️  Tổng giờ    : ${totalHours} giờ\n💰 TỔNG LƯƠNG  : ${formatVND(totalSalary || 0)}\n━━━━━━━━━━━━━━━━━━━━`;
  } catch (err) {
    console.error('[AttendanceSvc] Lỗi báo cáo:', err.message);
    return '❌ Không thể lấy báo cáo lúc này.';
  }
}

function handleHelp(displayName) {
  return `🤖 HƯỚNG DẪN ĐIỂM DANH & TÍNH LƯƠNG\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👋 Xin chào ${displayName}!\n\n📌 CÚ PHÁP NHẮN TẮT (TỰ TÍNH LƯƠNG):\n  • "4t 2n" → 4h ca trong + 2h ca ngoài hôm nay\n  • "02/08 4t 2n" → Chấm công bù cho ngày 02/08\n  • "6t" hoặc "6h" → 6h ca trong\n\n📌 LỆNH HỆ THỐNG:\n  • /baocao → Báo cáo tổng tiền lương`;
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
