/**
 * SafePaste fixture cases — expected outputs for regression checks.
 * Bearer case uses a real three-segment JWT shape (sample payload).
 */
export const fixtures = [
  {
    name: 'DB URL — redact password only',
    input: 'postgresql://user:secretpassword@host.render.com/db',
    output: 'postgresql://user:[REDACTED]@host.render.com/db',
  },
  {
    name: 'ENV file — redact value',
    input: 'ANTHROPIC_API_KEY=sk-ant-api03-realkey123',
    output: 'ANTHROPIC_API_KEY=[REDACTED]',
  },
  {
    name: 'Anthropic key — preserve prefix',
    input: 'sk-ant-api03-abcdef123456',
    output: 'sk-ant-api03-[REDACTED]',
  },
  {
    name: 'Bearer JWT',
    input:
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    output:
      'Authorization: Bearer [REDACTED_JWT]',
  },
  {
    name: 'Should NOT redact — placeholder',
    input: 'ANTHROPIC_API_KEY=your-key-here',
    output: 'ANTHROPIC_API_KEY=your-key-here',
  },
  {
    name: 'Should NOT redact — documentation example',
    input: 'postgresql://user:<PASSWORD>@host/db',
    output: 'postgresql://user:<PASSWORD>@host/db',
  },
];
