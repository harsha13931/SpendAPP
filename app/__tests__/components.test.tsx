import { fireEvent, render, screen } from '@testing-library/react-native';

import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { TransactionRow } from '@/components/TransactionRow';
import type { Transaction } from '@/lib/types';

const base: Transaction = {
  id: 9, txn_date: '2026-10-21', amount: 1500, amount_paise: 150000, direction: 'debit', merchant: 'IRON PARADISE',
  vpa: null, account_last4: null, ref_no: null, mode: 'UPI', category: 'Other', confidence: 0.2, layer: 'fallback',
  matched: null, created_at: '',
};

it('a low-confidence row asks for review and opens the sheet', async () => {
  const onPress = jest.fn();
  await render(<TransactionRow txn={base} onPress={onPress} />);
  expect(screen.getByText('Iron Paradise')).toBeTruthy();
  expect(screen.getByText('₹1,500')).toBeTruthy();
  expect(screen.getByText('Needs review')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /Iron Paradise, ₹1,500, Other, Needs review/ }));
  expect(onPress).toHaveBeenCalled();
});

it('a credit shows a signed blue amount and no chip', async () => {
  await render(<TransactionRow txn={{ ...base, direction: 'credit', category: 'Income', merchant: 'ACME', layer: 'direction', confidence: 0.9 }} />);
  expect(screen.getByText('+₹1,500')).toBeTruthy();
  expect(screen.queryByText('Auto')).toBeNull();
});

it('the breakdown names every category with amount and share', async () => {
  await render(
    <CategoryBreakdown
      items={[
        { category: 'Groceries', amount: 2340, percentage: 33.3, count: 1 },
        { category: 'Food', amount: 472, percentage: 6.7, count: 2 },
      ]}
    />,
  );
  expect(screen.getByLabelText('Groceries, ₹2,340, 33.3 percent')).toBeTruthy();
  expect(screen.getByText('6.7%')).toBeTruthy();
});
