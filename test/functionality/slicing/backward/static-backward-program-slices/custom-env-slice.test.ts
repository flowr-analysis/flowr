import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { FlowrConfig } from '../../../../../src/config';

describe.sequential('Custom Environment Slicing', withShell(shell => {
	describe('assign and get', () => {
		assertSliced(label('slice for get includes assign that provided value, not unrelated assign', ['dynamic-environment-resolution', 'environment-sharing', 'name-created']),
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

		assertSliced(label('slice of get traces value through assign back to new.env', ['dynamic-environment-resolution', 'name-created']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\nget("x", envir=e)',
			['3@get'],
			'e <- new.env()\nassign("x", 42, envir=e)\nget("x", envir=e)'
		);

		assertSliced(label('slice of e$x read traces back through assign', ['dynamic-environment-resolution', 'name-created']),
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

		assertSliced(label('multi-assign config: slice of specific get excludes unrelated assigns to same env', ['dynamic-environment-resolution', 'environment-sharing', 'name-created']),
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

		assertSliced(label('chained get-assign-get slice: full chain across two envs preserved', ['dynamic-environment-resolution', 'environment-sharing', 'name-created']),
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

		assertSliced(label('slice of get from metrics env excludes unrelated results env assigns', ['dynamic-environment-resolution', 'environment-sharing', 'name-created']),
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

	describe('parent env', () => {
		assertSliced(label('slice through child env with emptyenv parent: includes assign and new.env', ['dynamic-environment-resolution', 'environment-parent', 'name-created']),
			shell,
			'e <- new.env(parent=emptyenv())\nassign("x", 42, envir=e)\nget("x", envir=e)',
			['3@get'],
			'e <- new.env(parent=emptyenv())\nassign("x", 42, envir=e)\nget("x", envir=e)'
		);
	});

	describe('aliasing', () => {
		assertSliced(label('slice through alias: get via alias traces back through assign and new.env', ['dynamic-environment-resolution', 'environment-alias', 'name-created']),
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
	});

	describe('with() / within()', () => {
		assertSliced(label('slice from with(e, x): traces through assign and new.env', ['dynamic-environment-resolution', 'environment-with', 'name-created']),
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

		assertSliced(label('slice from with via alias: traces assign, alias assignment, and new.env', ['dynamic-environment-resolution', 'environment-with', 'environment-alias', 'name-created']),
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

		assertSliced(label('with() scoping: y assigned inside with body is not in outer scope', ['dynamic-environment-resolution', 'environment-with', 'name-created']),
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

		assertSliced(label('with() named args reordered: expr first, data second', ['dynamic-environment-resolution', 'environment-with', 'name-created']),
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

		assertSliced(label('with() partial arg name: dat= matches data param', ['dynamic-environment-resolution', 'environment-with', 'name-created']),
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
