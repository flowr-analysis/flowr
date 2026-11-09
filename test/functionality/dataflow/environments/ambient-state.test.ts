import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { AmbientStateName, KeyedState } from '../../../../src/dataflow/environments/ambient-state-name';
import { RBinaryOp } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RNode } from '../../../../src/r-bridge/lang-4.x/ast/model/model';
import type { RNodeWithParent } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { type BrandedIdentifier, Identifier } from '../../../../src/dataflow/environments/identifier';
import { Resolve } from '../../../../src/dataflow/environments/resolve-helper';
import { FlowrConfig } from '../../../../src/config';
import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import { VertexType } from '../../../../src/dataflow/graph/vertex';
import { DataflowGraph, type DataflowGraphJson, UnknownSideEffect } from '../../../../src/dataflow/graph/graph';
import { BuiltInProcName } from '../../../../src/dataflow/environments/built-in-proc-name';
import { SemanticCallTag } from '../../../../src/dataflow/environments/built-in-props';
import type { BuiltInDefinition } from '../../../../src/dataflow/environments/built-in-config';
import type { AmbientAccess } from '../../../../src/dataflow/graph/ambient-access';

describe('Ambient state summaries', withTreeSitter(ts => {
	type Kind = 'writes' | 'assumed' | 'kills' | 'variables';

	/** what each function, named by what it is assigned to, may leave changed (sorted) */
	async function summaries(code: string, kind: Kind): Promise<Record<BrandedIdentifier, BrandedIdentifier[]>> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(requestFromInput(code));
		const dfi = await analyzer.dataflow();
		const idMap = (await analyzer.normalize()).idMap;
		const result: Record<BrandedIdentifier, BrandedIdentifier[]> = {};
		for(const [id, writes] of Dataflow.sideEffects.ambientAccessOfFunctions(dfi)) {
			const parent = RNode.directParent(idMap.get(id) as RNodeWithParent, idMap);
			if(RBinaryOp.is(parent)) {
				result[Identifier.getName((parent.lhs as { content: Identifier }).content)] = [...writes[kind].keys()].sort();
			}
		}
		return result;
	}

	function check(name: string, code: string, expected: Record<string, string[]>, kind: Kind = 'writes'): void {
		test(label(name, [], ['dataflow']), async() => {
			assert.deepStrictEqual(await summaries(code, kind), Object.fromEntries(Object.entries(expected).map(([fn, w]) => [fn, [...w].sort()])));
		});
	}

	describe('options', () => {
		check('a function that sets an option', 'a01 <- function() options(digits = 3)', { a01: ['#option:digits', '#options'] });
		check('writes pass up through calls', 'a01 <- function() options(digits = 3)\na22 <- function() a01()\na33 <- function() 1', {
			a01: ['#option:digits', '#options'], a22: ['#option:digits', '#options'], a33: []
		});
		check('queries are no writes', 'a01 <- function() options("digits")', { a01: [] });
		check('options restored from a variable', 'a01 <- function(op) options(op)', { a01: ['#option:*', '#options'] });
		check('passed up through a chain', 'a <- function() options(width = 20)\nb <- function() a()\nc <- function() b()', {
			a: ['#option:width', '#options'], b: ['#option:width', '#options'], c: ['#option:width', '#options']
		});
		check('recursion terminates', 'a <- function(n) { options(digits = n); if(n > 0) a(n - 1) }', { a: ['#option:digits', '#options'] });
		check('frame-local writes are left out', 'a01 <- function() { withr::local_options(digits = 3); 1 }', { a01: [] });
		check('an exit hook writes for the function', 'a01 <- function() { on.exit(options(digits = 3)); 1 }', { a01: ['#option:digits', '#options'] });
		check('an exit hook restoring options', 'a01 <- function(op) { on.exit(options(op)); 1 }', { a01: ['#option:*', '#options'] });
	});

	describe('quoted code runs only if evaluated', () => {
		check('quote', 'a01 <- function() quote(options(digits = 3))', { a01: [] });
		check('bquote', 'a01 <- function(x) bquote(options(digits = .(x)))', { a01: [] });
		check('expression', 'a01 <- function() expression(options(digits = 3))', { a01: [] });
		check('substitute', 'a01 <- function() substitute(options(digits = 3))', { a01: [] });
		check('trace', 'a01 <- function() trace(g, quote(options(digits = 3)))', { a01: [] });
		check('evaluated', 'a01 <- function() eval(quote(options(digits = 3)))', { a01: ['#option:digits', '#options'] });
		check('evaluated through a variable', 'a01 <- function() { e <- quote(options(digits = 3)); eval(e) }', { a01: ['#option:digits', '#options'] });
	});

	describe('environment variables', () => {
		check('Sys.setenv names the variables', 'a01 <- function() Sys.setenv(LANG = "C", R_LIBS = "x")', { a01: ['#env', '#env:LANG', '#env:R_LIBS'] });
		check('Sys.unsetenv names the variables by value', 'a01 <- function() Sys.unsetenv("TZ")', { a01: ['#env', '#env:TZ'] });
		check('Sys.unsetenv with an unknown name', 'a01 <- function(v) Sys.unsetenv(v)', { a01: ['#env', '#env:*'] });
		check('resolved variable', 'a01 <- function() { v <- "HOME"; Sys.unsetenv(v) }', { a01: ['#env', '#env:HOME'] });
	});

	describe('locale and language', () => {
		check('Sys.setlocale with a category', 'a01 <- function() Sys.setlocale("LC_COLLATE", "C")', { a01: ['#locale', '#locale:LC_COLLATE'] });
		check('Sys.setlocale by name', 'a01 <- function() Sys.setlocale(locale = "C", category = "LC_TIME")', { a01: ['#locale', '#locale:LC_TIME'] });
		check('Sys.setlocale defaults to LC_ALL', 'a01 <- function() Sys.setlocale(locale = "C")', { a01: ['#locale', '#locale:LC_ALL'] });
		check('Sys.setLanguage', 'a01 <- function() Sys.setLanguage("de")', { a01: ['#env', '#env:LANGUAGE', '#locale', '#locale:LANGUAGE'] });
	});

	describe('graphics parameters', () => {
		check('par names its parameters', 'a01 <- function() par(mfrow = c(1, 2), mar = c(1, 1, 1, 1))', { a01: ['#device', '#graphics', '#par:mar', '#par:mfrow'] });
		check('par restoring a saved list', 'a01 <- function(op) par(op)', { a01: ['#device', '#graphics', '#par:*'] });
		/* a query opens a device if none is open (checked against R), but leaves the parameters alone */
		check('par queries are no writes', 'a01 <- function() par("mar")', { a01: ['#device'] });
		check('no.readonly is a query', 'a01 <- function() par(no.readonly = TRUE)', { a01: ['#device'] });
	});

	describe('output, files, and devices', () => {
		check('sink diverts the output', 'a01 <- function() sink("out.txt")', { a01: ['#sink', '#sink:opener', '#sink:output', '#file:out', '#files'] });
		check('sink() ends the diversion, which finishes the file it wrote', 'a01 <- function() sink()', { a01: ['#sink', '#sink:opener', '#sink:output', '#file:*', '#files'] });
		check('Sys.umask sets the mask', 'a01 <- function() Sys.umask("022")', { a01: ['#umask'] });
		check('Sys.umask() only queries', 'a01 <- function() Sys.umask()', { a01: [] });
		check('a device is opened', 'a01 <- function() pdf("a.pdf")', { a01: ['#device', '#device:opener', '#file:a', '#files', '#graphics', '#plot'] });
		/* a close ends the state of the device, a removal the entries it names (checked against R) */
		check('closing kills the device', 'a01 <- function() dev.off()\na22 <- function() graphics.off()\na03 <- function() dev.off(3)', {
			a01: ['#device', '#device:opener', '#graphics', '#plot'], a22: ['#device', '#device:opener', '#graphics', '#plot'], a03: []
		}, 'kills');
		check('kills of the other states', 'a01 <- function() sink()\na22 <- function() sink("a.txt")\na03 <- function() Sys.unsetenv("A")\na04 <- function() detach(package:dplyr)', {
			a01: ['#sink', '#sink:opener', '#sink:output'], a22: [], a03: ['#env:A'], a04: ['#search-path:dplyr']
		}, 'kills');
		check('a device is closed', 'a01 <- function() dev.off()', { a01: ['#device', '#device:opener', '#file:*', '#files', '#graphics', '#plot'] });
	});

	describe('the search path', () => {
		check('library with a symbol and a string', 'a01 <- function() library(dplyr)\na22 <- function() library("ggplot2")', {
			a01: ['#search-path', '#search-path:dplyr'], a22: ['#search-path', '#search-path:ggplot2']
		});
		check('require', 'a01 <- function() require(dplyr)', { a01: ['#search-path', '#search-path:dplyr'] });
		check('import::from attaches the imports', 'a01 <- function() import::from(dplyr, select)\na22 <- function() import::from(dplyr, select, .into = "tools")\na03 <- function() import::from(dplyr, select, .into = "")', {
			a01: ['#search-path', '#search-path:imports'], a22: ['#search-path', '#search-path:tools'], a03: []
		});
		check('library with character.only', 'a01 <- function() { p <- "dplyr"; library(p, character.only = TRUE) }', { a01: ['#search-path', '#search-path:dplyr'] });
		check('attach is named like its argument', 'df <- data.frame(x = 1)\na01 <- function() attach(df)\na22 <- function() attach(df, name = "data")', {
			a01: ['#search-path', '#search-path:df'], a22: ['#search-path', '#search-path:data']
		});
		check('detach', 'a01 <- function() detach(package:dplyr)\na22 <- function() detach("package:ggplot2", character.only = TRUE)', {
			a01: ['#search-path', '#search-path:dplyr'], a22: ['#search-path', '#search-path:ggplot2']
		});
	});

	describe('writes only assumed of a body we cannot see', () => {
		const code = 'hof <- function(f) f()\nhof2 <- function(x, FUN) vapply(x, FUN, 1)\nseeded <- function() set.seed(1)\nboth <- function(f) { set.seed(1); f() }\nup <- function() hof(function() 1)';
		check('a hidden body is no real write', code, { hof: [], hof2: [], seeded: ['#rng'], both: ['#rng'], up: [] });
		check('but an assumed one', code, { hof: ['#rng'], hof2: ['#rng'], seeded: [], both: [], up: ['#rng'] }, 'assumed');
	});

	describe('printing to the console writes no file', () => {
		check('cat and writeLines without a target', 'a01 <- function() cat("x")\na22 <- function() writeLines("x")\na03 <- function() dput(1)\na04 <- function() write.csv(1)\na05 <- function() capture.output(print(1))', {
			a01: ['#sink:output'], a22: ['#sink:output'], a03: ['#sink:output'], a04: [], a05: ['#sink:output']
		});
		check('the console named as the target', 'a01 <- function() cat("x", file = stderr())\na22 <- function() cat("x", file = "")\na03 <- function() writeLines("x", con = stdout())\na04 <- function() capture.output(print(1), file = NULL)', {
			a01: ['#message-sink:output', '#sink:output'], a22: ['#sink:output'], a03: ['#sink:output'], a04: ['#sink:output']
		});
		check('a named file is still written', 'a01 <- function() cat("x", file = "out.txt")\na22 <- function() capture.output(print(1), file = "c.txt")\na03 <- function(p) writeLines("x", p)', {
			a01: ['#file:out', '#files', '#sink:output'], a22: ['#file:c', '#files', '#sink:output'], a03: ['#file:*', '#files', '#sink:output']
		});
		check('write defaults to the file data', 'a01 <- function() write("x")', { a01: ['#file:*', '#files', '#sink:output'] });
		check('package functions printing by default', 'a01 <- function(d) data.table::fwrite(d)\na22 <- function(t) ape::write.tree(t)\na03 <- function(m) texreg::texreg(m)', {
			a01: [], a22: [], a03: []
		});
		check('reading the console reads no file', 'a01 <- function() readLines()\na22 <- function() scan(file = "")', { a01: [], a22: [] });
	});

	describe('aliases', () => {
		check('an alias keeps the names of its arguments', 'a01 <- function() { set <- Sys.setenv; set(TZ = "UTC") }\na22 <- function() { o <- options; o(digits = 4) }\na03 <- function() { o <- options; o("digits") }', {
			a01: ['#env', '#env:TZ'], a22: ['#option:digits', '#options'], a03: []
		});
		check('a parameter bound to a built-in names nothing', 'g <- function(f, ...) f(...)\na01 <- function() g(options, digits = 3)', {
			g: ['#option:*', '#options', '#warn-error'], a01: ['#option:*', '#options', '#warn-error']
		});
	});

	describe('global variables', () => {
		check('assign into the global environment and <<-', 'a01 <- function() assign("x", 1, envir = .GlobalEnv)\na22 <- function() y <<- 3\na03 <- function() a22()', {
			a01: ['x'], a22: ['y'], a03: ['y']
		}, 'variables');
		check('a closure keeps its own variable', 'a01 <- local({ n <- 0; inc <- function() n <<- 1; inc })\na22 <- function() { k <- 0; h <- function() k <<- 1; h() }\na03 <- function() { z <- 1; z }', {
			inc: [], h: [], a22: [], a03: []
		}, 'variables');
	});

	describe('names', () => {
		test(label('entries of a pseudo variable', [], ['dataflow']), () => {
			assert.strictEqual(AmbientStateName.keyed(KeyedState.SearchPath, 'package:dplyr'), '#search-path:dplyr');
		});
	});
}));

describe('Ambient access of code', withTreeSitter(ts => {
	type Selector = 'file' | 'first' | 'second' | 'last' | 'block';
	interface Shown { reads: BrandedIdentifier[], writes: BrandedIdentifier[], assumed: BrandedIdentifier[], kills: BrandedIdentifier[], variables: BrandedIdentifier[], draws: number }

	async function run(code: string, drawing = false) {
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.semantics.ambient = { drawingWritesDevice: drawing };
		});
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).setConfig(config).build();
		analyzer.addRequest(requestFromInput(code));
		const info = await analyzer.dataflow();
		const root = (await analyzer.normalize()).ast.files[0].root;
		return { graph: info.graph, info, root };
	}

	function shown(a: AmbientAccess): Shown {
		return { reads: [...a.reads.keys()].sort(), writes: [...a.writes.keys()].sort(), assumed: [...a.assumed.keys()].sort(), kills: [...a.kills.keys()].sort(), variables: [...a.variables.keys()].sort(), draws: a.draws.size };
	}

	async function access(code: string, selector: Selector, drawing = false): Promise<Shown> {
		const { info, root } = await run(code, drawing);
		const [first, second] = root.children;
		const scope = selector === 'file' ? RNode.collectAllIds(root) : selector === 'first' ? RNode.collectAllIds(first)
			: selector === 'second' ? RNode.collectAllIds(second) : selector === 'last' ? RNode.collectAllIds(root.children[root.children.length - 1]) : first.info.id;
		return shown(Dataflow.sideEffects.ambientAccess(info, scope));
	}

	function check(name: string, code: string, selector: Selector, expected: Partial<Shown>, drawing = false): void {
		test(label(name, [], ['dataflow']), async() => {
			assert.deepStrictEqual(await access(code, selector, drawing), { reads: [], writes: [], assumed: [], kills: [], variables: [], draws: 0, ...expected });
		});
	}

	describe('scopes', () => {
		check('a file', 'options(digits = 3)\nx <- 1', 'file', { writes: ['#option:digits', '#options'] });
		check('a statement', 'options(digits = 3)\nsink("a.txt")', 'second', { reads: ['#file:*', '#file:a', '#wd'], writes: ['#file:a', '#files', '#sink', '#sink:opener', '#sink:output'] });
		check('a single call id', 'options(digits = 3)\nx <- 1', 'block', { writes: ['#option:digits', '#options'] });
		check('a block', '{\n options(digits = 3)\n sink("a.txt")\n}\nx <- 1', 'first', { reads: ['#file:*', '#file:a', '#wd'], writes: ['#file:a', '#files', '#option:digits', '#options', '#sink', '#sink:opener', '#sink:output'] });
		check('a call reaching a function', 'f <- function() options(digits = 3)\nf()', 'second', { reads: ['#option:*', '#option:digits', '#options', '#sink'], writes: ['#option:digits', '#options', '#sink:output'] });
		check('a function never called does not count', 'f <- function() options(digits = 3)\nx <- 1', 'file', {});
		check('the exit hook of a function never called does not count', 'f <- function() { on.exit(options(digits = 3)); 1 }\nx <- 1', 'file', {});
		check('quoted code does not count', 'x <- quote(options(digits = 3))', 'file', {});
		check('only the code of the scope counts', 'x <- 1\noptions(digits = 3)', 'first', {});
		check('frame-local writes are excluded', 'f <- function() { withr::local_options(digits = 3); 1 }\nf()', 'file', { reads: ['#options', '#sink'], writes: ['#sink:output'] });
	});

	describe('scopes as nodes', () => {
		test(label('a project, a file root, and a node id count the code they span', ['name-normal'], ['dataflow']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(requestFromInput('x <- 1\noptions(digits = 3)'));
			const info = await analyzer.dataflow();
			const { ast } = await analyzer.normalize();
			const root = ast.files[0].root;
			const expected = shown(Dataflow.sideEffects.ambientAccess(info, RNode.collectAllIds(root)));
			assert.deepStrictEqual(expected.writes, ['#option:digits', '#options']);
			assert.deepStrictEqual(shown(Dataflow.sideEffects.ambientAccess(info, ast)), expected);
			assert.deepStrictEqual(shown(Dataflow.sideEffects.ambientAccess(info, root)), expected);
			assert.deepStrictEqual(shown(Dataflow.sideEffects.ambientAccess(info, root.info.id)), expected);
			assert.deepStrictEqual(shown(Dataflow.sideEffects.ambientAccess(info, root.children[0])).writes, []);
		});
	});

	describe('sourced files', () => {
		test(label('the top level of a sourced file runs as part of the scope', ['sourcing-external-files'], ['dataflow']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addFile(new FlowrInlineTextFile('a.R', 'options(digits = 3)\nsource("b.R")'), new FlowrInlineTextFile('b.R', 'sink("x.txt")'));
			analyzer.addRequest(requestFromInput('source("a.R")\nx <- 1'));
			const info = await analyzer.dataflow();
			const [first, second] = (await analyzer.normalize()).ast.files[0].root.children;
			assert.includeMembers(shown(Dataflow.sideEffects.ambientAccess(info, RNode.collectAllIds(first))).writes, ['#option:digits', '#sink']);
			assert.deepStrictEqual(shown(Dataflow.sideEffects.ambientAccess(info, RNode.collectAllIds(second))).writes, []);
		});
	});

	describe('reads', () => {
		check('getOption reads the option', 'x <- getOption("digits")', 'file', { reads: ['#option:*', '#option:digits'] });
		check('a read through a called function', 'f <- function() getOption("digits")\nf()', 'second', { reads: ['#option:*', '#option:digits', '#options', '#sink'], writes: ['#sink:output'] });
		check('setwd reads and writes the working directory', 'setwd("a")', 'file', { reads: ['#files', '#wd'], writes: ['#wd'] });
	});

	describe('drawing', () => {
		/* a plot draws on the active device, which it opens if there is none, and starts a new plot on it */
		check('plot draws on the device', 'plot(1)', 'file', { reads: ['#graphics', '#palette'], writes: ['#device', '#plot'], draws: 1 });
		check('lines adds to the plot', 'lines(1:2)', 'file', { reads: ['#graphics', '#palette', '#plot'], writes: ['#device', '#plot'], draws: 1 });
		check('curve adds only if asked', 'curve(sin)\ncurve(cos, add = TRUE)', 'second', { reads: ['#graphics', '#palette', '#plot'], writes: ['#device', '#plot'], draws: 1 });
		check('building a ggplot leaves the device alone', 'library(ggplot2)\np <- ggplot(d)', 'second', { writes: ['#last-plot'] });
		check('printing a ggplot draws it', 'library(ggplot2)\np <- ggplot(d) + geom_point()\nprint(p)', 'last', { reads: ['#options', '#sink'], writes: ['#device', '#plot', '#sink:output'] });
		check('ggsave reads the last plot', 'library(ggplot2)\nggplot(d)\nggsave("a.png")', 'last', { reads: ['#last-plot', '#wd'], writes: ['#file:a', '#files'] });
		check('a function drawing', 'f <- function() plot(1)\nf()', 'second', { reads: ['#graphics', '#options', '#palette', '#sink'], writes: ['#device', '#plot', '#sink:output'], draws: 1 });
		check('plot writes the canvas if configured', 'plot(1)', 'file', { reads: ['#graphics', '#palette'], writes: ['#canvas', '#device', '#plot'], draws: 1 }, true);
		check('a function plotting writes the canvas if configured', 'f <- function() plot(1)\nf()', 'second', { reads: ['#graphics', '#options', '#palette', '#sink'], writes: ['#canvas', '#device', '#plot', '#sink:output'], draws: 1 }, true);
		check('closing a device reads what it holds', 'png("a.png")\nplot(1)\ndev.off()', 'last', { reads: ['#device', '#options', '#sink'], writes: ['#device', '#device:opener', '#graphics', '#plot', '#sink:output'], kills: ['#device', '#device:opener', '#graphics', '#plot'], draws: 1 });
		check('exporting reads what the device holds', 'img <- magick::image_graph()\nplot(1)\nmagick::image_write(img, "a.png")', 'file', { reads: ['#device', '#graphics', '#palette', '#wd'], writes: ['#device', '#device:opener', '#file:a', '#files', '#graphics', '#plot'], draws: 2 });
		check('par queries the plot', 'u <- par("usr")', 'file', { reads: ['#graphics', '#par:*', '#par:usr', '#plot'], writes: ['#device'], draws: 1 });
		check('par is a graphics call writing the parameters', 'par(mfrow = c(1, 2))', 'file', { reads: ['#graphics'], writes: ['#device', '#graphics', '#par:mfrow'], draws: 1 });

		check('a draw through a parameter', 'g <- function(f, ...) f(...)\nh <- function() g(plot, 1)\nh()', 'file', {
			reads: ['#env', '#graphics', '#options', '#palette', '#plot', '#rng', '#sink'], writes: ['#canvas', '#device', '#plot', '#sink:output'], assumed: ['#rng'], draws: 1
		}, true);

		test(label('a configured graphics built-in draws', [], ['dataflow']), async() => {
			const myPlot = { type: 'function', names: [Identifier.from(['myPlot', 'base'])], processor: BuiltInProcName.Default, config: { tags: [SemanticCallTag.Graphics] }, assumePrimitive: false } satisfies BuiltInDefinition;
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).amendConfig(c => {
				c.semantics.environment.overwriteBuiltIns.definitions = [myPlot];
			}).build();
			analyzer.addRequest(requestFromInput('myPlot(1)\nplot(2)'));
			const info = await analyzer.dataflow();
			const root = (await analyzer.normalize()).ast.files[0].root;
			assert.strictEqual(Dataflow.sideEffects.ambientAccess(info, RNode.collectAllIds(root)).draws.size, 2);
		});

		test(label('removing a global binds it, under its own name', [], ['dataflow']), async() => {
			const { graph } = await run('restore <- function(seed) {\n  if(is.null(seed)) rm(".Random.seed", envir = globalenv())\n  else assign(".Random.seed", seed, envir = globalenv())\n}');
			const [access] = Dataflow.sideEffects.ambientAccessOfFunctions(graph).values();
			assert.deepStrictEqual([...access.variables.keys()], ['.Random.seed']);
		});

		test(label('every function', [], ['dataflow']), async() => {
			const { graph } = await run('a <- function() plot(1)\nb <- function() a()\nc <- function() 1');
			const all = [...Dataflow.sideEffects.ambientAccessOfFunctions(graph).values()].map(shown);
			assert.deepStrictEqual(all.map(a => [a.writes.length, a.draws]).sort(), [[0, 0], [2, 1], [2, 1]]);
		});
	});

	describe('records', () => {
		test(label('survive serialization and reduction', [], ['dataflow']), async() => {
			const { graph, root } = await run('options(digits = 3)\nx <- getOption("digits")');
			const ids = RNode.collectAllIds(root);
			const again = DataflowGraph.fromJson(JSON.parse(JSON.stringify(graph.toJSON())) as DataflowGraphJson);
			assert.deepStrictEqual(shown(Dataflow.sideEffects.ambientAccess(again, ids)), shown(Dataflow.sideEffects.ambientAccess(graph, ids)));
			const reduced = Dataflow.reduceGraph(graph, ids);
			assert.deepStrictEqual(shown(Dataflow.sideEffects.ambientAccess(reduced, ids)), shown(Dataflow.sideEffects.ambientAccess(graph, ids)));
			assert.include(shown(Dataflow.sideEffects.ambientAccess(again, ids)).writes, '#option:digits');
		});

		test(label('graph diffs compare them', [], ['dataflow']), async() => {
			const { graph } = await run('options(digits = 3)\nx <- getOption("digits")');
			const again = DataflowGraph.fromJson(JSON.parse(JSON.stringify(graph.toJSON())) as DataflowGraphJson);
			const equal = () => Dataflow.diffGraphs({ name: 'left', graph }, { name: 'right', graph: again }).isEqual();
			assert.isTrue(equal());
			const [first] = again.ambientAccessIds();
			again.recordAmbientAccess(first, { writes: ['#option:width'] });
			assert.isFalse(equal());
		});
	});

	describe('a variable named like a state stays a variable', () => {
		test.each([
			['the state written after', '`#wd` <- 1\nsetwd("a")\nprint(`#wd`)', '`#wd` <- 1'],
			['the state written before', 'setwd("a")\n`#wd` <- 1\nfile.exists("b")', 'setwd("a")'],
			['an option', '`#option:digits` <- 5\noptions(digits = 3)\nprint(`#option:digits`)', '`#option:digits` <- 5']
		])('%s', async(_, code, kept) => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(requestFromInput(code));
			const { results } = (await analyzer.query([{ type: 'static-slice', criteria: [`${code.split('\n').length}:1`] }]))['static-slice'];
			assert.include(Object.values(results)[0].reconstruct?.code, kept);
		});
	});

	describe('every kind of access names the calls behind it', () => {
		test(label('a call and the function around it answer in the same form', ['name-normal', 'call-normal'], ['dataflow']), async() => {
			const { info, graph } = await run('f <- function() options(digits = 3)\nf()');
			const [call] = [...graph.ambientAccessIds()].filter(id => graph.ambientAccessOf(id)?.writes.has('#option:digits'));
			assert.deepStrictEqual(graph.ambientAccessOf(call)?.writes.get('#option:digits'), new Set([call]));
			const [ofFunction] = Dataflow.sideEffects.ambientAccessOfFunctions(info).values();
			assert.deepStrictEqual(ofFunction.writes.get('#option:digits'), new Set([call]));
		});
		test(label('a bound variable names its definition', ['name-normal', 'call-normal'], ['dataflow']), async() => {
			const { info, graph } = await run('f <- function() x <<- 1');
			const [ofFunction] = Dataflow.sideEffects.ambientAccessOfFunctions(info).values();
			const [definition] = ofFunction.variables.get('x') ?? [];
			assert.strictEqual(graph.getVertex(definition)?.tag, VertexType.VariableDefinition);
		});
	});

	describe('queries do not change the graph', () => {
		test(label('ambientAccessOfFunctions is pure', ['name-normal', 'call-normal'], ['dataflow']), async() => {
			const { graph } = await run('g <- function(f, ...) f(...)\na01 <- function() g(plot, 1)\na22 <- function() g(options, digits = 3)');
			const before = JSON.stringify(graph.toJSON());
			const effects = [...graph.unknownSideEffects].map(UnknownSideEffect.id);
			Dataflow.sideEffects.ambientAccessOfFunctions(graph);
			Dataflow.sideEffects.ambientAccessOfFunctions(graph);
			assert.strictEqual(JSON.stringify(graph.toJSON()), before);
			assert.deepStrictEqual([...graph.unknownSideEffects].map(UnknownSideEffect.id), effects);
		});
	});
}));

describe('Ambient state stays small', withTreeSitter(ts => {
	/* closing a device we cannot name merges the state of the active device with the others; each call may add its own definition, but no copies */
	test(label('closing unnamed devices again and again', ['name-normal', 'call-normal'], ['dataflow']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(requestFromInput(Array.from({ length: 40 }, () => 'dev.off(dev.list()["RStudioGD"])').join('\n')));
		const { environment } = await analyzer.dataflow();
		assert.isAtMost(Resolve.byName(AmbientStateName.graphics, environment)?.length ?? 0, 41);
	});
}));
