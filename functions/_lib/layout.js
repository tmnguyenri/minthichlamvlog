// Khung trang dùng cho các trang do máy chủ dựng (bài viết, 404). Giống hệt các trang tĩnh.
import { esc, html } from './http.js';
import { SITE_NAME, jsonLd as ldJson } from './site.js';

const attr = (vi, en) => (en ? ` data-en="${esc(en)}"` : '');

// seo (không bắt buộc): { base, path, image, robots, jsonLd, published, modified }
//   base    địa chỉ gốc của trang, ví dụ https://minthichlamvlog.pages.dev
//   path    đường dẫn chuẩn của trang này, ví dụ /bai/kyoto
//   image   địa chỉ đầy đủ của ảnh khi chia sẻ
//   robots  ví dụ 'noindex' cho bản nháp và trang không tìm thấy
//   jsonLd  đối tượng dữ liệu có cấu trúc (schema.org)
export function page({ title, titleEn = '', desc = '', descEn = '', ogType = 'website', main, scripts = [], status = 200, seo = null }) {
  const tags = [];
  if (seo?.robots) tags.push(`<meta name="robots" content="${esc(seo.robots)}">`);
  if (seo?.base && seo.path) {
    const url = seo.base + seo.path;
    tags.push(`<link rel="canonical" href="${esc(url)}">`, `<meta property="og:url" content="${esc(url)}">`);
  }
  if (seo?.base) {
    tags.push(
      `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
      '<meta property="og:locale" content="vi_VN">',
      '<meta property="og:locale:alternate" content="en_US">',
    );
    if (seo.image) tags.push(`<meta property="og:image" content="${esc(seo.image)}">`, '<meta name="twitter:card" content="summary_large_image">');
    if (seo.published) tags.push(`<meta property="article:published_time" content="${esc(seo.published)}">`);
    if (seo.modified) tags.push(`<meta property="article:modified_time" content="${esc(seo.modified)}">`);
    tags.push(`<link rel="alternate" type="application/rss+xml" title="${esc(SITE_NAME)}" href="${esc(seo.base)}/rss.xml">`);
  }
  if (seo?.jsonLd) tags.push(`<script type="application/ld+json">${ldJson(seo.jsonLd)}</script>`);
  const seoHead = tags.length ? '\n  ' + tags.join('\n  ') : '';
  const metaDesc = desc ? `
  <meta name="description" content="${esc(desc)}"${descEn ? ` data-en-content="${esc(descEn)}"` : ''}>
  <meta property="og:description" content="${esc(desc)}">` : '';
  const body = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title${attr(title, titleEn)}>${esc(title)}</title>${metaDesc}
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:type" content="${ogType}">
  <meta name="theme-color" content="#ffffff">${seoHead}
  <link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="/css/style.css">
  <script src="/js/lang.js"></script>
  <script src="/js/session.js" defer></script>
</head>
<body>
  <a class="skip" href="#main" data-en="Skip to content">Chuyển đến nội dung</a>

  <header class="site-header">
    <div class="wrap site-header__inner">
      <a class="brand" href="/">
        <img class="brand__mark" src="/images/logo-96.png" alt="" width="44" height="44">
        <span class="brand__name">Mìn Thích Làm Vlog</span>
      </a>
      <nav class="nav" aria-label="Menu chính" data-en-aria-label="Main menu">
        <a href="/#nhat-ky" data-en="Journal">Nhật ký</a>
        <a href="/#ban-do" data-en="Atlas">Bản đồ</a>
        <a href="/about.html" data-en="About">Giới thiệu</a>
        <a class="nav-account" href="/dang-nhap" data-en="Log in">Đăng nhập</a>
      </nav>
      <div class="lang-switch" role="group" aria-label="Ngôn ngữ" data-en-aria-label="Language">
        <button type="button" data-set-lang="vi" aria-pressed="true" lang="vi" aria-label="Tiếng Việt">VI</button>
        <button type="button" data-set-lang="en" aria-pressed="false" lang="en" aria-label="English">EN</button>
      </div>
    </div>
  </header>

  <main id="main">
${main}
  </main>
  <footer class="site-footer">
    <div class="wrap site-footer__inner">
      <p data-en="© 2026 Mìn Thích Làm Vlog">© 2026 Mìn Thích Làm Vlog</p>
      <ul class="footer-nav">
        <li><a href="/#nhat-ky" data-en="Journal">Nhật ký</a></li>
        <li><a href="/#ban-do" data-en="Atlas">Bản đồ</a></li>
        <li><a href="/about.html" data-en="About">Giới thiệu</a></li>
        <li><a href="/about.html#lien-he" data-en="Contact">Liên hệ</a></li>
        <li><a href="/rieng-tu" data-en="Privacy">Quyền riêng tư</a></li>
      </ul>
    </div>
  </footer>
${scripts.map((s) => `  <script src="${esc(s)}" defer></script>`).join('\n')}
</body>
</html>
`;
  return html(body, status);
}
