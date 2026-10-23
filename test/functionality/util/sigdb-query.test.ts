import { describe, expect, test } from 'vitest';
import { argsOf, closed, completeAt, problemsOf, explainAt, isIncomplete, globOf, highlight, matchArgs, parseSpec } from '../../../scripts/sigdb-page/query';

describe('sigdb page query', () => {
	describe('plain names stay names', () => {
		test.each(['*', '+', '[', '[[', '[[<-', '(', '{', '%*%', '%in%', '[.data.frame', 'dplyr::filter', 'read.csv'])('%s', name => {
			expect(parseSpec(name)).toEqual({ rest: name, props: [] });
		});
		test('backticks and an empty call are dropped', () => {
			expect(parseSpec('`+`').rest).toBe('+');
			expect(parseSpec('f()').rest).toBe('f');
		});
	});

	describe('parseSpec', () => {
		test('wildcard name with argument and function constraints', () => {
			expect(parseSpec('*([alias],*) [pure]')).toEqual({
				rest:  '',
				args:  [{ name: '', roles: ['alias'] }, { repeat: '*', name: '', roles: [] }],
				props: ['pure']
			});
		});
		test('named formal with several roles, commas inside brackets do not split', () => {
			expect(parseSpec('f(x[alias,forced], y)').args).toEqual([
				{ name: 'x', roles: ['alias', 'f'] },
				{ name: 'y', roles: [] }
			]);
		});
		test('short and long words are the same', () => {
			expect(parseSpec('[invisible]').props).toEqual(parseSpec('[invis]').props);
		});
		test('operators take constraints too', () => {
			expect(parseSpec('+(x)[pure]')).toMatchObject({ rest: '+', props: ['pure'] });
		});
		test('properties may come first', () => {
			expect(parseSpec('[pure] *([alias],*)')).toEqual(parseSpec('*([alias],*) [pure]'));
			expect(parseSpec('[pure] read*')).toMatchObject({ rest: 'read*', props: ['pure'] });
			expect(parseSpec('[pure] *([alias]*) [invisible]').props).toEqual(['pure', ...parseSpec('[invisible]').props]);
			expect(parseSpec('*[pure]([alias]*)')).toEqual(parseSpec('*([alias]*) [pure]'));
		});
		test('brackets that lead a name stay a name', () => {
			expect(parseSpec('[ x')).toEqual({ rest: '[ x', props: [] });
			expect(parseSpec('[[ x')).toEqual({ rest: '[[ x', props: [] });
		});
		test('empty brackets are no constraint', () => {
			expect(parseSpec('[]')).toEqual({ rest: '[]', props: [] });
		});
	});

	describe('matchArgs', () => {
		const m = (spec: string, args: string) => matchArgs(parseSpec(spec).args ?? [], argsOf(args));
		test('first alias, anything after', () => {
			expect(m('*([alias],*)', 'x:alias|forced,y')).toBe(true);
			expect(m('*([alias],*)', 'x:alias')).toBe(true);
			expect(m('*([alias],*)', 'x:value,y:alias')).toBe(false);
		});
		test('without a star the count is exact', () => {
			expect(m('f([alias])', 'x:alias,y')).toBe(false);
			expect(m('f([alias])', 'x:alias')).toBe(true);
		});
		test('a star may sit in the middle', () => {
			expect(m('f(*,[alias],*)', 'a,b:alias,c')).toBe(true);
			expect(m('f(*,[alias])', 'a,b:alias,c')).toBe(false);
		});
		test('names and roles together', () => {
			expect(m('f(x[value])', 'x:value')).toBe(true);
			expect(m('f(x[value])', 'y:value')).toBe(false);
		});
		test('one or more arguments that all have a role', () => {
			expect(m('*([value]+)', 'x:value,y:value|forced')).toBe(true);
			expect(m('*([value]+)', 'x:value,y')).toBe(false);
			expect(m('*([value]+)', '')).toBe(false);
		});
		test('zero or more arguments that all have a role', () => {
			expect(m('*([value]*)', '')).toBe(true);
			expect(m('*([value]*)', 'x:value,y:value')).toBe(true);
			expect(m('*([value]*)', 'x:value,y')).toBe(false);
		});
		test('a repeated item followed by another one', () => {
			expect(m('f([value]+,[alias])', 'a:value,b:value,c:alias')).toBe(true);
			expect(m('f([value]+,[alias])', 'c:alias')).toBe(false);
		});
		test('at least one argument with a role, the others may be anything', () => {
			expect(m('*([value]?) [pure]', 'x:value')).toBe(true);
			expect(m('*([value]?)', 'x,y:value|forced,z')).toBe(true);
			expect(m('*([value]?)', 'x,y:alias')).toBe(false);
			expect(m('*([value]?)', '')).toBe(false);
		});
		test('a named argument must exist', () => {
			expect(m('*(x?)', 'a,x:value,b')).toBe(true);
			expect(m('*(x?)', 'a,b')).toBe(false);
			expect(m('*(x[value]?)', 'a,x,b')).toBe(false);
			expect(m('*(x[value]?)', 'a,x:value')).toBe(true);
		});
		test('a bare quantifier asks for any arguments', () => {
			expect(m('*(+)', 'a')).toBe(true);
			expect(m('*(+)', '')).toBe(false);
			expect(m('*(?)', 'a,b')).toBe(true);
		});
		test('no stated arguments', () => {
			expect(m('f(*)', '')).toBe(true);
			expect(m('f([alias])', '')).toBe(false);
		});
	});

	describe('globOf', () => {
		test('matches the whole name', () => {
			expect(globOf('read*')?.test('read.csv')).toBe(true);
			expect(globOf('read*')?.test('xread.csv')).toBe(false);
			expect(globOf('*csv')?.test('read.csv')).toBe(true);
			expect(globOf('a.b*')?.test('axb')).toBe(false);
		});
		test('operators and a bare star are names', () => {
			for(const name of ['*', '**', '%*%', '[[<-', 'plain']) {
				expect(globOf(name)).toBeUndefined();
			}
		});
	});
});

describe('sigdb page patterns', () => {
	test('a name between slashes is a regular expression', () => {
		const spec = parseSpec('/^read\\.(csv|table)$/');
		expect(spec.rest).toBe('');
		expect(spec.nameRegex?.test('read.csv')).toBe(true);
		expect(spec.nameRegex?.test('read.csv2')).toBe(false);
		expect(spec.nameRegex?.test('READ.TABLE')).toBe(true);
	});
	test('brackets, commas and parentheses inside a pattern do not split the query', () => {
		const spec = parseSpec('/^[a-z]{1,3}(x|y)$/([alias],*) [pure]');
		expect(spec.nameRegex?.test('abx')).toBe(true);
		expect(spec.props).toEqual(['pure']);
		expect(spec.args).toHaveLength(2);
	});
	test('patterns for argument names', () => {
		const spec = parseSpec('*(/^file/?)');
		expect(matchArgs(spec.args ?? [], argsOf('a,filename,b'))).toBe(true);
		expect(matchArgs(spec.args ?? [], argsOf('a,b'))).toBe(false);
	});
	test('/ and unfinished or broken patterns stay names', () => {
		for(const text of ['/', '//', '/abc', '/[/', '/(/']) {
			expect(parseSpec(text)).toEqual({ rest: text, nameRegex: undefined, props: [] });
		}
	});
	test('patterns are colored whole', () => {
		expect(highlight('/^[a-z]+$/')).toEqual([['/^[a-z]+$/', 'regex']]);
		expect(highlight('*(/^f[ab]/[value]?) [pure]').filter(([, kind]) => kind === 'regex').map(([text]) => text)).toEqual(['/^f[ab]/']);
		expect(highlight('*(/^f[ab]/[value]?) [pure]').map(([text]) => text).join('')).toBe('*(/^f[ab]/[value]?) [pure]');
	});
});

describe('sigdb page completion', () => {
	const at = (text: string) => completeAt(text, text.length);
	test('roles inside an argument list', () => {
		expect(at('*([al')?.options).toEqual(['alias']);
		expect(at('f(x[')?.options).toContain('value');
	});
	test('properties after the arguments', () => {
		expect(at('*([alias],*) [pu')?.options).toEqual(['pure']);
		expect(at('read.csv[inv')?.options).toEqual(['invisible']);
	});
	test('replaces only the word being typed', () => {
		expect(at('*([alias,fo')).toMatchObject({ from: 9, to: 11, options: ['forced'] });
	});
	test('does not offer what is already there', () => {
		expect(at('*([alias,al')).toBeUndefined();
	});
	test('names with brackets and closed brackets offer nothing', () => {
		for(const text of ['[', '[[', '[[<-', '[.data.frame', '+', '*', 'f([alias]', '']) {
			expect(at(text)).toBeUndefined();
		}
	});
});

describe('sigdb page highlighting', () => {
	const kinds = (text: string) => highlight(text).filter(([, kind]) => kind !== 'punct' && kind !== 'plain' && kind !== 'op').map(([word, kind]) => `${kind}:${word}`);
	test('roles in arguments, properties after them', () => {
		expect(kinds('*([alias],*) [pure]')).toEqual(['role:alias', 'prop:pure']);
	});
	test('unknown words are marked, short forms are known', () => {
		expect(kinds('f([alais,F]) [invis]')).toEqual(['bad:alais', 'role:F', 'prop:invis']);
	});
	test('an unfinished query is still colored', () => {
		expect(kinds('*([va')).toEqual(['bad:va']);
	});
	test('the pieces always give the text back', () => {
		for(const text of ['*([alias],*) [pure]', 'f(x[a,b]+', '[[<-', '+', '', 'a[b]c', '(', '[', 'x[']) {
			expect(highlight(text).map(([part]) => part).join('')).toBe(text);
		}
	});
	test('leading properties are colored', () => {
		expect(kinds('[pure] *([alias],*)')).toEqual(['prop:pure', 'role:alias']);
	});
	test('wildcards and quantifiers are operators', () => {
		expect(highlight('*([value]+,*)').filter(([, kind]) => kind === 'op').map(([text]) => text)).toEqual(['*', '+', '*']);
	});
	test('hovering explains a piece', () => {
		const text = '*([alias]?) [pure]';
		expect(explainAt(text, text.indexOf('alias'))).toBe('handed back as the result');
		expect(explainAt(text, text.indexOf('pure'))).toBe('computes a result, nothing else');
		expect(explainAt(text, text.indexOf('?'))).toBe('at least one like the one before');
		expect(explainAt(text, 0)).toBe('any number of arguments');
		expect(explainAt('read.csv', 2)).toBeUndefined();
	});
	test('plain names are not colored', () => {
		for(const text of ['[', '[[', '%*%', '*', 'read.csv']) {
			expect(highlight(text)).toEqual([[text, 'plain']]);
		}
	});
});

describe('sigdb page incomplete queries', () => {
	test('open brackets and unknown words are unfinished', () => {
		for(const text of ['*([', '*([ali', '*([alias],', 'f(x', 'f(x[value]', '*([alias]) [pu', '*([alais])']) {
			expect(isIncomplete(text), text).toBe(true);
		}
	});
	test('whole queries are finished', () => {
		for(const text of ['*([alias],*) [pure]', '[pure] *', '*(x?)', 'f()', 'read*', '/^a[b]/', 'dplyr::filter']) {
			expect(isIncomplete(text), text).toBe(false);
		}
	});
	test('names with brackets are never unfinished', () => {
		for(const text of ['[', '[[', '[[<-', '(', '((', '{', '%*%', '[.data.frame', '+', '*']) {
			expect(isIncomplete(text), text).toBe(false);
		}
	});
});

describe('sigdb page closing', () => {
	test('whatever is open gets closed', () => {
		expect(closed('*([alias],*) [pure')).toBe('*([alias],*) [pure]');
		expect(closed('*([ali')).toBe('*([ali])');
		expect(closed('f(x[value]')).toBe('f(x[value])');
	});
	test('finished queries and names stay as they are', () => {
		for(const text of ['*([alias],*) [pure]', 'read*', '[[<-', '(', '((', '%*%']) {
			expect(closed(text)).toBe(text);
		}
	});
	test('a closed completion parses as the query it stands for', () => {
		expect(parseSpec(closed('*([alias],*) [pure')).props).toEqual(['pure']);
	});
});

describe('sigdb page problems', () => {
	test('open brackets and parentheses are named', () => {
		expect(problemsOf('*([alias],')).toEqual(['missing `)`']);
		expect(problemsOf('*([alias')).toEqual(['missing `]`', 'missing `)`']);
		expect(problemsOf('f(x))')).toEqual(['unexpected `)`']);
		expect(problemsOf('f(g(x')).toEqual(['missing 2 times `)`']);
	});
	test('an unknown word comes with the closest known one', () => {
		expect(problemsOf('*([alais]) [pure]')).toEqual(['`alais` is no known argument role, did you mean `alias`?']);
		expect(problemsOf('*([alias]) [pur]')).toEqual(['`pur` is no known function property, did you mean `pure`?']);
		expect(problemsOf('*([zzzzzzzz])')[0]).toBe('`zzzzzzzz` is no known argument role');
	});
	test('a pattern that does not compile is named', () => {
		expect(problemsOf('/(/')[0]).toMatch(/^invalid pattern \/\(\/: /);
	});
	test('fine queries and names have no problems', () => {
		for(const text of ['*([alias],*) [pure]', '[pure] *', '*(x?)', 'read*', '/^a[b]/', '[[<-', '(', '((', '%*%', '', '*', '[']) {
			expect(problemsOf(text), text).toEqual([]);
		}
	});
});
