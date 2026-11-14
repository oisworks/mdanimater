const { execFile } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);
function parseReviewUrl(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const github = url.hostname === 'github.com' && url.pathname.match(/^\/([^/]+\/[^/]+)\/pull\/(\d+)\/?$/);
  const gitlab = url.hostname === 'gitlab.com' && url.pathname.match(/^\/(.+)\/-\/merge_requests\/(\d+)\/?$/);
  const match = github || gitlab;
  if (!match || !/^[\w.-]+(?:\/[\w.-]+)+$/.test(match[1]) || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) < 1) return null;
  return { provider: github ? 'github' : 'gitlab', repository: match[1], number: Number(match[2]), url: `${url.origin}${url.pathname}` };
}
async function readReviewComments(review, execute = run) {
  const cli = review.provider === 'github' ? 'gh' : 'glab';
  const pages = async endpoint => {
    const all = [];
    for (let page = 1; page <= 20; page++) {
      let response;
      try {
        response = await execute(cli, ['api', '--hostname', review.provider === 'github' ? 'github.com' : 'gitlab.com', `${endpoint}?per_page=100&page=${page}`], { timeout: 30000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
      } catch {
        throw new Error(`Could not read comments. Install ${cli}, sign in with ${cli} auth login, and check access to this review.`);
      }
      let entries;
      try { entries = JSON.parse(response.stdout); } catch { throw new Error('The review service returned invalid data.'); }
      if (!Array.isArray(entries)) throw new Error('The review service returned invalid data.');
      all.push(...entries);
      if (entries.length < 100) return all;
    }
    throw new Error('This review is too large to load completely (over 2,000 entries).');
  };
  if (review.provider === 'github') {
    const prefix = `repos/${review.repository}`;
    const [inline, general, reviews] = await Promise.all([
      pages(`${prefix}/pulls/${review.number}/comments`), pages(`${prefix}/issues/${review.number}/comments`), pages(`${prefix}/pulls/${review.number}/reviews`),
    ]);
    const roots = new Map();
    for (const item of inline) {
      const id = item.in_reply_to_id || item.id;
      if (!roots.has(id)) roots.set(id, []);
      roots.get(id).push(item);
    }
    return [
      ...Array.from(roots.values(), items => ({ location: location(items.find(item => !item.in_reply_to_id) || items[0]), comments: items.map(normalize) })),
      ...general.map(item => ({ location: 'Conversation', comments: [normalize(item)] })),
      ...reviews.filter(item => item.body).map(item => ({ location: `Review · ${item.state || ''}`, comments: [normalize(item)] })),
    ];
  }
  const discussions = await pages(`projects/${encodeURIComponent(review.repository)}/merge_requests/${review.number}/discussions`);
  return discussions.map(thread => ({ location: `${location(thread.notes?.find(note => note.position)?.position)}${thread.notes?.some(note => note.resolved) ? ' · resolved' : ''}`, comments: (thread.notes || []).filter(note => !note.system).map(normalize) })).filter(thread => thread.comments.length);
}
function location(item) {
  if (!item) return 'Conversation';
  const file = item.path || item.new_path || item.old_path;
  const line = item.line || item.new_line || item.old_line;
  return file ? `${file}${line ? `:${line}` : ' · outdated / no current line'}${item.side === 'LEFT' ? ' (base)' : ''}` : 'Conversation';
}
function normalize(item) { return { author: item.user?.login || item.author?.username || 'Unknown', body: String(item.body || ''), date: item.created_at || item.submitted_at || '' }; }
function escape(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function renderComments(review, threads) {
  return `<h1>Review comments</h1><p>${escape(review.url)}</p><p>Read-only snapshot. GitHub thread resolution status is not available in this view.</p>${threads.length ? threads.map(thread => `<section><h2>${escape(thread.location)}</h2>${thread.comments.map(comment => `<article><strong>${escape(comment.author)}</strong> <small>${escape(comment.date)}</small><pre>${escape(comment.body)}</pre></article>`).join('')}</section>`).join('') : '<p>No comments found.</p>'}`;
}
module.exports = { parseReviewUrl, readReviewComments, renderComments };
