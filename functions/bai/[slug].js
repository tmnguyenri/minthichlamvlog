// Trang một bài viết, dựng phía máy chủ (công cụ tìm kiếm đọc được, không cần JavaScript).
import { esc } from '../_lib/http.js';
import { page } from '../_lib/layout.js';
import { renderMarkdown, renderPlain } from '../_lib/md.js';
import { SLUG_RE } from '../_lib/validate.js';
import { SITE_NAME, describe, isoDate, shareImage, siteUrl } from '../_lib/site.js';

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const en = (value) => (value ? ` data-en="${esc(value)}"` : '');

function notFound() {
  return page({
    title: 'Không tìm thấy bài viết – Mìn Thích Làm Vlog', titleEn: 'Post not found – Mìn Thích Làm Vlog', status: 404, seo: { robots: 'noindex' },
    main: `    <section class="notfound wrap">
      <h1 class="page-title" data-en="This post could not be found">Không tìm thấy bài viết này</h1>
      <div class="prose"><p><a href="/nhat-ky" data-en="Back to all posts">Quay lại tất cả bài viết</a></p></div>
    </section>`,
  });
}

export async function onRequestGet({ params, env, data }) {
  if (!SLUG_RE.test(params.slug)) return notFound();
  const user = data.user;
  const post = await env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(params.slug).first();
  if (!post || (post.status !== 'published' && user?.role !== 'admin')) return notFound();

  const { results: comments } = await env.DB.prepare(
    `SELECT c.id, c.user_id, c.body, c.created_at, u.display_name FROM comments c
       JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created_at ASC LIMIT 300`,
  ).bind(post.id).all();

  // Ảnh đầu bài: một ảnh ngẫu nhiên trong các ảnh đã tải lên cho bài; nếu chưa có thì dùng ảnh bìa (nếu có) hoặc ảnh mặc định.
  const randomPhoto = await env.DB.prepare('SELECT id FROM images WHERE post_id = ? ORDER BY RANDOM() LIMIT 1').bind(post.id).first();
  const cover = randomPhoto ? `/api/images/${randomPhoto.id}` : (post.cover || '/images/cover-default.svg');
  let when = '';
  const m = /^(\d{4})-(\d{2})$/.exec(post.trip_date);
  if (m) when = `<div><dt><span data-en="When">Thời gian</span></dt><dd><time datetime="${post.trip_date}" data-en="${MONTHS_EN[Number(m[2]) - 1]} ${m[1]}">Tháng ${Number(m[2])}/${m[1]}</time></dd></div>`;
  const place = [post.city, post.country].filter(Boolean).join(', ');
  const where = place ? `<div><dt><span data-en="Where">Địa điểm</span></dt><dd>${esc(place)}</dd></div>` : '';
  const length = post.days ? `<div><dt><span data-en="Length">Thời lượng</span></dt><dd><span data-en="${post.days} ${post.days === 1 ? 'day' : 'days'}">${post.days} ngày</span></dd></div>` : '';
  const facts = when || where || length ? `<dl class="facts">${when}${where}${length}</dl>` : '';

  const video = post.video
    ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(post.video)}" title="${esc(post.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`
    : '';
  const bodyVi = renderMarkdown(post.body);
  const bodyEn = post.body_en ? renderMarkdown(post.body_en) : '';
  const prose = bodyEn
    ? `<div class="prose" data-only="vi">${bodyVi}</div>\n        <div class="prose" data-only="en">${bodyEn}</div>`
    : `<div class="prose">${bodyVi}</div>`;

  const canDelete = (c) => user && (user.role === 'admin' || user.id === c.user_id);
  const list = comments.length
    ? `<ol class="comment-list">${comments.map((c) => `
        <li class="comment">
          <p class="comment__meta"><strong>${esc(c.display_name)}</strong> <time datetime="${new Date(c.created_at * 1000).toISOString()}">${new Date(c.created_at * 1000).toISOString().slice(0, 10)}</time>${canDelete(c) ? ` <button type="button" class="link-btn" data-del-comment="${c.id}" data-en="Delete">Xóa</button>` : ''}</p>
          <p class="comment__body">${renderPlain(c.body)}</p>
        </li>`).join('')}</ol>`
    : '<p class="muted" data-en="No comments yet. Be the first!">Chưa có bình luận nào. Hãy là người đầu tiên!</p>';
  const form = user
    ? `<form class="form" id="comment-form" data-post-id="${post.id}" novalidate>
          <div class="field"><label for="comment-body" data-en="Leave a comment">Viết bình luận</label>
            <textarea id="comment-body" name="body" rows="4" maxlength="1000" required></textarea></div>
          <p id="comment-msg" class="notice" role="alert" hidden></p>
          <button class="btn btn--primary btn--sm" type="submit" data-en="Post comment">Gửi bình luận</button>
        </form>`
    : `<p class="muted"><a href="/dang-nhap?next=${encodeURIComponent('/bai/' + post.slug)}" data-en="Log in">Đăng nhập</a> <span data-en="or">hoặc</span> <a href="/dang-ky" data-en="sign up">đăng ký</a> <span data-en="to leave a comment.">để bình luận.</span></p>`;

  const draft = post.status !== 'published'
    ? '<p class="notice notice--info wrap" data-en="Draft: only you can see this post.">Bản nháp: chỉ bạn nhìn thấy bài này.</p>' : '';

  const main = `${draft}
    <article>
      <header class="post-hero">
        <img class="post-hero__img" src="${esc(cover)}" alt="" width="1600" height="800">
        <div class="wrap post-hero__content">
          <a class="crumb" href="/nhat-ky"><span data-en="All posts">Tất cả bài viết</span></a>
          <h1><span${en(post.title_en)}>${esc(post.title)}</span></h1>
          ${post.excerpt ? `<p class="post-dek"${en(post.excerpt_en)}>${esc(post.excerpt)}</p>` : ''}
          ${facts}
        </div>
      </header>
      <div class="wrap post-body">
        ${video}
        ${prose}
        <section class="comments" id="binh-luan" aria-labelledby="cm-title">
          <h2 id="cm-title" data-en="Comments">Bình luận</h2>
          ${list}
          ${form}
        </section>
      </div>
    </article>`;

  // Thẻ chia sẻ, địa chỉ chuẩn và dữ liệu có cấu trúc để công cụ tìm kiếm hiểu đây là một bài viết
  const base = siteUrl(env);
  const path = `/bai/${encodeURIComponent(post.slug)}`;
  const image = shareImage(base, randomPhoto ? cover : post.cover);
  const published = isoDate(post.published_at || post.created_at);
  const modified = isoDate(post.updated_at);
  const author = { '@type': 'Person', name: 'Mìn', url: `${base}/about` };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: describe(post) || undefined,
    image: [image],
    datePublished: published || undefined,
    dateModified: modified || undefined,
    inLanguage: post.body_en ? ['vi', 'en'] : 'vi',
    url: base + path,
    mainEntityOfPage: { '@type': 'WebPage', '@id': base + path },
    author,
    publisher: { '@type': 'Person', name: SITE_NAME, url: base + '/' },
    contentLocation: place
      ? {
        '@type': 'Place', name: place,
        address: { '@type': 'PostalAddress', addressLocality: post.city || undefined, addressCountry: post.country || undefined },
      }
      : undefined,
  };
  return page({
    title: `${post.title} – Mìn Thích Làm Vlog`, titleEn: post.title_en ? `${post.title_en} – Mìn Thích Làm Vlog` : '',
    desc: describe(post), descEn: post.excerpt_en, ogType: 'article', main, scripts: ['/js/ui.js', '/js/comments.js'],
    seo: { base, path, image, published, modified, jsonLd, robots: post.status === 'published' ? '' : 'noindex' },
  });
}
