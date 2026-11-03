// Trang một bài viết, dựng phía máy chủ (công cụ tìm kiếm đọc được, không cần JavaScript).
// Mỗi bài có hai địa chỉ: /bai/<tên> (tiếng Việt) và /en/bai/<tên> (tiếng Anh, khi bài đã có bản dịch).
// Hai địa chỉ trỏ vào nhau bằng hreflang để Google hiện đúng bản theo ngôn ngữ người tìm kiếm.
import { esc } from './http.js';
import { page } from './layout.js';
import { renderMarkdown, renderPlain } from './md.js';
import { SLUG_RE } from './validate.js';
import { SITE_NAME, describe, isoDate, shareImage, siteUrl } from './site.js';

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Quốc gia được lưu bằng tiếng Việt; bản tiếng Anh dùng tên này (không có trong danh sách thì giữ nguyên).
const COUNTRY_EN = {
  'Việt Nam': 'Vietnam', 'Hoa Kỳ': 'United States', Mỹ: 'United States', 'Nhật Bản': 'Japan', 'Hàn Quốc': 'South Korea',
  'Thái Lan': 'Thailand', Pháp: 'France', Anh: 'United Kingdom', Ý: 'Italy', Đức: 'Germany', 'Tây Ban Nha': 'Spain',
  'Bồ Đào Nha': 'Portugal', 'Trung Quốc': 'China', Úc: 'Australia', Canada: 'Canada', Singapore: 'Singapore',
};

function notFound() {
  return page({
    title: 'Không tìm thấy bài viết – Mìn Thích Làm Vlog', titleEn: 'Post not found – Mìn Thích Làm Vlog', status: 404, seo: { robots: 'noindex' },
    main: `    <section class="notfound wrap">
      <h1 class="page-title" data-en="This post could not be found">Không tìm thấy bài viết này</h1>
      <div class="prose"><p><a href="/#nhat-ky" data-en="Back to all posts">Quay lại tất cả bài viết</a></p></div>
    </section>`,
  });
}

// lang: 'vi' -> /bai/<tên>, 'en' -> /en/bai/<tên>
export async function renderPost({ params, env, data, lang = 'vi' }) {
  const isEn = lang === 'en';
  if (!SLUG_RE.test(params.slug)) return notFound();
  const user = data.user;
  const post = await env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(params.slug).first();
  if (!post || (post.status !== 'published' && user?.role !== 'admin')) return notFound();

  const hasEn = Boolean(String(post.body_en || '').trim());
  const base = siteUrl(env);
  const viPath = `/bai/${encodeURIComponent(post.slug)}`;
  const enPath = `/en/bai/${encodeURIComponent(post.slug)}`;
  // Bài chưa có bản dịch thì không có trang tiếng Anh riêng: đưa về bản tiếng Việt.
  if (isEn && !hasEn) return new Response(null, { status: 302, headers: { location: viPath } });

  // Chữ cố định của trang theo ngôn ngữ: bản Việt có kèm data-en cho nút EN đổi tại chỗ, bản Anh là tiếng Anh sẵn.
  const dataEn = (en) => (isEn || !en ? '' : ` data-en="${esc(en)}"`);
  const txt = (vi, en) => esc(isEn ? en : vi);
  const el = (tag, vi, en, extra = '') => `<${tag}${extra}${dataEn(en)}>${txt(vi, en)}</${tag}>`;

  const title = isEn ? (post.title_en || post.title) : post.title;
  const excerpt = isEn ? (post.excerpt_en || post.excerpt) : post.excerpt;

  const { results: comments } = await env.DB.prepare(
    `SELECT c.id, c.user_id, c.body, c.created_at, u.display_name FROM comments c
       JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created_at ASC LIMIT 300`,
  ).bind(post.id).all();

  // Ảnh đầu bài: một ảnh ngẫu nhiên trong các ảnh đã tải lên cho bài; nếu chưa có thì dùng ảnh bìa (nếu có) hoặc ảnh mặc định.
  const randomPhoto = await env.DB.prepare('SELECT id FROM images WHERE post_id = ? ORDER BY RANDOM() LIMIT 1').bind(post.id).first();
  const cover = randomPhoto ? `/api/images/${randomPhoto.id}` : (post.cover || '/images/cover-default.svg');

  let when = '';
  const m = /^(\d{4})-(\d{2})$/.exec(post.trip_date);
  if (m) {
    const monthEn = `${MONTHS_EN[Number(m[2]) - 1]} ${m[1]}`;
    when = `<div><dt>${el('span', 'Thời gian', 'When')}</dt><dd><time datetime="${post.trip_date}"${dataEn(monthEn)}>${txt(`Tháng ${Number(m[2])}/${m[1]}`, monthEn)}</time></dd></div>`;
  }
  const placeVi = [post.city, post.country].filter(Boolean).join(', ');
  const placeEn = [post.city, COUNTRY_EN[post.country] || post.country].filter(Boolean).join(', ');
  const place = isEn ? placeEn : placeVi;
  const where = place ? `<div><dt>${el('span', 'Địa điểm', 'Where')}</dt><dd>${esc(place)}</dd></div>` : '';
  const dayEn = post.days ? `${post.days} ${post.days === 1 ? 'day' : 'days'}` : '';
  const length = post.days ? `<div><dt>${el('span', 'Thời lượng', 'Length')}</dt><dd>${el('span', `${post.days} ngày`, dayEn)}</dd></div>` : '';
  const facts = when || where || length ? `<dl class="facts">${when}${where}${length}</dl>` : '';

  const video = post.video
    ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(post.video)}" title="${esc(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`
    : '';
  // Mỗi địa chỉ chỉ chứa một ngôn ngữ: bản Việt chỉ có chữ Việt, bản Anh chỉ có chữ Anh.
  const prose = `<div class="prose">${renderMarkdown(isEn ? post.body_en : post.body)}</div>`;

  // Ảnh tải lên cho bài nhưng chưa được chèn tay vào nội dung (qua nút "Chèn vào nội dung" trong
  // /quan-ly) vẫn không nên biến mất — tự động gộp thành một dải ảnh ở cuối bài, để người đọc xem
  // được hết ảnh của chuyến đi dù người viết không chèn từng tấm vào giữa bài.
  const { results: photos } = await env.DB.prepare('SELECT id, caption FROM images WHERE post_id = ? ORDER BY id').bind(post.id).all();
  const usedIds = new Set();
  for (const mm of `${post.body}\n${post.body_en || ''}`.matchAll(/\/api\/images\/(\d+)/g)) usedIds.add(Number(mm[1]));
  const leftoverPhotos = photos.filter((img) => !usedIds.has(img.id));
  const gallery = leftoverPhotos.length
    ? `<section class="post-gallery">
          ${el('h2', 'Thêm ảnh', 'More photos')}
          <div class="post-gallery__grid">
            ${leftoverPhotos.map((img) => `<a class="post-gallery__item" href="/api/images/${img.id}" target="_blank" rel="noopener noreferrer">
              <img src="/api/images/${img.id}" alt="${esc(img.caption || '')}" width="400" height="300" loading="lazy"></a>`).join('')}
          </div>
        </section>`
    : '';

  const canDelete = (c) => user && (user.role === 'admin' || user.id === c.user_id);
  const list = comments.length
    ? `<ol class="comment-list">${comments.map((c) => `
        <li class="comment">
          <p class="comment__meta"><strong>${esc(c.display_name)}</strong> <time datetime="${new Date(c.created_at * 1000).toISOString()}">${new Date(c.created_at * 1000).toISOString().slice(0, 10)}</time>${canDelete(c) ? ` ${el('button', 'Xóa', 'Delete', ' type="button" class="link-btn"' + ` data-del-comment="${c.id}"`)}` : ''}</p>
          <p class="comment__body">${renderPlain(c.body)}</p>
        </li>`).join('')}</ol>`
    : el('p', 'Chưa có bình luận nào. Hãy là người đầu tiên!', 'No comments yet. Be the first!', ' class="muted"');
  const nextPath = encodeURIComponent(isEn ? enPath : viPath);
  const form = user
    ? `<form class="form" id="comment-form" data-post-id="${post.id}" novalidate>
          <div class="field">${el('label', 'Viết bình luận', 'Leave a comment', ' for="comment-body"')}
            <textarea id="comment-body" name="body" rows="4" maxlength="1000" required></textarea></div>
          <p id="comment-msg" class="notice" role="alert" hidden></p>
          ${el('button', 'Gửi bình luận', 'Post comment', ' class="btn btn--primary btn--sm" type="submit"')}
        </form>`
    : `<p class="muted"><a href="/dang-nhap?next=${nextPath}"${dataEn('Log in')}>${txt('Đăng nhập', 'Log in')}</a> ${el('span', 'hoặc', 'or')} <a href="/dang-ky"${dataEn('sign up')}>${txt('đăng ký', 'sign up')}</a> ${el('span', 'để bình luận.', 'to leave a comment.')}</p>`;

  const draft = post.status !== 'published'
    ? el('p', 'Bản nháp: chỉ bạn nhìn thấy bài này.', 'Draft: only you can see this post.', ' class="notice notice--info wrap"') : '';

  const main = `${draft}
    <article>
      <header class="post-hero">
        <img class="post-hero__img" src="${esc(cover)}" alt="${esc(title)}" width="1600" height="800">
        <div class="wrap post-hero__content">
          <a class="crumb" href="/#nhat-ky">${el('span', 'Tất cả bài viết', 'All posts')}</a>
          <h1><span${dataEn(post.title_en)}>${esc(title)}</span></h1>
          ${excerpt ? `<p class="post-dek"${dataEn(post.excerpt_en)}>${esc(excerpt)}</p>` : ''}
          ${facts}
        </div>
      </header>
      <div class="wrap post-body">
        ${video}
        ${prose}
        ${gallery}
        <section class="comments" id="binh-luan" aria-labelledby="cm-title">
          ${el('h2', 'Bình luận', 'Comments', ' id="cm-title"')}
          ${list}
          ${form}
        </section>
      </div>
    </article>`;

  // Thẻ chia sẻ, địa chỉ chuẩn và dữ liệu có cấu trúc để công cụ tìm kiếm hiểu đây là một bài viết
  const path = isEn ? enPath : viPath;
  const image = shareImage(base, randomPhoto ? cover : post.cover);
  const published = isoDate(post.published_at || post.created_at);
  const modified = isoDate(post.updated_at);
  const description = isEn ? describe({ excerpt: post.excerpt_en, body: post.body_en }) : describe(post);
  const author = { '@type': 'Person', name: 'Mìn', url: `${base}/about` };
  const blogPosting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: description || undefined,
    image: [image],
    datePublished: published || undefined,
    dateModified: modified || undefined,
    inLanguage: lang,
    url: base + path,
    mainEntityOfPage: { '@type': 'WebPage', '@id': base + path },
    author,
    publisher: { '@type': 'Person', name: SITE_NAME, url: base + '/' },
    contentLocation: place
      ? {
        '@type': 'Place', name: place,
        address: { '@type': 'PostalAddress', addressLocality: post.city || undefined, addressCountry: (isEn ? COUNTRY_EN[post.country] || post.country : post.country) || undefined },
      }
      : undefined,
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: base + '/' },
      { '@type': 'ListItem', position: 2, name: title, item: base + path },
    ],
  };
  const alternates = hasEn
    ? [{ hreflang: 'vi', href: base + viPath }, { hreflang: 'en', href: base + enPath }, { hreflang: 'x-default', href: base + viPath }]
    : [];
  return page({
    title: `${title} – Mìn Thích Làm Vlog`, titleEn: !isEn && post.title_en ? `${post.title_en} – Mìn Thích Làm Vlog` : '',
    desc: description, descEn: !isEn ? post.excerpt_en : '', ogType: 'article', main, scripts: ['/js/ui.js', '/js/comments.js'], lang, alternates,
    seo: { base, path, image, published, modified, jsonLd: [blogPosting, breadcrumb], robots: post.status === 'published' ? '' : 'noindex' },
  });
}
