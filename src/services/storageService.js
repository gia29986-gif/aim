/**
 * src/services/storageService.js
 * ================================
 * Lưu trữ dữ liệu chấm công trực tiếp lên GitHub Repository
 * dưới dạng file JSON, thông qua GitHub REST API v3.
 *
 * File dữ liệu được lưu tại: data/attendance.json trong repo.
 *
 * Cấu trúc file JSON:
 * {
 *   "records": [
 *     {
 *       "id": "uuid-string",
 *       "systemTime": "03/08/2026 19:58:08",
 *       "date": "03/08/2026",
 *       "userId": "1234567890",
 *       "displayName": "Nguyễn Văn A",
 *       "groupId": "9876543210",
 *       "type": "Checkin",          // "Checkin" | "Checkout" | "Checkin → Checkout"
 *       "checkinTime": "08:00:00",
 *       "checkoutTime": "",
 *       "totalHours": 0,
 *       "note": ""
 *     }
 *   ],
 *   "lastUpdated": "2026-08-03T19:58:08+07:00"
 * }
 */

'use strict';

const axios     = require('axios');
const env       = require('../config/env');
const timeUtils = require('../utils/timeUtils');

// ─── Cấu hình GitHub API ─────────────────────────────────────────────────
const GH_API     = 'https://api.github.com';
const DATA_PATH  = env.GITHUB_DATA_PATH; // VD: "data/attendance.json"

/**
 * Header xác thực GitHub API.
 */
function getHeaders() {
  return {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'Accept'       : 'application/vnd.github+json',
    'Content-Type' : 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Đọc file JSON từ GitHub repository.
 * Trả về { content, sha } — sha cần để cập nhật file sau này.
 *
 * @returns {Promise<{ data: Object, sha: string }>}
 */
async function readDataFile() {
  try {
    const url = `${GH_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${DATA_PATH}`;
    const response = await axios.get(url, { headers: getHeaders() });

    // GitHub trả nội dung file dưới dạng Base64
    const raw  = Buffer.from(response.data.content, 'base64').toString('utf8');
    const sha  = response.data.sha;
    const data = JSON.parse(raw);

    return { data, sha };
  } catch (err) {
    // File chưa tồn tại → trả về cấu trúc rỗng
    if (err.response && err.response.status === 404) {
      console.log(`[Storage] 📄 File "${DATA_PATH}" chưa có, sẽ tạo mới khi ghi lần đầu.`);
      return {
        data: { records: [], lastUpdated: null },
        sha : null,
      };
    }
    console.error('[Storage] ❌ Lỗi đọc file từ GitHub:', err.response?.data?.message || err.message);
    throw err;
  }
}

/**
 * Ghi (tạo mới hoặc cập nhật) file JSON lên GitHub repository.
 *
 * @param {Object} data - Toàn bộ object dữ liệu cần ghi
 * @param {string|null} sha - SHA của file hiện tại (null nếu tạo mới)
 * @param {string} [commitMessage] - Nội dung commit
 * @returns {Promise<void>}
 */
async function writeDataFile(data, sha, commitMessage) {
  try {
    data.lastUpdated = timeUtils.nowVN().toISOString();

    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');
    const url     = `${GH_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${DATA_PATH}`;

    const payload = {
      message: commitMessage || `chore: update attendance data ${timeUtils.formatNow()}`,
      content : content,
      branch  : env.GITHUB_BRANCH,
    };

    // Phải truyền sha khi UPDATE file (không cần khi CREATE)
    if (sha) payload.sha = sha;

    await axios.put(url, payload, { headers: getHeaders() });
    console.log(`[Storage] ✅ Đã ghi file "${DATA_PATH}" lên GitHub.`);
  } catch (err) {
    console.error('[Storage] ❌ Lỗi ghi file lên GitHub:', err.response?.data?.message || err.message);
    throw err;
  }
}

/**
 * Sinh ID duy nhất đơn giản (timestamp + random).
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────

/**
 * Lưu một bản ghi chấm công mới.
 * @param {Object} record - Thông tin bản ghi
 * @returns {Promise<Object>} Bản ghi đã lưu (có thêm id)
 */
async function saveAttendanceRecord(record) {
  const { data, sha } = await readDataFile();

  const newRecord = {
    id          : generateId(),
    systemTime  : record.systemTime   || timeUtils.formatNow(),
    date        : record.date         || timeUtils.formatDate(),
    userId      : record.userId       || '',
    displayName : record.displayName  || 'Không rõ',
    groupId     : record.groupId      || '',
    type        : record.type         || '',
    checkinTime : record.checkinTime  || '',
    checkoutTime: record.checkoutTime || '',
    insideHours : normalizeNumber(record.insideHours),
    outsideHours: normalizeNumber(record.outsideHours),
    totalHours  : normalizeNumber(record.totalHours),
    insideSalary: normalizeNumber(record.insideSalary),
    outsideSalary: normalizeNumber(record.outsideSalary),
    totalSalary : normalizeNumber(record.totalSalary),
    note        : record.note         || '',
  };

  data.records.push(newRecord);

  await writeDataFile(
    data,
    sha,
    `feat: ${record.type} - ${record.displayName} ${timeUtils.formatNow()} [skip ci]`
  );

  console.log(`[Storage] ✅ Đã lưu [${record.type}] cho ${record.displayName} (${record.userId})`);
  return newRecord;
}

/**
 * Lấy bản ghi check-in chưa có checkout của user trong ngày hôm nay.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getPendingCheckin(userId) {
  const { data } = await readDataFile();
  const today    = timeUtils.formatDate();

  // Tìm từ cuối mảng để lấy checkin gần nhất
  const records = data.records || [];
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (
      r.userId === String(userId) &&
      r.date   === today &&
      r.type   === 'Checkin' &&
      !r.checkoutTime
    ) {
      return r;
    }
  }
  return null;
}

/**
 * Cập nhật bản ghi check-in với thông tin checkout.
 * Tìm bản ghi Checkin mới nhất của userId hôm nay và cập nhật.
 *
 * @param {string} userId
 * @param {string} checkoutTime  - Giờ checkout (HH:mm:ss)
 * @param {number} totalHours    - Tổng giờ làm
 * @param {string} [note]
 * @returns {Promise<boolean>} true nếu cập nhật thành công
 */
async function updateCheckoutRecord(userId, checkoutTime, totalHours, note) {
  const { data, sha } = await readDataFile();
  const today         = timeUtils.formatDate();
  const records       = data.records || [];

  let targetIndex = -1;
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (
      r.userId === String(userId) &&
      r.date   === today &&
      r.type   === 'Checkin' &&
      !r.checkoutTime
    ) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    console.log(`[Storage] ⚠️ Không tìm thấy checkin để cập nhật cho user ${userId}`);
    return false;
  }

  // Cập nhật record với đầy đủ các trường giờ và lương
  const RATE_INSIDE = 30000;
  const insideHours = totalHours;
  const insideSalary = insideHours * RATE_INSIDE;

  records[targetIndex].type         = 'Checkin → Checkout';
  records[targetIndex].checkoutTime = checkoutTime;
  records[targetIndex].insideHours  = insideHours;
  records[targetIndex].outsideHours = 0;
  records[targetIndex].totalHours   = totalHours;
  records[targetIndex].insideSalary = insideSalary;
  records[targetIndex].outsideSalary = 0;
  records[targetIndex].totalSalary  = insideSalary;
  records[targetIndex].note         = note || '';

  data.records = records;

  await writeDataFile(
    data,
    sha,
    `feat: checkout - ${records[targetIndex].displayName} ${timeUtils.formatNow()} [skip ci]`
  );

  console.log(`[Storage] ✅ Cập nhật checkout cho user ${userId}: ${totalHours}h`);
  return true;
}

/**
 * Lấy báo cáo tổng giờ làm của user trong tháng chỉ định.
 * @param {string} userId
 * @param {string} [yearMonth] - VD: "2026-08" (mặc định: tháng hiện tại)
 * @returns {Promise<{ totalHours: number, days: number, records: Array }>}
 */
async function getMonthlyReport(userId, yearMonth) {
  const { data }   = await readDataFile();
  const records    = data.records || [];
  const { start, end } = timeUtils.getCurrentMonthRange(yearMonth);

  const moment = require('moment-timezone');

  let totalHours = 0;
  let totalSalary = 0;
  const workDays = new Set();
  const matched  = [];

  for (const r of records) {
    if (r.userId !== String(userId)) continue;
    if (!r.date) continue;

    const rowMoment = moment.tz(r.date, 'DD/MM/YYYY', timeUtils.TIMEZONE);
    if (!rowMoment.isValid()) continue;
    if (!rowMoment.isBetween(start, end, 'day', '[]')) continue;

    if (
      (r.type === 'Checkin → Checkout' || r.type === 'Checkout' || r.type === 'Nhập giờ trực tiếp') &&
      r.totalHours > 0
    ) {
      const rowSalary = Number(r.totalSalary || (r.insideSalary || 0) + (r.outsideSalary || 0) || r.totalHours * 30000);
      totalHours += r.totalHours;
      totalSalary += rowSalary;
      workDays.add(r.date);
      matched.push({
        date       : r.date,
        checkin    : r.checkinTime,
        checkout   : r.checkoutTime,
        totalHours : r.totalHours,
        totalSalary: rowSalary,
      });
    }
  }

  return {
    totalHours : Math.round(totalHours * 100) / 100,
    totalSalary: Math.round(totalSalary),
    days       : workDays.size,
    records    : matched.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

module.exports = {
  saveAttendanceRecord,
  getPendingCheckin,
  updateCheckoutRecord,
  getMonthlyReport,
  readDataFile,  // Export để debug
};
