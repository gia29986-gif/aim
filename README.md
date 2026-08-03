# 🤖 Zalo Attendance Bot (100% Free - GitHub Storage & Render 24/7)

> **Zalo Bot Chấm Công & Quản Lý Ca Làm Việc**  
> Dữ liệu được **tự động lưu trực tiếp thành file JSON ngay trên GitHub Repository** mà không cần dịch vụ đám mây trả phí hay Google Cloud! Chạy 24/7 hoàn toàn **MIỄN PHÍ** trên Render.com hoặc Railway.app.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-blue)](https://expressjs.com)
[![GitHub API Storage](https://img.shields.io/badge/Storage-GitHub%20REST%20API-black)](https://docs.github.com/en/rest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📋 Mục Lục

1. [Ưu Điểm Của Giải Pháp Free này](#-ưu-điểm-của-giải-pháp)
2. [Cấu Trúc Thư Mục Project](#-cấu-trúc-thư-mục-project)
3. [Bước 1: Tạo GitHub Token & Repo](#-bước-1-tạo-github-token--repository)
4. [Bước 2: Đẩy Mã Nguồn Lên GitHub](#-bước-2-đẩy-mã-nguồn-lên-github)
5. [Bước 3: Deploy Lên Render.com (Free 24/7)](#-bước-3-deploy-lên-rendercom-miễn-phí-247)
6. [Bước 4: Cấu Hình Webhook Trên Zalo](#-bước-4-cấu-hình-webhook-trên-zalo)
7. [Các Lệnh Bot & Định Dạng Dữ Liệu](#-các-lệnh-bot)

---

## 🌟 Ưu Điểm Của Giải Pháp

- ⚡ **100% Miễn Phí**: Không cần thẻ tín dụng, không dùng Google Cloud / Firebase / AWS.
- 💾 **Lưu trữ trên GitHub**: Mỗi lượt Check-in/Out sẽ tự động lưu vào file `data/attendance.json` trên GitHub.
- 🛑 **Không bị Lặp Build**: Các commit lưu dữ liệu có đính kèm thẻ `[skip ci]` giúp Render không bị build lại mỗi khi có dữ liệu mới.
- ⏰ **Tự Động Self-Ping 24/7**: Tích hợp cơ chế tự ping giữ server không bị sleep trên gói Free của Render.

---

## 📁 Cấu Trúc Thư Mục Project

```
zalo-attendance-bot/
├── .env.example              # Template khai báo biến môi trường
├── .env                      # File chứa token bí mật (KHÔNG commit lên Git)
├── .gitignore                # Bỏ qua node_modules, .env, log...
├── package.json              # Khai báo thư viện Node.js
├── Procfile                  # File cấu hình deploy cho Cloud
├── README.md                 # Tài liệu hướng dẫn sử dụng
├── index.js                  # Entry Point - Khởi tạo Express Server & Keep-Alive
├── data/
│   └── attendance.json       # File dữ liệu chấm công được lưu trữ trực tiếp
└── src/
    ├── config/
    │   └── env.js            # Đọc và validate cấu hình biến môi trường
    ├── controllers/
    │   └── webhookController.js # Xử lý các event từ Zalo OA Webhook
    ├── services/
    │   ├── attendanceService.js # Business logic chấm công, parse lệnh Regex
    │   ├── storageService.js    # Đọc/Ghi file JSON trực tiếp trên GitHub API
    │   └── zaloService.js       # Gửi tin nhắn cá nhân / nhóm qua Zalo OA API
    └── utils/
        └── timeUtils.js         # Xử lý tính toán thời gian theo múi giờ Việt Nam (UTC+7)
```

---

## 🔑 Bước 1: Tạo GitHub Token & Repository

### 1.1 Tạo Personal Access Token (PAT) trên GitHub
1. Đăng nhập vào [GitHub.com](https://github.com).
2. Vào **Settings** (Góc trên bên phải) → Scroll xuống chọn **Developer settings**.
3. Chọn **Personal access tokens** → **Fine-grained tokens** → Click **Generate new token**.
4. Cấu hình Token:
   - **Token name**: `Zalo Bot Token`
   - **Expiration**: Chọn *90 days* hoặc *Custom* / *No expiration* (tùy nhu cầu).
   - **Repository access**: Chọn **Only select repositories** → Chọn repository bot của bạn (sau khi tạo ở bước 1.2).
   - **Permissions**: Chọn **Repository permissions** → Tìm mục **Contents** → Chọn quyền **Read and write**.
5. Click **Generate token** và **Copy lại chuỗi Token** (dạng `github_pat_...` hoặc `ghp_...`).

### 1.2 Tạo Repository Mới Trên GitHub
1. Vào [github.com/new](https://github.com/new).
2. Đặt tên Repo: `zalo-attendance-bot`.
3. Chọn quyền **Public** hoặc **Private** (Private vẫn dùng tốt và bảo mật hơn).
4. Click **Create repository**.

---

## 🚀 Bước 2: Đẩy Mã Nguồn Lên GitHub

Mở Terminal (PowerShell hoặc Git Bash) tại thư mục `zalo-attendance-bot` và chạy các lệnh sau:

```bash
# 1. Khởi tạo Git repository local
git init

# 2. Thêm toàn bộ mã nguồn
git add .

# 3. Commit mã nguồn đầu tiên
git commit -m "feat: initial commit zalo attendance bot"

# 4. Đổi tên branch thành main
git branch -M main

# 5. Liên kết với GitHub Repo của bạn (Thay YOUR_USERNAME bằng username GitHub của bạn)
git remote add origin https://github.com/YOUR_USERNAME/zalo-attendance-bot.git

# 6. Đẩy mã nguồn lên GitHub
git push -u origin main
```

---

## ☁️ Bước 3: Deploy Lên Render.com (Miễn Phí 24/7)

### 3.1 Tạo Web Service Trên Render
1. Đăng nhập vào [Render.com](https://render.com) (Đăng nhập bằng GitHub).
2. Click **New +** → Chọn **Web Service**.
3. Kết nối với Repository `zalo-attendance-bot` của bạn.
4. Cấu hình các thông số:
   - **Name**: `zalo-attendance-bot`
   - **Region**: Singapore (gần Việt Nam nhất)
   - **Branch**: `main`
   - **Root Directory**: Để trống
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Instance Type**: `Free`

### 3.2 Khai Báo Biến Môi Trường (Environment Variables)
Chuyển sang tab **Environment** trên Render và thêm các biến sau:

| Tên Biến (Key) | Giá Trị (Value) | Ghi Chú |
|---|---|---|
| `PORT` | `10000` | Cổng mặc định của Render |
| `NODE_ENV` | `production` | Môi trường sản xuất |
| `ZALO_BOT_TOKEN` | `983376812717887946:...` | Token Zalo Bot của bạn |
| `GITHUB_TOKEN` | `ghp_xxxxxxxxxxxx` | Personal Access Token lấy ở Bước 1.1 |
| `GITHUB_OWNER` | `username_github` | Username GitHub của bạn |
| `GITHUB_REPO` | `zalo-attendance-bot` | Tên Repo trên GitHub |
| `GITHUB_BRANCH` | `main` | Branch chứa dữ liệu |
| `GITHUB_DATA_PATH` | `data/attendance.json` | Đường dẫn file lưu trữ |
| `APP_URL` | `https://zalo-attendance-bot.onrender.com` | URL Render cấp cho ứng dụng của bạn |

Click **Save Changes**. Render sẽ tự động Build và Start ứng dụng!

### 3.3 Chống Sleep 24/7 (Đã Tích Hợp)
- Bot đã được tích hợp sẵn cơ chế **Self-Ping** tự động gọi đường dẫn `/health` mỗi 10 phút để Render không bị tắt.
- *(Tùy chọn bổ sung)*: Bạn có thể đăng ký miễn phí tại [UptimeRobot.com](https://uptimerobot.com) → Tạo monitor loại **HTTP(s)** trỏ đến `https://your-app.onrender.com/health` với chu kỳ 5-10 phút/lần.

---

## 📲 Bước 4: Cấu Hình Webhook Trên Zalo

1. Truy cập [Zalo Developers Console](https://developers.zalo.me).
2. Chọn ứng dụng Zalo Bot / Official Account của bạn.
3. Vào mục **Webhook** → Nhập đường dẫn:
   ```text
   https://zalo-attendance-bot.onrender.com/webhook
   ```
4. Chọn các sự kiện (Events):
   - `user_send_text` (Tin nhắn từ người dùng)
   - `user_joined_group` (Thành viên mới gia nhập nhóm)
   - `follow` / `unfollow` (Theo dõi OA)
5. Nhấn **Lưu / Xác nhận**.

---

## 💬 Các Lệnh Bot & Định Dạng Dữ Liệu

### Lệnh Sử Dụng Trong Zalo:
- `/in` hoặc `/checkin`: Bắt đầu ca làm việc.
- `/out` hoặc `/checkout`: Kết thúc ca làm việc, hệ thống tự động tính số giờ làm.
- `/baocao`: Xem tổng số giờ làm và số ngày làm trong tháng.
- `Checkin 08:30`: Ghi nhận check-in giờ tùy chỉnh.
- `Làm từ 8h đến 17h`: Ghi nhận khoảng thời gian làm việc.
- `/help`: Xem hướng dẫn chi tiết.

### Cấu Trúc File Dữ Liệu `data/attendance.json`:
Mỗi khi nhân viên check-in / check-out, dữ liệu sẽ được lưu tự động lên GitHub dạng:
```json
{
  "records": [
    {
      "id": "1722690000000-abc123",
      "systemTime": "03/08/2026 08:00:00",
      "date": "03/08/2026",
      "userId": "1234567890",
      "displayName": "Nguyễn Văn A",
      "groupId": "9876543210",
      "type": "Checkin → Checkout",
      "checkinTime": "08:00:00",
      "checkoutTime": "17:30:00",
      "totalHours": 9.5,
      "note": ""
    }
  ],
  "lastUpdated": "2026-08-03T17:30:00+07:00"
}
```

---
**Chúc bạn triển khai Zalo Bot Chấm Công thành công 24/7 Hoàn Toàn Miễn Phí!** 🎉
