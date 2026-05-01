# Hướng dẫn Kích hoạt Toàn diện MobileConfig trên iPhone

Để file [AimlockV9.mobileconfig](file:///d:/New%20folder%20(13)/AimlockV9.mobileconfig) hoạt động đầy đủ các tính năng (DNS, VPN, Wi-Fi, Restrictions), bạn cần thực hiện chính xác các bước sau:

## 1. Chuyển file vào iPhone
- **Cách tốt nhất**: Gửi qua **AirDrop** từ Mac hoặc gửi file qua **Email/Telegram/iCloud Drive**.
- **Lưu ý**: Không mở trực tiếp trong một số trình duyệt bên thứ 3 vì có thể bị lỗi định dạng XML. Nên dùng **Safari** để tải về.

## 2. Quy trình Cài đặt (Bắt buộc)
Khi mở file, iPhone sẽ thông báo "Profile Downloaded" (Hồ sơ đã tải về).
1. Mở ứng dụng **Settings (Cài đặt)**.
2. Chọn dòng **Profile Downloaded (Đã tải về hồ sơ)** ở ngay phía dưới thông tin Apple ID.
3. Nhấn **Install (Cài đặt)** ở góc trên bên phải.
4. Nhập mật mã (Passcode) của máy.
5. Tiếp tục nhấn **Install** cho đến khi hoàn tất.

## 3. Tin cậy Chứng chỉ (Nếu có payload Cert)
Nếu hồ sơ của bạn chứa chứng chỉ bảo mật (để chạy VPN/DNS HTTPS):
1. Vào **Settings (Cài đặt)** -> **General (Cài đặt chung)** -> **About (Giới thiệu)**.
2. Kéo xuống dưới cùng chọn **Certificate Trust Settings (Cài đặt tin cậy chứng chỉ)**.
3. Gạt nút **Bật (Enable)** cho chứng chỉ liên quan đến Aimlock V9.

## 4. Xử lý lỗi "Not Verified" (Hồ sơ không được xác minh)
Để file hoạt động "mượt" nhất và không bị hệ thống cảnh báo đỏ:
- Bạn cần **Ký số (Sign)** file bằng một chứng chỉ SSL hợp lệ. 
- Sử dụng script [ManageConfig.ps1](file:///d:/New%20folder%20(13)/ManageConfig.ps1) (Tùy chọn 5) để xem hướng dẫn lệnh ký bằng OpenSSL.
- Sau khi ký, hồ sơ sẽ có tích xanh **"Verified"**, giúp các dịch vụ như VPN tự động kết nối (On-Demand) mà không cần hỏi lại.

## 5. Kiểm tra Hoạt động
- **DNS**: Truy cập `1.1.1.1/help` trên Safari để kiểm tra xem "Using DNS over HTTPS (DoH)" có báo **Yes** hay không.
- **VPN**: Kiểm tra trong mục **Settings -> VPN**, bạn sẽ thấy cấu hình "Aimlock V9 Ultra-Fast".
- **Restrictions**: Kiểm tra xem mục "Làm mới ứng dụng trong nền" có bị khóa/tắt theo cấu hình hay không.

---
**Mẹo**: Để gỡ bỏ hoàn toàn, bạn chỉ cần vào **Settings -> General -> VPN & Device Management**, chọn hồ sơ Aimlock V9 và nhấn **Remove Profile**.
