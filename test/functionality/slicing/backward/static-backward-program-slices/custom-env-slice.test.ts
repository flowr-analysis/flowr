import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { FlowrConfig } from '../../../../../src/config';
import type { FlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
import type { SlicingCriteria } from '../../../../../src/slicing/criterion/parse';

type SliceTestConfig = Parameters<typeof assertSliced>[5];

const newEnv = 'e <- new.env()';
const assignX42 = 'assign("x", 42, envir=e)';
const assignX1 = 'assign("x", 1, envir = e)';
const getX = 'get("x", envir=e)';
const envWithX = `${newEnv}\n${assignX42}`;
const envWithXThenX = `${envWithX}\nx`;
const aliasOfE = 'alias <- e';

function paramEnvProgram(name: string, body: string): string {
	return [
		newEnv,
		`assign("${name}", 1, envir = e)`,
		`f <- function(en) ${body}`,
		'f(e)',
		`r <- get("${name}", envir = e)`,
		'print(r)',
	].join('\n');
}

describe('Custom Environment Slicing', { concurrent: false }, withShell(shell => {
	function keepsAll(name: string, capabilities: readonly FlowrCapabilityId[], code: string, criteria: SlicingCriteria, testConfig?: SliceTestConfig) {
		assertSliced(label(name, capabilities), shell, code, criteria, code, testConfig);
	}

	function keepsAllWithAndWithoutCallees(name: string, capabilities: readonly FlowrCapabilityId[], code: string, criteria: SlicingCriteria) {
		keepsAll(name, capabilities, code, criteria);
		keepsAll(`${name} with includeCallees`, capabilities, code, criteria, { includeCallees: true });
	}

	describe('assign and get', () => {
		const e1New = 'e1 <- new.env()';
		const e1AssignX = 'assign("x", 42, envir=e1)';
		const e1GetX = 'get("x", envir=e1)';
		assertSliced(label('slice for get includes assign that provided value, not unrelated assign', ['dynamic-environment-resolution', 'environment-sharing', 'name-created-resolved']),
			shell,
			[e1New, 'e2 <- new.env()', e1AssignX, 'assign("y", 99, envir=e2)', e1GetX].join('\n'),
			['5@get'],
			[e1New, e1AssignX, e1GetX].join('\n')
		);

		assertSliced(label('x after assign-to-env is not in global scope, slice is just x', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			envWithXThenX,
			['3@x'],
			'x'
		);

		keepsAll('slice of get traces value through assign back to new.env', ['dynamic-environment-resolution', 'name-created-resolved'],
			`${envWithX}\n${getX}`, ['3@get']);

		keepsAll('slice of e$x read traces back through assign', ['dynamic-environment-resolution'],
			`${envWithX}\ne$x`, ['3@$']);

		keepsAll('slice of x after attach(e) traces through assign and new.env', ['dynamic-environment-resolution', 'environment-sharing'],
			`${envWithX}\nattach(e)\nx`, ['4@x']);

		const cfgHead = 'cfg <- new.env()\nassign("alpha", 0.05, envir=cfg)';
		const cfgTail = 'lr <- get("alpha", envir=cfg)\nlr';
		assertSliced(label('multi-assign config: slice of specific get excludes unrelated assigns to same env', ['dynamic-environment-resolution', 'environment-sharing', 'name-created-resolved']),
			shell,
			`${cfgHead}\nassign("n_iter", 1000, envir=cfg)\nassign("mu", 0, envir=cfg)\n${cfgTail}`,
			['6@lr'],
			`${cfgHead}\n${cfgTail}`
		);

		const flagSample = 'flag <- sample(c(TRUE, FALSE), 1)';
		const assignX1 = 'assign("x", 1, envir=e)';
		const assignX2 = 'assign("x", 2, envir=e)';
		assertSliced(label('slice through conditional assign in both branches: full if-then-else included', ['dynamic-environment-resolution', 'environment-sharing', 'if', 'environment-in-control-flow']),
			shell,
			[newEnv, flagSample, 'if (flag) {', `  ${assignX1}`, '} else {', `  ${assignX2}`, '}', getX].join('\n'),
			['8@get'],
			[newEnv, flagSample, `if(flag) { ${assignX1} } else`, `{ ${assignX2} }`, getX].join('\n')
		);

		keepsAll('chained get-assign-get slice: full chain across two envs preserved', ['dynamic-environment-resolution', 'environment-sharing', 'name-created-resolved'],
			[
				'src <- new.env()',
				'dst <- new.env()',
				'assign("val", 42, envir=src)',
				'assign("val", get("val", envir=src), envir=dst)',
				'get("val", envir=dst)',
			].join('\n'), ['5@get']);

		const metricsEnv = 'metrics <- new.env()';
		const metricsAssign = 'assign("n_samples", 200, envir=metrics)';
		const metricsGet = 'n <- get("n_samples", envir=metrics)\nn';
		assertSliced(label('slice of get from metrics env excludes unrelated results env assigns', ['dynamic-environment-resolution', 'environment-sharing', 'name-created-resolved']),
			shell,
			[
				'results <- new.env()',
				metricsEnv,
				'assign("accuracy", 0.95, envir=results)',
				'assign("precision", 0.9, envir=results)',
				metricsAssign,
				'assign("n_features", 10, envir=metrics)',
				metricsGet,
			].join('\n'),
			['8@n'],
			[metricsEnv, metricsAssign, metricsGet].join('\n')
		);
	});

	describe('assign and ls, piped', () => {
		const envWithX1 = `${newEnv}\nassign("x1", 1, envir = e)`;
		const nestedLs = 'r <- length(ls(e))';
		const pipedLs = 'r <- e |> ls() |> length()';
		assertSliced(label('nested: ls(e) resolves the custom env', ['dynamic-environment-resolution']),
			shell,
			`${envWithX1}\n${nestedLs}\nprint(r)`,
			['4@r'],
			`${envWithX1}\n${nestedLs}\nr`
		);

		assertSliced(label('piped: e |> ls() resolves the same custom env as the nested form', ['dynamic-environment-resolution', 'pipe-and-pipe-bind']),
			shell,
			`${envWithX1}\n${pipedLs}\nprint(r)`,
			['4@r'],
			`${envWithX1}\n${pipedLs}\nr`
		);

		const lsAfterNamed = 'r <- length(ls(all.names = TRUE, e))';
		assertSliced(label('a named argument before the environment does not shift what ls lists', ['dynamic-environment-resolution']),
			shell,
			`${envWithX1}\n${lsAfterNamed}\nprint(r)`,
			['4@r'],
			`${envWithX1}\n${lsAfterNamed}\nr`
		);

		keepsAll('named arguments before the environment do not shift what get reads', ['dynamic-environment-resolution', 'name-created-resolved'],
			`${envWithX}\nget("x", mode = "any", inherits = TRUE, e)`, ['3@get']);
	});

	describe('list2env, piped', () => {
		const getR = 'r <- get("x", envir = e)';
		const nestedList2env = 'list2env(list(x = 42), e)';
		const pipedList2env = 'list(x = 42) |> list2env(e)';
		assertSliced(label('nested: list2env(list(...), e) binds into the custom env', ['dynamic-environment-resolution', 'name-created-resolved']),
			shell,
			`${newEnv}\n${nestedList2env}\n${getR}\nprint(r)`,
			['4@r'],
			`${newEnv}\n${nestedList2env}\n${getR}\nr`
		);

		const countInE = 'n <- length(ls(e))';
		assertSliced(label('a positional envir routes the bindings into the custom env', ['dynamic-environment-resolution', 'name-created-resolved']),
			shell,
			`${newEnv}\n${nestedList2env}\n${countInE}\nprint(n)`,
			['4@n'],
			`${newEnv}\n${nestedList2env}\n${countInE}\nn`
		);

		assertSliced(label('piped: list(...) |> list2env(e) binds the same way as the nested form', ['dynamic-environment-resolution', 'name-created-resolved', 'pipe-and-pipe-bind']),
			shell,
			`${newEnv}\n${pipedList2env}\n${getR}\nprint(r)`,
			['4@r'],
			`${newEnv}\n${pipedList2env}\n${getR}\nr`
		);
	});

	describe('parent env', () => {
		keepsAll('slice through child env with emptyenv parent: includes assign and new.env', ['dynamic-environment-resolution', 'environment-parent-tracked', 'name-created-resolved'],
			`e <- new.env(parent=emptyenv())\n${assignX42}\n${getX}`, ['3@get']);

		const parentGlobal = 'e <- new.env(parent = globalenv())';
		const getW = 'r <- get("w", envir = e)';
		assertSliced(label('a free name reached through a custom env is linked on call only, so w is dropped', ['environment-parent']),
			shell,
			`w <- 42\nf <- function() {\n  ${parentGlobal}\n  ${getW}\n  print(r)\n}\nf()`,
			['5@r'],
			`${parentGlobal}\n${getW}\nr`
		);
	});

	describe('aliasing', () => {
		keepsAll('slice through alias: get via alias traces back through assign and new.env', ['dynamic-environment-resolution', 'environment-alias-read', 'name-created-resolved'],
			`${envWithX}\n${aliasOfE}\nget("x", envir=alias)`, ['4@get']);

		const getViaAlias = 'r <- get("x", envir = alias)';
		const assignX5 = 'assign("x", 5, envir = e)';
		assertSliced(label('an assign to the original after the alias is reflected through it', ['environment-alias']),
			shell,
			[newEnv, aliasOfE, assignX5, getViaAlias, 'print(r)'].join('\n'),
			['4@r'],
			[newEnv, aliasOfE, assignX5, getViaAlias].join('\n')
		);
	});

	describe('with() / within()', () => {
		keepsAll('slice from with(e, x): traces through assign and new.env', ['dynamic-environment-resolution', 'environment-with'],
			`${envWithX}\nwith(e, x)`, ['3@with']);

		keepsAll('slice from with via alias: traces assign, alias assignment, and new.env', ['dynamic-environment-resolution', 'environment-with', 'environment-alias-read'],
			`${envWithX}\n${aliasOfE}\nwith(alias, x)`, ['4@with']);

		assertSliced(label('with() scoping: y assigned inside with body is not in outer scope', ['dynamic-environment-resolution', 'environment-with']),
			shell,
			'x <- new.env()\nx$x <- 42\nwith(x, { y <- x + 2 })\ny',
			['4@y'],
			'y'
		);

		keepsAll('with() named args reordered: expr first, data second', ['dynamic-environment-resolution', 'environment-with'],
			`${envWithX}\nwith(expr=x, data=e)`, ['3@with']);

		keepsAll('with() partial arg name: dat= matches data param', ['dynamic-environment-resolution', 'environment-with'],
			`${envWithX}\nwith(dat=e, x)`, ['3@with']);
	});

	describe('local with an explicit envir', () => {
		const localGlobalenv = 'local(x <- 2, envir = globalenv())';
		const localDotGlobalEnv = 'local(x <- 2, envir = .GlobalEnv)';
		const list2envGlobalenv = 'f <- function() list2env(list(x = 1), envir = globalenv())';
		assertSliced(label('local(x <- 2, envir = globalenv()) writes into the real global scope', ['local-envir-argument']),
			shell,
			`x <- 1\n${localGlobalenv}\nprint(x)`,
			['3@x'],
			`${localGlobalenv}\nx`
		);

		assertSliced(label('local(x <- 2, envir = .GlobalEnv) writes into the real global scope', ['local-envir-argument']),
			shell,
			`x <- 1\n${localDotGlobalEnv}\nprint(x)`,
			['3@x'],
			`${localDotGlobalEnv}\nx`
		);

		assertSliced(label('list2env(envir = globalenv()) inside a function writes into the real global scope', ['local-envir-argument']),
			shell,
			`${list2envGlobalenv}\nf()\nprint(x)`,
			['3@x'],
			`${list2envGlobalenv}\nf()\nx`
		);
	});

	describe('envir argument is a function parameter (unresolvable at definition time)', () => {
		keepsAllWithAndWithoutCallees('assign(envir=parameter) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'local-envir-argument'],
			paramEnvProgram('a', 'assign("a", 42, envir = en)'), ['6@print']);

		keepsAllWithAndWithoutCallees('local(expr, envir=parameter) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'local-envir-argument'],
			paramEnvProgram('x', 'local(x <- 42, envir = en)'), ['6@print']);

		keepsAllWithAndWithoutCallees('list2env(envir=parameter) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'local-envir-argument'],
			paramEnvProgram('x', 'list2env(list(x = 42), envir = en)'), ['6@print']);

		keepsAllWithAndWithoutCallees('within(data=parameter, ...) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'environment-with', 'local-envir-argument'],
			paramEnvProgram('x', 'within(en, x <- 42)'), ['6@print']);

		keepsAllWithAndWithoutCallees('makeActiveBinding(env=parameter) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'local-envir-argument'],
			[newEnv, 'f <- function(en) makeActiveBinding("x", function() 42, env = en)', 'f(e)', 'r <- get("x", envir = e)', 'print(r)'].join('\n'), ['5@print']);

		keepsAllWithAndWithoutCallees('sys.source(envir=parameter) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'local-envir-argument'],
			[newEnv, 'f <- function(en) sys.source("setup.R", envir = en)', 'f(e)', 'r <- get("x", envir = e)', 'print(r)'].join('\n'), ['5@print']);
	});

	describe('several reaching definitions for the envir argument', () => {
		const agreeing = ['p <- runif(1) > 0.5', 'if(p) e <- globalenv() else e <- globalenv()', assignX1, 'x'].join('\n');
		assertSliced(label('two agreeing globalenv() definitions still reach the global x', ['dynamic-environment-resolution', 'environment-sharing']),
			shell, agreeing, ['4@x'],
			['p <- runif(1) > 0.5', 'if(p) e <- globalenv() else', 'e <- globalenv()', assignX1, 'x'].join('\n')
		);

		const disagreeing = ['p <- runif(1) > 0.5', 'if(p) e <- globalenv() else e <- new.env()', assignX1, 'x'].join('\n');
		assertSliced(label('disagreeing definitions keep the assign rather than route it into the custom env', ['dynamic-environment-resolution', 'environment-sharing']),
			shell, disagreeing, ['4@x'],
			['p <- runif(1) > 0.5', 'if(p) e <- globalenv() else', 'e <- new.env()', assignX1, 'x'].join('\n')
		);
	});

	describe('config: trackEnvironments disabled', () => {
		const noTrack = FlowrConfig.setInConfig(FlowrConfig.default(), 'solver.trackEnvironments', false);

		assertSliced(label('with tracking disabled, slice of x includes the assign', ['dynamic-environment-resolution']),
			shell,
			envWithXThenX,
			['3@x'],
			`${assignX42}\nx`,
			{ flowrConfig: noTrack }
		);
	});
}));
