import { describe, expect, it } from 'vitest';
import { BUILDER_SECTIONS } from '../src/presentation/agents/builder-prompt.ts';

const prompt = BUILDER_SECTIONS.map((section) => section.render()).join('\n');

describe('the builder prompt', () => {
  it('asks for a goal in plain language, as a hotelier would write it', () => {
    expect(prompt).toContain('plain-language sentence a hotelier would write');
    expect(prompt).toContain("Email me when Lisbon's pace over the next 90 nights is more than 10% behind last year");
    expect(prompt).toMatch(/never a column name.*operator/i);
  });

  it('keeps tool and column names out of the chat replies, and the replies short', () => {
    expect(prompt).toMatch(/replies?.*never.*tool name/is);
    expect(prompt).toContain('one or two sentences');
  });
});
