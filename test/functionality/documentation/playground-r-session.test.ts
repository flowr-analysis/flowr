import { describe, expect, test } from 'vitest';
import { isRSession, parseRSession, sessionAsScript } from '../../../scripts/playground/r-session';

const Session = [
	'> x <- c(1,',
	'+   2)',
	'> x',
	'[1] 1 2',
	'',
	'> y <- sum(x)'
].join('\n');

describe('R console sessions', () => {
	test.each([
		['a.Rout', 'x <- 1', true],
		['a.Rsession', '', true],
		['a.rconsole', '', true],
		['a.R', '\n> x <- 1', true],
		['a.R', 'x <- 1\n> y', false],
		['a.R', '', false]
	])('isRSession(%s, %j) is %s', (name, text, expected) => {
		expect(isRSession(name, text)).toBe(expected);
	});

	test('input groups with continuations, output, and blank lines', () => {
		expect(parseRSession(Session)).toEqual([
			{ kind: 'input', lines: ['> x <- c(1,', '+   2)'], firstLine: 1 },
			{ kind: 'input', lines: ['> x'], firstLine: 3 },
			{ kind: 'output', lines: ['[1] 1 2', ''], firstLine: 4 },
			{ kind: 'input', lines: ['> y <- sum(x)'], firstLine: 6 }
		]);
	});

	test('a continuation without a command before it is output', () => {
		expect(parseRSession('+ 1\n> x')[0]).toEqual({ kind: 'output', lines: ['+ 1'], firstLine: 1 });
	});

	test('the script keeps lines and columns, output becomes comments', () => {
		const script = sessionAsScript(Session);
		const rows = script.split('\n');
		expect(rows).toHaveLength(Session.split('\n').length);
		expect(rows).toEqual(['  x <- c(1,', '    2)', '  x', '# [1] 1 2', '', '  y <- sum(x)']);
		Session.split('\n').forEach((line, at) => {
			if(/^[>+] /.test(line)) {
				expect(rows[at].slice(2)).toBe(line.slice(2));
				expect(rows[at].length).toBe(line.length);
			}
		});
	});

	test('a bare prompt stays an empty line of the same width', () => {
		expect(sessionAsScript('>\n> x')).toBe(' \n  x');
	});
});
