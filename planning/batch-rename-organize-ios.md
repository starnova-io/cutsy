# FileFlow — Planning: Batch Rename cho iOS

> Tài liệu planning giai đoạn 0 (rev 2): định vị sản phẩm, tên app, pricing, tech stack và định hướng UI/UX.
> Rev 2 cập nhật theo quyết định của founder: tên FileFlow, freemium + lifetime, định vị "mini automation engine cho filenames", target photographers/creators/devs/students.

---

## 1. Tên app

**Lựa chọn của founder: `FileFlow: Batch Rename`** — tagline *"Rename. Organize. Done."* Nghe consumer hơn "Batch Renamer" và mở rộng được về sau.

⚠️ **Cảnh báo trùng tên (kiểm tra 09/2026):** trên App Store đã tồn tại:
- **FileFlow Local File Manager** (id 6768175929) — đáng lo nhất vì app này **có sẵn tính năng Batch Rename** (prefix/suffix/sequential/rules), tức trùng cả tên lẫn tính năng.
- **FileFlow** (id 1442948216) — chiếm exact name.
- **FileFlows** (fileflows.com) — brand tool automation media, có rủi ro trademark/SEO.

Hệ quả: "FileFlow: Batch Rename" vẫn submit được (tên đầy đủ khác chuỗi), nhưng cạnh tranh trực tiếp về brand/search với một app cùng tính năng là bất lợi ASO dài hạn. Phương án giữ vibe nếu cần đổi: **RenameFlow**, **Renamely**, **NameFlow**. Nếu muốn ăn keyword thẳng: **Batch Rename — File Renamer**. Quyết định cuối thuộc founder; doc này dùng FileFlow làm working title.

---

## 2. Thị trường & định vị

### Bối cảnh cạnh tranh (cập nhật 09/2026)
- **Android**: Renamer: Bulk rename (100K+ downloads), Batch Rename and Organize (100K+ downloads, 2.2K reviews, rating ~3.77) — nhu cầu rõ, chất lượng còn room.
- **iOS đã có đối thủ** (khác giả định "iOS chưa ai làm" ban đầu): Batch Rename And Organize (id 6760161991), Batch Rename Files (free nhưng giới hạn **1 batch/ngày**), Smart Renamer, Renamer, Batchio, FileFlow Local File Manager. Điểm chung: app nhỏ, mới, paywall gắt hoặc UX sơ sài.

→ Khoảng trống không còn là "chưa ai làm" mà là **"chưa ai làm tốt"**: free tier hào phóng + preview/undo chuẩn + rule chain mạnh là đủ khác biệt.

### Định vị: không phải "app rename" — là mini automation engine cho filenames
```
Find "IMG_" → Remove spaces → Lowercase → Add date → Add counter
```
Ví dụ chọn 500 ảnh `IMG_1234.jpg…`, rule `Tokyo Trip {date} {counter}` →
`Tokyo Trip 2026-08-21 001.jpg`, `…002.jpg`. **Preview before → after là killer feature.**

### Wedge trên iOS: "Photos → Files → Rename"
Không cạnh tranh trực tiếp với file manager. Lưu ý kỹ thuật quan trọng: **iOS không cho đổi tên file bên trong thư viện Photos** (Photos không expose filename có nghĩa). Flow đúng — và nên bán như một feature — là **"Export renamed copies"**: chọn ảnh từ Photos → áp rule (được đọc EXIF: `Trip {date} {model}.{ext}`) → xuất bản sao đã đổi tên vào Files/iCloud Drive. Rename tại chỗ (in-place) áp dụng cho file trong Files qua security-scoped folder access.

### Target & ASO
- **Target đầu tiên**: photographers, content creators, developers, students.
- **Keywords**: batch rename files, bulk rename files, rename multiple files, photo renamer, rename photos, file renamer, bulk file rename, rename files by date, EXIF renamer.

---

## 3. Pricing & monetization (quyết định của founder)

| Plan | Giá |
|---|---|
| Free | $0 |
| Pro Monthly | $2.99 |
| Pro Yearly | $19.99 |
| Lifetime | $39.99 |

Thứ tự ưu tiên nguồn thu: **(1) Lifetime** — utility "cần một lần" ($39.99, user có 2.000 ảnh không muốn trả $3/tháng mãi); **(2) Yearly** cho power user (workflows, automation, metadata rules, Shortcuts, regex nâng cao); **(3) Ads chỉ ở Free** — không ưu tiên nếu target US/EU (user ngách này nhạy cảm với quảng cáo).

### Free vs Pro

| Free | Pro |
|---|---|
| Rename tối đa 20 files/run | Unlimited files |
| Prefix / suffix | Rule chains |
| Find & replace | EXIF metadata, date/time, camera model |
| Sequential numbering | Custom patterns, regex |
| Preview | Save / import / export presets |
| Undo | Batch workflows |

**Nguyên tắc: không paywall basic rename** — user tải app vì cần rename 50–500 file ngay; bắt trả tiền trước khi thấy giá trị → uninstall.

> ⚠️ Điểm cần cân nhắc trước khi ship: nguyên tắc trên đang mâu thuẫn với cap **20 files/run** — chính persona "50–500 file ngay lập tức" sẽ đụng paywall ở lần chạy đầu tiên. Gợi ý dung hòa: (a) nâng cap free lên ~100 files/run, hoặc (b) 20 files/run nhưng tặng 1–3 "unlimited run" đầu tiên để user thấy trọn giá trị rồi mới chặn, hoặc (c) free không giới hạn số file nhưng chỉ 1 rule/run (không chain). Đối thủ iOS đang chặn 1 batch/ngày — hào phóng hơn họ là lợi thế rẻ nhất.

---

## 4. Tech stack

### Nền tảng
- **Swift 6 + SwiftUI**, minimum **iOS 17** (`@Observable`, SwiftData, TipKit).
- Modular hóa lõi thành Swift Package để test độc lập UI:
  - `RenameEngine` — pipeline token/rule → tên mới, pure function, unit test dày.
  - `OrganizeEngine` — rule → kế hoạch di chuyển (plan/preview/apply) *(phase sau)*.
  - `ExifKit` — đọc EXIF qua ImageIO cho token `{date}` `{model}`, GPX phase sau.
  - `FileAccessKit` — security-scoped bookmarks, NSFileCoordinator, undo journal.

### Framework hệ thống (ưu tiên first-party, gần như zero dependency)
| Nhu cầu | Công nghệ |
|---|---|
| Chọn & giữ quyền thư mục | `fileImporter` / UIDocumentPicker + security-scoped bookmark |
| Chọn ảnh từ Photos | PhotosPicker (PhotoKit chỉ khi cần sửa metadata Photos) |
| Thao tác file an toàn (kể cả iCloud Drive) | FileManager + NSFileCoordinator |
| Đọc EXIF cho token | ImageIO (`CGImageSource`) |
| Regex | Swift Regex / RegexBuilder |
| Presets, workflows, lịch sử | SwiftData |
| Tự động hóa | App Intents (Shortcuts) — Pro |
| IAP | StoreKit 2 (monthly, yearly, lifetime non-consumable) |

**Không backend, không tài khoản, zero AI cost** — build nhanh, đúng kiểu indie utility. Analytics nếu có: TelemetryDeck (privacy-first, khớp brand Cutsy).

### Nguyên tắc kiến trúc
- **Plan → Preview → Apply → Undo**: mọi batch sinh "kế hoạch" bất biến → preview diff → apply có journal → undo. Vừa là kiến trúc vừa là USP.
- Swift Concurrency (`TaskGroup`) cho EXIF đọc hàng loạt; giới hạn song song theo số core.

---

## 5. UI/UX design

### Nguyên tắc
1. **Preview before → after là trung tâm** — không bao giờ apply mù; diff highlight phần thay đổi, cảnh báo trùng tên + auto-resolve.
2. **Native trước** — SF Symbols, SF Pro, chuẩn HIG, Dark Mode + Dynamic Type từ ngày đầu.
3. **Mô hình quyền là một phần UX** — onboarding dạy "cấp cả thư mục" bằng một màn minh họa; với Photos dùng picker nên không cần xin quyền trước.
4. **Task-first** — mở app thấy việc cần làm, không phải cây thư mục.

### Điều hướng (MVP gọn: 3 tab)
- **Rename (Home)** — chọn nguồn (Photos picker / Files folder) → Rule Builder → Preview → Apply.
- **Presets** — pipeline đã lưu dạng card, chạy nhanh; empty state = 3 template mẫu ("Tokyo Trip {date} {counter}", "Dọn WhatsApp Image → {date}_{counter}", "Bỏ IMG_ + lowercase").
- **Settings** — quyền thư mục đã cấp, lịch sử/undo, Pro, privacy.

### Rule Builder (màn hình quan trọng nhất)
- Rule là **khối xếp theo pipeline, kéo-thả đổi thứ tự**: `Find & Replace → Prefix → Counter 001 → lowercase`.
- Token có sheet cấu hình riêng (padding counter, format ngày, nguồn EXIF).
- **Live preview 3 dòng từ file thật** ngay dưới builder, cập nhật tức thì.
- Lưu pipeline thành Preset (Pro).

### Flow chính
1. **Batch rename (Files)**: chọn thư mục → Rule Builder → Preview full-list → Apply (progress + Cancel) → toast "Đã đổi tên 128 file · Hoàn tác".
2. **Photos → Files (Export renamed copies)**: PhotosPicker → rule (token EXIF) → preview → xuất vào thư mục Files do user chọn.
3. **Paywall moment**: hiện đúng lúc user vượt giới hạn free, kèm preview kết quả đầy đủ họ *sẽ* nhận được — bán bằng giá trị đã nhìn thấy.

### Visual direction
- Nền hệ thống, card bo góc 12–16pt, một accent duy nhất (teal/indigo, tách khỏi accent Cutsy) cho CTA và diff highlight.
- Icon: mũi tên/flow tối giản gợi "biến đổi tên", cùng độ tinh gọn với Cutsy.

---

## 6. Roadmap

| Phase | Nội dung | Mục tiêu |
|---|---|---|
| **MVP (4–6 tuần)** | Rename engine + Rule Builder + Preview/Undo (Files), Photos → Files export, free cap + paywall StoreKit 2 (3 SKU) | Ship TestFlight, validate |
| **1.1** | EXIF tokens đầy đủ ({date}{model}{ext}), regex, presets, import/export | Pro tier có lý do |
| **1.2** | Organize rules (di chuyển theo {yyyy}/{MM}, đuôi file), rule chains nâng cao | "Organize" trong tagline thành thật |
| **1.3** | App Intents/Shortcuts workflows | Power users, lý do subscription |
| **2.0** | Duplicate finder / EXIF editor / GPX (nếu traction) — kéo lại các ý tưởng từ rev 1 | Mở rộng |

### Rủi ro cần theo dõi
- Trùng tên FileFlow (mục 1) — chốt trước khi làm icon/landing.
- iCloud Drive file dataless — download-before-rename + báo tiến độ.
- Batch 500+ ảnh từ PhotosPicker — copy ra temp trước khi xử lý, benchmark sớm.
- App Review: mô tả rõ mục đích quyền thư mục; không xin quyền Photos toàn thư viện (dùng picker).
