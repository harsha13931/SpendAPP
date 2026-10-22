import { ApiRepository } from '@/lib/api';
import { messageFor, RepositoryError } from '@/lib/repository';

function respond(status: number, body: unknown) {
  return jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

it('builds requests against the engine API', async () => {
  const f = respond(200, []);
  const repo = new ApiRepository('http://10.0.2.2:8000/', 'u1', f);
  await repo.transactions('2026-10-01', '2026-10-21');
  expect(f.mock.calls[0][0]).toBe('http://10.0.2.2:8000/transactions?user_id=u1&from=2026-10-01&to=2026-10-21');

  await repo.correct(7, 'Health', false);
  const [url, init] = f.mock.calls[1];
  expect(url).toBe('http://10.0.2.2:8000/corrections');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({ user_id: 'u1', transaction_id: 7, category: 'Health', apply_to_past: false });
});

it('maps an engine parse failure to its reason', async () => {
  const repo = new ApiRepository('http://x', 'u1', respond(422, { detail: { error: 'parse_failed', reason: 'not_transactional' } }));
  const err = await repo.categorize('Your OTP is 123456').catch((e) => e);
  expect(err).toBeInstanceOf(RepositoryError);
  expect(err.reason).toBe('not_transactional');
  expect(messageFor(err)).toMatch(/OTP, offer or reminder/);
});

it('reports an unreachable server', async () => {
  const repo = new ApiRepository('http://x', 'u1', jest.fn().mockRejectedValue(new TypeError('Network request failed')));
  await expect(repo.summary('2026-10-21')).rejects.toMatchObject({ reason: 'network' });
});

it('keeps plain-string error details', async () => {
  const repo = new ApiRepository('http://x', 'u1', respond(404, { detail: 'transaction not found' }));
  await expect(repo.correct(1, 'Food', true)).rejects.toMatchObject({ reason: 'http_404', message: 'transaction not found' });
});
