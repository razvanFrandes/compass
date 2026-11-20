import { describe, expect, it } from 'vitest';
import { proposalRisk, proposalStatus } from '../src/domain/action-risk.ts';

describe('proposalRisk', () => {
  it.each(['adjust_bar', 'close_channel', 'open_channel'] as const)('makes %s high risk whatever the model says', (action) => {
    expect(proposalRisk(action, 'low')).toBe('high');
    expect(proposalRisk(action, 'high')).toBe('high');
  });

  it.each(['notify', 'create_task', 'contact_account'] as const)('lets the model rate %s, and raise it to high', (action) => {
    expect(proposalRisk(action, 'low')).toBe('low');
    expect(proposalRisk(action, 'high')).toBe('high');
  });
});

describe('proposalStatus', () => {
  it('only suggests in suggest mode', () => {
    expect(proposalStatus('suggest', 'low')).toBe('suggested');
  });
  it('waits for a person in approve mode', () => {
    expect(proposalStatus('approve', 'low')).toBe('pending');
  });
  it('acts alone only on low risk in auto_low_risk mode', () => {
    expect(proposalStatus('auto_low_risk', 'low')).toBe('auto_approved');
    expect(proposalStatus('auto_low_risk', 'high')).toBe('pending');
  });
});
