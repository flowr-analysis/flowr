import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

const Certain = LintingResultCertainty.Certain;
const Uncertain = LintingResultCertainty.Uncertain;

describe('flowR linter', withTreeSitter(parser => {
	describe('s3-method-consistency', () => {
		const ns = (...lines: string[]) => ({ files: { NAMESPACE: lines.join('\n') + '\n' } });
		const mismatch = (fn: string, generic: string, certainty = Uncertain) => ({ kind: 'argument-mismatch', function: fn, generic, certainty });
		const call = (g: string) => `\nuse_${g.replace(/\W/g, '_')} <- function(x) ${g}(x)`;

		describe('registered methods', () => {
			assertLinterPackage('missing dots', parser, 'print.foo <- function(x) 1', 's3-method-consistency', [mismatch('print.foo', 'print', Certain)], ns('S3method(print, foo)'));
			assertLinterPackage('renamed first argument', parser, 'print.foo <- function(obj, ...) 1', 's3-method-consistency', [mismatch('print.foo', 'print', Certain)], ns('S3method(print, foo)'));
			assertLinterPackage('correct method', parser, 'print.foo <- function(x, ...) 1', 's3-method-consistency', [], ns('S3method(print, foo)'));
			assertLinterPackage('extra named arguments after the dots are fine', parser, 'print.foo <- function(x, ..., digits = 3) 1', 's3-method-consistency', [], ns('S3method(print, foo)'));
			assertLinterPackage('extra arguments before the dots are fine with a generic that has dots', parser, 'print.foo <- function(x, digits = 3, ...) 1', 's3-method-consistency', [], ns('S3method(print, foo)'));
			assertLinterPackage('dots first are accepted as R does', parser, 'sort.foo <- function(..., x, decreasing) 1', 's3-method-consistency', [], ns('S3method(sort, foo)'));
			assertLinterPackage('arguments swapped', parser, 'sort.foo <- function(decreasing, x, ...) 1', 's3-method-consistency', [mismatch('sort.foo', 'sort', Certain)], ns('S3method(sort, foo)'));
			assertLinterPackage('method without a generic argument but with dots', parser, 'sort.foo <- function(x, ...) 1', 's3-method-consistency', [], ns('S3method(sort, foo)'));
			assertLinterPackage('generic without dots, method adds an argument', parser, 'length.foo <- function(x, extra) 1', 's3-method-consistency', [mismatch('length.foo', 'length', Certain)], ns('S3method(length, foo)'));
			assertLinterPackage('generic without dots, method renames the argument', parser, 'length.foo <- function(obj) 1', 's3-method-consistency', [mismatch('length.foo', 'length', Certain)], ns('S3method(length, foo)'));
			assertLinterPackage('message names both signatures', parser, 'print.foo <- function(x) 1', 's3-method-consistency', [
				{ message: 'S3 generic/method inconsistency:\nprint:\n  function(x, ...)\nprint.foo:\n  function(x)' }
			], ns('S3method(print, foo)'));
			assertLinterPackage('location is the name of the method', parser, 'a <- 1\nprint.foo <- function(x) 1', 's3-method-consistency', [
				{ loc: [2, 1, 2, 9, '/pkg/R/code.R'] }
			], ns('S3method(print, foo)'));
			assertLinterPackage('quoted method name', parser, '"print.foo" <- function(x) 1', 's3-method-consistency', [mismatch('print.foo', 'print', Certain)], ns('S3method(print, foo)'));
			assertLinterPackage('registered method not defined in the package is ignored', parser, 'f <- function() 1', 's3-method-consistency', [], ns('S3method(print, foo)'));
			assertLinterPackage('method of a class with dots in its name', parser, 'print.foo.bar <- function(x) 1', 's3-method-consistency', [mismatch('print.foo.bar', 'print', Certain)], ns('S3method(print, foo.bar)'));
			assertLinterPackage('formula methods ignore the first argument', parser, 'sort.formula <- function(formula, ...) 1', 's3-method-consistency', [], ns('S3method(sort, formula)'));
			assertLinterPackage('round methods taking x are fine', parser, 'round.foo <- function(x, ...) 1', 's3-method-consistency', [], ns('S3method(round, foo)'));
			assertLinterPackage('round method with a different first argument', parser, 'round.foo <- function(y, digits) 1', 's3-method-consistency', [mismatch('round.foo', 'round', Certain)], ns('S3method(round, foo)'));
			assertLinterPackage('as.data.frame methods', parser, 'as.data.frame.foo <- function(x, row.names = NULL, optional = FALSE, ...) 1', 's3-method-consistency', [], ns('S3method(as.data.frame, foo)'));
			assertLinterPackage('as.data.frame method missing arguments', parser, 'as.data.frame.foo <- function(x, optional) 1', 's3-method-consistency', [mismatch('as.data.frame.foo', 'as.data.frame', Certain)], ns('S3method(as.data.frame, foo)'));
		});

		describe('group generics and operators', () => {
			assertLinterPackage('Ops with the right arguments', parser, 'Ops.foo <- function(e1, e2) 1', 's3-method-consistency', [], ns('S3method(Ops, foo)'));
			assertLinterPackage('Ops with renamed arguments', parser, 'Ops.foo <- function(a, b) 1', 's3-method-consistency', [mismatch('Ops.foo', 'Ops', Certain)], ns('S3method(Ops, foo)'));
			assertLinterPackage('Math without dots', parser, 'Math.foo <- function(x) 1', 's3-method-consistency', [mismatch('Math.foo', 'Math', Certain)], ns('S3method(Math, foo)'));
			assertLinterPackage('Math with dots', parser, 'Math.foo <- function(x, ...) 1', 's3-method-consistency', [], ns('S3method(Math, foo)'));
			assertLinterPackage('Summary with na.rm', parser, 'Summary.foo <- function(..., na.rm = FALSE) 1', 's3-method-consistency', [], ns('S3method(Summary, foo)'));
			assertLinterPackage('operator methods only need the right number of arguments', parser, '"+.foo" <- function(a, b) 1', 's3-method-consistency', [], ns('S3method("+", foo)'));
			assertLinterPackage('operator method with the wrong number of arguments', parser, '"+.foo" <- function(a) 1', 's3-method-consistency', [mismatch('+.foo', '+', Certain)], ns('S3method("+", foo)'));
			assertLinterPackage('subsetting methods take any arguments', parser, '"[.foo" <- function(x, i, j, drop) 1\n"$.foo" <- function(x, nm) 1', 's3-method-consistency', [], ns('S3method("[", foo)', 'S3method("$", foo)'));
		});

		describe('apparent methods', () => {
			assertLinterPackage('apparent method of a called generic of base R', parser, 'print.foo <- function(x) 1' + call('print'), 's3-method-consistency', [mismatch('print.foo', 'print')]);
			assertLinterPackage('apparent method of a generic never called is not reported', parser, 'print.foo <- function(x) 1', 's3-method-consistency', []);
			assertLinterPackage('apparent method, but the NAMESPACE does not register it', parser, 'print.foo <- function(x) 1' + call('print'), 's3-method-consistency', [mismatch('print.foo', 'print')], ns('export(f)'));
			assertLinterPackage('apparent Ops method counts as called through an operator', parser, 'Ops.foo <- function(a, b) 1\nf <- function(x) x + 1', 's3-method-consistency', [mismatch('Ops.foo', 'Ops')]);
			assertLinterPackage('apparent methods can be turned off', parser, 'print.foo <- function(x) 1' + call('print'), 's3-method-consistency', [], { checkApparentMethods: false });
			assertLinterPackage('registered methods stay with apparent ones turned off', parser, 'print.foo <- function(x) 1', 's3-method-consistency', [mismatch('print.foo', 'print', Certain)], { ...ns('S3method(print, foo)'), checkApparentMethods: false });
			assertLinterPackage('methods can be turned off', parser, 'print.foo <- function(x) 1', 's3-method-consistency', [], { ...ns('S3method(print, foo)'), checkMethods: false });
			assertLinterPackage('t.test is no method of t', parser, 't.test <- function(a, b) 1' + call('t'), 's3-method-consistency', []);
			assertLinterPackage('rep.int is no method of rep', parser, 'rep.int <- function(a) 1' + call('rep'), 's3-method-consistency', []);
			assertLinterPackage('a function of the package hides the generic of base R', parser, 'print <- function(x) 1\nprint.foo <- function(x) 1', 's3-method-consistency', []);
			assertLinterPackage('a function without a generic', parser, 'foo.bar <- function(x) 1', 's3-method-consistency', []);
			assertLinterPackage('a generic alone is no method', parser, 'print <- function(x, ...) UseMethod("print")', 's3-method-consistency', []);
		});

		describe('generics of the package', () => {
			const gen = 'gen <- function(x, ...) UseMethod("gen")\n';
			assertLinterPackage('method missing the dots', parser, gen + 'gen.foo <- function(x) 1', 's3-method-consistency', [mismatch('gen.foo', 'gen')]);
			assertLinterPackage('method with matching arguments', parser, gen + 'gen.foo <- function(x, y = 2, ...) 1', 's3-method-consistency', []);
			assertLinterPackage('generic without dots', parser, 'gen <- function(x, y) UseMethod("gen")\ngen.foo <- function(x, y, z) 1', 's3-method-consistency', [mismatch('gen.foo', 'gen')]);
			assertLinterPackage('registered method of a local generic is certain', parser, gen + 'gen.foo <- function(a, ...) 1', 's3-method-consistency', [mismatch('gen.foo', 'gen', Certain)], ns('export(gen)', 'S3method(gen, foo)'));
			assertLinterPackage('UseMethod of a nested function does not make a generic', parser, 'gen <- function(x) { h <- function(y) UseMethod("h"); 1 }\ngen.foo <- function(a) 1', 's3-method-consistency', []);
			assertLinterPackage('redefined UseMethod does not make a generic', parser, 'UseMethod <- function(...) 1\ngen <- function(x, ...) UseMethod("gen")\ngen.foo <- function(a) 1', 's3-method-consistency', []);
			assertLinterPackage('generic with a longer name wins', parser, 'gen <- function(x, ...) UseMethod("gen")\ngen.sub <- function(x, ...) UseMethod("gen.sub")\ngen.sub.foo <- function(x, a) 1', 's3-method-consistency', [mismatch('gen.sub.foo', 'gen.sub')]);
		});

		describe('unregistered methods', () => {
			const gen = 'gen <- function(x, ...) UseMethod("gen")\n';
			assertLinterPackage('exported generic, unregistered method', parser, gen + 'gen.foo <- function(x, ...) 1', 's3-method-consistency', [
				{ kind: 'unregistered-method', function: 'gen.foo', generic: 'gen', certainty: Uncertain }
			], ns('export(gen)'));
			assertLinterPackage('registered method is fine', parser, gen + 'gen.foo <- function(x, ...) 1', 's3-method-consistency', [], ns('export(gen)', 'S3method(gen, foo)'));
			assertLinterPackage('generic not exported', parser, gen + 'gen.foo <- function(x, ...) 1', 's3-method-consistency', [], ns('export(other)'));
			assertLinterPackage('export pattern', parser, gen + 'gen.foo <- function(x, ...) 1', 's3-method-consistency', [{ kind: 'unregistered-method' }], ns('exportPattern("^gen")'));
			assertLinterPackage('no NAMESPACE, nothing to compare', parser, gen + 'gen.foo <- function(x, ...) 1', 's3-method-consistency', []);
			assertLinterPackage('exported method of a generic of base R', parser, 'print.foo <- function(x, ...) 1', 's3-method-consistency', [{ kind: 'unregistered-method', generic: 'print' }], ns('export(print.foo)'));
			assertLinterPackage('unexported method of a generic of base R', parser, 'print.foo <- function(x, ...) 1', 's3-method-consistency', [], ns('export(f)'));
			assertLinterPackage('can be turned off', parser, gen + 'gen.foo <- function(x, ...) 1', 's3-method-consistency', [], { ...ns('export(gen)'), checkUnregistered: false });
			assertLinterPackage('message names the method and the generic', parser, gen + 'gen.foo <- function(x, ...) 1', 's3-method-consistency', [
				{ message: 'Apparent S3 method gen.foo for exported generic gen is not registered in the NAMESPACE' }
			], ns('export(gen)'));
		});

		describe('replacement functions', () => {
			const repl = (fn: string, certainty = Certain) => ({ kind: 'replacement-value', function: fn, certainty });
			assertLinterPackage('value is not last', parser, '"foo<-" <- function(value, x) x', 's3-method-consistency', [repl('foo<-')]);
			assertLinterPackage('value is missing', parser, '"foo<-" <- function(x, val) x', 's3-method-consistency', [repl('foo<-')]);
			assertLinterPackage('value last is fine', parser, '"foo<-" <- function(x, i, value) x', 's3-method-consistency', []);
			assertLinterPackage('backtick name', parser, '`foo<-` <- function(x, v) x', 's3-method-consistency', [repl('foo<-')]);
			assertLinterPackage('no arguments is fine', parser, '"foo<-" <- function() 1', 's3-method-consistency', []);
			assertLinterPackage('percent operators are no replacement functions', parser, '`%in<-%` <- function(a, b) 1', 's3-method-consistency', []);
			assertLinterPackage('message', parser, '"foo<-" <- function(x, val) x', 's3-method-consistency', [{ message: "Replacement function foo<- should have 'value' as its last argument" }]);
			assertLinterPackage('location is the name', parser, 'a <- 1\n"foo<-" <- function(x, val) x', 's3-method-consistency', [{ loc: [2, 1, 2, 7, '/pkg/R/code.R'] }]);
			assertLinterPackage('registered replacement method', parser, '"[<-.foo" <- function(x, i, val) x', 's3-method-consistency', [{ ...repl('[<-.foo'), generic: '[<-' }], ns('S3method("[<-", foo)'));
			assertLinterPackage('registered replacement method, correct', parser, '"$<-.foo" <- function(x, name, value) x', 's3-method-consistency', [], ns('S3method("$<-", foo)'));
			assertLinterPackage('apparent replacement method of a subsetting generic', parser, '"[<-.foo" <- function(x, i, val) x', 's3-method-consistency', [repl('[<-.foo', Uncertain)]);
			assertLinterPackage('replacement method of a generic of the package', parser, '"gen<-" <- function(x, value) UseMethod("gen<-")\n"gen<-.foo" <- function(x, v) x', 's3-method-consistency', [mismatch('gen<-.foo', 'gen<-'), repl('gen<-.foo', Uncertain)].map(r => ({ kind: r.kind, certainty: r.certainty })));
			assertLinterPackage('a dot name that is no replacement generic', parser, '"foo<-.bar" <- function(x, v) x', 's3-method-consistency', []);
			assertLinterPackage('can be turned off', parser, '"foo<-" <- function(x, val) x', 's3-method-consistency', [], { checkReplacementValues: false });
		});

		describe('exact formals of generics', () => {
			assertLinterPackage('t takes no dots', parser, 't.foo <- function(x) 1', 's3-method-consistency', [], ns('S3method(t, foo)'));
			assertLinterPackage('rev takes no dots', parser, 'rev.foo <- function(x) 1', 's3-method-consistency', [], ns('S3method(rev, foo)'));
			assertLinterPackage('t method with other arguments', parser, 't.foo <- function(y) 1', 's3-method-consistency', [mismatch('t.foo', 't', Certain)], ns('S3method(t, foo)'));
			assertLinterPackage('transform takes _data', parser, 'transform.foo <- function(`_data`, ...) 1', 's3-method-consistency', [], ns('S3method(transform, foo)'));
			assertLinterPackage('trunc takes dots', parser, 'trunc.foo <- function(x, ...) 1', 's3-method-consistency', [], ns('S3method(trunc, foo)'));
			assertLinterPackage('cumsum takes no dots', parser, 'cumsum.foo <- function(x) 1', 's3-method-consistency', [], ns('S3method(cumsum, foo)'));
			assertLinterPackage('plot methods are fine', parser, 'plot.foo <- function(x, y, ...) 1', 's3-method-consistency', [], ns('S3method(plot, foo)'));
		});

		describe('functions that are no methods', () => {
			const pkg = (name: string) => ({ files: { DESCRIPTION: `Package: ${name}\nVersion: 1.0\nTitle: A Package\nLicense: MIT\n`, NAMESPACE: 'S3method(dim, def.nc)\nS3method(dim, inq.nc)\n' } });
			assertLinterPackage('dim.def.nc of RNetCDF is no method', parser, 'dim.def.nc <- function(ncfile, name) 1', 's3-method-consistency', [], pkg('RNetCDF'));
			assertLinterPackage('dim.inq.nc of RNetCDF is no method', parser, 'dim.inq.nc <- function(ncfile, name) 1', 's3-method-consistency', [], pkg('RNetCDF'));
			assertLinterPackage('the same name in another package is checked', parser, 'dim.def.nc <- function(ncfile, name) 1', 's3-method-consistency', [mismatch('dim.def.nc', 'dim', Certain)], pkg('other'));
		});

		describe('scope', () => {
			assertLinterPackage('nested functions are no package-level methods', parser, 'f <- function() { print.foo <- function(x) 1 }', 's3-method-consistency', [], ns('S3method(print, foo)'));
			assertLinterPackage('functions outside of R/ are ignored', parser, 'print.foo <- function(x) 1', 's3-method-consistency', [], { ...ns('S3method(print, foo)'), file: 'tests/testthat/helper.R' });
			assertLinterPackage('replacement functions outside of R/ are ignored', parser, '"foo<-" <- function(x, val) x', 's3-method-consistency', [], { file: 'inst/run.R' });
			assertLinterPackage('several problems at once', parser, 'print.foo <- function(x) 1\n"foo<-" <- function(x, v) x', 's3-method-consistency', [
				{ kind: 'argument-mismatch', function: 'print.foo' }, { kind: 'replacement-value', function: 'foo<-' }
			], ns('S3method(print, foo)'));
		});
	});
}));
