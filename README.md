# Aimlock V9 - High Performance Gaming Config for iPhone

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Platform](https://img.shields.io/badge/Platform-iOS%2015--17-lightgrey.svg)
![Version](https://img.shields.io/badge/Version-9.1.0-green.svg)

**Aimlock V9** là bộ cấu hình XML và MobileConfig chuyên sâu dành cho game Free Fire trên iPhone, tập trung vào việc tối ưu hóa hiệu suất thiết bị, ổn định mạng và hỗ trợ các tính năng điều khiển nâng cao như Aimlock vùng đầu và Drag Aim (kéo tâm).

## 🚀 Tính năng nổi bật
- **Tối ưu hóa FPS & Mạng**: Mở khóa 120Hz, giảm Ping với DNS-over-HTTPS.
- **Hệ thống Aimlock**: Tự động bám mục tiêu vào vùng đầu với độ chính xác cao.
- **Drag Aim Interface**: Hỗ trợ nhận tín hiệu điều khiển từ bên ngoài qua API với độ trễ < 1ms.
- **Chống rung & Chống lố tâm**: Thuật toán EMA giúp ổn định tâm ngắm khi combat.

## 📂 Cấu trúc dự án
- `AimlockV9.xml`: Cấu hình game chính (v9.1.0).
- `AimlockV9.mobileconfig`: Hồ sơ cấu hình iOS tích hợp DNS/VPN/Restrictions.
- `AimController.py`: Máy chủ API điều khiển tâm ngắm.
- `ManageConfig.ps1`: Bộ công cụ quản lý, sao lưu và ký số trên Windows.
- `INSTALL_GUIDE.md`: Hướng dẫn cài đặt chi tiết trên iPhone.

## 🛠 Cách sử dụng
1. **Clone dự án**:
   ```bash
   git clone https://github.com/your-username/AimlockV9.git
   ```
2. **Cài đặt lên iPhone**: Theo dõi hướng dẫn tại [INSTALL_GUIDE.md](INSTALL_GUIDE.md).
3. **Chạy máy chủ điều khiển**:
   ```bash
   python AimController.py
   ```

## ⚠️ Miễn trừ trách nhiệm
Dự án này được tạo ra cho mục đích nghiên cứu và tối ưu hóa hiệu suất thiết bị. Việc sử dụng trong game có thể vi phạm điều khoản của nhà phát hành. Chúng tôi không chịu trách nhiệm cho bất kỳ rủi ro nào liên quan đến tài khoản của bạn.

## 📄 Giấy phép
Phát hành dưới giấy phép [MIT](LICENSE).
