import { RBaseGuardsVersion } from '../data/r-base-guards.generated';
import type { RShell } from '../r-bridge/shell';
import { CloneAlgorithm } from '../clones/clone-detector';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import { FlowrAnalyzer } from '../project/flowr-analyzer';
import { defaultDependencyCategories, type DefaultDependencyCategoryName, type DependencyCategorySettings } from '../queries/catalog/dependencies-query/dependencies-query-format';
import { Constant, Unknown } from '../queries/catalog/dependencies-query/dependency-values';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { executeQueries, QueriesSchema } from '../queries/query';
import { FlowrGithubBaseRef, FlowrGithubGroupName, FlowrWikiBaseRef, getFilePathMd } from './doc-util/doc-files';
import {
	assertAllQueriesDocumented,
	linkToQueryOfName,
	queryPages,
	registerQueryDocumentation,
	showQuery,
	sliceQueryShorthand,
	tocForQueryType
} from './doc-util/doc-query';
import { describeSchema } from '../util/schema';
import { markdownFormatter } from '../util/text/ansi';
import { exampleQueryCode } from './data/query/example-query-code';
import { block, details } from './doc-util/doc-structure';
import { codeBlock } from './doc-util/doc-code';
import { getReplCommand } from './doc-util/doc-cli-option';
import { NewIssueUrl } from './doc-util/doc-issue';
import { CallTargets } from '../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { Q } from '../search/flowr-search-builder';
import { VertexType } from '../dataflow/graph/vertex';
import { printCfgCode } from './doc-util/doc-cfg';
import { documentReplSession } from './doc-util/doc-repl';
import type { SlicingCriterion, SlicingCriteria } from '../slicing/criterion/parse';
import { escapeNewline } from './doc-util/doc-escape';
import type { ShowQueryOptions } from './doc-util/doc-query';
import { DefaultAssumedRVersion } from '../config';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import type { GeneralDocContext } from './wiki-mk/doc-context';
import type { ArgProp, CallProp } from '../dataflow/environments/built-in-props';
import { SliceDirection } from '../util/slice-direction';
import type { AbsintQueryType } from '../queries/catalog/absint-query/absint-query-format';
import { warnMissingSigDb } from './doc-util/doc-sigdb';
import type { AnyPredefinedTaintAnalysisName } from '../taint-analysis/predefined/predefined';


registerQueryDocumentation('call-context', {
	type:             'active',
	shortDescription: 'Finds all calls in a set of files that matches specified criteria.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		return `
Call context queries can be used to identify calls to specific functions that match criteria of your interest.
For now, we support two criteria:

1. **Function Name** (\`callName\`): The function name is specified by a regular expression. This allows you to find all calls to functions that match a specific pattern. Please note, that if you do not use Regex-Anchors, the query will match any function name that contains the given pattern (you can set the \`callNameExact\` property to \`true\` to automatically add the \`^...$\` anchors).
2. **Call Targets**  (\`callTargets\`): This specifies to what the function call targets. For example, you may want to find all calls to a function that is not defined locally.

Besides this, we provide the following ways to automatically categorize and link identified invocations:

1. **Kind**         (\`kind\`): This is a general category that can be used to group calls together. For example, you may want to link all calls to \`plot\` to \`visualize\`.
2. **Subkind**      (\`subkind\`): This is used to uniquely identify the respective call type when grouping the output. For example, you may want to link all calls to \`ggplot\` to \`plot\`.
3. **Linked Calls** (\`linkTo\`): This links the current call to the last/nested/.. call of the given kind. This way, you can link a call like \`points\` to the latest graphics plot etc.
4. **Aliases**      (\`includeAliases\`): Consider a case like \`f <- function_of_interest\`, do you want calls to \`f\` to be included in the results? There is probably no need to combine this with a global call target!

It's also possible to filter the results based on the following properties:

1. **File** (\`fileFilter\`): This allows you to filter the results based on the file in which the call is located. This can be useful if you are only interested in calls in, e.g., specific folders.
   The \`fileFilter\` property is an object made up of two properties:
     - **Filter** (\`filter\`): A regular expression that a node's file attribute must match to be considered.
     - **Include Undefined Files** (\`includeUndefinedFiles\`): If \`fileFilter\` is set, but a node's file attribute is not present, should we include it in the results? Defaults to \`true\`.
2. **Ignore Parameter Values** (\`ignoreParameterValues\`): Should we ignore default values for parameters in the results?

Re-using the example code from above, the following query attaches all calls to \`mean\` to the kind \`visualize\` and the subkind \`text\`,
all calls that start with \`read_\` to the kind \`input\` but only if they are not locally overwritten, and the subkind \`csv-file\`, and links all calls to \`points\` to the last call to \`plot\`:

${
	await showQuery(shell, exampleQueryCode, [
		{ type: 'call-context', callName: '^mean$', kind: 'visualize', subkind: 'text' },
		{ type: 'call-context', callName: '^read_', kind: 'input', subkind: 'csv-file', callTargets: CallTargets.OnlyGlobal },
		{ type: 'call-context', callName: '^points$', kind: 'visualize', subkind: 'plot', linkTo: { type: 'link-to-last-call', callName: '^plot$' } }
	], { showCode: false, ctx })
}

All kinds and subkinds with the same name are grouped together.
Yet, re-stating common arguments and kinds may be cumbersome (although you can already use clever regex patterns).
See the ${linkToQueryOfName('compound')} for a way to structure your queries more compactly if you think it gets too verbose. 

${
	await (async() => {
		const code = `
foo <- my_test_function
foo()
if(u) bar <- foo
bar()
my_test_function()
`.trim();
		return details('Alias Example', `Consider the following code: ${codeBlock('r', code)}\nNow let's say we want to query _all_ uses of the \`my_test_function\`:` + await showQuery(shell, code, [
			{ type: 'call-context', callName: '^my_test_function', includeAliases: true }
		], { showCode: false, ctx }));
	})()
}
		`;
	}
});

registerQueryDocumentation('dataflow', {
	type:             'active',
	shortDescription: 'Returns the dataflow graph of the given code.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x + 1';
		return `
Maybe you want to handle only the result of the query execution, or you just need the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')} again.
This query type does exactly that!

Using the example code \`${exampleCode}\`, the following query returns the dataflow graph of the code:
${
	await showQuery(shell, exampleCode, [{ type: 'dataflow' }], { showCode: true, ctx })
}
		`;
	}
});

registerQueryDocumentation('call-graph', {
	type:             'active',
	shortDescription: 'Returns the call graph of the given code.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x + 1';
		return `
This query calculates and returns the ${ctx.linkPage('wiki/Dataflow Graph', 'call graph', 'perspectives-cg')} of the given code.

Using the example code \`${exampleCode}\`, the following query returns the dataflow graph of the code:
${
	await showQuery(shell, exampleCode, [{ type: 'call-graph' }], { showCode: true, ctx })
}
		`;
	}
});

registerQueryDocumentation('does-call', {
	type:             'active',
	shortDescription: 'Checks whether a function calls another function matching given constraints.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'f <- function(x) { eval(x) };\nf("1 + 1")';
		return `
This query checks whether a function calls another function matching given constraints.

Using the example code:
${codeBlock('r', exampleCode)}
the following query checks whether the call to \`f\` calls \`eval\`:
${
	await showQuery(shell, exampleCode, [{ type: 'does-call', queryId: 'calls-eval', call: '2@f', calls: { type: 'name', name: 'eval', nameExact: true } }], { showCode: true, shorthand: '(2@f:"eval")', ctx })
}
		`;
	}
});

registerQueryDocumentation('files', {
	type:             'active',
	shortDescription: 'Returns the files matching the given criteria.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		return `
This query returns the files that match the given criteria.
${
	await showQuery(shell, '', [{ type: 'files' }], { showCode: true, ctx })
}
		`;
	}
});

registerQueryDocumentation('project', {
	type:             'active',
	shortDescription: 'Returns information about the analyzed project',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x + 1';
		return `
This query returns the information about the analyzed project.
If present, it will incorporate plugins to, e.g., extract author and license information from R package DESCRIPTION files.

${
	await showQuery(shell, exampleCode, [{ type: 'project' }], { showCode: true, ctx })
}
		`;
	}
});

registerQueryDocumentation('normalized-ast', {
	type:             'active',
	shortDescription: 'Returns the normalized AST of the given code.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x + 1';
		return `
Maybe you want to handle only the result of the query execution, or you just need the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST')} again.
This query type does exactly that!

Using the example code \`${exampleCode}\`, the following query returns the normalized AST of the code:
${
	await showQuery(shell, exampleCode, [{ type: 'normalized-ast' }], { showCode: true, ctx })
}
		`;
	}
});

registerQueryDocumentation('dataflow-cluster', {
	type:             'active',
	shortDescription: 'Calculates and returns all the clusters present in the dataflow graph.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleA = 'x <- 1; x';
		const exampleB = 'x <- 1; y';
		return `
This query automatically calculates clusters in flowR's dataflow graph 
and returns a list of all clusters found. 
Clusters are to be interpreted as literal clusters on the graph traversing
edges in both directions. From this perspective, 
the code \`${exampleA}\` has one cluster (given that all code is related), 
while the code \`${exampleB}\` has two clusters (given that the \`y\` has no relation to the previous definition).

${details('Example <code>' + exampleA + '</code>',
	await showQuery(shell, exampleA, [{ type: 'dataflow-cluster' }], { showCode: false, ctx }))}
${details('Example <code>' + exampleB + '</code>',
	await showQuery(shell, exampleB, [{ type: 'dataflow-cluster' }], { showCode: false, ctx }))}

Using the example code from above, the following query returns all clusters:
${
	await showQuery(shell, exampleQueryCode, [{ type: 'dataflow-cluster' }], { showCode: false, ctx })
}
		`;
	}
});

registerQueryDocumentation('resolve-value', {
	type:             'active',
	shortDescription: 'Provides access to flowR\'s value tracking (which is configurable)',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x <- 1\ny <-2\nprint(x)\nprint(y)';
		const criteria = ['3@x', '4@y'] as SlicingCriteria;
		return `
With this query you can use flowR's value-tracking capabilities to resolve identifiers to all potential values they may have at runtime (if possible).
The extent to which flowR traces values (e.g., built-ins vs. constants) can be configured in flowR's Configuration file (see the ${ctx.linkPage('wiki/Interface', 'Interface')} wiki page for more information).

Using the example code \`${exampleCode}\` (with newlines), the following query returns all values of \`x\` in the code:
${
	await showQuery(shell, exampleCode, [{ type: 'resolve-value', criteria: criteria }], { showCode: true, shorthand: sliceQueryShorthand(criteria, escapeNewline(exampleCode)), ctx })
}
		`;
	}
});

registerQueryDocumentation('inspect-higher-order', {
	type:             'active',
	shortDescription: 'Determine whether functions are higher-order functions',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'f <- function() function(x) x; f()';
		return `
With this query you can identify which functions in the code are higher-order functions, i.e., either take a function as an argument or return a function.
A parameter the body itself calls (\`function(g) g()\`, \`function(g) lapply(x, g)\`) counts as well, without any call site having to hand a function over.
Please note, that functions that are just identities (e.g., \`function(x) x\`) are not considered higher-order if they do not take a function as an argument.

Using the example code \`${exampleCode}\` the following query returns the information for all identified function definitions whether they are higher-order functions:
${
	await showQuery(shell, exampleCode, [{ type: 'inspect-higher-order' }], { showCode: true, ctx })
}

This query also supports a slicing criterion based query mode that only returns information for functions matching the given criteria:
${
	await showQuery(shell, exampleCode, [{ type: 'inspect-higher-order', filter: ['1@function'] }], { showCode: false, shorthand: sliceQueryShorthand(['1@function'], escapeNewline(exampleCode)), ctx })
}
		`;
	}
});

registerQueryDocumentation('inspect-recursion', {
	type:             'active',
	shortDescription: 'Determine whether functions are recursive',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'fact <- function(n) { if(n <= 1) 1 else n * fact(n - 1) }';
		return `
With this query you can identify which functions in the code are recursive.
Please note, that functions that *may* be recursive due to indirect calls are also considered recursive.

Using the example code \`${exampleCode}\` the following query returns the information for all identified function definitions whether they are recursive:
${
	await showQuery(shell, exampleCode, [{ type: 'inspect-recursion' }], { showCode: true, ctx })
}

This query also supports a slicing criterion based query mode that only returns information for functions matching the given criteria:
${
	await showQuery(shell, exampleCode, [{ type: 'inspect-recursion', filter: ['1@function'] }], { showCode: true, shorthand: sliceQueryShorthand(['1@function'], escapeNewline(exampleCode)), ctx })
}
		`;
	}
});

registerQueryDocumentation('ambient-access', {
	type:             'active',
	shortDescription: 'What code reads and writes of the global state',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'f <- function() options(digits = 3)\nf()\nSys.setenv(A = "1")';
		return `
This query reports what code reads and writes of the global state, such as options, environment variables,
the working directory, open devices, or the search path, as the pseudo variables of ${ctx.link('AmbientStateName')}
(\`#option:digits\`, \`#env:A\`, ...). A call counts with what the functions it calls access, so \`f()\` above writes \`digits\`.
It also names the global variables the code binds (\`x <<- 1\`) and the drawing calls it makes.
The same is available in code as \`Dataflow.sideEffects.ambientAccess\`.

Without criteria, the query answers for every file and for the whole project (\`<project>\`):
${
	await showQuery(shell, exampleCode, [{ type: 'ambient-access' }], { showCode: true, ctx })
}

With slicing criteria, it answers for each criterion with all the code its node spans, so \`3^\` asks for the statement on line 3.
Set \`functions\` to also learn what calling each function accesses:
${
	await showQuery(shell, exampleCode, [{ type: 'ambient-access', criteria: ['2^'], functions: true }], { showCode: false, shorthand: sliceQueryShorthand(['2^'], escapeNewline(exampleCode)), ctx })
}
		`;
	}
});

registerQueryDocumentation('inspect-fn-props', {
	type:             'active',
	shortDescription: 'Determine what functions and their formals do',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'f <- function(x, xs, FUN, opt) { if(missing(opt)) print(length(xs)); lapply(xs, FUN); x }';
		return `
Per function definition this states what each formal is used for, as ${ctx.link('ArgProp')} bits, and what the
function itself does, as ${ctx.link('CallProp')} bits: the very scheme flowR states its built-ins and the
signature database stores its parameters with.

R hands arguments over as promises, so whether a parameter is evaluated at all is part of the answer:
${ctx.linkE<typeof ArgProp>('ArgProp', 'Forced')} says every call forces it,
${ctx.linkE<typeof ArgProp>('ArgProp', 'Lazy')} that none can, and neither of the two that it depends on the
path taken, on the caller, or on a function flowR could not resolve. A function forcing every one of its
parameters is ${ctx.linkE<typeof CallProp>('CallProp', 'Strict')} in turn. A read that only hands the parameter
on is decided by the function receiving it, resolved through the call graph, while a read in a nested
definition, in a loop, or under a condition leaves it open.

A formal is an alias only if the function *always* returns it (\`return(x)\` under an \`if\` does not count),
every other bit is the one the calls in the body state for what they are handed, and a formal carrying none at
all is left out. A body reading its own call or frame (\`match.call()\`, \`nargs()\`,
\`as.list(environment())\`) reaches every formal without naming one, so they all carry \`nse\`.
What the function itself does is read off its body: what its calls do it does too, a dispatching body is a
generic, and one whose result always comes from a call returning invisibly returns invisibly in turn.

With \`only\` the query infers just one half (\`arguments\` or \`function\`, skipping the other walk
entirely), \`formals\` keeps the parameters written as one of the given names, and \`props\` keeps the
properties named as the \`ArgProp\`/\`CallProp\` members they are.

Using the example code \`${exampleCode}\` the following query returns what every identified function and formal does:
${
	await showQuery(shell, exampleCode, [{ type: 'inspect-fn-props' }], { showCode: true, ctx })
}

This query also supports a slicing criterion based query mode that only returns information for functions matching the given criteria:
${
	await showQuery(shell, exampleCode, [{ type: 'inspect-fn-props', filter: ['1@function'] }], { showCode: true, shorthand: sliceQueryShorthand(['1@function'], escapeNewline(exampleCode)), ctx })
}
		`;
	}
});

registerQueryDocumentation('inspect-fn-guards', {
	type:             'active',
	shortDescription: 'Infer what functions ask of the calls they return from',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'f <- function(x, n, type = c("a", "b")) {\n  type <- match.arg(type)\n  if(!is.numeric(x) || x < 0) stop("invalid x")\n  if(length(x) < n) stop("x is too short")\n  sum(x)\n}';
		const predicateConfig = `new FlowrAnalyzerBuilder().amendConfig(c => {
	c.semantics.environment.overwriteBuiltIns.definitions = [{
		type: 'function', names: ['is_text'], processor: BuiltInProcName.DefaultReadAllArgs,
		config: { guards: { is_text: { predicate: { yes: RValueType.Character, exact: true } } } }
	}];
})`;
		return `
This query works out the *contract* of every function of a program: what a call has to fulfill to return normally, read off the checks in the body.
In the example below, \`f\` stops unless \`x\` is a non-negative number at least \`n\` long, and \`match.arg\` only lets \`type\` be \`"a"\` or \`"b"\`.
The query states exactly that: per formal what a call has to give and what holds of it, and what relates several formals, like \`length(x) >= n\`:

${await showQuery(shell, exampleCode, [{ type: 'inspect-fn-guards' }], { showCode: true, ctx })}

### Where the contracts are used

- the \`call-contracts\` linting rule reports a call that cannot fulfill the contract of what it calls, like \`f(-1)\` or \`f("a")\`
- the ${linkToQueryOfName('inspect-fn-props')} reports the formals a call has to supply (${ctx.linkE<typeof ArgProp>('ArgProp', 'Required')}) and those a condition reads (${ctx.linkE<typeof ArgProp>('ArgProp', 'Guarded')})
- the ${linkToQueryOfName('signature')} and the [signature browser](https://flowr-analysis.github.io/flowr/wiki/sigdb/) show the contracts of the functions of R and of packages
- the playground shows the contract of the function under the cursor

### Reading the result

Each function the program defines gets ${ctx.link('FunctionGuards')}:

- ${ctx.link('FunctionGuards::clauses')}: one ${ctx.link('GuardClause')} per check, with the condition as R code and as a ${ctx.link('GuardTerm')} tree (\`succeeds(e)\` stands for \`e\` not raising an error), whether R checks it itself (\`implicit\`, like \`x + 1\` for a value that is no number) or the code does (\`explicit\`, like the \`stop\` above), and the message of the failure
- ${ctx.link('FunctionGuards::formals')}: what the conditions together claim of each formal, as a ${ctx.link('FormalClaim')}:

| field | a normal return makes sure that |
|---|---|
| \`types\` | \`typeof(x)\` is one of these |
| \`unclassedTypes\` | the same, but only for an \`x\` without a class (a classed one may bring its own method) |
| \`values\`, \`partial\` | \`x\` is one of these strings, or with \`partial\` abbreviates one (\`match.arg\`) |
| \`classes\` | \`x\` inherits from one of these |
| \`bounds\` | \`x\` (\`value\`), \`length(x)\`, \`nchar(x)\`, \`nrow(x)\`, ... lie in this range |
| \`whole\`, \`notNA\`, \`callable\` | \`trunc(x) == x\`, \`!anyNA(x)\`, \`x\` is or names a function |
| \`resolves\` | a name built from \`x\`, like \`paste0("f_", x)\`, exists |
| \`cases\` | what holds in each case a branch on \`x\` tells apart, like \`if(is.logical(center)) ... else ...\` |

- ${ctx.link('FunctionGuards::relations')}: what relates several formals, like \`length(x) >= n\`, each with the formals it speaks of and what lets a call through anyway (\`unless\`)
- ${ctx.link('FunctionGuards::conditional')}: what holds of a formal unless something about the others lets the call through, like \`m\` having to be a number unless \`x\` is no count
- ${ctx.link('FunctionGuards::returns')}: what holds of the value a call returns normally
- ${ctx.link('FunctionGuards::conditions')}: per formal the checks as they read in R, also those no claim has a word for, like \`stopifnot(x %% 2 == 0)\`
- ${ctx.link('FunctionGuards::required')}: the formals a call has to supply
- ${ctx.link('FunctionGuards::pure')}: the checks that fail before the function does anything but compute, so a call failing on them leaves nothing behind

The query takes \`kind\` (keep only \`implicit\` or \`explicit\` conditions), \`onlyPure\`, \`formals\` (only these formals), and \`builtIns\` (also state the contracts of the functions of R and of the packages flowR knows).

### What counts as a check

- \`stop\`, \`rlang::abort\`, and every other function that always fails, reached under \`if\`, \`&&\`, \`||\`, and \`switch\`, taking an earlier \`return\` into account: \`if(a) return(1); if(!is.numeric(x)) stop()\` asks \`a || is.numeric(x)\`
- \`stopifnot\`, \`assertthat::assert_that\`, \`match.arg\`, \`rlang::arg_match\`, and the \`assert_*\` functions of \`checkmate\`
- what R fails on by itself, like \`strsplit\` for anything but a character vector
- names that have to resolve, like \`do.call(paste0("f_", x), list())\`, and a \`UseMethod\` without a default method
- the methods a dispatch may run: a generic asks what its \`default\` method (or that of an implicit class like \`matrix\`) asks, unless \`is.object(x)\`
- the contracts of the functions a body surely calls, in terms of what it hands them, and predicates of the program like \`is_count <- function(v) is.numeric(v) && v >= 0\`

### Teaching flowR about more functions

A contract can only be as good as what flowR knows about the functions a body calls. There are three places to add that knowledge:

1. **A predicate or check of your own code base, without changing flowR.** Describe it in the configuration of the analyzer (the same \`overwriteBuiltIns\` works in a configuration file). With this, \`f <- function(x) { stopifnot(is_text(x)); x }\` claims that \`x\` is a character vector:

${codeBlock('ts', predicateConfig)}

   Besides \`predicate\`, the guard facts can state \`asks\` (what the function fails on per formal), \`required\` (formals a call has to give), \`check\` (the function fails unless its argument passes, like \`checkmate::assert_numeric\`), \`asserts\` (it fails unless every argument is \`TRUE\`, like \`stopifnot\`), and \`returns\`. All of them are typed in \`src/dataflow/environments/guard-facts.ts\`.
2. **A function of R or a package that flowR should know for everyone.** Add its guard facts to the built-in configuration: \`src/dataflow/environments/default-builtin-config/guards.ts\` for functions of base R and packages, \`guards-primitive-ops.ts\` for the operators and math primitives. For example \`'which': { asks: { x: fails(is('is.logical'), 'argument to \\'which\\' is not logical') } }\` makes every \`which(x)\` ask for a logical \`x\`.
3. **The closures of the base packages.** Their contracts are read off R itself with \`npx ts-node --transpile-only scripts/gen-base-guards.ts\`, which writes \`src/data/r-base-guards.generated.ts\` (currently from R ${RBaseGuardsVersion}). Rerun it after changing what flowR knows, as the base contracts are built on top of that knowledge.

### Limits

Every condition the query reports is *necessary*: a call that breaks one fails in R. What flowR cannot state exactly (a loop body, a variable with several definitions, a function it does not know) weakens a condition or drops it, it never makes one stronger than what the code asks for.

- A condition speaks of the value at the check, so a formal overwritten before it is read as what it was overwritten with.
- A default value claims nothing: \`function(n = 5L)\` still takes \`n = 1.5\`. Only \`match.arg\` and \`rlang::arg_match\` read the default, as the values they allow.
- What R fails on depends on the R version flowR assumes (\`solver.sigdb.assumedRVersion\`, else R ${RBaseGuardsVersion}): a condition of \`if\` longer than one only fails since R 4.2.0, an operand of \`&&\` longer than one since R 4.3.0.
- A missing argument handed on to another function written in R is only required if that function needs it, as R hands it on as a promise: \`matpoints(x)\` passes its missing \`y\` to \`matplot\`, which checks \`missing(y)\`.
		`;
	}
});

registerQueryDocumentation('inspect-exception', {
	type:             'active',
	shortDescription: 'Determine whether functions throw exceptions (known to flowR)',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = `mayFail <- function(x) {
  if(x < 0) stop("Negative value!")
  else sqrt(x)
}
safeFail <- function(x) {
  tryCatch(
    mayFail(x),
    error = function(e) { NA }
  )
}`;
		return `
With this query you can identify which functions in the code throw exceptions (known to flowR).

Using the following example code:
${codeBlock('r', exampleCode)}
the following query returns the information for all identified function definitions whether they throw exceptions:
${
	await showQuery(shell, exampleCode, [{ type: 'inspect-exception' }], { showCode: true, ctx })
}
		`;
	}
});

registerQueryDocumentation('origin', {
	type:             'active',
	shortDescription: 'Retrieve the origin of a variable, function call, ...',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x <- 1\nprint(x)';
		const criterion = '2@x';
		return `
With this query you can use flowR's origin tracking to find out the read origins of a variable,
the functions called by a call, and more.

Using the example code \`${exampleCode}\` (with the \`print(x)\` in the second line), the following query returns the origins of \`x\` in the code:
${
	await showQuery(shell, exampleCode, [{ type: 'origin', criterion: criterion }], { showCode: true, shorthand: sliceQueryShorthand([criterion], escapeNewline(exampleCode)), ctx })
}
		`;
	}
});

registerQueryDocumentation('search', {
	type:             'active',
	shortDescription: 'Provides access to flowR\'s search API',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x + 1';
		return `
With this query you can use the ${ctx.linkPage('wiki/Search API', 'Search API')} to conduct searches on the flowR analysis result.

Using the example code \`${exampleCode}\`, the following query returns all uses of 'x' in the code:
${
	await showQuery(shell, exampleCode, [{ type: 'search', search: Q.var('x').filter(VertexType.Use).build() }], { showCode: true, ctx })
}
		`;
	}
});

registerQueryDocumentation('happens-before', {
	type:             'active',
	shortDescription: 'Check whether one normalized AST node happens before another in the CFG.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x <- 1\ny <- 2';
		return `
With this query you can analyze the control flow graph:

Using the example code:

${codeBlock('r', exampleCode)}

the following query returns that the first assignment happens always before the other:
${
	await showQuery(shell, exampleCode, [{ type: 'happens-before', a: '1@x', b: '2@y' }], { showCode: true, ctx })
}
		`;
	}
});

registerQueryDocumentation('id-map', {
	type:             'active',
	shortDescription: 'Returns the id-map of the normalized AST of the given code.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x + 1';
		return `
This query provides access to all nodes in the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST')} as a mapping from their id to the node itself.

Using the example code \`${exampleCode}\`, the following query returns all nodes from the code:
${
	await showQuery(shell, exampleCode, [{ type: 'id-map' }], { showCode: true, ctx })
}
		`;
	}
});

registerQueryDocumentation('config', {
	type:             'active',
	shortDescription: 'Returns the current configuration of flowR.',

	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		return `
This query provides access to the current configuration of the flowR instance. See the ${ctx.linkPage('wiki/Interface', 'Interface')} wiki page for more information on what the configuration represents.
Additionally, you can use this query to update the configuration of flowR on-the-fly (please do not rely on this mechanism it is mostly of interest for demonstrations).
${
	await showQuery(shell, '', [{ type: 'config', update: { ignoreSourceCalls: true } }], { showCode: false, collapseResult: true, ctx })
}

Please note that, in the REPL, a special syntax starting with \`+\` (which should be autocompleted) can be used to update the configuration on the fly:

${
	await documentReplSession(shell, [{ command: ':query @config +solver.slicer.threshold=10000', description: 'Set the slicing threshold to 10,000.' }])
}

In the REPL you can also read a single option by its \`.\`-separated path, or several at once with a glob&mdash;\`*\` covers
one path segment, \`**\` any number. This only reads: setting a value still names exactly one key.

${
	await documentReplSession(shell, [
		{ command: ':query @config **.enabled', description: 'Read every `enabled` option, wherever it sits in the configuration.' },
		{ command: ':query @config solver.*', description: 'Read the direct children of `solver` (use `solver.**` for the whole subtree).' }
	])
}

One of the most useful options to change on-the-fly are probably those under \`repl\`. For example, setting ${ctx.linkConfig('repl.quickStats', true)}
enables quick statistics after each REPL command. Likewise, ${ctx.linkConfig('repl.dfProcessorHeat', true)} enables the dataflow processor heatmap after each REPL command.
`;
	}
});

registerQueryDocumentation('absint', {
	type:             'active',
	shortDescription: 'Returns the abstract values inferred for every expression or at specific locations.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const criteria: SlicingCriteria = ['1@df', '1@data.frame'];
		const inference: AbsintQueryType = 'df-shape';
		const exampleCode = 'df <- data.frame(id = 1:3) |>\n  filter(df, FALSE)';
		return `
This query infers all shapes of dataframes within the code using abstract interpretation. For example, you can use:
${
	await showQuery(shell, exampleCode, [{ type: 'absint', inference: inference }], { showCode: true, ctx })
}

The query optionally also accepts slice criteria to narrow the results to specific nodes. For example:
${
	await showQuery(shell, exampleCode, [{ type: 'absint', inference: inference, criteria: criteria }], { showCode: true, shorthand: sliceQueryShorthand(criteria, escapeNewline(exampleCode)), ctx })
}
`;
	}
});

registerQueryDocumentation('taint', {
	type:             'active',
	shortDescription: 'Returns the taint values inferred for every expression.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const defs: AnyPredefinedTaintAnalysisName[] = ['normalization-constant'];
		const exampleCode = `
			x <- c(1 , 2 , 3 , 4 , 5)\n
			y <- scale(x)\n
			z <- mean(y)`;
		return `
This query infers all taints for one or multiple analysis definitions within the code using taint analysis. 
For example, you can use the following query to get the results of the normalization analysis:
${
	await showQuery(shell, exampleCode, [{
		type: 'taint',
		defs: defs
	}], { showCode: true, ctx })
}
`;
	}
});

registerQueryDocumentation('compound', {
	name:             'Compound Query',
	type:             'virtual',
	shortDescription: 'Combines multiple queries of the same type into one, specifying common arguments.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		return `
A compound query comes in use, whenever we want to state multiple queries of the same type with a set of common arguments.
It offers the following properties of interest:

1. **Query** (\`query\`): the type of the query that is to be combined.
2. **Common Arguments** (\`commonArguments\`): The arguments that are to be used as defaults for all queries (i.e., any argument the query may have).
3. **Arguments** (\`arguments\`): The other arguments for the individual queries that are to be combined.

For example, consider the following compound query that combines two call-context queries for \`mean\` and \`print\`, both of which are to be
assigned to the kind \`visualize\` and the subkind \`text\` (using the example code from above):

${
	await showQuery(shell, exampleQueryCode, [{ type: 'compound', query: 'call-context', commonArguments: { kind: 'visualize', subkind: 'text' }, arguments: [{ callName: '^mean$' }, { callName: '^print$' }] }], { showCode: false, ctx })
}

In this specific scenario, the following query would be equivalent:

${
	await showQuery(shell, exampleQueryCode, [{ type: 'call-context', callName: '^(mean|print)$', kind: 'visualize', subkind: 'text' }], { showCode: false, collapseResult: true, ctx })
}

However, compound queries become more useful whenever common arguments can not be expressed as a union in one of their properties.
Additionally, you can still overwrite default arguments.
In the following, we (by default) want all calls to not resolve to a local definition, except for those to \`print\` for which we explicitly
want to resolve to a local definition:

${
	await showQuery(shell, exampleQueryCode, [{ type: 'compound', query: 'call-context', commonArguments: { kind: 'visualize', subkind: 'text', callTargets: CallTargets.OnlyGlobal }, arguments: [{ callName: '^mean$' }, { callName: '^print$', callTargets: CallTargets.OnlyLocal }] }], { showCode: false, ctx })
}

Now, the results no longer contain calls to \`plot\` that are not defined locally.

		`;
	}
});

registerQueryDocumentation('static-slice', {
	type:             'active',
	shortDescription: 'Slice the dataflow graph reducing the code to just the parts relevant for the given criteria (backward and forward).',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x <- 1\ny <- 2\nz <- 3\nx';
		const criteria = ['3@z', '4@x'] as SlicingCriteria;
		const sourceExample = 'source("library.R")\nprint(greeting)';
		const sourceCriteria = ['2@print'] as SlicingCriteria;
		return `
To slice, _flowR_ needs one thing from you: a variable or a list of variables (function calls are supported to, referring to the anonymous
return of the call) that you want to slice the dataflow graph for (additionally, you have to tell flowR if you want to have a forward slice).
Given this, the backward slice is essentially the subpart of the program that may influence the value of the variables you are interested in.
To specify a variable of interest, you have to present flowR with a [slicing criterion](${FlowrWikiBaseRef}/Terminology#slicing-criterion) (or, respectively, an array of them).

To exemplify the capabilities, consider the following code:
${codeBlock('r', exampleCode)}
If you are interested in the parts required for the use of \`x\` in the last line and \`z\`, you can use the following query:

${
	await showQuery(shell, exampleCode, [{ type: 'static-slice', criteria: criteria }], { showCode: false, shorthand: sliceQueryShorthand(criteria, escapeNewline(exampleCode)), ctx })
}

In general, you may be uninterested in seeing the reconstructed version and want to save some computation time, for this,
you can use the \`noReconstruction\` flag.

${
	details('No Reconstruction Example', await showQuery(shell, exampleCode, [{ type: 'static-slice', criteria: ['4@x'], noReconstruction: true }], { showCode: false, ctx }))
}

Likewise, if you want the forward slice for the first use of \`x\`, you can do it like this:

${
	await showQuery(shell, exampleCode, [{ type: 'static-slice', criteria: ['1@x'], direction: SliceDirection.Forward }], { showCode: false, shorthand: sliceQueryShorthand(['1@x'], escapeNewline(exampleCode), true), ctx })
}

If your program pulls in other files with \`source(...)\`, the \`inlineSources\` flag splices the reconstruction
of each resolvable sourced file into the place of its \`source()\` call, so the slice becomes a single
self-contained R text (cyclic or unresolvable \`source()\` calls are kept verbatim and reported via
\`reconstruct.inlineWarnings\`). With the ${getReplCommand('query')} REPL command you append an \`i\` to the
criteria (and may combine it with the forward \`f\` as \`fi\`), for example (with a faked \`library.R\` providing \`greeting\`):
${
	await showQuery(shell, sourceExample, [{ type: 'static-slice', criteria: sourceCriteria, inlineSources: true }], {
		showCode:  false,
		shorthand: sliceQueryShorthand(sourceCriteria, escapeNewline(sourceExample), false, true),
		ctx,
		files:     [{ name: 'library.R', content: 'greeting <- "hello"\nunused <- 123' }]
	})
}

You can disable ${ctx.linkPage('wiki/Interface', 'magic comments', 'slice-magic-comments')} using the \`noMagicComments\` flag.
This query replaces the old ${ctx.linkPage('wiki/Interface', '`request-slice`', 'message-request-slice')} message.
		`;
	}
});

registerQueryDocumentation('provenance', {
	type:             'active',
	shortDescription: 'Calculate the provenance of a given variable, optionally restricted to its enveloping fdef',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x <- 1\ny <- 2\nz <- 3\nx';
		const criterion: SlicingCriterion = '4@x';
		return `
Given a [slicing criterion](${FlowrWikiBaseRef}/Terminology#slicing-criterion), flowR will return the provenance
of the given program element (i.e., all related vertices in a non-interprocedural and non-context sensitive backward slice).

To exemplify the capabilities, consider the following code:
${codeBlock('r', exampleCode)}
If you are interested in the provenance of the \`x\` in the last line you can use:

${
	await showQuery(shell, exampleCode, [{ type: 'provenance', criterion }], { showCode: false, shorthand: sliceQueryShorthand([criterion], escapeNewline(exampleCode)), ctx })
}
`;
	}
});

registerQueryDocumentation('input-sources', {
	type:             'active',
	shortDescription: 'Classify the input sources of function calls',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = `
f <- function(x) {
	x <- x * 2
	print(x)
}`.trim();
		const criterion: SlicingCriterion = '3@print';
		const shinyCode = `
server <- function(input, output, session) {
	system(paste("convert", input$file))
}`.trim();
		const shinyCriterion: SlicingCriterion = '2@system';
		return `
Given a [slicing criterion](${FlowrWikiBaseRef}/Terminology#slicing-criterion) to
something like a function call, flowR classifies the types of all input sources (e.g., arguments).

To exemplify the query, consider the following code:
${codeBlock('r', exampleCode)}
If you are interested in the input-sources of the \`print\` call, you can use:

${
	await showQuery(shell, exampleCode, [{ type: 'input-sources', criterion }], { showCode: false, shorthand: sliceQueryShorthand([criterion], escapeNewline(exampleCode)), ctx })
}

Some objects are handed to the code by a framework rather than defined in it, like the \`input\` of a shiny
server function. The ${ctx.link('InputClassifierConfig::linkedObjects')} configuration lists them, so that reads
of such an object (and of its fields) classify as user input instead of stopping at a ${ctx.link('InputType::Parameter')}:
${codeBlock('r', shinyCode)}

${
	await showQuery(shell, shinyCode, [{ type: 'input-sources', criterion: shinyCriterion }], { showCode: false, shorthand: sliceQueryShorthand([shinyCriterion], escapeNewline(shinyCode)), ctx })
}

Every ${ctx.link('LinkedInputObject')} names the object, the ${ctx.link('InputType')} to use for it, and optionally
the parameters the binding function has to declare as well (${ctx.link('LinkedInputObject::withParams')}) - shiny's
\`input\` only counts as such if the function also takes an \`output\`, so that an ordinary function with a
parameter named \`input\` is left alone. Where the framework is handed the function instead of the code naming it,
a ${ctx.link('LinkedInputEntryPoint')} is exact: it says which object goes to which parameter *by position*, just
like R does, so \`shinyApp(ui, function(i, o, s))\` works no matter what those parameters are called.
With ${ctx.link('LinkedInputObject::declaredBy')} a read even links back to its definition - the \`textInput("n", …)\`
behind an \`input$n\` shows up as ${ctx.link('InputSource::declaredAt')}.

You do not have to pass any of this per query: the ${ctx.linkConfig('inputSources', true)} section of flowR's
${ctx.linkPage('wiki/Interface', 'configuration file')} carries the same shape and is *added* to what flowR already
knows, so your framework joins shiny instead of replacing it (and \`specializeConfig\` can scope it to one
${ctx.link('ProjectKind')}). Functions may be written as plain \`fn\` or namespaced \`pkg::fn\` strings; a bare call
only counts as the namespaced one while that package is attached, exactly as R would resolve it.

${codeBlock('json', JSON.stringify({ inputSources: {
	user:              ['myframework::read_form'],
	linkedObjects:     [{ name: 'ctx', type: 'user', declaredBy: { calls: ['myframework::field'], argName: 'id', argIdx: 0 } }],
	linkedEntryPoints: [{ call: 'myframework::serve', argName: 'handler', argIdx: 0, params: ['ctx', null] }]
} }, undefined, 2))}
`;
	}
});

/** what a script takes in, what it puts out, and what it does with data in between, by category of the dependencies query */
const DependencyRoles: readonly (readonly [title: string, categories: readonly DefaultDependencyCategoryName[]])[] = [
	['Inputs', ['library', 'remote', 'source', 'read']],
	['Outputs', ['write', 'visualize']],
	['What the script does with data', ['transform', 'statistics', 'test']],
	['What only works in an interactive session', ['interactive']]
];

/** the categories and the values they report, generated from the categories the query knows */
function dependencyOverview(ctx: GeneralDocContext, categories: Record<DefaultDependencyCategoryName, DependencyCategorySettings>): string {
	const examples = (c: DefaultDependencyCategoryName) => categories[c].functions.slice(0, 4).map(f => `\`${f.name}\``).join(', ');
	const rows = DependencyRoles.map(([title, names]) => `| **${title}** | | | |\n` + names.map(c =>
		`| \`${c}\` (${categories[c].queryDisplayName ?? c}) | ${categories[c].functions.length} | ${examples(c)} | ${categories[c].defaultValue === undefined ? '' : `\`${categories[c].defaultValue}\``} |`).join('\n')).join('\n');
	return `
The query reports one list of entries per category, each entry a call and the \`value\` it reads or writes, like the
file of a \`read.csv\`:

| Category | Functions known | For example | Value where none is named |
|----------|----------------:|-------------|---------------------------|
${rows}

What the \`value\` of an entry tells, and the fields that say more:

| Entry | How to tell | Meaning |
|-------|-------------|---------|
| a file, package, or URL | \`value\` names it | the call reads or writes it, like \`"data.csv"\` |
| inline data | \`value\` is \`${Constant}\` | ${ctx.doc('Constant')} |
| an unknown resource | \`value\` is \`${Unknown}\` | ${ctx.doc('Unknown')} |
| console output | \`value\` is \`stdout\` or \`stderr\` | \`print\` and \`cat\` write to \`stdout\`, \`message\` and \`warning\` to \`stderr\` |
| auto-printed output | \`implicit\` is set | ${ctx.doc('DependencyInfo::implicit')} |
| through a call of the program | \`via\` is set | ${ctx.doc('DependencyInfo::via').replaceAll('\n', ' ')} |
| part of another output | its id is in another entry's \`parts\` | ${ctx.doc('DependencyInfo::parts').replaceAll('\n', ' ')} |
`;
}

registerQueryDocumentation('dependencies', {
	type:             'active',
	shortDescription: 'Returns all direct dependencies (in- and outputs) of a given R script',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'library(x)';
		const transformCode = `
library(dplyr)
library(ggplot2)
small <- measurements |> filter(x > 1) |> select(x, y)
p <- ggplot(small, aes(x, y)) + geom_point() + ggtitle("Small")
ggsave("small.png", plot = p)
		`;
		const longerCode = `
source("sample.R")
foo <- loadNamespace("bar")

data <- read.csv("data.csv")

#' @importFrom ggplot2 ggplot geom_point aes
ggplot(data, aes(x=x, y=y)) + geom_point()

better::write.csv(data, "data2.csv")
print("hello world!")
		`;
		const categories = defaultDependencyCategories((await new FlowrAnalyzerBuilder().setParser(shell).build()).inspectContext());
		return `
This query extracts all dependencies from an R script, using a combination of a ${linkToQueryOfName('call-context')}
and more advanced tracking in the ${ctx.linkPage('wiki/Dataflow Graph', 'Dataflow Graph')}.
Loaded libraries are resolved against the ${ctx.linkPage('wiki/Signature Database', 'signature database')}.

${dependencyOverview(ctx, categories)}

For a script reading \`${exampleCode}\`, the following query returns the loaded library:
${
	await showQuery(shell, exampleCode, [{ type: 'dependencies' }], { showCode: false, ctx })
}

The query also handles more complicated scripts and offers information on the loaded _libraries_, _sourced_ files, data which is _read_ and data which is _written_.
For example, consider the following script:
${codeBlock('r', longerCode)}
The following query returns the dependencies of the script.
${
	await showQuery(shell, longerCode, [{ type: 'dependencies' }], { showCode: false, collapseResult: true, ctx })
}

Currently, the dependency extraction may fail as it is essentially a set of heuristics guessing the dependencies.
We welcome any feedback on this (consider opening a [new issue](${NewIssueUrl})).

In the meantime we offer several properties to overwrite the default behavior (e.g., function names that should be collected)

${
	await showQuery(shell, longerCode, [{ type: 'dependencies', ignoreDefaultFunctions: true, enabledCategories: ['library'], libraryFunctions: [{ package: 'base', name: 'print', argIdx: 0, argName: 'library', resolveValue: true }] }], { showCode: false, collapseResult: true, ctx })
}

Here, \`resolveValue\` tells the dependency query to resolve the value of this argument in case it is not a constant.

By default the query reports only the dependencies the code names itself. Yet R attaches a handful of base packages
to the search path on startup, so a bare \`sd(x)\` genuinely depends on \`stats\` without any \`library\` call saying so.
Set \`assumedPackages\` to have those reported as well, as \`library\` entries marked \`implicit\` and carrying no
\`nodeId\` (no single call stands for "R attached this"), with the calls that pulled the package in listed as
\`linkedIds\`:
${
	await showQuery(shell, 'sd(c(1, 2, 3))', [{ type: 'dependencies', assumedPackages: true, enabledCategories: ['library'] }], { showCode: true, collapseResult: false, ctx })
}

\`base\` is reported alongside the others but additionally marked \`alwaysAttached\`. The other six are attached by
convention and \`R_DEFAULT_PACKAGES\` (or \`options(defaultPackages=)\`) can drop any of them, whereas \`base\` is always
there and cannot be detached -- so it is never something the script could have asked for, and never something to
suggest a \`library\` call for.

To see what takes part in a dependency, ask the query to \`focus\` on it: \`.meta.focus\` then lists every node the
dependency depends on and every node that depends on it, so a client can gray out the rest. In the REPL, the
criteria go in parentheses, as with ${ctx.replCmd('query')} \`@dependencies (3@read.csv)\`, which prints the lines taking part:
${
	await showQuery(shell, 'f <- "a.csv"\ng <- 2\nd <- read.csv(f)\nh <- g + 1\nprint(d)', [{ type: 'dependencies', focus: ['3@read.csv'], enabledCategories: ['read'] }], { showCode: true, collapseResult: true, ctx })
}

Beyond libraries, files and outputs, the query knows the \`visualize\` category (plots) and the \`transform\` category
(\`Data Transformations\`): the calls that reshape, filter, join or aggregate data, like \`dplyr::filter\`, \`tidyr::pivot_longer\`,
\`merge\`, \`aggregate\` or \`data.table::setDT\`. The category is read from the built-in configuration: every built-in labeled
\`SemanticCallTag.Transforms\` belongs to it. Every such built-in names its package, so \`filter\` is only a transformation when it
resolves to \`dplyr\` and never for the time-series \`stats::filter\`.

The \`read\`, \`write\`, \`visualize\`, and \`transform\` entries additionally state how data flows through the call,
resolved with the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')} instead of the syntax:
* \`inputVariables\` (for \`write\`, \`visualize\`, and \`transform\`) are the variables the result is computed from, through every call
  in between. What an argument's role in the signature excludes (a file, a flag, a callee) is no input, nor is what a call quotes or
  looks up in a data mask: \`df\` for \`df |> filter(x > 1)\`, both \`a\` and \`b\` for \`left_join(a, b)\`. An addon to a plot draws its data.
* \`assignedTo\` (for \`read\`, \`visualize\`, and \`transform\`) is the variable the result is stored in, following every call that hands
  it on (a pipe into a call, parentheses, a \`+\` adding to a plot) up to \`<-\`, \`=\` or \`->\`: \`small\` for \`small <- filter(df, x > 1)\`, and
  nothing for \`f(filter(df, x > 1))\`.
* Every plot additionally carries its \`title\` (from \`ggtitle\`, \`labs(title = )\` or \`main =\`) and the file it is written to as \`savedTo\`
  (by \`ggsave\`, which names its \`plot\` or saves \`last_plot()\`, or by the graphics device open when it is drawn).
${
	await showQuery(shell, transformCode, [{ type: 'dependencies', enabledCategories: ['transform', 'visualize'] }], { showCode: true, collapseResult: false, ctx })
}
		`;
	}
});

registerQueryDocumentation('linter', {
	type:             'active',
	shortDescription: 'Lints a given R script for common issues.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'read.csv("i_do_not_exist.csv")';
		return `
This query lints a given R script for common issues, such as missing files, unused variables, and more.

For a script reading \`${exampleCode}\`, the following query returns all smells detected:
${
	await showQuery(shell, exampleCode, [{ type: 'linter' }], { showCode: false, ctx })
}

You can also configure which rules to apply and what settings to use for these rules:
${
	await showQuery(shell, exampleCode, [{ type: 'linter', rules: ['file-path-validity'] }], { showCode: false, shorthand: `rules:file-path-validity "${exampleCode}"`, ctx })
}

We welcome any feedback and suggestions for new rules on this (consider opening a [new issue](${NewIssueUrl})).
		`;
	}
});

registerQueryDocumentation('control-flow', {
	type:             'active',
	shortDescription: 'Provides the control-flow of the program.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'if(TRUE) 1 else 2';
		return `
This control-flow query provides you access to the control flow graph.

For a script reading \`${exampleCode}\`, the following query returns the CFG:
${
	await showQuery(shell, exampleCode, [{ type: 'control-flow' }], { showCode: false, collapseResult: true, ctx })
}

You can also overwrite the simplification passes to tune the perspective. for example, if you want to have basic blocks:
${
	await showQuery(shell, exampleCode, [{ type: 'control-flow', config: { simplificationPasses: ['unique-cf-sets', 'to-basic-blocks'] } }], { showCode: false, collapseResult: true, ctx })
}

this produces: 

${await printCfgCode(shell, exampleCode, { showCode: false, prefix: 'flowchart LR\n', simplifications: ['to-basic-blocks'], ctx })}


If, on the other hand, you want to prune dead code edges:
${
	await showQuery(shell, exampleCode, [{ type: 'control-flow', config: { simplificationPasses: ['unique-cf-sets', 'analyze-dead-code'] } }], { showCode: false, collapseResult: true, ctx })
}

this produces:

${await printCfgCode(shell, exampleCode, { showCode: false, prefix: 'flowchart LR\n', simplifications: ['analyze-dead-code'], ctx })}


Or, completely remove dead code:
${
	await showQuery(shell, exampleCode, [{ type: 'control-flow', config: { simplificationPasses: ['unique-cf-sets', 'analyze-dead-code', 'remove-dead-code'] } }], { showCode: false, collapseResult: true, ctx })
}

this produces:

${await printCfgCode(shell, exampleCode, { showCode: false, prefix: 'flowchart LR\n', simplifications: ['analyze-dead-code', 'remove-dead-code'], ctx })}

		`;
	}
});

registerQueryDocumentation('location-map', {
	type:             'active',
	shortDescription: 'Returns a simple mapping of ids to their location in the source file',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x + 1\nx * 2';
		const criteria = ['1@x', '2@x'] as SlicingCriteria;
		return `
A query like the ${linkToQueryOfName('id-map')} query can return a huge result, especially for larger scripts.
If you are not interested in all of the information contained within the full map, you can use the location map query to get a simple mapping of ids to their location in the source file.   

Consider you have the following code:

${codeBlock('r', exampleCode)}

The following query then gives you the aforementioned mapping:

${
	await showQuery(shell, exampleCode, [{ type: 'location-map' }], { showCode: false, ctx })
}

The query also accepts a list of slice criteria to filter the results to only include the locations of specific nodes. For example:

${
	await showQuery(shell, exampleCode, [{ type: 'location-map', ids: criteria }], { showCode: false, shorthand: sliceQueryShorthand(criteria, escapeNewline(exampleCode)), ctx })
}

All locations are given as a ${ctx.link('SourceRange')} paired with the file id in the format \`[file-id, [start-line, start-column, end-line, end-column]]\`.

		`;
	}
});

registerQueryDocumentation('data-columns', {
	type:             'active',
	shortDescription: 'Returns the columns of a data frame that can be written at a position, as an editor offers them to complete.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'library(dplyr)\npenguins |> filter(year > 2008, bi)';
		return `
Editors complete names, and within code that works on a data frame the names worth offering are often its columns:
after \`df$\`, but also in every argument a call evaluates within its data, as \`filter\`, \`mutate\`, \`subset\`, \`with\`, or \`aes\` do.
flowR knows which arguments a call evaluates that way (they are _quoted_ in the dataflow graph), so this works for every such call,
not just for a fixed list of them. The data frame is another argument of that call, the left side of a pipe into it, or, for a layer
like \`geom_point(aes(...))\`, an argument of what it is added to. Its columns come from the ${linkToQueryOfName('absint')} of data frame shapes,
which also knows the data sets R finds as lazy data, like \`penguins\` of \`datasets\` or \`starwars\` of \`dplyr\` (once loaded, or as \`dplyr::starwars\`).

Consider the following code, with the cursor just after the \`bi\` (line 2, column 34):

${codeBlock('r', exampleCode)}

The query asks for the columns at that position:

${
	await showQuery(shell, exampleCode, [{ type: 'data-columns', positions: ['2:34'] }], { showCode: false, shorthand: sliceQueryShorthand(['2:34'] as SlicingCriteria, escapeNewline(exampleCode)), ctx })
}

The position has to fall within a node. An editor completing a name not typed yet, as in \`filter(penguins, )\`, inserts a placeholder name at the cursor first.
		`;
	}
});

registerQueryDocumentation('dice', {
	type:             'active',
	shortDescription: 'Reduces the code to the parts that carry information from a given start point to a given end point.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'x <- 1\ny <- 2\nz <- x + y\nw <- z * 2\nprint(z)';
		return `
While the ${linkToQueryOfName('static-slice')} answers "what affects this point?" (or "what does this point affect?"),
a _dice_ answers the two-sided question: **which parts of the program carry information from A to B?**
It is the intersection of a forward slice seeded at \`from\` and a backward slice seeded at \`to\`,
so only the code that lies on some dependency path between the two criteria survives.

Both \`from\` and \`to\` are arrays of [slicing criteria](${FlowrWikiBaseRef}/Terminology#slicing-criterion), just like for the ${linkToQueryOfName('static-slice')}.
Unlike that query, there is no \`direction\` property: the direction is already fixed by the \`from\`&rarr;\`to\` pairing.

Consider the following code:
${codeBlock('r', exampleCode)}

Asking what connects the definition of \`x\` to the definition of \`z\` drops \`y <- 2\` (it never depends on \`x\`)
as well as \`w <- z * 2\` and \`print(z)\` (they are not on a path _into_ the \`to\` criterion):

${
	await showQuery(shell, exampleCode, [{ type: 'dice', from: ['1@x'] as SlicingCriteria, to: ['3@z'] as SlicingCriteria }], { showCode: false, shorthand: `(1@x->3@z) "${escapeNewline(exampleCode)}"`, ctx })
}

Beyond \`from\` and \`to\`, the dice query understands the same options as the ${linkToQueryOfName('static-slice')}
(\`noReconstruction\`, \`noMagicComments\`, \`inlineSources\`, \`inlineFull\`, and \`includeCallees\`), as both share the
\`SliceQueryOptions\` of ${getFilePathMd('../queries/catalog/slice-query-options.ts')}.

${
	details('Multiple Criteria per Side', 'Each side accepts several criteria, which are seeded together:' + await showQuery(shell, exampleCode, [{ type: 'dice', from: ['1@x', '2@y'] as SlicingCriteria, to: ['5@print'] as SlicingCriteria }], { showCode: false, ctx }))
}
		`;
	}
});

registerQueryDocumentation('dataflow-lens', {
	type:             'active',
	shortDescription: 'Returns a simplified view on the dataflow graph, reduced to definitions, uses, and calls.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'f <- function(a) a + 1\nx <- 1\ny <- f(x)\nprint(y)';
		return `
The ${linkToQueryOfName('dataflow')} hands you the complete dataflow graph, which is precise but quickly grows too large to read.
The dataflow lens returns a _reduced_ view of that same graph, keeping only what is usually interesting when looking at it by hand:

* only vertices tagged as a use, a variable definition, a function definition, or a function call (value vertices are dropped),
* without the environment captured at each vertex (control dependencies are kept),
* and without the vertices for plain operators and keywords (\`<-\`, \`=\`, \`+\`, \`|>\`, \`if\`, \`function\`, ...).

Edges survive only if both of their endpoints do. The query takes no further arguments.

${codeBlock('r', exampleCode)}

${await showQuery(shell, exampleCode, [{ type: 'dataflow-lens' }], { showCode: false, ctx })}

${
	block({
		type:    'NOTE',
		content: `This is a presentation aid, not a semantic one: the reduced graph is not a sound basis for slicing.
Use the ${linkToQueryOfName('dataflow')} if you need the complete graph, or the ${linkToQueryOfName('dataflow-cluster')} if you want the graph partitioned instead of shrunk.`
	})
}
		`;
	}
});

registerQueryDocumentation('signature', {
	type:             'active',
	shortDescription: 'Inspects the signature database: packages, function signatures, source and documentation links.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'library(dplyr)\nlead(1:10, n = 1)';
		return `
This query is the read-side interface to flowR's ${ctx.linkPage('wiki/Signature Database', 'signature database')}&mdash;the very same database
that resolves \`library()\` and \`::\` calls during the dataflow analysis. It lets you ask what flowR actually _knows_ about a package
or a function, without needing R or a network connection.

What you get back depends on how specific you are:

| Given | Result |
| ----- | :----- |
| nothing | a summary of the loaded databases |
| \`package\` | the full package view: version, CRAN links, dependencies, exports |
| \`package\` + \`function\` | the full function view: parameters, definition site, source and documentation links, S3 relations |
| a glob in either (\`gg*\`, \`geom_*\`) | the set of matching packages or functions |

The \`version\` property accepts an exact version, a glob (\`3.*\`), a semver range (\`>=3.0.0\`), or a release-date bound (\`<=2026\`, \`>=2021.05\`).
Without it, the release that flowR resolved for the analyzed script is used, so the signature you see is the one the analysis actually assumed.

Given a script such as:
${codeBlock('r', exampleCode)}

we can inspect the signature of the function it calls:

${await showQuery(shell, exampleCode, [{ type: 'signature', package: 'dplyr', function: 'lead' }], { showCode: false, collapseResult: true, ctx })}

The \`parameters\` and \`requiredParameters\` properties additionally filter by the _shape_ of a function, which is useful to find
functions you only half-remember: \`{ package: '*', parameters: ['data', 'mapping'] }\` finds every known function taking both of these.

${
	block({
		type:    'NOTE',
		content: `The results depend on which database shards are mounted; with none available the query reports that no database is loaded rather than failing.
See the ${ctx.linkPage('wiki/Signature Database')} page for the storage format, the configuration under ${ctx.linkConfig('solver.sigdb', true)}, and how to obtain further shards.
To find out what a script _uses_, reach for the ${linkToQueryOfName('dependencies')}; to find out which versions it is compatible with, see the ${linkToQueryOfName('guess-dep-versions')}.`
	})
}
		`;
	}
});

/** Pins the R version so this page reports the same bounds, whatever R the machine regenerating it has. */
function guessDepVersionsExampleOptions(ctx: GeneralDocContext): ShowQueryOptions {
	return {
		showCode:       false,
		collapseResult: true,
		ctx,
		prepare:        b => b.configure('solver.sigdb.assumedRVersion', DefaultAssumedRVersion)
	};
}

registerQueryDocumentation('guess-dep-versions', {
	type:             'active',
	shortDescription: 'Guesses the version range each dependency must have, from declared constraints and actual code usage.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const exampleCode = 'library(dplyr)\nmutate(mtcars, across(everything(), round))';
		return `
A script rarely says which version of a package it needs, but it shows you. If it passes an argument that a function only
gained in some release, it cannot run on anything older. This query turns that observation into a concrete version range per dependency.

It combines two sources of evidence:

1. what the project **declares**: a \`DESCRIPTION\` range, an \`rproject.toml\` entry, a lockfile pin, and everything these imply transitively, and
2. what the code **does**: which package functions it calls and with which arguments, matched against the ${ctx.linkPage('wiki/Signature Database', 'signature database')}.

Every resulting bound carries its provenance, so the answer explains itself: each entry lists the \`evidence\` that produced it,
naming the function, the parameter, and the bound it implies.

Two things can raise a lower bound: calling a function that did not exist yet, or passing an argument that the
function only gained later. Consider a script calling \`dplyr::across\`:
${codeBlock('r', exampleCode)}

\`across\` was only introduced in dplyr 1.0.0, so the script cannot run on anything older. The result names the function
that produced the bound:

${await showQuery(shell, exampleCode, [{ type: 'guess-dep-versions' }], guessDepVersionsExampleOptions(ctx))}

The guess can be narrowed further:

* \`packages\` restricts it to the dependencies you care about,
* \`date\` caps every guess to releases available at that point in time (\`YYYY.MM.DD\`, also \`YYYY\` or \`YYYY.MM\`),
* \`clean\` ignores the declared constraints entirely and guesses purely from usage,
* \`disabled\` excludes individual evidence sources by name (repl: \`--disabled\` followed by their one-letter codes shown in the legend below, e.g. \`--disabled ds\` drops \`declared\` and \`signature\`),
* \`maxCandidates\` caps how many candidate versions are listed per dependency,
* \`maxIterations\` bounds the two fixpoint loops (packages constrain each other, so the guess is iterated until it settles), and
* \`explode\` additionally enumerates concrete version _combinations_ (\`order\`, \`prefer\`, and \`limit\` control which and how many).

Packages can also be tied to one shared version (the base/R packages always are), and ${ctx.linkConfig('solver.versionManagement.linkedVersionGroups', true)}
declares further groups. Such a package reports its partners in \`linkedWith\`, because its range is then no longer independent of theirs.

What one dependency requires of another (\`transitive\` evidence) is read from *every* version of it still in play:

* all of them require it: the guess is narrowed, by the weakest of their bounds,
* only some do: the evidence carries \`partial: true\` and never narrows, as another version avoids it.

A partial requirement still ties the two together. \`A 0.2.5\` needing \`B 0.2.1\` and \`A 0.3.0\` needing \`B 0.3.2\`
shrinks neither range, yet the versions are not free. Each package lists its \`coupledWith\` partners, and
\`runnableCombinations\` counts the tuples those couplings admit, against the plain product \`possibleCombinations\`
and, where the project declares constraints, against \`declaredCombinations\` (what those alone leave, so the share
says how much the guess added).

${
	block({
		type:    'NOTE',
		content: `This query needs the ${ctx.linkPage('wiki/Signature Database', 'signature database')}, and specifically a database carrying the _history_ of a package,
since bounding a version means comparing releases. Without one it returns no guesses and says so in its \`message\`.
See the ${linkToQueryOfName('signature')} to inspect the signatures the guess is drawn from.`
	})
}
		`;
	}
});

registerQueryDocumentation('code-clones', {
	type:             'active',
	shortDescription: 'Finds code clones in all analyzed files with a configurable selection of AST, token, and fingerprint based algorithms.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		const example = `normalize <- function(v) {
  m <- mean(v)
  (v - m) / sd(v)
}
scale_it <- function(values) {
  mu <- mean(values)
  (values - mu) / sd(values)
}`;
		return `
This query reports pairs of code fragments that are clones of each other, that is, code that was copied and possibly
adapted. It runs over all files of the analysis, for example a whole folder or package, with three published algorithms:

| algorithm | compares | after |
|-----------|----------|-------|
| \`baxter\` | all AST subtrees above a mass threshold, hashed by structure (ignoring identifiers and constants) and compared with \`2S / (2S + L + R)\` | Baxter et al., [Clone Detection Using Abstract Syntax Trees](https://doi.org/10.1109/ICSM.1998.738528), ICSM 1998 |
| \`gst\` | the token strings of functions or files with Greedy String Tiling | as in [JPlag](https://github.com/jplag/JPlag), see Prechelt et al., [Finding Plagiarisms among a Set of Programs with JPlag](https://doi.org/10.3217/jucs-008-11-1016), 2002 |
| \`winnowing\` | k-gram fingerprints selected by robust winnowing, reported with the matched passages | Schleimer et al., [Winnowing: Local Algorithms for Document Fingerprinting](https://doi.org/10.1145/872757.872770), SIGMOD 2003, the algorithm behind MOSS |

Before the detection, the query presents the code in one of three \`perspective\`s:

- \`syntax\` shows the code as written.
- \`canonical\` (the default) rewrites syntactic sugar and newer R features into one core form. Pipes become calls, \`\\(x)\` becomes \`function(x)\`, right and equal assignments become \`<-\`, \`(e)\` and \`{e}\` become \`e\`, \`x[["a"]]\` becomes \`x$a\`, \`T\` and \`F\` become \`TRUE\` and \`FALSE\`, and a tail \`return(e)\` becomes \`e\`. Every rewritten node keeps the id of the node it stems from, so all findings point to the original source.
- \`dataflow\` additionally inlines temporaries that are used exactly once along the ${ctx.linkPage('wiki/Dataflow Graph', 'dataflow graph')}, so \`t <- f(x)\` followed by \`g(t)\` looks like \`g(f(x))\`. It only inlines where this cannot change what the code computes, and it is the only perspective that needs the dataflow analysis.

With \`exportIndex\`, the query also returns the clone index of the analyzed files (their normalized ASTs).
A later query can pass such indices as \`against\` to search new code in a corpus of pre-analyzed projects without analyzing them again.
Use \`config\` to tune the thresholds of each algorithm, and \`maxPairs\` to limit the number of reported pairs, as \`n\` copies of the same function already form \`n(n-1)/2\` pairs.

${await showQuery(shell, example, [{ type: 'code-clones', algorithms: [CloneAlgorithm.Gst, CloneAlgorithm.Winnowing] }], { showCode: true, collapseResult: true, ctx })}

In code, passing the query on its own to ${ctx.linkM(FlowrAnalyzer, 'query')} returns its result directly:

${codeBlock('typescript', `const { pairs } = await analyzer.query({ type: 'code-clones', algorithms: ['gst', 'winnowing'] });
for(const { algorithm, similarity, a, b } of pairs) {
	console.log(\`\${algorithm} (\${similarity.toFixed(2)}): \${a.name ?? a.file} ~ \${b.name ?? b.file}\`);
}`)}

${
	block({
		type:    'NOTE',
		content: `The ${ctx.linkPage('wiki/Linter', 'linter')} offers the same detection as its \`code-clones\` rule, which is not active by default. In the REPL, \`:query @code-clones gst winnowing <code>\` runs the query with the given algorithms.`
	})
}
`;
	}
});

registerQueryDocumentation('function-info', {
	type:             'active',
	shortDescription: 'Reports where a function name comes from: which packages export it, their signature, and whether flowR itself has a built-in definition for it.',
	buildExplanation: async(shell: RShell, ctx: GeneralDocContext) => {
		return `
This query answers "where does this function come from?" for a bare name, combining two sources flowR otherwise
consults separately: the ${ctx.linkPage('wiki/Signature Database', 'signature database')} (which packages export
the name, and their signature/definition site) and flowR's own built-in configuration (whether flowR models the
name itself, and how).

Given a base-R name such as \`sd\`:

${await showQuery(shell, '', [{ type: 'function-info', name: 'sd' }], { showCode: false, collapseResult: true, ctx })}

The \`packages\` property restricts which packages are considered (every exporting package is checked by default),
which is useful once a name is exported by more than one package on CRAN. A name flowR models itself, like \`get\`,
also reports the built-in's processor, its evaluation handler (if it folds to a constant), and the semantic tags
flowR states for it:

${await showQuery(shell, '', [{ type: 'function-info', name: 'get' }], { showCode: false, collapseResult: true, ctx })}

${
	block({
		type:    'NOTE',
		content: `To find out what a script _uses_, reach for the ${linkToQueryOfName('dependencies')}; to inspect a specific
package/version in the database directly, reach for the ${linkToQueryOfName('signature')}. In the REPL, \`:signature info <name>\` is a shorthand for this query.`
	})
}
		`;
	}
});

/**
 * https://github.com/flowr-analysis/flowr/wiki/Query-API
 */
export class WikiQuery extends DocMaker<'wiki/Query API.md'> {
	constructor() {
		super('wiki/Query API.md', module.filename, 'query API');
	}

	protected async text({ ctx, shell }: DocMakerArgs): Promise<string> {
		assertAllQueriesDocumented();
		/* the signature query documented here answers from the database, so its examples need one */
		warnMissingSigDb(this.getTarget());
		for(const [file, content] of Object.entries({
			...await queryPages(shell, ctx, 'active'),
			...await queryPages(shell, ctx, 'virtual')
		})) {
			this.writeSubFile(file, content);
		}
		return `
This page briefly summarizes flowR's query API, represented by the ${executeQueries.name} function in ${getFilePathMd('../queries/query.ts')}.
Please see the ${ctx.linkPage('wiki/Interface')} wiki page for more information on how to access this API.
In code, you run queries with ${ctx.linkM(FlowrAnalyzer, 'query')}.
Pass it a single query object, and it answers with the result of that query directly, which is the most common case and also the fastest, as there is nothing to group.
For queries that report one entry per query (e.g., the ${linkToQueryOfName('static-slice')}), the result is just that entry.
A failing single query throws an error.

${codeBlock('ts', 'const { slice, reconstruct } = await analyzer.query({ type: \'static-slice\', criteria: [\'3@x\'] });')}

Pass it a list of queries, and it answers with a record of the results by query type.
Queries of the same type run together, and a failing query type is reported as an error without affecting the others:

${codeBlock('ts', 'const results = await analyzer.query([{ type: \'id-map\' }, { type: \'dataflow\' }]);\nconst graph = results.dataflow.graph;')}

${
	block({
		type:    'NOTE',
		content: `
There are many ways to query a dataflow graph created by flowR.
For example, you can use the ${ctx.linkPage('wiki/Interface', '`request-query`', 'message-request-query')} message
with a running flowR server, or the ${getReplCommand('query')} command in the flowR ${ctx.linkPage('wiki/Interface', 'REPL', '-using-the-repl')}.

Also, check out the [${FlowrGithubGroupName}/sample-analyzer-project-query](${FlowrGithubBaseRef}/sample-analyzer-project-query) repository for a complete example project using the query API.
			`.trim()
	})
}

## The Query Format

Queries are JSON arrays of query objects, each of which uses a \`type\` property to specify the query type.
In general, we separate two types of queries:

1. **Active Queries**: Are exactly what you would expect from a query (e.g., the ${linkToQueryOfName('call-context')}). They fetch information from the dataflow graph.
2. **Virtual Queries**: Are used to structure your queries (e.g., the ${linkToQueryOfName('compound')}).

We support the following **active** queries (which we refer to as a \`query\`):

${tocForQueryType('active')}

Similarly, we support the following **virtual** queries: 

${tocForQueryType('virtual')}

<details>


<summary>Detailed Query Format (Automatically Generated)</summary>

The schema of the query format:

${describeSchema(QueriesSchema(), markdownFormatter)}

</details>

### Why Queries?

First, consider that you have a file like the following (a simple, artificial example):

\`\`\`r
${exampleQueryCode}
\`\`\`

<details> <summary>Dataflow Graph of the Example</summary>

${await printDfGraphForCode(shell, exampleQueryCode, { showCode: false, ctx })}

</details>

&nbsp;

Additionally, consider that you are interested in all function calls which loads data with \`read_csv\`.
A simple \`regex\`-based query could look like this: \`^read_csv$\`.
However, this fails to incorporate
 
1. Syntax-based information (comments, strings, used as a variable, called as a higher-order function, ...)
2. Semantic information (e.g., \`read_csv\` is overwritten by a function with the same name)
3. Context information (e.g., calls like \`points\` may link to the current plot)

To solve this, flowR provides a query API which allows you to specify queries on the dataflow graph.
For the specific use-case stated, you could use the ${linkToQueryOfName('call-context')} to find all calls to \`read_csv\` which refer functions that are not overwritten.

Just as an example, the following ${linkToQueryOfName('call-context')} finds all calls to \`read_csv\` that are not overwritten:

${await showQuery(shell, exampleQueryCode, [{ type: 'call-context', callName: '^read_csv$', callTargets: CallTargets.OnlyGlobal, kind: 'input', subkind: 'csv-file' }], { showCode: false, ctx })}

Every query is explained in detail on its own wiki page, linked from the overviews above.
`;
	}
}
