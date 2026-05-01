# Tài liệu Kỹ thuật: Module Điều khiển Tâm ngắm Aimlock V9

## 1. Tổng quan
Module `AimController` là thành phần trung gian (Interface) cho phép hệ thống Aimlock V9 nhận tín hiệu từ các thiết bị hoặc phần mềm bên ngoài (External Hardware/Software) để thực hiện các thao tác khóa mục tiêu và kéo tâm (Drag Aim) với độ trễ cực thấp.

## 2. Giao thức Kết nối (API Interface)
Hệ thống sử dụng giao thức JSON-RPC qua cổng API được định nghĩa trong [AimlockV9.xml](file:///d:/New%20folder%20(13)/AimlockV9.xml).

### 2.1. API Kéo tâm (Drag Aim Control)
- **Endpoint**: `/v9/aim/control`
- **Method**: `POST`
- **Payload Format**:
```json
{
    "type": "drag",
    "x": 10.5,
    "y": -5.2,
    "timestamp": 1714560000000
}
```
- **Phản hồi (Response)**:
```json
{
    "status": "success",
    "offset": { "x": 26.25, "y": -23.4 },
    "latency_ms": 0.045
}
```

### 2.2. API Khóa mục tiêu (Aimlock Status)
- **Endpoint**: `/v9/aim/lock`
- **Payload Format**:
```json
{
    "type": "lock",
    "target": "head"
}
```

## 3. Cơ chế Xử lý (Logic)
1. **Smoothing (Làm mượt)**: Sử dụng thuật toán **Exponential Moving Average (EMA)** với hệ số alpha = 0.6 để triệt tiêu hiện tượng rung tâm khi nhận tín hiệu nhiễu từ bên ngoài.
2. **Vertical Boost (Tăng tốc dọc)**: Tự động nhân hệ số 1.8 cho trục Y để hỗ trợ các pha kéo tâm "One-Tap" chính xác hơn.
3. **Latency (Độ trễ)**: Mục tiêu xử lý dưới **1ms** để đảm bảo không có độ trễ giữa tín hiệu điều khiển và phản hồi trong game.

## 4. Kiểm thử (Testing)
Toàn bộ logic được xác thực qua bộ test:
- **Unit Test**: [test_aim_controller.py](file:///d:/New%20folder%20(13)/test_aim_controller.py)
- **Integration Test**: Kiểm tra luồng nhận tín hiệu và phản hồi offset thực tế.

## 5. Tích hợp MobileConfig
Các tham số cấu hình API được lưu trữ trong [AimlockV9.mobileconfig](file:///d:/New%20folder%20(13)/AimlockV9.mobileconfig) dưới dạng Metadata để các ứng dụng điều khiển bên ngoài có thể đọc và đồng bộ hóa tự động.
