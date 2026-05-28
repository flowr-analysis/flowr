import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { describe } from 'vitest';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../src/dataflow/environments/built-in-proc-name';
import { argumentInCall } from '../../../_helper/dataflow/environment-builder';
import { FlowrConfig } from '../../../../../src/config';

describe('Custom Environment Tracking', withTreeSitter(shell => {

	describe('new.env()', () => {
		assertDataflow(label('new.env() call carries NewEnv origin', ['dynamic-environment-resolution']),
			shell,
			'e <- new.env()',
			emptyGraph()
				.call('1@new.env', 'new.env', [], {
					onlyBuiltIn: true,
					origin:      [BuiltInProcName.NewEnv],
					reads:       [NodeId.toBuiltIn('new.env')]
				})
				.calls('1@new.env', NodeId.toBuiltIn('new.env'))
				.defineVariable('1@e', 'e', { definedBy: ['1@<-', '1@new.env'] })
				.call('1@<-', '<-', [argumentInCall('1@e'), argumentInCall('1@new.env')], {
					returns:     ['1@e'],
					onlyBuiltIn: true,
					reads:       [NodeId.toBuiltIn('<-'), '1@new.env']
				})
				.calls('1@<-', NodeId.toBuiltIn('<-')),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);
	});

	describe('assign()', () => {
		assertDataflow(label('global assign (no envir) is unchanged', ['assignment-functions', 'dynamic-environment-resolution']),
			shell,
			'assign("x", 42)\nx',
			emptyGraph()
				.defineVariable('1@"x"', '"x"', { definedBy: ['1@assign', '1@42'] })
				.use('2@x')
				.reads('2@x', '1@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('assign to custom env: e is read, x not in global scope', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\nx',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e')
				.reads('2@e', '1@e')
				.use('3@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['3@x', '2@assign']]
			}
		);

		assertDataflow(label('multiple assigns to same env all read e', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			'e <- new.env()\nassign("x", 1, envir=e)\nassign("y", 2, envir=e)',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('3@e').reads('3@e', '1@e'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('assign to .GlobalEnv falls through to global', ['dynamic-environment-resolution']),
			shell,
			'assign("x", 42, envir=.GlobalEnv)\nx',
			emptyGraph()
				.defineVariable('1@"x"', '"x"')
				.use('2@x')
				.reads('2@x', '1@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('assign with unknown envir falls through conservatively', ['dynamic-environment-resolution']),
			shell,
			'assign("x", 42, envir=mystery_env)\nx',
			emptyGraph()
				.defineVariable('1@"x"', '"x"')
				.use('2@x')
				.reads('2@x', '1@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('new.env() passed directly as envir arg (no intermediate binding): conservative, x in global scope', ['dynamic-environment-resolution']),
			shell,
			'assign("x", 42, envir=new.env())\nx',
			emptyGraph()
				.defineVariable('1@"x"', '"x"')
				.use('2@x')
				.reads('2@x', '1@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('env variable reassigned to a second new.env(): second envState replaces first, x still isolated', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			'e <- new.env()\ne <- new.env()\nassign("x", 1, envir=e)\nx',
			emptyGraph()
				.defineVariable('2@e', 'e')
				.use('3@e').reads('3@e', '2@e')
				.use('4@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['4@x', '3@assign']]
			}
		);

		assertDataflow(label('assign in both if-then-else branches: each branch reads e, x not in global scope', ['dynamic-environment-resolution', 'environment-sharing', 'if', 'environment-in-conditionals']),
			shell,
			'e <- new.env()\nflag <- sample(c(TRUE, FALSE), 1)\nif (flag) {\n  assign("x", 1, envir=e)\n} else {\n  assign("x", 2, envir=e)\n}\nx',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('4@e').reads('4@e', '1@e')
				.use('6@e').reads('6@e', '1@e')
				.use('8@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['8@x', '4@assign'], ['8@x', '6@assign']]
			}
		);

		assertDataflow(label('assign in if-then-else to two separate envs: each branch reads its own env variable', ['dynamic-environment-resolution', 'environment-sharing', 'if', 'environment-in-conditionals']),
			shell,
			'e1 <- new.env()\ne2 <- new.env()\nflag <- sample(c(TRUE, FALSE), 1)\nif (flag) {\n  assign("result", 1, envir=e1)\n} else {\n  assign("result", 2, envir=e2)\n}\nget("result", envir=e1)',
			emptyGraph()
				.defineVariable('1@e1', 'e1')
				.defineVariable('2@e2', 'e2')
				.use('5@e1').reads('5@e1', '1@e1')
				.use('7@e2').reads('7@e2', '2@e2')
				.use('9@e1').reads('9@e1', '1@e1'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('assign in for-loop to custom env: e read in each iteration, x not in global scope', ['dynamic-environment-resolution', 'environment-sharing', 'for-loop', 'environment-in-loops']),
			shell,
			'e <- new.env()\nfor (i in 1:3) {\n  assign("x", i, envir=e)\n}\nx',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.reads('3@e', '1@e')
				.use('5@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['5@x', '3@assign']]
			}
		);

		assertDataflow(label('assign in while-loop to custom env: e read in body, val not in global scope', ['dynamic-environment-resolution', 'environment-sharing', 'while-loop', 'environment-in-loops']),
			shell,
			'e <- new.env()\ni <- 0\nwhile (i < 3) {\n  assign("val", i, envir=e)\n  i <- i + 1\n}\nval',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.reads('4@e', '1@e')
				.use('7@val'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['7@val', '4@assign']]
			}
		);
	});

	describe('get() with envir=', () => {
		assertDataflow(label('get resolves x from custom env and e is read', ['dynamic-environment-resolution', 'name-created']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\nget("x", envir=e)',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('3@e').reads('3@e', '1@e')
				.reads('3@"x"', '2@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('get without envir resolves from global scope', ['dynamic-environment-resolution', 'name-created']),
			shell,
			'x <- 10\nget("x")',
			emptyGraph()
				.defineVariable('1@x', 'x')
				.use('2@"x"')
				.reads('2@"x"', '1@x'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('get result drives if-then-else condition: val reads from get, if reads val', ['dynamic-environment-resolution', 'name-created', 'if']),
			shell,
			'e <- new.env()\nassign("flag", TRUE, envir=e)\nval <- get("flag", envir=e)\nif (val) {\n  x <- 1\n} else {\n  x <- 2\n}',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('3@e').reads('3@e', '1@e')
				.reads('3@"flag"', '2@"flag"')
				.defineVariable('3@val', 'val')
				.use('4@val').reads('4@val', '3@val'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('multiple gets from same env each independently read e and resolve their names', ['dynamic-environment-resolution', 'name-created', 'environment-sharing']),
			shell,
			'e <- new.env()\nassign("mu", 0, envir=e)\nassign("sigma", 1, envir=e)\nmu_val <- get("mu", envir=e)\nsigma_val <- get("sigma", envir=e)\nresult <- mu_val + sigma_val',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('3@e').reads('3@e', '1@e')
				.use('4@e').reads('4@e', '1@e')
				.use('5@e').reads('5@e', '1@e')
				.reads('4@"mu"', '2@"mu"')
				.reads('5@"sigma"', '3@"sigma"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);
	});

	describe('local() with envir=', () => {
		assertDataflow(label('local with custom env reads the envir variable', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			'e <- new.env()\nlocal({\nx <- 42\n}, envir=e)',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('4@e')
				.reads('4@e', '1@e'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('local with custom env: x not in global scope', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			'e <- new.env()\nlocal({\nx <- 42\n}, envir=e)\nx',
			emptyGraph()
				.use('5@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['5@x', '3@x']]
			}
		);

		assertDataflow(label('local without envir behaves normally, y not accessible outside', ['dynamic-environment-resolution']),
			shell,
			'x <- 1\nlocal({ y <- x + 1 })\ny',
			emptyGraph()
				.use('3@y'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['3@y', '2@local']]
			}
		);

		assertDataflow(label('local with if-then-else body in custom env: neither branch leaks to global scope', ['dynamic-environment-resolution', 'environment-sharing', 'if', 'environment-in-conditionals']),
			shell,
			'e <- new.env()\nlocal({\n  x <- if (TRUE) 10 else 20\n  y <- x + 1\n}, envir=e)\nx\ny',
			emptyGraph()
				.use('6@x')
				.use('7@y'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['6@x', '3@x'], ['7@y', '4@y']]
			}
		);
	});

	describe('dollar-sign assignment (e$x <- val)', () => {
		assertDataflow(label('e$x routes field into envState, x not in global scope', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			'e <- new.env()\ne$x <- 42\nx',
			emptyGraph()
				.use('3@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['3@x', '2@$<-']]
			}
		);

		assertDataflow(label('e$x <- val then get("x", envir=e) resolves correctly', ['dynamic-environment-resolution', 'name-created']),
			shell,
			'e <- new.env()\ne$x <- 42\nget("x", envir=e)',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('3@e')
				.reads('3@e', '1@e'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);
	});

	describe('dollar-sign read (e$x)', () => {
		assertDataflow(label('e$x resolves to x in envState, both define and use linked', ['dynamic-environment-resolution', 'name-created']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'x <- 99',
				'e$x',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('4@e').reads('4@e', '1@e')
				.reads('4@$', '2@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true, mustNotHaveEdges: [['4@$', '3@x']] }
		);
	});

	describe('attach() search path injection', () => {
		assertDataflow(label('attach(e) injects env contents into scope', ['dynamic-environment-resolution', 'environment-sharing']),
			shell,
			[
				'x <- 0',
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'attach(e)',
				'x',
			].join('\n'),
			emptyGraph()
				.defineVariable('2@e', 'e')
				.use('3@e').reads('3@e', '2@e')
				.use('4@e').reads('4@e', '2@e')
				.reads('5@x', '3@"x"')
				.use('5@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['5@x', '3@assign'], ['5@x', '1@x']]
			}
		);

		assertDataflow(label('attach with untracked object is a conservative side effect', ['dynamic-environment-resolution']),
			shell,
			'attach(some_obj)\nx',
			emptyGraph()
				.use('2@x'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);
	});

	describe('complex programs', () => {
		assertDataflow(label('configuration manager: multi-assign then conditional update then selective get', ['dynamic-environment-resolution', 'environment-sharing', 'name-created', 'if', 'environment-in-conditionals']),
			shell,
			[
				'cfg <- new.env()',
				'assign("threshold", 0.05, envir=cfg)',
				'assign("n_iter", 1000, envir=cfg)',
				'assign("method", "lm", envir=cfg)',
				'thresh <- get("threshold", envir=cfg)',
				'if (thresh < 0.1) {',
				'  assign("method", "glm", envir=cfg)',
				'}',
				'method <- get("method", envir=cfg)',
				'n <- get("n_iter", envir=cfg)',
				'result <- paste(method, n)',
				'result',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@cfg', 'cfg')
				.use('2@cfg').reads('2@cfg', '1@cfg')
				.use('3@cfg').reads('3@cfg', '1@cfg')
				.use('4@cfg').reads('4@cfg', '1@cfg')
				.use('5@cfg').reads('5@cfg', '1@cfg')
				.reads('5@"threshold"', '2@"threshold"')
				.use('7@cfg').reads('7@cfg', '1@cfg')
				.use('9@cfg').reads('9@cfg', '1@cfg')
				.use('10@cfg').reads('10@cfg', '1@cfg')
				.reads('10@"n_iter"', '3@"n_iter"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('two-env pipeline: data and config environments are independent', ['dynamic-environment-resolution', 'environment-sharing', 'name-created']),
			shell,
			[
				'data_env <- new.env()',
				'cfg_env <- new.env()',
				'assign("raw", c(1, 2, 3), envir=data_env)',
				'assign("scale", 10, envir=cfg_env)',
				'raw_val <- get("raw", envir=data_env)',
				'scale_val <- get("scale", envir=cfg_env)',
				'assign("scaled", raw_val * scale_val, envir=data_env)',
				'get("scaled", envir=data_env)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@data_env', 'data_env')
				.defineVariable('2@cfg_env', 'cfg_env')
				.use('3@data_env').reads('3@data_env', '1@data_env')
				.use('4@cfg_env').reads('4@cfg_env', '2@cfg_env')
				.use('5@data_env').reads('5@data_env', '1@data_env')
				.reads('5@"raw"', '3@"raw"')
				.use('6@cfg_env').reads('6@cfg_env', '2@cfg_env')
				.reads('6@"scale"', '4@"scale"')
				.use('7@data_env').reads('7@data_env', '1@data_env')
				.use('8@data_env').reads('8@data_env', '1@data_env'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('results and metrics envs: conditional summary strategy based on count from metrics env', ['dynamic-environment-resolution', 'environment-sharing', 'name-created', 'if', 'environment-in-conditionals']),
			shell,
			[
				'results <- new.env()',
				'metrics <- new.env()',
				'data <- c(1, 2, 3, 4, 5)',
				'assign("n", length(data), envir=metrics)',
				'assign("raw", data, envir=results)',
				'n_val <- get("n", envir=metrics)',
				'if (n_val > 3) {',
				'  assign("summary", mean(data), envir=results)',
				'} else {',
				'  assign("summary", median(data), envir=results)',
				'}',
				'get("summary", envir=results)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@results', 'results')
				.defineVariable('2@metrics', 'metrics')
				.use('4@metrics').reads('4@metrics', '2@metrics')
				.use('5@results').reads('5@results', '1@results')
				.use('6@metrics').reads('6@metrics', '2@metrics')
				.reads('6@"n"', '4@"n"')
				.defineVariable('6@n_val', 'n_val')
				.use('7@n_val').reads('7@n_val', '6@n_val')
				.use('8@results').reads('8@results', '1@results')
				.use('10@results').reads('10@results', '1@results')
				.use('12@results').reads('12@results', '1@results'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('for-loop populates env with dynamic keys: e read in body and after loop', ['dynamic-environment-resolution', 'environment-sharing', 'for-loop', 'environment-in-loops']),
			shell,
			[
				'e <- new.env()',
				'for (i in 1:5) {',
				'  assign(paste0("v", i), i * 2, envir=e)',
				'}',
				'get("v1", envir=e)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@e', 'e')
				.reads('3@e', '1@e')
				.use('5@e').reads('5@e', '1@e'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('chained get-assign-get across two envs: full provenance chain', ['dynamic-environment-resolution', 'environment-sharing', 'name-created']),
			shell,
			[
				'src <- new.env()',
				'dst <- new.env()',
				'assign("val", 42, envir=src)',
				'assign("val", get("val", envir=src), envir=dst)',
				'get("val", envir=dst)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@src', 'src')
				.defineVariable('2@dst', 'dst')
				.use('3@src').reads('3@src', '1@src')
				.use('4@src').reads('4@src', '1@src')
				.reads('5@"val"', '4@"val"')
				.use('4@dst').reads('4@dst', '2@dst')
				.use('5@dst').reads('5@dst', '2@dst'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('parallel accumulation in two envs inside for-loop: reads isolated per env', ['dynamic-environment-resolution', 'environment-sharing', 'for-loop', 'environment-in-loops']),
			shell,
			[
				'evens <- new.env()',
				'odds <- new.env()',
				'for (i in 1:6) {',
				'  if (i %% 2 == 0) {',
				'    assign("last", i, envir=evens)',
				'  } else {',
				'    assign("last", i, envir=odds)',
				'  }',
				'}',
				'get("last", envir=evens)',
				'get("last", envir=odds)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@evens', 'evens')
				.defineVariable('2@odds', 'odds')
				.reads('5@evens', '1@evens')
				.reads('7@odds', '2@odds')
				.use('10@evens').reads('10@evens', '1@evens')
				.use('11@odds').reads('11@odds', '2@odds'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);
	});

	describe('new.env() parent argument', () => {
		assertDataflow(label('new.env(parent=e) with tracked parent env: child reads from parent via assign', ['dynamic-environment-resolution', 'environment-parent']),
			shell,
			'e <- new.env()\nassign("x", 1, envir=e)\nchild <- new.env(parent=e)\nget("x", envir=child)',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.defineVariable('3@child', 'child')
				.use('3@e').reads('3@e', '1@e')
				.use('4@child').reads('4@child', '3@child'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('new.env(parent=emptyenv()): fresh isolated env, assign into it does not leak to parent', ['dynamic-environment-resolution', 'environment-parent']),
			shell,
			'e <- new.env(parent=emptyenv())\nassign("x", 42, envir=e)\nx',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('3@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['3@x', '2@assign']]
			}
		);

		assertDataflow(label('new.env(parent=NULL): same as emptyenv(), assign does not leak', ['dynamic-environment-resolution', 'environment-parent']),
			shell,
			'e <- new.env(parent=NULL)\nassign("x", 42, envir=e)\nx',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('3@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['3@x', '2@assign']]
			}
		);

		assertDataflow(label('new.env() without parent uses default (parent.frame()), tracked normally', ['dynamic-environment-resolution', 'environment-parent']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\nx',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('3@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['3@x', '2@assign']]
			}
		);
	});

	describe('rlang::new_environment()', () => {
		assertDataflow(label('rlang::new_environment() carries NewEnv origin, assigned variable is tracked', ['dynamic-environment-resolution']),
			shell,
			'e <- rlang::new_environment()\nassign("x", 42, envir=e)\nx',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('3@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['3@x', '2@assign']]
			}
		);

		assertDataflow(label('rlang::new_environment(parent=emptyenv()): isolated env, assign does not leak', ['dynamic-environment-resolution', 'environment-parent']),
			shell,
			'e <- rlang::new_environment(parent=emptyenv())\nassign("x", 1, envir=e)\nx',
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('3@x'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				mustNotHaveEdges:      [['3@x', '2@assign']]
			}
		);
	});

	describe('user-defined function creates env', () => {
		assertDataflow(label('simple wrapper function returns new.env(): e has no envState, assign falls through to global scope', ['dynamic-environment-resolution']),
			shell,
			'make_env <- function() new.env()\ne <- make_env()\nassign("x", 42, envir=e)\nx',
			emptyGraph()
				.defineVariable('1@make_env', 'make_env')
				.defineVariable('2@e', 'e')
				/* "x" is defined in global scope because e carries no envState */
				.defineVariable('3@"x"', '"x"')
				.use('4@x')
				.reads('4@x', '3@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('factory function with internal new.env() and assign: no envState propagated to caller, get does not resolve', ['dynamic-environment-resolution']),
			shell,
			[
				'make_cfg <- function(val) {',
				'  env <- new.env()',
				'  assign("setting", val, envir=env)',
				'  env',
				'}',
				'cfg <- make_cfg(42)',
				'get("setting", envir=cfg)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@make_cfg', 'make_cfg')
				.defineVariable('6@cfg', 'cfg')
				/* cfg has no envState so envir=cfg is ignored; get resolves nothing from it */
				.use('7@cfg').reads('7@cfg', '6@cfg'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);
	});

	describe('environment aliasing (alias <- e)', () => {
		assertDataflow(label('alias snapshots envState: get via alias resolves x assigned before alias', ['dynamic-environment-resolution', 'environment-alias']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'alias <- e',
				'get("x", envir=alias)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.defineVariable('3@alias', 'alias')
				.use('3@e').reads('3@e', '1@e')
				.use('4@alias').reads('4@alias', '3@alias')
				.reads('4@"x"', '2@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('alias of alias: double indirection still resolves x', ['dynamic-environment-resolution', 'environment-alias']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'alias1 <- e',
				'alias2 <- alias1',
				'get("x", envir=alias2)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.defineVariable('3@alias1', 'alias1')
				.use('3@e').reads('3@e', '1@e')
				.defineVariable('4@alias2', 'alias2')
				.use('4@alias1').reads('4@alias1', '3@alias1')
				.use('5@alias2').reads('5@alias2', '4@alias2')
				.reads('5@"x"', '2@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);

		assertDataflow(label('alias does not see assigns made to original env AFTER alias was created', ['dynamic-environment-resolution', 'environment-alias']),
			shell,
			[
				'e <- new.env()',
				'alias <- e',
				'assign("x", 42, envir=e)',
				'get("x", envir=alias)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@e', 'e')
				.defineVariable('2@alias', 'alias')
				.use('2@e').reads('2@e', '1@e')
				/* alias was created before the assign so its envState has no "x": get falls through */
				.use('4@alias').reads('4@alias', '2@alias'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
				/* assign("x",...) goes into e AFTER the alias snapshot; alias cannot see it */
				mustNotHaveEdges:      [['4@"x"', '3@"x"']]
			}
		);
	});

	describe('with() / within()', () => {
		assertDataflow(label('with(e, x): x resolves from envState, e is read', ['dynamic-environment-resolution', 'environment-with']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'x <- 3',
				'with(e, x)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.use('4@e').reads('4@e', '1@e')
				.reads('4@x', '2@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true, mustNotHaveEdges: [['4@x', '3@x']] }
		);

		assertDataflow(label('with via alias: with(alias, x) resolves x from alias envState', ['dynamic-environment-resolution', 'environment-with', 'environment-alias']),
			shell,
			[
				'e <- new.env()',
				'assign("x", 42, envir=e)',
				'alias <- e',
				'x <- 3',
				'with(alias, x)',
			].join('\n'),
			emptyGraph()
				.defineVariable('1@e', 'e')
				.use('2@e').reads('2@e', '1@e')
				.defineVariable('3@alias', 'alias')
				.use('3@e').reads('3@e', '1@e')
				.use('5@alias').reads('5@alias', '3@alias')
				.reads('5@x', '2@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true, mustNotHaveEdges: [['5@x', '4@x']] }
		);

		assertDataflow(label('with untracked env falls through to default handling', ['dynamic-environment-resolution', 'environment-with']),
			shell,
			'with(some_obj, x)\nx',
			emptyGraph()
				.use('1@x')
				.use('2@x'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
		);
	});

	describe('config: trackEnvironments disabled', () => {
		const noTrack = FlowrConfig.setInConfig(FlowrConfig.default(), 'solver.trackEnvironments', false);

		assertDataflow(label('with tracking disabled, assign falls through to global', ['dynamic-environment-resolution']),
			shell,
			'e <- new.env()\nassign("x", 42, envir=e)\nx',
			emptyGraph()
				.defineVariable('2@"x"', '"x"')
				.use('3@x')
				.reads('3@x', '2@"x"'),
			{ expectIsSubgraph: true, resolveIdsAsCriterion: true },
			0,
			noTrack
		);
	});
}));
