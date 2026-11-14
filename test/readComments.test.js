import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseReviewUrl, readReviewComments, renderComments } = require('../src/host/review/readComments');
describe('read-only review comments', () => {
  it('accepts only supported HTTPS URLs without credentials', () => {
    expect(parseReviewUrl('https://github.com/owner/repo/pull/12#discussion')).toMatchObject({ provider: 'github', number: 12 });
    expect(parseReviewUrl('https://gitlab.com/group/sub/project/-/merge_requests/2')).toMatchObject({ provider: 'gitlab', repository: 'group/sub/project' });
    for (const value of ['https://evil.com/o/r/pull/1', 'http://github.com/o/r/pull/1', 'https://token@github.com/o/r/pull/1', 'https://github.com/o/r/pull/0', 'https://github.com:8080/o/r/pull/1']) expect(parseReviewUrl(value)).toBeNull();
  });
  it('groups replies and includes general and review comments using read-only calls', async () => {
    const execute = vi.fn(async (_cli, args) => ({ stdout: JSON.stringify(args.at(-1).includes('/pulls/1/comments') ? [{ id: 1, path: 'a.md', line: 4, body: 'first', user: { login: 'alice' } }, { id: 2, in_reply_to_id: 1, body: 'reply' }] : args.at(-1).includes('/reviews') ? [{ body: 'approved', state: 'APPROVED' }] : [{ body: 'hello' }]) }));
    const result = await readReviewComments(parseReviewUrl('https://github.com/o/r/pull/1'), execute);
    expect(result).toHaveLength(3); expect(result[0].comments).toHaveLength(2); expect(result[0].location).toBe('a.md:4');
    expect(execute.mock.calls.every(([cli, args]) => cli === 'gh' && args[0] === 'api' && !args.includes('-X'))).toBe(true);
  });
  it('paginates GitLab discussions and filters system notes', async () => {
    const note = { notes: [{ body: 'review', position: { new_path: 'a.md', new_line: 7 }, resolved: true }, { body: 'system', system: true }] };
    const execute = vi.fn().mockResolvedValueOnce({ stdout: JSON.stringify(Array(100).fill(note)) }).mockResolvedValueOnce({ stdout: '[]' });
    const result = await readReviewComments(parseReviewUrl('https://gitlab.com/o/r/-/merge_requests/1'), execute);
    expect(execute).toHaveBeenCalledTimes(2); expect(execute.mock.calls[0][1].at(-1)).toContain('projects/o%2Fr/');
    expect(result[0].location).toBe('a.md:7 · resolved'); expect(result[0].comments).toHaveLength(1);
  });
  it('rejects invalid data without leaking CLI error secrets', async () => {
    const review = parseReviewUrl('https://gitlab.com/o/r/-/merge_requests/1');
    await expect(readReviewComments(review, async () => { throw new Error('SECRET'); })).rejects.toThrow('Install glab');
    await expect(readReviewComments(review, async () => ({ stdout: '{}' }))).rejects.toThrow('invalid data');
  });
  it('escapes provider content and distinguishes empty results', () => {
    const html = renderComments({ url: '<x>' }, [{ location: '<img>', comments: [{ author: '<script>', date: '"', body: '<script>alert(1)</script>' }] }]);
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
    expect(renderComments({ url: '' }, [])).toContain('No comments found.');
  });
});
