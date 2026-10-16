/**
 * Logging that cannot leak page text or answers: only these fixed, non-textual fields are accepted.
 * Never add a free-form string field here.
 */
export interface LogFields {
  code?: string;
  status?: number;
  attempt?: number;
  count?: number;
  ms?: number;
  cached?: boolean;
  kind?: string;
}

function emit(level: 'info' | 'warn' | 'error', event: string, fields?: LogFields): void {
  const line = `[siyaq] ${event}`;
  if (fields) console[level](line, fields);
  else console[level](line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};
