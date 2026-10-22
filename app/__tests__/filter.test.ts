import { filterTransactions } from '@/lib/filter';
import { SampleRepository } from '@/lib/sample';

it('filters and searches', async () => {
  const txns = await new SampleRepository().transactions('2026-10-19', '2026-10-21');
  expect(filterTransactions(txns, 'income', '').every((t) => t.direction === 'credit')).toBe(true);
  expect(filterTransactions(txns, 'spend', '').every((t) => t.direction === 'debit')).toBe(true);
  expect(filterTransactions(txns, 'review', '').map((t) => t.merchant)).toEqual(['IRON PARADISE', 'RAJESH KUMAR', 'IRON PARADISE']);
  expect(filterTransactions(txns, 'all', 'rapido').map((t) => t.vpa)).toEqual(['rapido.ride@axisbank']);
  expect(filterTransactions(txns, 'all', 'groceries').length).toBe(5);
  expect(filterTransactions(txns, 'all', '2340').length).toBe(1);
});
