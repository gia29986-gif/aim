/**
 * src/utils/timeUtils.js
 * ======================
 * Các tiện ích xử lý thời gian theo múi giờ Việt Nam (UTC+7).
 * Sử dụng moment-timezone để tránh lỗi offset DST.
 */

'use strict';

const moment = require('moment-timezone');
const env    = require('../config/env');

const TIMEZONE = env.TIMEZONE; // 'Asia/Ho_Chi_Minh'

/**
 * Lấy thời điểm hiện tại theo múi giờ VN.
 * @returns {moment.Moment}
 */
function nowVN() {
  return moment().tz(TIMEZONE);
}

/**
 * Format thời điểm hiện tại thành chuỗi ngày giờ đầy đủ.
 * @returns {string} VD: "03/08/2026 19:58:08"
 */
function formatNow() {
  return nowVN().format('DD/MM/YYYY HH:mm:ss');
}

/**
 * Format chỉ phần ngày.
 * @param {moment.Moment} [m] - moment object (mặc định: now)
 * @returns {string} VD: "03/08/2026"
 */
function formatDate(m) {
  return (m || nowVN()).format('DD/MM/YYYY');
}

/**
 * Format chỉ phần giờ:phút:giây.
 * @param {moment.Moment} [m]
 * @returns {string} VD: "19:58:08"
 */
function formatTime(m) {
  return (m || nowVN()).format('HH:mm:ss');
}

/**
 * Parse timestamp Unix (milliseconds) về moment VN.
 * @param {number} ts - Unix timestamp (ms)
 * @returns {moment.Moment}
 */
function fromTimestamp(ts) {
  return moment(ts).tz(TIMEZONE);
}

/**
 * Tính khoảng cách thời gian giữa hai thời điểm (theo giờ, làm tròn 2 chữ số).
 * @param {moment.Moment} startMoment
 * @param {moment.Moment} endMoment
 * @returns {number} Số giờ đã làm (VD: 8.5)
 */
function calcWorkHours(startMoment, endMoment) {
  const diffMs = endMoment.diff(startMoment);
  if (diffMs <= 0) return 0;
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100; // Làm tròn 2 chữ số
}

/**
 * Parse chuỗi giờ dạng "8h", "8:30", "08:30" thành [hour, minute].
 * @param {string} timeStr
 * @returns {{ hour: number, minute: number } | null}
 */
function parseTimeString(timeStr) {
  if (!timeStr) return null;

  // Xử lý dạng "8h30", "08h30", "8h", "17h"
  const matchH = timeStr.match(/^(\d{1,2})h(\d{0,2})$/i);
  if (matchH) {
    return {
      hour  : parseInt(matchH[1], 10),
      minute: parseInt(matchH[2] || '0', 10),
    };
  }

  // Xử lý dạng "8:30", "08:30", "08:30:00"
  const matchColon = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (matchColon) {
    return {
      hour  : parseInt(matchColon[1], 10),
      minute: parseInt(matchColon[2], 10),
    };
  }

  // Xử lý số thuần như "8" hoặc "17"
  const matchNum = timeStr.match(/^(\d{1,2})$/);
  if (matchNum) {
    const h = parseInt(matchNum[1], 10);
    if (h >= 0 && h <= 23) return { hour: h, minute: 0 };
  }

  return null;
}

/**
 * Tạo moment VN với giờ cụ thể từ chuỗi giờ.
 * @param {string} timeStr - VD: "08:30", "8h30"
 * @param {moment.Moment} [baseDate] - Ngày cơ sở (mặc định: hôm nay)
 * @returns {moment.Moment | null}
 */
function buildMomentFromTime(timeStr, baseDate) {
  const parsed = parseTimeString(timeStr);
  if (!parsed) return null;

  const base = baseDate ? baseDate.clone() : nowVN();
  return base
    .clone()
    .hour(parsed.hour)
    .minute(parsed.minute)
    .second(0)
    .millisecond(0);
}

/**
 * Lấy đầu tháng và cuối tháng hiện tại theo VN timezone.
 * @param {string} [yearMonth] - VD: "2026-08" (mặc định: tháng hiện tại)
 * @returns {{ start: moment.Moment, end: moment.Moment }}
 */
function getCurrentMonthRange(yearMonth) {
  const base = yearMonth
    ? moment.tz(yearMonth, 'YYYY-MM', TIMEZONE)
    : nowVN();

  return {
    start: base.clone().startOf('month'),
    end  : base.clone().endOf('month'),
  };
}

/**
 * Format số giờ thành chuỗi dễ đọc.
 * @param {number} hours
 * @returns {string} VD: "8 giờ 30 phút"
 */
function formatHours(hours) {
  if (!hours || hours <= 0) return '0 phút';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

/**
 * Lấy tên tháng/năm hiện tại.
 * @returns {string} VD: "Tháng 8/2026"
 */
function getCurrentMonthLabel() {
  const m = nowVN();
  return `Tháng ${m.month() + 1}/${m.year()}`;
}

/**
 * So sánh hai ngày (chỉ phần ngày, không tính giờ).
 * @param {moment.Moment} m1
 * @param {moment.Moment} m2
 * @returns {boolean}
 */
function isSameDay(m1, m2) {
  return m1.format('YYYY-MM-DD') === m2.format('YYYY-MM-DD');
}

module.exports = {
  nowVN,
  formatNow,
  formatDate,
  formatTime,
  fromTimestamp,
  calcWorkHours,
  parseTimeString,
  buildMomentFromTime,
  getCurrentMonthRange,
  formatHours,
  getCurrentMonthLabel,
  isSameDay,
  TIMEZONE,
};
