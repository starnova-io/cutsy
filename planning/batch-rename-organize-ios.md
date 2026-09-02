# Sortsy — Planning: Batch Rename & Organize cho iOS

> Tài liệu planning giai đoạn 0: định vị sản phẩm, tên app, tech stack và định hướng UI/UX.
> Nguồn cảm hứng: "Batch Rename and Organize" (JD Android-Apps, 100K+ lượt tải) — nhưng thiết kế lại từ đầu cho mô hình quyền của iOS, không port 1:1.

---

## 1. Tên app

**Đề xuất chính: `Sortsy`** — cùng "họ" thương hiệu với Cutsy (ngắn, dễ nhớ, đuôi *-sy*, thân thiện), gợi đúng hành vi cốt lõi (sort/organize). Subtitle App Store: *"Batch rename & organize files"*.

Phương án dự phòng (nếu Sortsy vướng trademark / trùng tên trên App Store):

| Tên | Ghi chú |
|---|---|
| `Renamely` | Nhấn mạnh rename, dễ SEO từ khóa "rename" |
| `Batchly` | Gợi "batch", hơi generic |
| `Tidsy` | Tidy + sy, giữ họ thương hiệu |
| `Namekit` | Nghe "công cụ", hợp positioning utility |

Việc cần làm trước khi chốt: search App Store cả US/VN, check trademark (USPTO/WIPO nhanh), check domain `sortsy.app` và handle mạng xã hội.

---

## 2. Định vị sản phẩm trên iOS (điều chỉnh so với Android)

iOS không có `MANAGE_EXTERNAL_STORAGE` — nhưng **document picker + security-scoped bookmark** cho phép người dùng cấp quyền cả một thư mục (On My iPhone, iCloud Drive, và cả server SMB/file provider bên thứ ba đã add trong Files). Trong phạm vi thư mục đã cấp, app đọc/ghi/đổi tên/di chuyển file thoải mái. Vậy sản phẩm iOS khả thi ở mức cao, chỉ khác mô hình cấp quyền.

Ma trận tính năng Android → iOS:

| Tính năng gốc (Android) | iOS | Cách làm |
|---|---|---|
| Batch rename (prefix/suffix/counter, hoa thường) | ✅ Đầy đủ | FileManager trong security scope, NSFileCoordinator |
| Tổ chức thư mục theo quy tắc (ngày, định dạng, metadata) | ✅ Đầy đủ | Rules engine + move trong thư mục đã cấp quyền |
| Sửa EXIF (ngày giờ, GPS) cho file ảnh | ✅ Đầy đủ | ImageIO (CGImageSource/Destination), không cần lib ngoài |
| Sửa ngày/GPS ảnh trong thư viện Photos | ✅ | PhotoKit `PHAssetChangeRequest` (creationDate, location đều sửa được) |
| Geotag từ file GPX | ✅ | Parse GPX, nội suy theo timestamp |
| Tìm ảnh trùng/tương tự (PHash/AverageHash) | ✅ | dHash/pHash tự viết + Vision `VNGenerateImageFeaturePrintRequest` cho "similar" |
| Giám sát thư mục tức thời (folder monitoring) | ❌ Không có nền vĩnh viễn | Thay bằng: chạy workflow khi mở app + `BGProcessingTask` best-effort |
| Workflow theo lịch | ⚠️ Một phần | Shortcuts Automations (App Intents) — người dùng đặt lịch trong Shortcuts |
| Tích hợp Tasker | 🔁 Thay thế | **App Intents / Shortcuts** — còn mạnh hơn về hệ sinh thái iOS |
| SMB | ✅ gián tiếp / ⚠️ trực tiếp | Gián tiếp: Files đã hỗ trợ SMB, app dùng qua document picker. Trực tiếp (Pro): lib AMSMB2 nếu cần trải nghiệm riêng |

Kết luận: khoảng 85% giá trị cốt lõi làm được trên iOS, và vì **chưa có app iOS nào làm trọn bộ này**, khoảng trống thị trường là thật. Điểm bán chính: *rename/organize hàng loạt + sửa EXIF hàng loạt + dọn ảnh trùng — tất cả on-device, không upload* (nhất quán triết lý privacy của Cutsy).

---

## 3. Tech stack

### Nền tảng
- **Swift 6 + SwiftUI**, minimum **iOS 17** (để dùng `@Observable`, SwiftData, TipKit; iOS 17 hiện đã phủ tuyệt đại đa số thiết bị).
- Xcode project + **Swift Package modular hóa phần lõi** để test độc lập UI:
  - `RenameEngine` — token/rule → tên mới, pure function, dễ unit test.
  - `OrganizeEngine` — rule → kế hoạch di chuyển (plan/preview/apply).
  - `ExifKit` — đọc/ghi EXIF qua ImageIO, parse GPX, nội suy GPS.
  - `DedupeKit` — dHash/pHash (Accelerate/vImage) + Vision feature print.
  - `FileAccessKit` — security-scoped bookmarks, NSFileCoordinator, undo journal.

### Framework hệ thống (ưu tiên first-party, gần như không cần dependency ngoài)
| Nhu cầu | Công nghệ |
|---|---|
| Chọn & giữ quyền thư mục | `fileImporter` / UIDocumentPicker + security-scoped bookmark |
| Thao tác file an toàn | FileManager + NSFileCoordinator (an toàn với iCloud Drive) |
| EXIF read/write | ImageIO (`CGImageSource`, `CGImageDestination`) |
| Photos (ngày/GPS, xoá ảnh trùng) | PhotoKit (`PHAsset`, `PHAssetChangeRequest`) |
| Ảnh tương tự | Vision `VNGenerateImageFeaturePrintRequest`; hash thô bằng vImage |
| Chạy nền batch lớn | `BGProcessingTask` + tiếp tục khi mở lại (checkpoint) |
| Tự động hóa | **App Intents** (Shortcuts, Spotlight, widget interactive) |
| Lưu presets/rules/lịch sử | **SwiftData** |
| IAP | **StoreKit 2** (`Product`, `Transaction`) |
| Map chọn GPS | MapKit |
| Onboarding gợi ý | TipKit |

### Dependency ngoài (tối thiểu)
- `CoreGPX` (hoặc parser GPX tự viết ~200 dòng — khuyến nghị tự viết để không kéo dep).
- `AMSMB2` — chỉ khi làm SMB trực tiếp ở Pro, phase sau.
- Analytics: **TelemetryDeck** (privacy-first, khớp thông điệp "không upload ảnh") — hoặc không dùng gì ở v1.

### Nguyên tắc kiến trúc
- **Plan → Preview → Apply → Undo**: mọi thao tác batch sinh ra một "kế hoạch" bất biến, hiển thị preview, apply có journal để undo. Đây vừa là kiến trúc vừa là điểm UX ăn tiền.
- Concurrency: Swift Concurrency (`TaskGroup`) cho hash/EXIF hàng loạt, giới hạn song song theo `ProcessInfo.activeProcessorCount`.
- Không backend, không tài khoản — mọi thứ on-device (rẻ, đúng brand, review App Store dễ).

### Mô hình kinh doanh (khớp bản gốc)
- **Freemium + IAP mở khóa Pro** (StoreKit 2):
  - Free: rename cơ bản (đủ token), 1 preset, organize 1 rule, quét trùng có giới hạn nhóm hiển thị.
  - **Pro (lifetime ~ $6.99–9.99, cân nhắc thêm gói năm)**: preset không giới hạn, rule chains, EXIF batch + GPX, Shortcuts actions nâng cao, SMB trực tiếp (phase sau).

---

## 4. UI/UX design

### Nguyên tắc
1. **Không bao giờ phá hủy mù quáng** — mọi batch đều có màn Preview (tên cũ → tên mới, cây thư mục trước/sau) và Undo sau khi apply.
2. **Native trước** — SF Symbols, SF Pro, layout chuẩn HIG, hỗ trợ Dark Mode + Dynamic Type từ ngày đầu; app utility sống nhờ cảm giác "đồ Apple".
3. **Mô hình quyền là một phần UX** — người dùng iOS không quen "cấp cả thư mục"; onboarding phải dạy điều này bằng 1 màn duy nhất, minh họa trực quan.
4. **Task-first, không file-browser-first** — khác Android: mở app là thấy việc cần làm, không phải cây thư mục.

### Cấu trúc điều hướng (TabView 4 tab)
```
┌──────────────────────────────────────────────┐
│ Workflows │ Rename │ Photos │ Settings       │
└──────────────────────────────────────────────┘
```
- **Workflows (Home)**: danh sách preset/quy tắc đã lưu dưới dạng card, nút chạy nhanh; empty state = 3 template mẫu ("Ảnh → thư mục theo tháng", "Thêm ngày chụp vào tên", "Dọn Screenshots").
- **Rename**: flow chủ lực — chọn nguồn (thư mục/file) → **Rule Builder** → Preview → Apply. Organize (di chuyển vào thư mục theo rule) nằm cùng tab như một loại rule, vì cùng mental model.
- **Photos**: hai công cụ cho thư viện ảnh — *Sửa ngày & GPS* (shift thời gian, chọn GPS trên map, import GPX) và *Ảnh trùng/tương tự* (quét → nhóm → smart select → xoá vào Recently Deleted).
- **Settings**: quản lý quyền thư mục đã cấp, lịch sử/undo, Pro, privacy.

### Rule Builder (màn hình quan trọng nhất)
- Các rule là **chip/khối xếp chồng theo thứ tự**, kéo-thả để đổi thứ tự pipeline: `Find & Replace` → `Prefix` → `Counter (001…)` → `lowercase` …
- Mỗi token có sheet cấu hình riêng (padding của counter, format ngày, nguồn metadata EXIF).
- **Live preview 3 dòng ngay dưới builder** (lấy 3 file thật đầu tiên) — người dùng thấy kết quả tức thì trước khi vào màn Preview đầy đủ.
- Lưu pipeline thành **Preset** (Free: 1, Pro: không giới hạn).

### Các flow chính
1. **Batch rename**: Chọn thư mục (fileImporter) → Rule Builder → Preview full-list (diff highlight phần thay đổi, cảnh báo trùng tên bằng badge đỏ + auto-resolve đề xuất) → Apply (progress + Cancel) → Toast "Đã đổi tên 128 file · Hoàn tác".
2. **Organize**: Rule "chuyển vào thư mục con theo `{yyyy}/{MM}` / theo đuôi file / theo camera model" → Preview dạng cây thư mục before/after → Apply.
3. **EXIF/GPX**: Chọn ảnh (Photos hoặc Files) → chọn thao tác (đặt ngày, shift ±, set GPS từ map, import GPX) → với GPX hiển thị map có track + ảnh được snap lên track → Apply.
4. **Duplicates**: Chọn phạm vi → quét (progress theo % + có thể chạy nền) → nhóm theo mức tương tự, mặc định giữ ảnh chất lượng cao nhất, "Smart select" → xoá (ảnh Photos vào Recently Deleted = an toàn).

### Onboarding (3 màn, bỏ qua được)
1. Value prop: "Đổi tên & sắp xếp hàng nghìn file trong vài chạm."
2. Cách iOS cấp quyền thư mục (minh họa động, 1 nút "Chọn thư mục đầu tiên").
3. Privacy: "Mọi thứ chạy trên máy. Không upload, không tài khoản." (đồng bộ thông điệp Cutsy).

### Visual direction
- Nền hệ thống (systemBackground/secondarySystemBackground), card bo góc 12–16pt.
- 1 accent màu duy nhất (đề xuất teal/indigo — tách khỏi accent của Cutsy để không lẫn brand), dùng cho CTA và highlight diff trong preview.
- Icon app: ký hiệu sắp xếp (3 vạch → thẳng hàng) tối giản, cùng "độ cute" với Cutsy nhưng nghiêm túc hơn một chút vì là utility.

---

## 5. Roadmap đề xuất

| Phase | Nội dung | Mục tiêu |
|---|---|---|
| **MVP (6–8 tuần)** | Rename engine + Rule Builder + Preview/Undo, Organize theo ngày/đuôi file, presets, paywall StoreKit 2 | Ship TestFlight, validate demand |
| **1.1** | EXIF batch (ngày giờ, GPS map), Photos date/GPS | Điểm khác biệt lớn nhất |
| **1.2** | Duplicate/similar finder | Từ khóa ASO "duplicate photos" volume cao |
| **1.3** | GPX geotagging, App Intents/Shortcuts đầy đủ | Power users |
| **2.0** | SMB trực tiếp (AMSMB2), rule chains nâng cao, iPad layout 2 cột | Pro tier mở rộng |

### Rủi ro chính cần theo dõi
- iCloud Drive: file chưa tải về (dataless) — phải xử lý download-before-rename và báo tiến độ.
- Batch rất lớn (10K+ file) trong security scope: benchmark sớm, checkpoint/resume.
- App Review: mô tả rõ vì sao cần quyền Photos (chỉ khi dùng tính năng Photos, xin quyền theo ngữ cảnh, không xin trước).
