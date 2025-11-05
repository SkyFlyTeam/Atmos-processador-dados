import { describe, expect, it, jest } from '@jest/globals';

describe('hello world mock', () => {
  it('returns greeting using a mocked implementation', () => {
    const greet = jest.fn<(name: string) => string>().mockImplementation(() => 'Hello World');

    const result = greet('Codex');

    expect(result).toBe('Hello World');
    expect(greet).toHaveBeenCalledWith('Codex');
    expect(greet).toHaveBeenCalledTimes(1);
  });
});

