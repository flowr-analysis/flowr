import { describe } from 'vitest';
import { createStringDomainAssert } from './common';
import { withShell } from '../../../_helper/shell';
import type { Lift } from '../../../../../src/abstract-interpretation/eval/domain';
import { Top } from '../../../../../src/abstract-interpretation/eval/domain';
import type { ConstSet } from '../../../../../src/abstract-interpretation/eval/domains/constant-set';

function v(...value: string[]): ConstSet {
	return { kind: 'const-set', value };
}

describe.sequential('String Inference: Constant Set', withShell((shell) => {
	const assertStringDomain = createStringDomainAssert<ConstSet>(shell, 'const-set');
  
	assertStringDomain(
		'assignment',
		'a <- "foo"',
		'1@a',
		v('foo'),
	);

	assertStringDomain(
		'indirect assignment',
		'a <- "foo"\nb <- a',
		'2@b',
		v('foo'),
	);

	assertStringDomain(
		'reassignment',
		'a <- "foo"\na <- "bar"',
		'2@a',
		v('bar'),
	);

	assertStringDomain(
		'conditional assignment',
		'a <- "foo"\nif (x) { a <- "bar" }\na',
		'3@a',
		v('foo', 'bar'),
	);

	assertStringDomain(
		'if true branch',
		'if(TRUE) { "foo" } else { "bar" }',
		'1:1',
		v('foo'),
	);

	assertStringDomain(
		'if false branch',
		'if(FALSE) { "foo" } else { "bar" }',
		'1:1',
		v('bar'),
	);

	assertStringDomain(
		'if else',
		'if(a) { "foo" } else { "bar" }',
		'1:1',
		v('foo', 'bar'),
	);

	assertStringDomain(
		'super assignment',
		'a <- "foo"\nf <- function() { a <<- "bar" }\nf()\na',
		'4:1',
		v('bar'),
	);

	assertStringDomain(
		'implicit string conversion',
		'paste0(7)',
		'1:1',
		v('7'),
	);

	assertStringDomain(
		'indirect implicit string conversion',
		'a <- 7\npaste0(a)',
		'2:1',
		v('7'),
	);

	assertStringDomain(
		'paste: literals, no sep',
		'paste("foo", "bar")',
		'1:1',
		v('foo bar'),
	);

	assertStringDomain(
		'paste: literals, unknown sep',
		'paste("foo", "bar", sep=x)',
		'1:1',
		Top,
	);

	assertStringDomain(
		'paste: literals, literal sep',
		'paste("foo", "bar", sep=",")',
		'1:1',
		v('foo,bar'),
	);

	assertStringDomain(
		'paste: unknown, no sep',
		'paste(x, "bar")',
		'1:1',
		Top,
	);

	assertStringDomain(
		'paste: unknown, no sep',
		'paste(x, if(x){"foo"}else{"bar"})',
		'1:1',
		Top,
	);

	assertStringDomain(
		'paste: literals, literal sep',
		'paste(if(x){"a"}else{"b"}, if(x){"x"}else{"y"}, sep=if(x){","}else{"-"})',
		'1:1',
		v('a-x', 'a,x', 'a-y', 'a,y', 'b-x', 'b,x', 'b-y', 'b,y'),
	);

	const implicitConversionCases: [string, Lift<ConstSet>][] = [
		['5', v('5')],
		['5.0', v('5')],
		['2.3', v('2.3')],
		['0.333333333333333', v('0.333333333333333')],
		['42.825', v('42.825')],
		['TRUE', v('TRUE')],
		['FALSE', v('FALSE')],
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
