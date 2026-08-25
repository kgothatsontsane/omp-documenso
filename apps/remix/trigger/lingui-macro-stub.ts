import type { MessageDescriptor } from '@lingui/core';
import type { ReactNode } from 'react';

// Runtime shim for @lingui macros. The trigger.dev esbuild build cannot run
// the Lingui Babel macro transform, so `msg`/`t`/`Trans`/`Plural` are provided
// as plain runtime functions. This project ships English-only emails, so the
// macros resolve to their literal (untranslated) strings.
type MessageDescriptorInput = MessageDescriptor | { message: string; context?: string };

export function msg(input: TemplateStringsArray | MessageDescriptorInput, ...values: unknown[]): MessageDescriptor {
  return resolveMessage(input, ...values);
}

export function t(input: TemplateStringsArray | MessageDescriptorInput, ...values: unknown[]): MessageDescriptor {
  return msg(input, ...values);
}

function resolveMessage(input: TemplateStringsArray | MessageDescriptorInput, ...values: unknown[]): MessageDescriptor {
  if (Array.isArray(input)) {
    const message = (input as TemplateStringsArray).reduce<string>(
      (acc, str, i) => acc + str + (i < values.length ? String(values[i] ?? '') : ''),
      '',
    );

    return { id: message, message };
  }

  const descriptor = input as MessageDescriptorInput;

  const message = descriptor.message ?? (descriptor as { id?: string }).id ?? '';

  return { id: message, message };
}

export function defineMessage(descriptor: MessageDescriptor): MessageDescriptor {
  return descriptor;
}

type PluralProps = {
  value: number;
  one: string;
  other: string;
  zero?: string;
};

export function Plural({ value, one, other, zero }: PluralProps): ReactNode {
  if (value === 0 && zero) {
    return zero.replaceAll('#', String(value));
  }

  return (value === 1 ? one : other).replaceAll('#', String(value));
}

export function Trans({ children }: { children?: ReactNode }): ReactNode {
  return children ?? null;
}

export function select(): never {
  throw new Error('@lingui select() macro is not supported in trigger.dev tasks');
}
