import { describe } from 'vitest';
import { createStringDomainAssert } from './common';
import { withShell } from '../../../_helper/shell';
import type { Lift } from '../../../../../src/abstract-interpretation/eval/domain';
import { Top } from '../../../../../src/abstract-interpretation/eval/domain';
import type { Presuffix } from '../../../../../src/abstract-interpretation/eval/domains/presuffix';

function e(value: string): Presuffix {
	return { kind: 'presuffix', prefix: value, suffix: value, exact: true };
}

function ps(prefix: string, suffix: string): Presuffix {
	return { kind: 'presuffix', prefix, suffix, exact: false };
}

describe.sequential('String Inference: Presuffix', withShell((shell) => {
	const assertStringDomain = createStringDomainAssert<Presuffix>(shell, 'presuffix');
  
	assertStringDomain(
		'assignment',
		'a <- "foo"',
		'1@a',
		e('foo'),
	);

	assertStringDomain(
		'indirect assignment',
		'a <- "foo"\nb <- a',
		'2@b',
		e('foo'),
	);

	assertStringDomain(
		'reassignment',
		'a <- "foo"\na <- "bar"',
		'2@a',
		e('bar'),
	);

	assertStringDomain(
		'conditional assignment',
		'a <- "foo"\nif (x) { a <- "bar" }\na',
		'3@a',
		Top,
	);

	assertStringDomain(
		'if true branch',
		'if(TRUE) { "foo" } else { "bar" }',
		'1:1',
		e('foo'),
	);

	assertStringDomain(
		'if false branch',
		'if(FALSE) { "foo" } else { "bar" }',
		'1:1',
		e('bar'),
	);

	assertStringDomain(
		'if else',
		'if(a) { "foo" } else { "bar" }',
		'1:1',
		Top,
	);

	assertStringDomain(
		'super assignment',
		'a <- "foo"\nf <- function() { a <<- "bar" }\nf()\na',
		'4:1',
		e('bar'),
	);

	assertStringDomain(
		'implicit string coneersion',
		'paste0(7)',
		'1:1',
		e('7'),
	);

	assertStringDomain(
		'indirect implicit string coneersion',
		'a <- 7\npaste0(a)',
		'2:1',
		e('7'),
	);

	assertStringDomain(
		'paste: literals, no sep',
		'paste("foo", "bar")',
		'1:1',
		e('foo bar'),
	);

	assertStringDomain(
		'paste: literals, unknown sep',
		'paste("foo", "bar", sep=x)',
		'1:1',
		ps('foo', 'bar'),
	);

	assertStringDomain(
		'paste: literals, literal sep',
		'paste("foo", "bar", sep=",")',
		'1:1',
		e('foo,bar'),
	);

	assertStringDomain(
		'paste: unknown + literal, no sep',
		'paste(x, "bar")',
		'1:1',
		ps('', ' bar'),
	);

	assertStringDomain(
		'paste: literal + unknown, no sep',
		'paste("foo", x)',
		'1:1',
		ps('foo ', ''),
	);

	assertStringDomain(
		'paste: literal + unknown + literal, literal sep',
		'paste("foo", x, "bar", sep="-")',
		'1:1',
		ps('foo-', '-bar'),
	);

	assertStringDomain(
		'paste: literal + unknown + literal, unknown sep',
		'paste("foo", x, "bar", sep=y)',
		'1:1',
		ps('foo', 'bar'),
	);

	const implicitConversionCases: [string, Lift<Presuffix>][] = [
		['5', e('5')],
		['5.0', e('5')],
		['2.3', e('2.3')],
		['0.333333333333333', e('0.333333333333333')],
		['42.825', e('42.825')],
		['TRUE', e('TRUE')],
		['FALSE', e('FALSE')],
	];
	for(const [input, expected] of implicitConversionCases) {
		assertStringDomain(
			`implicit-conversion: ${input}`,
			`paste(${input})`,
			'1:1',
			expected,
		);
	}
}));

