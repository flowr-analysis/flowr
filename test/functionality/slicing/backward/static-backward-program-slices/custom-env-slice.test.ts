import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { FlowrConfig } from '../../../../../src/config';

describe('Custom Environment Slicing', { concurrent: false }, withShell(shell => {
	describe('assign and get', () => {
		assertSliced(label('slice for get includes assign that provided value, not unrelated assign', ['dynamic-environment-resolution', 'environment-sharing', 'name-created-resolved']),
			shell,
			'e1 <- new.env()\ne2 <- new.env()\nassign("x", 42, envir=e1)\nassign("y", 99, envir=e2)\nget("x", envir=e1)',
			['5@get'],
			'e1 <- new.env()\nassign("x", 42, envir=e1)\nget("x", envir=e1)'
		);

		assertSliced(label('x after assign-to-env is not in global scope, slice is just x', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\nx',
			['3@x'],
			'x'
		);

		assertSliced(label('slice of get traces value through assign back to new.env', ['dynamic-environment-resolution', 'name-created-resolved']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\nget("x", envir=e)',
			['3@get'],
			'e <- new.env()\nassign("x", 42, envir=e)\nget("x", envir=e)'
		);

		assertSliced(label('slice of e$x read traces back through assign', ['dynamic-environment-resolution']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\ne$x',
			['3@$'],
			'e <- new.env()\nassign("x", 42, envir=e)\ne$x'
		);

		assertSliced(label('slice of x after attach(e) traces through assign and new.env', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\nattach(e)\nx',
			['4@x'],
			'e <- new.env()\nassign("x", 42, envir=e)\nattach(e)\nx'
		);

		assertSliced(label('multi-assign config: slice of specific get excludes unrelated assigns to same env', ['dynamic-environment-resolution', 'environment-sharing', 'name-created-resolved']),
			shell,
			[
				'cfg <- new.env()',
				'assign("alpha", 0.05, envir=cfg)',
				'assign("n_iter", 1000, envir=cfg)',
				'assign("mu", 0, envir=cfg)',
				'lr <- get("alpha", envir=cfg)',
				'lr',
			].join('\n'),
			['6@lr'],
			'cfg <- new.env()\nassign("alpha", 0.05, envir=cfg)\nlr <- get("alpha", envir=cfg)\nlr'
		);

		assertSliced(label('slice through conditional assign in both branches: full if-then-else included', ['dynamic-environment-resolution', 'environment-sharing', 'if', 'environment-in-conditionals']),
			shell,
			[
				'e <- new.env()',
				'flag <- sample(c(TRUE, FALSE), 1)',
				'if (flag) {',
				'  assign("x", 1, envir=e)',
				'} else {',
				'  assign("x", 2, envir=e)',
				'}',
				'get("x", envir=e)',
			].join('\n'),
			['8@get'],
			'e <- new.env()\nflag <- sample(c(TRUE, FALSE), 1)\nif(flag) { assign("x", 1, envir=e) } else\n{ assign("x", 2, envir=e) }\nget("x", envir=e)'
		);

		assertSliced(label('chained get-assign-get slice: full chain across two envs preserved', ['dynamic-environment-resolution', 'environment-sharing', 'name-created-resolved']),
			shell,
			[
				'src <- new.env()',
				'dst <- new.env()',
				'assign("val", 42, envir=src)',
				'assign("val", get("val", envir=src), envir=dst)',
				'get("val", envir=dst)',
			].join('\n'),
			['5@get'],
			[
				'src <- new.env()',
				'dst <- new.env()',
				'assign("val", 42, envir=src)',
				'assign("val", get("val", envir=src), envir=dst)',
				'get("val", envir=dst)',
			].join('\n')
		);

		assertSliced(label('slice of get from metrics env excludes unrelated results env assigns', ['dynamic-environment-resolution', 'environment-sharing', 'name-created-resolved']),
			shell,
			[
				'results <- new.env()',
				'metrics <- new.env()',
				'assign("accuracy", 0.95, envir=results)',
				'assign("precision", 0.9, envir=results)',
				'assign("n_samples", 200, envir=metrics)',
				'assign("n_features", 10, envir=metrics)',
				'n <- get("n_samples", envir=metrics)',
				'n',
			].join('\n'),
			['8@n'],
			[
				'metrics <- new.env()',
				'assign("n_samples", 200, envir=metrics)',
				'n <- get("n_samples", envir=metrics)',
				'n',
			].join('\n')
		);
	});

	describe('assign and ls, piped', () => {
		/* a piped `e` must resolve for ls() the same way the nested form `ls(e)` does */
		assertSliced(label('nested: ls(e) resolves the custom env', ['dynamic-environment-resolution']),
			shell,
			'e <- new.env()\nassign("x1", 1, envir = e)\nr <- length(ls(e))\nprint(r)',
			['4@r'],
			'e <- new.env()\nassign("x1", 1, envir = e)\nr <- length(ls(e))\nr'
		);

		assertSliced(label('piped: e |> ls() resolves the same custom env as the nested form', ['dynamic-environment-resolution', 'pipe-and-pipe-bind']),
			shell,
			'e <- new.env()\nassign("x1", 1, envir = e)\nr <- e |> ls() |> length()\nprint(r)',
			['4@r'],
			'e <- new.env()\nassign("x1", 1, envir = e)\nr <- e |> ls() |> length()\nr'
		);
	});

	describe('parent env', () => {
		assertSliced(label('slice through child env with emptyenv parent: includes assign and new.env', ['dynamic-environment-resolution', 'environment-parent-tracked', 'name-created-resolved']),
			shell,
			'e <- new.env(parent=emptyenv())\nassign("x", 42, envir=e)\nget("x", envir=e)',
			['3@get'],
			'e <- new.env(parent=emptyenv())\nassign("x", 42, envir=e)\nget("x", envir=e)'
		);

		/* a dynamic parent isn't resolved, so flowR drops `w <- 42` even though real R prints "[1] 42" */
		assertSliced(label('a dynamic parent (globalenv() inside a function) is not resolved, w is dropped', ['environment-parent']),
			shell,
			'w <- 42\nf <- function() {\n  e <- new.env(parent = globalenv())\n  r <- get("w", envir = e)\n  print(r)\n}\nf()',
			['5@r'],
			'e <- new.env(parent = globalenv())\nr <- get("w", envir = e)\nr'
		);
	});

	describe('aliasing', () => {
		assertSliced(label('slice through alias: get via alias traces back through assign and new.env', ['dynamic-environment-resolution', 'environment-alias-read', 'name-created-resolved']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'alias <- e',
				'get("x", envir=alias)',
			].join('\n'),
			['4@get'],
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'alias <- e',
				'get("x", envir=alias)',
			].join('\n')
		);

		/* the alias snapshot is taken at alias time, so a later assign to the original is dropped here */
		assertSliced(label('an assign to the original after the alias is not reflected through it', ['environment-alias']),
			shell,
			[
				'e <- new.env()',
				'alias <- e',
				'assign("x", 5, envir = e)',
				'r <- get("x", envir = alias)',
				'print(r)',
			].join('\n'),
			['4@r'],
			[
				'e <- new.env()',
				'alias <- e',
				'r <- get("x", envir = alias)',
			].join('\n')
		);
	});

	describe('with() / within()', () => {
		assertSliced(label('slice from with(e, x): traces through assign and new.env', ['dynamic-environment-resolution', 'environment-with']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'with(e, x)',
			].join('\n'),
			['3@with'],
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'with(e, x)',
			].join('\n')
		);

		assertSliced(label('slice from with via alias: traces assign, alias assignment, and new.env', ['dynamic-environment-resolution', 'environment-with', 'environment-alias-read']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'alias <- e',
				'with(alias, x)',
			].join('\n'),
			['4@with'],
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'alias <- e',
				'with(alias, x)',
			].join('\n')
		);

		assertSliced(label('with() scoping: y assigned inside with body is not in outer scope', ['dynamic-environment-resolution', 'environment-with']),
			shell,
			[
				'x <- new.env()',
				'x$x <- 42',
				'with(x, { y <- x + 2 })',
				'y',
			].join('\n'),
			['4@y'],
			'y'
		);

		assertSliced(label('with() named args reordered: expr first, data second', ['dynamic-environment-resolution', 'environment-with']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'with(expr=x, data=e)',
			].join('\n'),
			['3@with'],
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'with(expr=x, data=e)',
			].join('\n')
		);

		assertSliced(label('with() partial arg name: dat= matches data param', ['dynamic-environment-resolution', 'environment-with']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'with(dat=e, x)',
			].join('\n'),
			['3@with'],
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'with(dat=e, x)',
			].join('\n')
		);
	});

	describe('local with an explicit envir', () => {
		/* the assignment lands in .GlobalEnv, so the slice keeps local() and drops the shadowed `x <- 1` */
		assertSliced(label('local(x <- 2, envir = globalenv()) writes into the real global scope', ['local-envir-argument']),
			shell,
			'x <- 1\nlocal(x <- 2, envir = globalenv())\nprint(x)',
			['3@x'],
			'local(x <- 2, envir = globalenv())\nx'
		);

		assertSliced(label('local(x <- 2, envir = .GlobalEnv) writes into the real global scope', ['local-envir-argument']),
			shell,
			'x <- 1\nlocal(x <- 2, envir = .GlobalEnv)\nprint(x)',
			['3@x'],
			'local(x <- 2, envir = .GlobalEnv)\nx'
		);

		/* list2env() binds into .GlobalEnv even though it runs inside f() */
		assertSliced(label('list2env(envir = globalenv()) inside a function writes into the real global scope', ['local-envir-argument']),
			shell,
			'f <- function() list2env(list(x = 1), envir = globalenv())\nf()\nprint(x)',
			['3@x'],
			'f <- function() list2env(list(x = 1), envir = globalenv())\nf()\nx'
		);
	});

	describe('envir argument is a function parameter (unresolvable at definition time)', () => {
		/* `en` carries no envState inside f's body -- a parameter is whatever its caller passes, so routing
		 * the write precisely would be a guess; the call becomes an unknown side effect, and
		 * linkEnvironmentArgumentsWrittenByCallee (extractor.ts) carries that mark out to f's call site once it
		 * sees `e` (the argument bound to `en`) is a tracked environment -- same as it already does for a
		 * replacement write through a parameter (`en$a <- 42`), so no includeCallees is needed here either */
		assertSliced(label('assign(envir=parameter) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'local-envir-argument']),
			shell,
			[
				'e <- new.env()',
				'assign("a", 1, envir = e)',
				'f <- function(en) assign("a", 42, envir = en)',
				'f(e)',
				'r <- get("a", envir = e)',
				'print(r)',
			].join('\n'),
			['6@print'],
			[
				'e <- new.env()',
				'assign("a", 1, envir = e)',
				'f <- function(en) assign("a", 42, envir = en)',
				'f(e)',
				'r <- get("a", envir = e)',
				'print(r)',
			].join('\n')
		);

		/* same program, kept with includeCallees explicitly set: the unknown-side-effect-driven boundary above
		 * must not depend on this option, but the option must keep working alongside it either way */
		assertSliced(label('assign(envir=parameter) inside a function keeps f and its call site with includeCallees', ['dynamic-environment-resolution', 'local-envir-argument']),
			shell,
			[
				'e <- new.env()',
				'assign("a", 1, envir = e)',
				'f <- function(en) assign("a", 42, envir = en)',
				'f(e)',
				'r <- get("a", envir = e)',
				'print(r)',
			].join('\n'),
			['6@print'],
			[
				'e <- new.env()',
				'assign("a", 1, envir = e)',
				'f <- function(en) assign("a", 42, envir = en)',
				'f(e)',
				'r <- get("a", envir = e)',
				'print(r)',
			].join('\n'),
			{ includeCallees: true }
		);

		assertSliced(label('local(expr, envir=parameter) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'local-envir-argument']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) local(x <- 42, envir = en)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n'),
			['6@print'],
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) local(x <- 42, envir = en)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n')
		);

		assertSliced(label('local(expr, envir=parameter) inside a function keeps f and its call site with includeCallees', ['dynamic-environment-resolution', 'local-envir-argument']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) local(x <- 42, envir = en)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n'),
			['6@print'],
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) local(x <- 42, envir = en)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n'),
			{ includeCallees: true }
		);

		assertSliced(label('list2env(envir=parameter) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'local-envir-argument']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) list2env(list(x = 42), envir = en)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n'),
			['6@print'],
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) list2env(list(x = 42), envir = en)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n')
		);

		assertSliced(label('list2env(envir=parameter) inside a function keeps f and its call site with includeCallees', ['dynamic-environment-resolution', 'local-envir-argument']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) list2env(list(x = 42), envir = en)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n'),
			['6@print'],
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) list2env(list(x = 42), envir = en)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n'),
			{ includeCallees: true }
		);

		assertSliced(label('within(data=parameter, ...) inside a function keeps f and its call site', ['dynamic-environment-resolution', 'environment-with', 'local-envir-argument']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) within(en, x <- 42)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n'),
			['6@print'],
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) within(en, x <- 42)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n')
		);

		assertSliced(label('within(data=parameter, ...) inside a function keeps f and its call site with includeCallees', ['dynamic-environment-resolution', 'environment-with', 'local-envir-argument']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) within(en, x <- 42)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n'),
			['6@print'],
			[
				'e <- new.env()',
				'assign("x", 1, envir = e)',
				'f <- function(en) within(en, x <- 42)',
				'f(e)',
				'r <- get("x", envir = e)',
				'print(r)',
			].join('\n'),
			{ includeCallees: true }
		);
	});

	describe('config: trackEnvironments disabled', () => {
		const noTrack = FlowrConfig.setInConfig(FlowrConfig.default(), 'solver.trackEnvironments', false);

		assertSliced(label('with tracking disabled, slice of x includes the assign', ['dynamic-environment-resolution']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\nx',
			['3@x'],
			'assign("x", 42, envir=e)\nx',
			{ flowrConfig: noTrack }
		);
	});
}));
