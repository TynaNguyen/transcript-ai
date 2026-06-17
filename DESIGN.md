# DESIGN.md — Hệ thống thiết kế Transcript Tool

> **Đọc file này trước khi viết bất kỳ component nào.**
> Reference: Screenshot 1 (clean SaaS transcript app) + Screenshot 2 (Apple Store).
> Direction: **Clean, premium, minimal** — không "AI generic".

---

## 1. Mood & Reference

- Nền xám nhạt (không phải trắng hoàn toàn) — cảm giác app, không phải trang web
- Typography mạnh, hierarchy rõ ràng — học Apple
- Tab navigation pill-shape với active state đen — học screenshot 1
- Khoảng trắng rộng, thoáng — không nhồi nhét
- Cards trắng nổi trên nền xám

**Không làm:**
- Gradient (trừ trường hợp được chỉ định)
- Shadow trang trí (chỉ dùng để phân cấp cụ thể)
- Emoji làm icon (dùng Lucide icons)
- Bo góc quá tròn kiểu "AI app" (tránh border-radius: 9999px cho cards)
- Color rực rỡ, nhiều màu

---

## 2. Color Palette

```css
/* Backgrounds */
--color-bg:        #F2F2F2   /* Nền toàn trang — xám nhạt */
--color-surface:   #FFFFFF   /* Cards, panels, inputs */
--color-surface-2: #F8F8F8   /* Surface phụ (nested) */

/* Borders */
--color-border:    #E5E5E5   /* Border nhẹ, default */
--color-border-2:  #D0D0D0   /* Border mạnh hơn khi cần */

/* Text */
--color-text:      #1A1A1A   /* Body text chính */
--color-text-2:    #6B6B6B   /* Text phụ, label, hint */
--color-text-3:    #9B9B9B   /* Placeholder, muted */

/* Actions */
--color-primary:   #1A1A1A   /* Button chính — đen */
--color-primary-fg:#FFFFFF   /* Text trên button chính */

/* Accent — dùng tiết kiệm (tag "NEW", highlight, recording indicator) */
--color-accent:    #E8692A   /* Cam — học Apple's "NEW" label */
--color-accent-fg: #FFFFFF

/* Status */
--color-success:   #22C55E
--color-error:     #EF4444
--color-warning:   #F59E0B
```

### Tailwind mapping (thêm vào tailwind.config)

```js
colors: {
  bg:        '#F2F2F2',
  surface:   '#FFFFFF',
  'surface-2': '#F8F8F8',
  border:    '#E5E5E5',
  'border-2': '#D0D0D0',
  text:      '#1A1A1A',
  'text-2':  '#6B6B6B',
  'text-3':  '#9B9B9B',
  primary:   '#1A1A1A',
  accent:    '#E8692A',
}
```

---

## 3. Typography

**Font chính:** Geist Sans (Vercel) — clean, không generic
**Fallback:** Inter, system-ui

```css
font-family: 'Geist Sans', 'Inter', system-ui, -apple-system, sans-serif
```

### Scale

| Token | Size | Weight | Line-height | Dùng cho |
|-------|------|--------|-------------|---------|
| `text-display` | 2.25rem (36px) | 700 | 1.1 | Page title lớn |
| `text-title` | 1.5rem (24px) | 700 | 1.2 | Section heading |
| `text-heading` | 1.125rem (18px) | 600 | 1.3 | Card heading, label quan trọng |
| `text-body` | 0.9375rem (15px) | 400 | 1.5 | Body text |
| `text-small` | 0.8125rem (13px) | 400 | 1.4 | Helper text, caption |
| `text-tiny` | 0.75rem (12px) | 500 | 1.3 | Badge, tag, counter |

Letter-spacing: heading dùng `-0.02em` để chữ trông premium hơn.

---

## 4. Spacing System

Dùng bội số của 4px (Tailwind default).

| Token | Value | Dùng |
|-------|-------|------|
| xs    | 4px   | Gap nhỏ trong component |
| sm    | 8px   | Padding icon, gap inline |
| md    | 12px  | Padding nhỏ của component |
| lg    | 16px  | Padding card, gap giữa elements |
| xl    | 24px  | Padding section, gap giữa cards |
| 2xl   | 32px  | Khoảng cách lớn giữa sections |
| 3xl   | 48px  | Page padding top |

**Page layout:** max-width `860px`, centered, padding ngang `24px`.

---

## 5. Border Radius

| Token | Value | Dùng |
|-------|-------|------|
| `rounded-sm` | 6px | Badge, tag nhỏ |
| `rounded-md` | 10px | Button, input |
| `rounded-lg` | 14px | Card, panel |
| `rounded-xl` | 20px | Card lớn (featured) |
| `rounded-full` | 9999px | Tab pill, avatar, toggle |

---

## 6. Components

### Tab Navigation (học screenshot 1)
```
Container: bg-bg, rounded-full, p-1, inline-flex, border border-border
Tab inactive: text-text-2, font-medium, px-4 py-2, rounded-full
Tab active: bg-primary text-white, rounded-full, font-medium
```
Không có underline. Không có border bottom. Pill shape hoàn toàn.

### Button — Primary
```
bg: #1A1A1A  text: white
padding: 10px 20px
border-radius: 10px
font-weight: 600, font-size: 15px
hover: opacity 0.85
Không dùng shadow, không gradient
```

### Button — Secondary (Ghost)
```
bg: transparent  text: text  border: 1px solid border
padding: 10px 20px
border-radius: 10px
hover: bg-surface-2
```

### Card
```
bg: white
border: 1px solid border (E5E5E5)
border-radius: 14px
padding: 20px
box-shadow: KHÔNG (hoặc chỉ 0 1px 3px rgba(0,0,0,0.06) — nhẹ nhất có thể)
```

### Input / Textarea
```
bg: white
border: 1px solid border
border-radius: 10px
padding: 12px 16px
font-size: 15px, color: text
focus: border-color: #1A1A1A (border đen)
placeholder: text-3
```

### Tag / Badge
```
Accent:   bg-accent/10 text-accent  (cam nhạt)
Default:  bg-surface-2 text-text-2
Rounded: rounded-sm (6px)
padding: 2px 8px
font: text-tiny (12px) font-medium
```

### Icon
- Dùng **Lucide React** (consistent, clean)
- Size mặc định: 16px cho inline, 20px cho standalone
- Color: inherit từ text

---

## 7. Quy tắc layout

- **Nền toàn trang:** `bg-bg` (#F2F2F2) — không bao giờ đặt content trên nền trắng thuần
- **Sidebar (nếu có):** width 240px, border-right, bg-surface
- **Content area:** max-width 860px, centered
- **Các panel:** bg-surface với border, không floating card với shadow lớn
- **Header:** bg-surface, border-bottom: 1px solid border, height 56px

---

## 8. Trạng thái đặc biệt

### Recording active
- Indicator: chấm tròn đỏ (Tailwind `bg-red-500`), animation `pulse`
- Timer: `text-display` size, font-mono
- Waveform: bars màu `accent` (#E8692A)

### Processing / Loading
- Skeleton: bg-gradient (shimmer) hoặc đơn giản là bg-surface-2 animated
- Không dùng spinner mặc định — dùng `text-sm text-text-2 + dots animation`

### Empty state
- Illustration: đơn giản, monochrome (không màu mè)
- Heading: text-heading, text-text-2
- CTA: button secondary

---

## 9. Thứ không làm (Hard rules)

- Không dùng `bg-white` làm nền toàn trang (chỉ dùng cho surface)
- Không dùng màu tím/xanh làm primary (primary là đen)
- Không `box-shadow` lớn hay nhiều lớp
- Không icon từ emoji
- Không text-transform: uppercase cho body
- Không font > 700 weight
- Không `border-radius: 9999px` cho card/panel
