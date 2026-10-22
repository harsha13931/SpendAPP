import { RepositoryError } from '@/lib/repository';
import { SampleRepository } from '@/lib/sample';

const IRON_PARADISE_TODAY = 1; // first sample row

it('lists a date range newest first', async () => {
  const repo = new SampleRepository();
  const txns = await repo.transactions('2026-10-19', '2026-10-21');
  expect(txns[0].txn_date).toBe('2026-10-21');
  expect(txns[txns.length - 1].txn_date).toBe('2026-10-19');
  expect(await repo.transactions('2026-10-22', '2026-10-30')).toEqual([]);
});

it('a correction re-tags every payment to the same payee', async () => {
  const repo = new SampleRepository();
  const out = await repo.correct(IRON_PARADISE_TODAY, 'Health', true);
  expect(out).toEqual({ override_keys: ['merchant:iron paradise'], updated_transactions: 2 });
  const all = await repo.transactions('2026-10-19', '2026-10-21');
  const iron = all.filter((t) => t.merchant === 'IRON PARADISE');
  expect(iron.every((t) => t.category === 'Health' && t.layer === 'user_override')).toBe(true);
  expect((await repo.summary('2026-10-21')).top_category).toBe('Health');
});

it('can re-tag just one payment', async () => {
  const repo = new SampleRepository();
  expect((await repo.correct(IRON_PARADISE_TODAY, 'Health', false)).updated_transactions).toBe(1);
  const other = (await repo.transactions('2026-10-19', '2026-10-19')).find((t) => t.merchant === 'IRON PARADISE');
  expect(other?.category).toBe('Other');
});

it('needs a server to read new SMS', async () => {
  await expect(new SampleRepository().categorize()).rejects.toMatchObject({ reason: 'needs_server' });
  await expect(new SampleRepository().categorize()).rejects.toBeInstanceOf(RepositoryError);
});
