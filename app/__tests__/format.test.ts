import { addDays, confidenceChip, dayLabel, displayName, rupees } from '@/lib/format';

describe('rupees', () => {
  it.each([
    [0, '₹0'],
    [999, '₹999'],
    [7034, '₹7,034'],
    [124500, '₹1,24,500'],
    [10500000, '₹1,05,00,000'],
    [1186.5, '₹1,186.50'],
    [0.05, '₹0.05'],
  ])('%p -> %p', (n, s) => expect(rupees(n)).toBe(s));

  it('signs credits and negatives', () => {
    expect(rupees(1200, { sign: true })).toBe('+₹1,200');
    expect(rupees(-85)).toBe('−₹85');
  });
});

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('labels days relative to today', () => {
    expect(dayLabel('2026-10-21', '2026-10-21')).toBe('Today, 21 Oct');
    expect(dayLabel('2026-10-20', '2026-10-21')).toBe('Yesterday, 20 Oct');
    expect(dayLabel('2026-10-19', '2026-10-21')).toBe('Mon, 19 Oct');
  });
});

describe('displayName', () => {
  it('uses the canonical merchant for dictionary hits', () => {
    expect(displayName({ layer: 'alias', matched: 'Amazon', merchant: 'AMAZON PAY INDIA', vpa: null })).toBe('Amazon');
    expect(displayName({ layer: 'vpa', matched: 'Rapido', merchant: null, vpa: 'rapido.ride@axisbank' })).toBe('Rapido');
  });

  it('falls back to the bank text, title-cased only when shouted', () => {
    expect(displayName({ layer: 'keyword', matched: 'tea', merchant: 'GANESH TEA STALL', vpa: null })).toBe('Ganesh Tea Stall');
    expect(displayName({ layer: 'fallback', matched: null, merchant: 'Iron Paradise', vpa: null })).toBe('Iron Paradise');
    expect(displayName({ layer: 'fallback', matched: null, merchant: null, vpa: 'x@ybl' })).toBe('x@ybl');
    expect(displayName({ layer: 'fallback', matched: null, merchant: null, vpa: null })).toBe('Bank transfer');
  });
});

describe('confidenceChip', () => {
  it.each([
    [{ layer: 'user_override', confidence: 1 }, 'You tagged'],
    [{ layer: 'alias', confidence: 0.92 }, 'Auto'],
    [{ layer: 'keyword', confidence: 0.6 }, 'Likely'],
    [{ layer: 'fallback', confidence: 0.2 }, 'Needs review'],
  ] as const)('%p -> %p', (t, label) => expect(confidenceChip(t).label).toBe(label));
});
