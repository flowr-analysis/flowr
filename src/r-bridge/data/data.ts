import type { FlowrCapabilities } from './types';
import { FlowrWikiBaseRef, flowrSourceFileUrl } from '../../documentation/doc-util/doc-files';
import { codeBlock } from '../../documentation/doc-util/doc-code';
import { printDfGraphForCode } from '../../documentation/doc-util/doc-dfg';
import { MIN_VERSION_LAMBDA, MIN_VERSION_PIPE, MIN_VERSION_PIPE_BIND, MIN_VERSION_RAW_STABLE } from '../lang-4.x/ast/model/versions';

const Joiner = '/';
const AdvancedR = (subname: string, page: string) => ({ name: 'Advanced R' + Joiner + subname, href: 'https://adv-r.hadley.nz/' + page });
const RLang = (subname: string, anchor = subname.replaceAll(' ', '-')) => ({ name: 'R Definition' + Joiner + subname, href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#' + anchor });
const LinkTo = (id: string, label = id) => `[${label}](#${id})`;
const Wiki = (page: string, label: string) => `[${label}](${FlowrWikiBaseRef}/${page.replaceAll(' ', '-')})`;
const Plugin = (path: string) => ({ name: `plugin/${path.replace(/^.*\//, '').replace(/\.ts$/, '').replace(/^flowr-/, '').replace(/-plugin$/, '')}`, href: flowrSourceFileUrl(path) });

export const flowrCapabilities = {
	name:         'Capabilities of flowR',
	description:  'This is an evolving representation of what started with #636 to formulate capabilities in a structured format.',
	version:      '0.0.2',
	capabilities: [
		{
			name:        'Names and Identifiers',
			id:          'names-and-identifiers',
			description: `Every name an R program writes down, the ${LinkTo('form', 'form')} it is written in, and the ${LinkTo('resolution', 'binding')} it resolves to.`,
			example:     async parser => {
				const code = '"f" <- function(x) { get("x") } \n`y x` <- 2\nprint(`y x` + f(3))';
				return `
Consider the following R code:
${codeBlock('r', code)}
Identifiers of interest are:

- The symbols \`x\` (${LinkTo('name-normal')}), \`f\` (${LinkTo('name-quoted')}), and \`\` \`y x\` \`\` (${LinkTo('name-escaped')}).
- The function calls \`<-\`, \`function\`, \`{\`, \`get\`, \`+\`, and \`print\` (${LinkTo('function-calls')}, all given with ${LinkTo('name-normal')}).
  Especially \`{\` is identified as a ${LinkTo('grouping')} of the ${LinkTo('function-definitions', 'function-definitions\'')} body.
- The quoted name created by a function call \`get\` (${LinkTo('name-created')}).

Besides the parameter \`x\`, which is resolved in its ${LinkTo('lexicographic-scope')}, the other identifiers are resolved in the ${LinkTo('global-scope')}.

${await printDfGraphForCode(parser, code, { simplified: true, timeless: true })}
			`;
			},
			capabilities: [
				{
					name:         'Form',
					id:           'form',
					description:  `A name is written plainly, ${LinkTo('name-quoted', 'as a string')}, ${LinkTo('name-escaped', 'in backticks')}, or ${LinkTo('name-created', 'as the argument of a call')} that reads it as one.`,
					capabilities: [
						{
							name:        'Normal',
							id:          'name-normal',
							supported:   'fully',
							description: `_A name written as R's grammar allows it, like \`a\` or \`plot\`._ Every other form ends up as one of these, and a ${LinkTo('resolution', 'lookup')} links it to the definitions that may reach it.`,
							url:         [AdvancedR('Bindings', 'names-values.html#binding-basics'), RLang('Identifiers', 'Identifiers-1')]
						},
						{
							name:        'Quoted',
							id:          'name-quoted',
							supported:   'fully',
							description: `_A name given as a string, like \`"a"\` or \`'plot'\`._ Such a name may hold spaces, but R accepts the quotes only where it is defined, so reading it back needs ${LinkTo('name-escaped', 'backticks')} or a ${LinkTo('name-created', 'name-creating call')}.`,
							example:     codeBlock('r', '"my fn" <- function(x) x\n`my fn`(3)\nget("my fn")(3)'),
							url:         [AdvancedR('Non-Syntactic Names', 'names-values.html#non-syntactic')]
						},
						{
							name:        'Escaped',
							id:          'name-escaped',
							supported:   'fully',
							description: `_A name escaped in backticks, like \`\` \`a\` \`\` or \`\` \`my var\` \`\`._ It binds and resolves like a ${LinkTo('name-normal', 'normal name')}, the syntax only lifts the grammar's restriction on the characters it may hold.`,
							example:     codeBlock('r', '`my var` <- 1\n`my var` + 1'),
							url:         [AdvancedR('Non-Syntactic Names', 'names-values.html#non-syntactic')]
						},
						{
							name:        'Created',
							id:          'name-created',
							code:        ['get', 'get0', 'mget', 'exists', 'match.fun'],
							supported:   'fully',
							description: `_A call that reads a string argument as the name it spells, such as \`get\`, \`get0\`, \`mget\`, \`exists\`, \`match.fun\`, and \`assign\`._ The string counts as a use of that name, or for \`assign\` as a ${LinkTo('assignment-functions', 'definition')}. A name only known at runtime (\`get(Sys.getenv("V"))\`) is not linked.`,
							example:     codeBlock('r', 'x <- 1\nr <- get("x")\nprint(r)'),
							url:         [RLang('Identifiers', 'Identifiers-1')]
						},
						{
							name:        'Resolved Name',
							id:          'name-created-resolved',
							code:        ['paste0', 'paste', 'file.path'],
							supported:   'fully',
							description: `_A ${LinkTo('name-created', 'created name')} whose string argument is not a literal but folds to one._ Covers ${LinkTo('strings', 'string literals')}, variables holding one, and \`paste0\`/\`paste\`/\`file.path\` over constants, each followed like a written-out name.`,
							example:     codeBlock('r', 'nm <- paste0("x", 1)\nassign(nm, 42)\nget(nm)'),
							url:         [RLang('Identifiers', 'Identifiers-1')]
						}
					]
				},
				{
					name:         'Resolution',
					id:           'resolution',
					description:  `Which definitions a name may reach, through the ${LinkTo('lexicographic-scope', 'scopes')} around it, the ${LinkTo('dynamic-environment-resolution', 'environments')} a program builds, and the ${LinkTo('search-path', 'packages')} below them.`,
					capabilities: [
						{
							name:        'Global Scope',
							id:          'global-scope',
							code:        ['globalenv'],
							supported:   'fully',
							description: `_Resolve a name against the bindings of the global environment, whenever no enclosing ${LinkTo('function-definitions', 'function definition')} binds it._ Every top-level definition that may still be active is linked, so a use after an \`if\` reaches both branches' definitions.`,
							example:     codeBlock('r', 'x <- 1\nf <- function() x\nf()'),
							url:         [RLang('Global environment')]
						},
						{
							name:        'Lexicographic Scope',
							id:          'lexicographic-scope',
							supported:   'fully',
							description: `_Resolve a name to the innermost enclosing definition, and only to the ${LinkTo('global-scope', 'global scope')} when no enclosing one binds it._ Where a ${LinkTo('function-definitions', 'function')} is written decides what its body sees, not where it is called.`,
							example:     codeBlock('r', 'f <- function() {\n  y <- 1\n  g <- function() y\n  g()\n}\nf()'),
							url:         [RLang('Lexical environment'), AdvancedR('Lexical scoping', 'functions.html#lexical-scoping')]
						},
						{
							name:        'Closures',
							id:          'closures',
							supported:   'partially',
							description: `_Two closures from the same factory keep independent state in R, as every call of the factory makes an environment of its own._ We keep one environment per ${LinkTo('function-definitions', 'definition')} instead, so a \`<<-\` in one closure is read as reaching the binding the other captured.`,
							example:     codeBlock('r', 'counter <- function() {\n  i <- 0\n  function() {\n    i <<- i + 1\n    i\n  }\n}\nc1 <- counter()\nc2 <- counter()\nc1()\nc1()\nr <- c2()\nprint(r)'),
							url:         [AdvancedR('Function factories', 'function-factories.html'), RLang('Scope of variables')]
						},
						{
							name:        'Closure Capture',
							id:          'closure-capture',
							supported:   'fully',
							description: '_A function captures the environment it was defined in, not the values that were in it._ So it sees a write made to that environment after its definition, a sibling closure\'s `<<-` included.',
							example:     codeBlock('r', 'make <- function() {\n  x <- 1\n  list(get = function() x, set = function(v) x <<- v)\n}\no <- make()\no$set(5)\nr <- o$get()\nprint(r)'),
							url:         [AdvancedR('Function factories', 'function-factories.html'), RLang('Scope of variables')]
						},
						{
							name:         'Dynamic Environment Resolution',
							id:           'dynamic-environment-resolution',
							code:         ['new.env'],
							description:  `_An environment a program builds and names itself, rather than one a ${LinkTo('function-definitions', 'definition')} opens._ Covers \`new.env\`, \`assign\`/\`get\`/\`local\` with \`envir=\`, \`e$x\`, \`attach\`, \`with\`, and aliasing such an environment through a variable.`,
							example:      codeBlock('r', 'e <- new.env()\nassign("x", 3, envir = e)\nget("x", envir = e) + e$x'),
							capabilities: [
								{
									name:        'Environment in Control Flow',
									id:          'environment-in-control-flow',
									supported:   'fully',
									description: '_Track environment assignments and reads across branches and loop bodies, a key built at run time such as `paste0("k", i)` included._'
								},
								{
									name:        'Environment Parent',
									id:          'environment-parent',
									supported:   'partially',
									description: '_Specifying a parent for a newly-created environment from a dynamic or unknown expression (`new.env(parent = f())`)._ Such a parent falls back to the default (`parent.frame()`) instead of resolving.',
									url:         [AdvancedR('Parents', 'environments.html#parents')]
								},
								{
									name:        'Environment Parent (Tracked)',
									id:          'environment-parent-tracked',
									supported:   'fully',
									description: '_Specifying a parent for a newly-created environment from a tracked environment variable or a constant (`new.env(parent = e)`, `new.env(parent = emptyenv())`)._',
									url:         [AdvancedR('Parents', 'environments.html#parents')]
								},
								{
									name:        'Environment Alias',
									id:          'environment-alias',
									supported:   'partially',
									description: `_Aliasing a tracked environment variable (\`alias <- e\`), which binds a second name to the same environment rather than a copy._ A write to the original made after the alias is not reflected through it, unlike a ${LinkTo('environment-alias-read', 'read')}.`
								},
								{
									name:        'Environment Alias Read',
									id:          'environment-alias-read',
									supported:   'fully',
									description: '_Reading through an aliased tracked environment variable (`alias <- e`)._ Every assign made up to the alias is visible through it.'
								},
								{
									name:        'With',
									id:          'environment-with',
									code:        ['with'],
									supported:   'fully',
									description: '_Evaluating an expression inside a named environment with `with(data, expr)`._ Reads of names the tracked env defines resolve, including through a computed `data` argument or a nested call.'
								},
								{
									name:        'Parent Frame',
									id:          'parent-frame',
									code:        ['parent.frame'],
									supported:   'partially',
									description: '_Reading via `parent.frame()$name`, and a write escaping through `eval.parent(quote(name <- value))`._ Works only one call away, and storing the frame first drops the binding.',
									url:         [AdvancedR('Call stacks', 'environments.html#call-stack')]
								},
								{
									name:        'Dynamic Variable Removal',
									id:          'dynamic-variable-removal',
									code:        ['rm', 'sys.frame'],
									supported:   'partially',
									description: '_Support for `rm(list=..., envir=sys.frame(N))` removing variables from a specific call frame. Currently handles negative and zero offsets from within depth-1 functions._'
								}
							],
							url: [RLang('Environment objects')]
						},
						{
							name:        'Environment Sharing',
							id:          'environment-sharing',
							supported:   'partially',
							description: `_Handling side-effects through environments, which act as reference types and are not copied when modified._ A write through a parameter is kept as an unknown side effect of the call (see ${LinkTo('environment-alias')} and ${LinkTo('side-effects-in-function-call')}).`,
							example:     codeBlock('r', 'e <- new.env()\nassign("x", 42, envir = e)\nprint(get("x", envir = e))'),
							url:         [RLang('Environment objects'), AdvancedR('Environments', 'environments.html')]
						},
						{
							name:        'Search Type',
							id:          'search-type',
							supported:   'fully',
							description: `_Resolve a name in call position only against function definitions, a name in value position against every binding._ This is why the \`c <- 1\` below does not shadow the ${LinkTo('call-normal', 'call')} to \`c\`.`,
							example:     codeBlock('r', 'c <- 1\nc(c, 2)'),
							url:         [AdvancedR('Functions versus variables', 'functions.html#functions-versus-variables')]
						},
						{
							name:        'Search Path',
							id:          'search-path',
							code:        ['attach'],
							supported:   'fully',
							description: `_Resolve a name against the packages [the search path](https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Search-path) holds, whenever no scope in the script binds it._ Attached packages sit below \`.GlobalEnv\`, so a ${LinkTo('global-scope', 'global binding')} shadows an export.`,
							example:     codeBlock('r', 'library(dplyr)\nfilter <- function(...) "mine"\nfilter(1)'),
							url:         [RLang('Search path'), AdvancedR('Search path', 'environments.html#search-path')]
						},
						{
							name:        'Dynamic Search Path',
							id:          'dynamic-search-path',
							code:        ['search', 'searchpaths'],
							supported:   'not',
							description: '_Programmatically inspecting or mutating the search path with `search()`, `searchpaths()`, or detaching by position._ None of this is modelled, and `search()` reads as an unknown call.',
							example:     codeBlock('r', 'library(stats)\nn <- search()\nprint(n[2])'),
							url:         [RLang('Search path')]
						},
						{
							name:        'Namespaces',
							id:          'namespaces',
							supported:   'partially',
							description: `_Separate what a package's namespace holds from what attaching it puts on the ${LinkTo('search-path', 'search path')}._ The imports environment a package carries for itself is not modelled.`,
							url:         [AdvancedR('Namespaces', 'environments.html#namespaces')]
						},
						{
							name:        'Accessing Exported Names',
							id:          'accessing-exported-names',
							code:        ['::'],
							supported:   'fully',
							description: `_Resolve a name written \`pkg::name\` to the export it names, no matter what the script binds._ This depends on what the ${Wiki('Signature Database', 'signature database')} knows, and an unresolved name stays unresolved rather than reported.`,
							example:     codeBlock('r', 'median <- function(x) 0\nmedian(1:3)\nstats::median(1:3)'),
							url:         [AdvancedR('Namespaces', 'environments.html#namespaces')]
						},
						{
							name:        'Accessing Internal Names',
							id:          'accessing-internal-names',
							code:        [':::'],
							supported:   'fully',
							description: `_Resolve a name written \`pkg:::name\`, which reaches what the namespace keeps to itself._ Whether the name is genuinely internal rather than exported is not checked (see ${LinkTo('namespace-exports')}).`,
							example:     codeBlock('r', '"C_cor" %in% getNamespaceExports("stats")\nstats:::C_cor$name'),
							url:         [AdvancedR('Namespaces', 'environments.html#namespaces')]
						},
						{
							name:        'Namespace Exports',
							id:          'namespace-exports',
							code:        ['getNamespaceExports'],
							supported:   'fully',
							description: `_Know which names a package's namespace declares exported versus keeps internal._ The ${Wiki('Linter', '`namespace-access` rule')} checks a \`::\`/\`:::\` choice against what the ${Wiki('Signature Database', 'signature database')} records, which omits most internal names to stay small.`,
							example:     codeBlock('r', 'stats::median(1:3)\nstats:::C_cor'),
							url:         [{ name: 'Writing R Extensions/Package namespaces', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Package-namespaces' }]
						},
						{
							name:        'Library Loading',
							id:          'library-loading',
							code:        ['library', 'require', 'attachNamespace', 'loadNamespace'],
							supported:   'fully',
							description: `_Attach a package named by \`library\`, \`require\`, \`attachNamespace\`, ... to the ${LinkTo('search-path', 'search path')}._ From that point on an unbound name may resolve to one of its exports, while a binding in the script still shadows it.`,
							example:     codeBlock('r', 'library(stats)\nrequire(utils)\nattachNamespace("tools")'),
							url:         [RLang('Search path'), AdvancedR('Search path', 'environments.html#search-path')]
						},
						{
							name:        'Library Unloading',
							id:          'library-unloading',
							code:        ['detach', 'unloadNamespace'],
							supported:   'not',
							description: `_Undo a ${LinkTo('library-loading', 'library attach')} with \`detach\`, \`unloadNamespace\`, ..._ Neither is modelled, so a name used after \`detach\` still resolves to the package's export.`,
							example:     codeBlock('r', 'library(stats)\nmedian(1:3)\ndetach("package:stats")\nmedian(1:3)'),
							url:         [RLang('Search path')]
						},
						{
							name:        'Dynamic Scope Changes',
							id:          'dynamic-scope-changes',
							code:        ['local'],
							supported:   'fully',
							description: `_Open a scope of its own with a plain [\`local\`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/local) block._ A name it binds is invisible outside, while a ${LinkTo('super-left-assignment', 'super assignment')} from within reaches the enclosing scope.`,
							example:     codeBlock('r', 'x <- 1\nlocal({\n  x <- 2\n  x\n})\nx')
						},
						{
							name:        'Local with Explicit Environment',
							id:          'local-envir-argument',
							supported:   'partially',
							description: '_Send `local`\'s body to a specific environment._ `new.env()` and `globalenv()` work, but inside a function that already binds the name the write lands in that frame instead.',
							example:     codeBlock('r', 'e <- new.env()\nlocal(y <- 2, envir = e)\nget("y", envir = e)'),
							url:         [{ name: '`local`', href: 'https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/local' }]
						},
						{
							name:        'Anonymous Bindings',
							id:          'anonymous-bindings',
							code:        ['Recall'],
							supported:   'fully',
							description: `_Resolve a call that does not name the function it runs, as [\`Recall\`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/Recall) does._ It is linked to the enclosing ${LinkTo('function-definitions', 'function definition')}, the same way a call through the function's own name ${LinkTo('recursion', 'is')}.`,
							example:     codeBlock('r', 'fact <- function(n) if(n <= 1) 1 else n * Recall(n - 1)\nfact(5)')
						}
					]
				}
			]
		},
		{
			name:         'Expressions',
			id:           'expressions',
			description:  `The ${LinkTo('function-calls', 'calls')}, ${LinkTo('operators', 'operators')}, ${LinkTo('control-flow', 'control flow')}, and ${LinkTo('function-definitions', 'function definitions')} an R program is built from.`,
			capabilities: [
				{
					name:         'Calls',
					id:           'function-calls',
					description:  `Everything that is a call in R, from \`f(x)\` over ${LinkTo('infix-calls', 'an operator')} to a ${LinkTo('grouping', 'group')}, with the ${LinkTo('resolve-arguments', 'arguments')} it binds and the ${LinkTo('side-effects-in-function-call', 'side effects')} it may have.`,
					capabilities: [
						{
							name:        'Grouping',
							id:          'grouping',
							supported:   'fully',
							description: `_Read \`(\` and \`{\` as the calls they are, mapped to their primitive implementations._ A group hands on the value of its last expression, so \`x <- { 1; 2 }\` binds \`x\` to \`2\`, and ${LinkTo('redefinition-of-built-in-functions-primitives', 'redefining')} \`\` \`{\` \`\` replaces that meaning.`,
							example:     codeBlock('r', 'x <- {\n  1\n  2\n}\ny <- (3)'),
							url:         [RLang('Grouping')]
						},
						{
							name:         'Normal Call',
							id:           'call-normal',
							supported:    'fully',
							description:  `_Link a call like \`f(x)\` or \`foo::bar(x, y)\` to the ${LinkTo('function-definitions', 'definitions')} its name may resolve to, and its arguments to the formals they bind._ Every definition that may be active is linked, which over-approximates rather than picking one.`,
							capabilities: [
								{
									name:        'Unnamed Arguments',
									id:          'unnamed-arguments',
									supported:   'fully',
									description: `_An argument given without a name, like \`f(3)\`, which binds to a formal by position._ It is matched after every ${LinkTo('named-arguments', 'named argument')} has taken its formal.`,
									url:         [RLang('Arguments')]
								},
								{
									name:        'Empty Arguments',
									id:          'empty-arguments',
									supported:   'fully',
									description: `_An argument left out entirely, as the second one in \`foo::bar(3, ,42)\`._ It still takes a position, which is what makes \`m[1, ]\` an ${LinkTo('index-access', 'index access')} on one dimension.`,
									example:     codeBlock('r', 'm <- matrix(1:6, nrow = 2)\nm[1, ]\nm[, 2]'),
									url:         [RLang('Arguments')]
								},
								{
									name:        'Named Arguments',
									id:          'named-arguments',
									supported:   'fully',
									description: `_An argument given with a name, like \`f(x = 3)\`, which binds to the formal of that name._ Inside a call \`=\` names an argument rather than ${LinkTo('local-equal-assignment', 'binding a name')}.`,
									url:         [RLang('Argument matching')]
								},
								{
									name:        'String Arguments',
									id:          'string-arguments',
									supported:   'fully',
									description: `_An argument whose name is written as a string, like \`f('x' = 3)\`._ It binds the same formal a ${LinkTo('named-arguments', 'named argument')} would, the way a ${LinkTo('name-quoted', 'quoted name')} binds an ordinary one.`
								},
								{
									name:        'Resolve Arguments',
									id:          'resolve-arguments',
									supported:   'fully',
									description: `_Match every argument of a call to the formal it binds, exact names first, then unique prefixes ([\`pmatch\`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/pmatch)), then ${LinkTo('unnamed-arguments', 'position')}._ A formal behind ${LinkTo('formals-dot-dot-dot', '`...`')} matches only exactly, and an ambiguous prefix binds nothing.`,
									example:     codeBlock('r', 'f <- function(verbose = FALSE, value = 0) c(verbose, value)\nf(TRUE, val = 3)\nf(verb = TRUE)'),
									url:         [RLang('Argument matching')]
								},
								{
									name:        'Side-Effects in Argument',
									id:          'side-effects-in-argument',
									supported:   'partially',
									description: `_An argument that binds a name while it is evaluated, as \`f(x <- 3)\` does._ Whether the argument is ever forced is not modelled (see ${LinkTo('formals-promises', 'promises')}), so \`f <- function(a) 1; f(x <- 3)\` still believes \`x\` is 3.`,
									example:     codeBlock('r', 'f <- function(a) a\nf(x <- 3)\nx'),
									url:         [RLang('Argument evaluation')]
								},
								{
									name:        'Side-Effects in Function Call',
									id:          'side-effects-in-function-call',
									supported:   'partially',
									description: `_A call that binds a name outside itself, as \`setXTo(3)\` does with a ${LinkTo('super-left-assignment', 'super assignment')}._ Such a write reaches the caller through several call levels, but one through a ${LinkTo('environment-sharing', 'shared environment')} is missed.`,
									example:     codeBlock('r', 'set_x <- function(v) x <<- v\nset_x(3)\nx'),
									url:         [AdvancedR('Super assignment', 'environments.html#super-assignment--')]
								}
							],
							url: [RLang('Function calls')]
						},
						{
							name:        'Recursion',
							id:          'recursion',
							supported:   'fully',
							description: `_A call to \`f\` inside the ${LinkTo('function-definitions', 'definition')} of \`f\`._ The name resolves to the definition it sits in, so the call links back to it rather than staying unresolved.`,
							example:     codeBlock('r', 'fib <- function(n) if(n < 2) n else fib(n - 1) + fib(n - 2)\nfib(10)')
						},
						{
							name:        'Anonymous Calls',
							id:          'call-anonymous',
							supported:   'fully',
							description: `_A call whose target is an expression rather than a name, like \`(function(x) x)(3)\` or \`factory(0)()\`._ It links to the ${LinkTo('function-definitions', 'definition')} that expression yields, without a name being involved.`,
							example:     codeBlock('r', '(function(x) x + 1)(3)\nfactory <- function() function() 42\nfactory()()'),
							url:         [AdvancedR('First-class functions', 'functions.html#first-class-functions')]
						},
						{
							name:        'Infix Calls',
							id:          'infix-calls',
							supported:   'fully',
							description: `_An operator written between its arguments, like \`x + y\` or \`x %>% f(y)\`._ It is the same ${LinkTo('call-normal', 'call')} as \`\` \`+\`(x, y) \`\`, which is why ${LinkTo('redefinition-of-built-in-functions-primitives', 'redefining the operator')} changes what it does.`,
							example:     codeBlock('r', 'identical(1 + 2, `+`(1, 2))'),
							url:         [RLang('Infix and prefix operators')]
						},
						{
							name:        'Redefinition of Built-In Functions/primitives',
							id:          'redefinition-of-built-in-functions-primitives',
							supported:   'fully',
							description: `_A name that R defines being bound in the program, as in \`print <- function(x) x\` or \`\` \`for\` <- function(a,b,c) a \`\`._ The redefinition wins wherever the built-in would have been used, respecting ${LinkTo('lexicographic-scope', 'scope')} and order. Only ${LinkTo('accessing-exported-names', '`::`/`:::`')} are exempt.`,
							example:     codeBlock('r', '`+` <- function(a, b) a * b\n2 + 3'),
							url:         [RLang('Builtin objects and special forms')]
						},
						{
							name:        'Functions with global side effects',
							id:          'functions-with-global-side-effects',
							supported:   'partially',
							description: `_A call that changes state the rest of the program reads without naming it, as \`setwd\` changes where a path points._ Only the ${LinkTo('working-directory', 'working directory')} is interpreted, while other ambient state such as ${LinkTo('built-in-options', 'the options')} stays an unknown side effect.`,
							example:     codeBlock('r', 'setwd("/tmp")\nread.csv("data.csv")')
						},
						{
							name:        'Working Directory',
							id:          'working-directory',
							code:        ['setwd', 'getwd'],
							supported:   'partially',
							description: '_Track the effective working directory across `setwd`, control-flow- and location-sensitive._ Interprocedural, sourced, and loop cases are treated as unbounded.'
						},
					]
				},
				{
					name:         'Index Access',
					id:           'index-access',
					description:  'The bracket, double-bracket, dollar, and slot forms for picking an element out of a container, with names, empty positions, and multiple indices.',
					capabilities: [
						{
							name:        'Single Bracket Access',
							id:          'single-bracket-access',
							code:        ['['],
							supported:   'fully',
							description: `_The \`[\` call, as in \`x[i]\`, \`x[i, ,b]\`, or \`x[3][y]\`._ The container is read as a whole without separating the cell an index picks, and writing through it is a ${LinkTo('replacement-functions', 'replacement call')}.`,
							example:     codeBlock('r', 'l <- list(a = 1, b = 2)\nl["a"]\nl[c("a", "b")]'),
							url:         [RLang('Indexing'), AdvancedR('Selecting multiple elements', 'subsetting.html#subset-multiple')]
						},
						{
							name:        'Double Bracket Access',
							id:          'double-bracket-access',
							code:        ['[['],
							supported:   'fully',
							description: `_The \`[[\` call, as in \`x[[i]]\` or \`x[[i, b]]\`._ Read like ${LinkTo('single-bracket-access', 'single-bracket access')}, without modelling the difference in what R returns.`,
							example:     codeBlock('r', 'l <- list(a = 1, b = 2)\nl[["a"]]\nl[[2]]'),
							url:         [RLang('Indexing'), AdvancedR('Selecting a single element', 'subsetting.html#subset-single')]
						},
						{
							name:        'Dollar Access',
							id:          'dollar-access',
							code:        ['$'],
							supported:   'fully',
							description: '_The `$` call, as in `x$y`, `x$"y"`, or `x$y$z`, whose right side is a name rather than a value._ On a list `$` matches that name partially, so `l$al` reaches an element named `alpha`.',
							example:     codeBlock('r', 'l <- list(alpha = 1)\nl$alpha\nl$al'),
							url:         [RLang('Operators')]
						},
						{
							name:        'Slot Access',
							id:          'slot-access',
							code:        ['@'],
							supported:   'fully',
							description: `_The \`@\` call, which reads a slot of an ${LinkTo('oop-s4', 'S4')} object._ The slot name is read like any other access, without checking it against the class \`setClass\` declared.`,
							example:     codeBlock('r', 'setClass("P", representation(x = "numeric"))\np <- new("P", x = 1)\np@x'),
							url:         [RLang('Classes')]
						},
						{
							name:        'Access with Argument-Names',
							id:          'access-with-argument-names',
							supported:   'fully',
							description: `_An index given with a name, as in \`x[i = 3]\` or \`x[[i=]]\`._ It is matched like any other ${LinkTo('named-arguments', 'named argument')} of the underlying \`[\` call.`
						},
						{
							name:        'Access with Empty',
							id:          'access-with-empty',
							supported:   'fully',
							description: `_An index left out, as in \`x[]\` or \`x[2,,42]\`._ The gap is an ${LinkTo('empty-arguments', 'empty argument')} and still counts as a position.`
						},
						{
							name:        'Subsetting (Multiple Indices)',
							id:          'subsetting-multiple',
							supported:   'fully',
							description: `_An index that is a vector or a condition, as in \`x[i > 3]\` or \`x[c(1,3)]\`._ The index expression is read, but which elements it selects stays unknown, as ${LinkTo('vectorized-operator-or-functions', 'vectorized operations')} are not evaluated.`,
							example:     codeBlock('r', 'v <- c(a = 1, b = 2, c = 3)\nv[c(1, 3)]\nv[v > 1]'),
							url:         [RLang('Indexing by vectors'), AdvancedR('Selecting multiple elements', 'subsetting.html#subset-multiple')]
						}
					]
				},
				{
					name:         'Operators',
					id:           'operators',
					description:  "R's unary, binary, and special operators, the model formula, and every way a name can be bound to a value.",
					capabilities: [
						{
							name:        'Unary Operator',
							id:          'unary-operator',
							supported:   'fully',
							description: `_An operator written before its single argument, like \`+3\` or \`-3\`._ It is a ${LinkTo('call-normal', 'call')} of the operator's name with one argument.`,
							url:         [RLang('Operators')]
						},
						{
							name:         'Binary Operator',
							id:           'binary-operator',
							supported:    'fully',
							description:  `_An operator written between its two arguments, like \`3 + 4\` or \`3 * 4\`._ It is a ${LinkTo('call-normal', 'call')} of the operator's name with both arguments, in the order ${LinkTo('precedence', 'R gives them')}.`,
							capabilities: [
								{
									name:        'Special Operator',
									id:          'special-operator',
									code:        ['%%'],
									supported:   'fully',
									description: `_An operator whose name is spelled between percent signs, like \`3 %in% 4\` or \`3 %*% 4\`._ The name binds like any other, so a program may define \`%between%\` itself and the ${LinkTo('infix-calls', 'infix call')} resolves to it.`,
									example:     codeBlock('r', '`%between%` <- function(x, r) x >= r[1] & x <= r[2]\n5 %between% c(1, 10)'),
									url:         [RLang('Operator tokens')]
								},
								{
									name:        'Model Formula',
									id:          'model-formula',
									code:        ['~'],
									supported:   'partially',
									description: `_A formula written with \`~\`, like \`y ~ x\` or \`y ~ x + z\`._ Its operands are ${LinkTo('non-standard-evaluations-semantics', 'non-standard evaluation')}: a bare \`y ~ x\` names columns rather than variables, so neither name is read.`,
									example:     codeBlock('r', 'k <- 2\nf <- y ~ poly(x, k)\nall.vars(f)')
								},
								{
									name:         'Assignments and Bindings',
									id:           'assignments-and-bindings',
									description:  `Every way to bind a name to a value, with the ${LinkTo('local-left-assignment', 'local')} and ${LinkTo('super-left-assignment', 'super')} operators, the ${LinkTo('assignment-functions', 'calls doing the same')}, or a write through a ${LinkTo('replacement-functions', 'replacement function')}.`,
									capabilities: [
										{
											name:        'Local Left Assignment',
											id:          'local-left-assignment',
											code:        ['<-'],
											supported:   'fully',
											description: `_Bind a name in the current scope with \`<-\`, as in \`x <- 3\`._ A target that is an ${LinkTo('index-access', 'access')} (\`x$y <- 3\`) rebinds the whole container through a ${LinkTo('replacement-functions', 'replacement function')}.`,
											url:         [AdvancedR('Binding basics', 'names-values.html#binding-basics')]
										},
										{
											name:        'Local Right Assignment',
											id:          'local-right-assignment',
											code:        ['->'],
											supported:   'fully',
											description: `_Bind a name with \`->\`, as in \`3 -> x\`._ Identical to ${LinkTo('local-left-assignment', 'left assignment')} with the sides swapped.`,
											url:         [AdvancedR('Binding basics', 'names-values.html#binding-basics')]
										},
										{
											name:        'Local Equal Assignment',
											id:          'local-equal-assignment',
											supported:   'fully',
											description: `_Bind a name with \`=\`, as in \`x = 3\`._ This holds only at the start of an expression, as inside a call the same token gives a ${LinkTo('named-arguments', 'named argument')} (\`f(a = 3)\`).`,
											example:     codeBlock('r', 'x = 3\nf <- function(a) a\nf(a = x)'),
											url:         [AdvancedR('Binding basics', 'names-values.html#binding-basics')]
										},
										{
											name:        'Local Table Assignment',
											id:          'local-table-assignment',
											code:        [':='],
											supported:   'fully',
											description: `_Bind a column in place with data.table's \`:=\`, as in \`x[,a:=3,]\`._ It is read as a write to the table, not to a name, and which columns exist stays unknown (see ${LinkTo('data-masking', 'data masking')}).`
										},
										{
											name:        'Super Left Assignment',
											id:          'super-left-assignment',
											code:        ['<<-'],
											supported:   'fully',
											description: `_Bind a name in an enclosing scope with \`<<-\`, as in \`x <<- 42\`._ The write leaves the ${LinkTo('function-definitions', 'function')} it sits in, which is what makes it a ${LinkTo('side-effects-in-function-call', 'side effect of the call')}.`,
											url:         [AdvancedR('Super assignment', 'environments.html#super-assignment--')]
										},
										{
											name:        'Super Right Assignment',
											id:          'super-right-assignment',
											code:        ['->>'],
											supported:   'fully',
											description: `_Bind a name in an enclosing scope with \`->>\`, as in \`42 ->> x\`._ Identical to ${LinkTo('super-left-assignment', 'super left assignment')} with the sides swapped.`,
											url:         [AdvancedR('Super assignment', 'environments.html#super-assignment--')]
										},
										{
											name:        'Return Value of Assignments',
											id:          'return-value-of-assignments',
											supported:   'fully',
											description: '_An assignment is itself an expression that hands on the value it bound._ This is what makes `x <- y <- 3` bind both names and `print(x <- 4)` print `4`.',
											example:     codeBlock('r', 'x <- y <- 3\nprint(x <- 4)')
										},
										{
											name:        'Assignment Functions',
											id:          'assignment-functions',
											code:        ['assign', 'delayedAssign'],
											supported:   'partially',
											description: `_Bind a name given as a string, with \`assign\`, \`delayedAssign\`, ..._ The name has to be a ${LinkTo('name-created-resolved', 'resolvable string')}, and what a delayed assignment does when forced is not modelled.`,
											example:     codeBlock('r', 'assign("x", 3)\ndelayedAssign("y", x * 2)\ny')
										},
										{
											name:        'Range Assignment',
											id:          'range-assignment',
											supported:   'fully',
											description: `_Write to a range of a container, as in \`x[1:3] <- 3\`._ Like every ${LinkTo('replacement-functions', 'replacement call')} it rebinds the whole container, as which cells the range covers is not tracked.`,
											example:     codeBlock('r', 'x <- 1:5\nx[2:3] <- 0\nx'),
											url:         [RLang('Subset assignment'), AdvancedR('Subassignment', 'subsetting.html#subassignment')]
										},
										{
											name:        'Replacement Functions',
											id:          'replacement-functions',
											supported:   'partially',
											description: `_Read a write to a call, like \`x[i] <- 3\` or \`x$y <- 3\`, as the \`\` \`[<-\`(x, 3) \`\` R runs for it._ The name in front is both read and rebound. A ${LinkTo('named-arguments', 'named argument')} in such a call (\`g(v, k = 2) <- 3\`) leaves its argument edge dangling.`,
											example:     codeBlock('r', '`second<-` <- function(x, value) {\n  x[2] <- value\n  x\n}\nv <- 1:3\nsecond(v) <- 9\nv'),
											url:         [AdvancedR('Replacement functions', 'functions.html#replacement-functions'), RLang('Subset assignment')]
										},
										{
											name:        'Locked Bindings',
											id:          'locked-bindings',
											code:        ['lockEnvironment', 'lockBinding'],
											supported:   'not',
											description: `_A binding \`lockBinding\` (or \`lockEnvironment\`) makes constant._ Neither is recognized as a built-in, so the ${LinkTo('local-left-assignment', 'assignment')} R would have rejected is read as an ordinary rebinding.`,
											example:     codeBlock('r', 'x <- 1\nlockBinding("x", environment())\nx <- 2'),
											url:         [RLang('Environment objects')]
										}
									]
								}
							],
							url: [RLang('Operators')]
						}
					]
				},
				{
					name:         'Control-Flow',
					id:           'control-flow',
					description:  'Conditionals, the three loop forms, their jumps, and how an error leaves a computation.',
					capabilities: [
						{
							name:        'if',
							id:          'if',
							code:        ['if'],
							supported:   'fully',
							description: `_The conditional \`if (x) y else z\`, and \`if (x) y\` without an alternative._ Both branches stay possible, so a name bound in either reaches a use below, and a missing \`else\` yields ${LinkTo('null', '`NULL`')}.`,
							example:     codeBlock('r', 'x <- if(TRUE) 1 else 2\ny <- if(FALSE) 3\ny'),
							url:         [RLang('if')]
						},
						{
							name:        'for loop',
							id:          'for-loop',
							code:        ['for'],
							supported:   'fully',
							description: '_The loop `for (i in 1:3) print(i)`, which binds its variable in the surrounding scope._ The body is analyzed once for any number of iterations, so a name it binds also reaches its own next read, and `i` stays bound after the loop.',
							example:     codeBlock('r', 'for(i in 1:3) print(i)\ni'),
							url:         [RLang('Looping')]
						},
						{
							name:        'while loop',
							id:          'while-loop',
							code:        ['while'],
							supported:   'fully',
							description: '_The loop `while (x) b`, whose condition is read before every iteration._ Whether the body ever runs is unknown, so a name it binds and the one bound before it both reach a use below.',
							example:     codeBlock('r', 'i <- 0\nwhile(i < 3) i <- i + 1\ni'),
							url:         [RLang('while')]
						},
						{
							name:        'repeat loop',
							id:          'repeat-loop',
							code:        ['repeat'],
							supported:   'fully',
							description: `_The loop \`repeat {b; if (x) break}\`, which only a ${LinkTo('break', '`break`')} or a ${LinkTo('return', '`return`')} leaves._ Like every loop the body is analyzed once, for any number of iterations.`,
							example:     codeBlock('r', 'i <- 0\nrepeat {\n  i <- i + 1\n  if(i > 2) break\n}\ni'),
							url:         [RLang('repeat')]
						},
						{
							name:        'break',
							id:          'break',
							code:        ['break'],
							supported:   'fully',
							description: '_Leave the innermost enclosing loop with `break` (`break()` included)._ The rest of the body becomes unreachable on that path, so what it would have bound does not reach a use after the loop.',
							example:     codeBlock('r', 'for(i in 1:5) {\n  if(i == 4) break\n  print(i)\n}'),
							url:         [RLang('Control structures')]
						},
						{
							name:        'next',
							id:          'next',
							code:        ['next'],
							supported:   'fully',
							description: '_Start the next iteration of the innermost enclosing loop with `next` (`next()` included)._ The rest of the body is skipped on that path, while the loop itself continues.',
							example:     codeBlock('r', 'for(i in 1:5) {\n  if(i %% 2 == 0) next\n  print(i)\n}'),
							url:         [RLang('Control structures')]
						},
						{
							name:        'switch',
							id:          'switch',
							code:        ['switch'],
							supported:   'fully',
							description: '_Pick a branch by name or position with `switch`._ A branch left empty falls through to the next one, and every branch stays possible, as the selector does not narrow which of them runs.',
							example:     codeBlock('r', 'switch("b", a = , b = "ab", c = "c")\nswitch(2, "one", "two")'),
							url:         [RLang('Control structures')]
						},
						{
							name:        'return',
							id:          'return',
							code:        ['return'],
							supported:   'fully',
							description: `_Leave the enclosing ${LinkTo('function-definitions', 'function')} with \`return(3)\`._ Its argument becomes a value of the call, next to the ${LinkTo('implicit-return', 'implicit return')} of whatever path does not return early.`,
							example:     codeBlock('r', 'f <- function(x) {\n  if(x > 0) return("pos")\n  "non-pos"\n}\nf(1)'),
							url:         [AdvancedR('Exiting a function', 'functions.html#exiting-a-function')]
						},
						{
							name:        'Exceptions and Errors',
							id:          'exceptions-and-errors',
							code:        ['stop', 'try', 'tryCatch', 'warning'],
							supported:   'partially',
							description: `_A condition raised with \`stop\`/\`warning\` and caught with \`try\`/\`tryCatch\`._ The path on which a call throws before a write is not kept open, so \`tryCatch({ risky(); x <- 2 }, ...)\` loses \`x\`. A handler is read as an ordinary ${LinkTo('function-definitions', 'function definition')}.`,
							example:     codeBlock('r', 'tryCatch(\n  stop("boom"),\n  error = function(e) conditionMessage(e),\n  finally = print("done")\n)'),
							url:         [RLang('Exception handling'), AdvancedR('Conditions', 'conditions.html')]
						}
					]
				},
				{
					name:         'Function Definitions',
					id:           'function-definitions',
					description:  `The ${LinkTo('formals', 'parameters')} a function binds, their defaults, \`...\`, promises, and the value the call hands back.`,
					capabilities: [
						{
							name:        'Normal',
							id:          'normal-definition',
							code:        ['function'],
							supported:   'fully',
							description: `_A function written with \`function(x) x\`._ It opens a scope of its own, so its body resolves names in its ${LinkTo('lexicographic-scope', 'lexicographic scope')} rather than where the call happens.`,
							url:         [RLang('Function definitions')]
						},
						{
							name:         'Formals',
							id:           'formals',
							description:  `The parameters a definition declares, with their ${LinkTo('formals-named', 'names')}, ${LinkTo('formals-default', 'defaults')}, ${LinkTo('formals-dot-dot-dot', '`...`')}, and the ${LinkTo('formals-promises', 'promise')} each is bound to.`,
							capabilities: [
								{
									name:        'Named',
									id:          'formals-named',
									supported:   'fully',
									description: '_A parameter written as a name, as `x` in `function(x) x`._ It binds that name in the body, where it shadows an enclosing binding of the same name.',
									url:         [RLang('Arguments')]
								},
								{
									name:        'Default',
									id:          'formals-default',
									supported:   'fully',
									description: '_A parameter with a default, as in `function(x = 3) x`._ The default is evaluated in the function\'s own scope, so it may read another parameter (`function(x, y = x * 2)`).',
									example:     codeBlock('r', 'f <- function(x, y = x * 2) y\nf(3)'),
									url:         [AdvancedR('Default arguments', 'functions.html#default-arguments')]
								},
								{
									name:        'Dot-Dot-Dot',
									id:          'formals-dot-dot-dot',
									supported:   'fully',
									description: `_The variadic parameter \`...\`, which collects every argument no other formal took._ Passing it on keeps those arguments together, while a formal behind it is only matched by ${LinkTo('named-arguments', 'its exact name')}.`,
									example:     codeBlock('r', 'f <- function(...) sum(...)\ng <- function(...) f(..., 1)\ng(2, 3)'),
									url:         [RLang('Dot-dot-dot', 'Dot_002ddot_002ddot')]
								},
								{
									name:        'Promises',
									id:          'formals-promises',
									supported:   'partially',
									description: `_An argument is a promise, evaluated where it was written but only when the body first reads it._ When that happens is not modelled, nor are the ${LinkTo('side-effects-in-argument', 'writes that forcing it performs')}, so \`function(x = y) { y <- 3; x }\` does not tell us where \`y\` is read.`,
									example:     codeBlock('r', 'f <- function(x = y) {\n  y <- 3\n  x\n}\nf()'),
									url:         [RLang('Promise objects'), AdvancedR('Lazy evaluation', 'functions.html')]
								}
							]
						},
						{
							name:        'Implicit Return',
							id:          'implicit-return',
							supported:   'fully',
							description: `_A function hands back the value of the last expression it evaluates, without a ${LinkTo('return', '`return`')}._ Every path's last expression is such a value of the call.`,
							url:         [RLang('Function definitions')]
						},
						{
							name:        'Lambda Syntax',
							id:          'lambda-syntax',
							code:        ['\\('],
							supported:   'fully',
							minRVersion: MIN_VERSION_LAMBDA,
							description: `_The short form \`\\(x) x\` of a ${LinkTo('normal-definition', 'function definition')}._ It is purely syntax and binds its ${LinkTo('formals', 'parameters')} and scopes its body exactly like the long form.`,
							example:     codeBlock('r', 'sapply(1:3, \\(x) x^2)')
						}
					]
				},
				{
					name:         'Important Built-Ins',
					id:           'important-built-ins',
					description:  'The base-R functions we give a meaning of their own rather than treating as opaque calls, the ones that compute on the language included.',
					capabilities: [
						{
							name:        'Non-Strict Logical Operators',
							id:          'non-strict-logical-operators',
							code:        ['&&', '||'],
							supported:   'fully',
							description: '_The operators `&&` and `||`, which evaluate their right side only if the left one does not decide the result._ The right side is read as a path that may not run, unlike the vectorized `&`/`|`.',
							example:     codeBlock('r', 'FALSE && stop("never evaluated")\nTRUE || stop("never evaluated")'),
							url:         [RLang('Operators')]
						},
						{
							name:        'Pipe',
							id:          'pipe-and-pipe-bind',
							code:        ['|>'],
							supported:   'fully',
							minRVersion: MIN_VERSION_PIPE,
							description: `_The [native pipe](https://www.r-bloggers.com/2021/05/the-new-r-pipe/) \`|>\`, which is syntax rather than a ${LinkTo('call-normal', 'call')}: the parser rewrites it._ The left-hand side becomes the first argument or fills the \`_\` placeholder.`,
							example:     codeBlock('r', 'c(1, 2, 3) |> sum() |> sqrt()\nmtcars |> subset(cyl == 4)'),
							url:         [RLang('Function calls')]
						},
						{
							name:        'Pipe-Bind',
							id:          'pipe-bind',
							code:        ['=>'],
							supported:   'partially',
							minRVersion: MIN_VERSION_PIPE_BIND,
							description: `_The experimental pipe-bind \`=>\`, which names what the ${LinkTo('pipe-and-pipe-bind', 'pipe')} hands on and which R only enables under \`_R_USE_PIPEBIND_\`._ It is off by default and needs \`engine.r-shell.pipeBind\`. Tree-sitter's grammar has no production for it.`,
							example:     codeBlock('r', 'mtcars |> df => lm(mpg ~ cyl, data = df)'),
							url:         [RLang('Function calls')]
						},
						{
							name:        'Sequencing',
							id:          'built-in-sequencing',
							code:        [':', 'seq', 'seq_len', 'seq_along', 'rep'],
							supported:   'partially',
							description: `_Give \`:\`, \`seq\`, ... the sequence they produce, gathered by abstract interpretation._ That value lets us reason about a ${LinkTo('for-loop', 'loop')} bound or an ${LinkTo('index-access', 'index')}, but \`seq\`, \`seq_len\`, \`seq_along\`, and \`rep\` are not folded even for literal arguments.`,
							example:     codeBlock('r', 'n <- 0\n1:n\nseq_len(n)')
						},
						{
							name:        'Internal and Primitive Functions',
							id:          'built-in-internal-and-primitive-functions',
							code:        ['.Internal', '.Primitive'],
							supported:   'partially',
							description: `_The \`.Internal\` and \`.Primitive\` calls a base function reaches its C implementation through._ The call is kept and its arguments read, but the name \`.Primitive("sum")\` spells is not resolved the way a ${LinkTo('name-created', 'created name')} would be.`,
							example:     codeBlock('r', '.Primitive("+")(1, 2)\n.Internal(inspect(1))'),
							url:         [RLang('.Internal and .Primitive', 'g_t_002eInternal-and-_002ePrimitive')]
						},
						{
							name:        'Options',
							id:          'built-in-options',
							code:        ['options', 'getOption'],
							supported:   'partially',
							description: `_The global options \`options\` sets and \`getOption\` reads._ Option values are not tracked, so \`getOption("digits")\` does not reach a preceding \`options(digits = 3)\`. Unlike the ${LinkTo('working-directory', 'working directory')} they are not interpreted at all.`,
							example:     codeBlock('r', 'old <- options(digits = 3)\ngetOption("digits")\noptions(old)')
						},
						{
							name:        'Help',
							id:          'built-in-help',
							code:        ['help', 'help.search'],
							supported:   'partially',
							description: `_The help calls \`?\`, \`??\`, \`help\`, ..._ \`?\` and \`??\` are recognized, but their topic is read as an ordinary ${LinkTo('name-normal', 'name')} where R only looks it up, and \`help\`/\`help.search\` are not known at all.`,
							example:     codeBlock('r', '?sum\nhelp("sum")')
						},
						{
							name:         'Reflection / "Computing on the Language"',
							id:           'reflection-"computing-on-the-language"',
							description:  `Code that reads or builds code, by ${LinkTo('built-in-quoting', 'quoting')} an expression, ${LinkTo('built-in-evaluation', 'evaluating')} it elsewhere, ${LinkTo('built-in-parsing', 'parsing')} it from a string, or ${LinkTo('modify-function-structure', 'rewriting a function')}.`,
							capabilities: [
								{
									name:        'Get Function Structure',
									id:          'get-function-structure',
									code:        ['body', 'formals', 'environment', 'args'],
									supported:   'partially',
									description: `_Read a part of a ${LinkTo('function-definitions', 'function')} with \`body\`, \`formals\`, \`args\`, or \`environment\`._ What comes back is opaque, and the whole function is read, so asking only for \`formals(f)\` keeps all of \`f\`'s body in a slice.`,
									example:     codeBlock('r', 'f <- function(x) x + 1\nbody(f)\nformals(f)\nenvironment(f)'),
									url:         [RLang('Manipulation of functions')]
								},
								{
									name:        'Modify Function Structure',
									id:          'modify-function-structure',
									code:        ['body<-', 'formals<-', 'environment<-'],
									supported:   'partially',
									description: `_Rewrite a part of a function with \`body<-\`, \`formals<-\`, or \`environment<-\`._ Like every ${LinkTo('replacement-functions', 'replacement function')} it rebinds the name, so a later ${LinkTo('call-normal', 'call')} reaches the new part as well as the original one.`,
									example:     codeBlock('r', 'f <- function(x) x + 1\nbody(f) <- quote(x * 2)\nf(3)'),
									url:         [RLang('Manipulation of functions')]
								},
								{
									name:        'Quoting',
									id:          'built-in-quoting',
									code:        ['quote', 'substitute', 'bquote'],
									supported:   'partially',
									description: `_Take an expression as a value with \`quote\`, \`substitute\`, \`bquote\`, ..._ A quoted argument is ${LinkTo('non-standard-evaluations-semantics', 'non-standard evaluation')}: the names in it are not read, and \`substitute\` does not reach the caller's expression.`,
									example:     codeBlock('r', 'x <- 1\nquote(x + y)\nbquote(.(x) + y)'),
									url:         [RLang('Computing on the language'), AdvancedR('Metaprogramming', 'metaprogramming.html')]
								},
								{
									name:        'Evaluation',
									id:          'built-in-evaluation',
									code:        ['eval', 'evalq', 'eval.parent'],
									supported:   'partially',
									description: `_Run an expression that is a value with \`eval\`, \`evalq\`, \`eval.parent\`, ..._ \`eval(expr, envir)\` runs in an ${LinkTo('dynamic-environment-resolution', 'environment')} we may not know, so it is marked an unknown side effect.`,
									example:     codeBlock('r', 'e <- quote(x + 1)\nx <- 2\neval(e)'),
									url:         [RLang('Evaluation of expressions'), AdvancedR('Evaluation', 'evaluation.html')]
								},
								{
									name:        'String Templates',
									id:          'string-templates',
									code:        ['glue', 'str_glue', 'cli_alert_info'],
									supported:   'partially',
									description: '_A string that reads the names inside it, as `glue::glue("{x}")`, `cli::cli_alert_info("{.val {x}}")`, or `stringr::str_glue` do._ Those names resolve in the scope of the template, and one aimed at another scope (`.envir`, `.con`, `glue_data`) becomes an unknown side effect.',
									example:     codeBlock('r', 'x <- 2\nglue::glue("x plus one is {x + 1}")')
								},
								{
									name:        'Parsing',
									id:          'built-in-parsing',
									code:        ['parse', 'deparse'],
									supported:   'partially',
									description: `_Turn text into an expression with \`parse\`, and an expression back into text with \`deparse\`._ What \`parse\` produces is only reached through ${LinkTo('built-in-evaluation', 'evaluation')}, and \`deparse\` is not modelled beyond reading its argument.`,
									example:     codeBlock('r', 'eval(parse(text = "1 + 1"))\ndeparse(quote(x + y))'),
									url:         [RLang('The parsing process'), RLang('Deparsing')]
								}
							]
						}
					]
				},
				{
					name:         'Literal Values',
					id:           'literal-values',
					description:  `The values written into the source itself, which is what a ${LinkTo('name-created-resolved', 'resolved name')} and an ${LinkTo('oop-s3-construction', 'S3 class')} are read from.`,
					capabilities: [
						{
							name:         'Numbers',
							id:           'numbers',
							supported:    'fully',
							description:  '_Recognize numbers like `3`, `3.14`, the integer `3L`, hexadecimals such as `0xFF` and `0x1p3`, as well as the typed missings `NA_integer_`/`NA_real_`, ..._',
							example:      codeBlock('r', '1L\n0xFF\n1e-3\n0x1p3\nNA_real_'),
							capabilities: [
								{
									name:        'Complex',
									id:          'numbers-complex',
									supported:   'fully',
									description: '_Recognize the imaginary literals `1i`, `4.1i`, `1e-2i`, ..._ The value survives arithmetic and is told apart from `1L` and a plain `1`.',
									example:     codeBlock('r', 'z <- 1i\nz + 2i\n3 + 2i'),
									url:         [RLang('Literal constants')]
								}
							],
							url: [RLang('Literal constants')]
						},
						{
							name:         'Strings',
							id:           'strings',
							supported:    'fully',
							description:  `_A string literal like \`"a"\` or \`'b'\`._ Its value is kept, which is what lets it stand for a ${LinkTo('name-quoted', 'name')} or fold into a ${LinkTo('name-created-resolved', 'resolved one')}.`,
							capabilities: [
								{
									name:        'Raw Strings',
									id:          'raw-strings',
									supported:   'fully',
									minRVersion: MIN_VERSION_RAW_STABLE,
									description: `_A raw string like \`r"(a)"\`, in which a backslash is no escape._ Its value is the same ${LinkTo('strings', 'string')} the quoted form would give.`,
									example:     codeBlock('r', 'r"(C:\\Users\\me)"\nr"[\\d+]"')
								}
							],
							url: [RLang('Literal constants')]
						},
						{
							name:        'Logical',
							id:          'logical',
							code:        ['TRUE', 'FALSE'],
							supported:   'fully',
							description: '_Recognize the logicals `TRUE` and `FALSE`, ..._ Their short forms `T` and `F` are ordinary bindings and can be reassigned, while `TRUE` and `FALSE` are reserved.',
							example:     codeBlock('r', 'TRUE && FALSE\nT <- FALSE\nT'),
							url:         [RLang('Constants')]
						},
						{
							name:        'NULL',
							id:          'null',
							code:        ['NULL'],
							supported:   'fully',
							description: `_The \`NULL\` object, R's empty value._ It is what an \`if\` without an ${LinkTo('if', 'else branch')} yields, and assigning it to a list element removes that element.`,
							example:     codeBlock('r', 'c(1, NULL, 2)\nl <- list(a = 1)\nl$a <- NULL\nlength(l)'),
							url:         [RLang('NULL object')]
						},
						{
							name:        'Inf and NaN',
							id:          'inf-and-nan',
							code:        ['Inf', 'NaN'],
							supported:   'fully',
							description: `_The constants \`Inf\` and \`NaN\`, which arithmetic produces rather than errors on._ They are ordinary values here, and the predicates asking for them are not evaluated, as ${LinkTo('types-inference', 'no type is inferred')}.`,
							example:     codeBlock('r', '1 / 0\n-1 / 0\n0 / 0\nis.nan(NA)'),
							url:         [RLang('Constants')]
						}
					]
				}
			]
		},
		{
			name:         'Non-Standard Evaluations/Semantics',
			id:           'non-standard-evaluations-semantics',
			description:  `The places where R does not evaluate an expression the way it is written, so a ${LinkTo('name-normal', 'name')} in it may mean something other than the binding it seems to read.`,
			capabilities: [
				{
					name:        'Data Masking',
					id:          'data-masking',
					code:        ['subset'],
					supported:   'partially',
					description: `_A call that evaluates its arguments against the columns of a data frame first, as \`subset(d, col > 1)\`, the dplyr verbs, \`ggplot2::aes\`, and data.table's ${LinkTo('local-table-assignment', '`:=`')} do._ Which columns exist is unknown to us, so a column shadowing a variable still resolves to the variable.`,
					example:     codeBlock('r', 'd <- data.frame(x = 1:3)\nthreshold <- 2\nsubset(d, x > threshold)'),
					url:         [AdvancedR('Data masks', 'evaluation.html#data-masks')]
				},
				{
					name:        'Recycling',
					id:          'recycling',
					supported:   'not',
					description: `_A shorter operand is repeated to the length of the longer one._ This is not modelled, so the operands are read but the length of what an ${LinkTo('binary-operator', 'operator')} produces is not derived from them.`,
					example:     codeBlock('r', 'c(1, 2, 3, 4) + c(10, 20)'),
					url:         [RLang('Recycling rules'), AdvancedR('Vectors', 'vectors-chap.html')]
				},
				{
					name:        'Vectorized Operator or Functions',
					id:          'vectorized-operator-or-functions',
					code:        ['ifelse'],
					supported:   'partially',
					description: `_An operation applied to every element of a vector at once._ Comparisons, the reducing functions, and \`ifelse\` widen to the unknown value, so an ${LinkTo('subsetting-multiple', 'index built from one')} selects an unknown set of elements.`,
					example:     codeBlock('r', 'x <- 1:5\nx * 2\nifelse(x > 2, "big", "small")'),
					url:         [AdvancedR('Vectorise', 'perf-improve.html#vectorise')]
				},
				{
					name:        'Hooks',
					id:          'hooks',
					code:        ['on.exit', 'setHook'],
					supported:   'partially',
					description: `_Code registered to run at a point the program does not write out, with \`on.exit\` or \`userhooks\`._ An \`on.exit\` body runs when the ${LinkTo('function-definitions', 'function')} it sits in ends, while \`setHook\` is not modelled.`,
					example:     codeBlock('r', 'f <- function() {\n  on.exit(print("bye"))\n  1\n}\nf()'),
					url:         [AdvancedR('on.exit', 'functions.html#on-exit'), { name: 'R Definition/userhooks', href: 'https://stat.ethz.ch/R-manual/R-devel/library/base/html/userhooks.html' }]
				},
				{
					name:        'Precedence',
					id:          'precedence',
					supported:   'fully',
					description: `_Which ${LinkTo('operators', 'operator')} binds tighter, as the [documentation](https://rdrr.io/r/base/Syntax.html) lays it out._ It decides the shape of the tree the parser hands us, so \`-2^2\` is \`-(2^2)\` before anything else looks at it.`,
					example:     codeBlock('r', '-2^2\n1:3 - 1\n!TRUE == FALSE'),
					url:         [RLang('Operator tokens')]
				},
				{
					name:         'Attributes',
					id:           'attributes',
					description:  `The data an object carries beside its value, which is where its ${LinkTo('oop-s3', 'S3 class')} and its shape live.`,
					capabilities: [
						{
							name:        'User-Defined',
							id:          'user-defined',
							code:        ['attr', 'attributes', 'attr<-'],
							supported:   'partially',
							description: `_An [attribute](https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Attributes) a program sets itself, with \`attr\` or \`attributes\`._ Which attributes an object carries is not part of the value we track, so only the ${LinkTo('replacement-functions', 'rebinding')} of the object itself is seen.`,
							example:     codeBlock('r', 'x <- 1:3\nattr(x, "unit") <- "cm"\nattributes(x)'),
							url:         [RLang('Attributes')]
						},
						{
							name:        'Built-In',
							id:          'built-in',
							code:        ['dim<-', 'names<-', 'class', 'dim', 'names'],
							supported:   'partially',
							description: `_An attribute R gives a meaning of its own, such as \`dim\`, \`names\`, or the \`class\` that ${LinkTo('oop-s3', 'dispatch')} reads._ \`dim<-\`, \`names<-\`, and \`class<-\` track shape only on a data frame.`,
							example:     codeBlock('r', 'x <- 1:6\ndim(x) <- c(2, 3)\nclass(x)'),
							url:         [RLang('Dimensional attributes')]
						}
					]
				}
			]
		},
		{
			name:         'Object-Oriented Programming',
			id:           'object-oriented-programming',
			description:  `R's object systems, the class an object carries, and the ${LinkTo('oop-s3-dispatch', 'dispatch')} that decides which function body a generic call runs.`,
			capabilities: [
				{
					name:         'S3',
					id:           'oop-s3',
					url:          [AdvancedR('S3', 's3.html'), RLang('Object-oriented programming', 'Object_002doriented-programming')],
					description:  `_Classes and methods built on the ${LinkTo('built-in', '`class` attribute')} and \`UseMethod\` dispatch._ A class is a string an object carries rather than a declaration, so what a call runs follows from the ${LinkTo('name-normal', 'names')} \`generic.class\` in scope.`,
					example:      codeBlock('r', 'p <- structure(list(n = "ada"), class = "pt")\nprint.pt <- function(x, ...) cat("pt", x$n, "\\n")\np'),
					capabilities: [
						{
							name:        'Class Construction',
							id:          'oop-s3-construction',
							code:        ['class<-', 'oldClass<-'],
							supported:   'fully',
							description: `_Give an object its class with \`structure(..., class =)\`, \`class<-\`, or \`oldClass<-\`._ A class written as a ${LinkTo('strings', 'string literal')} is tracked and reaches the ${LinkTo('oop-s3-dispatch', 'dispatch')} that follows it.`,
							url:         [RLang('Objects')]
						},
						{
							name:        'Dispatch',
							id:          'oop-s3-dispatch',
							code:        ['UseMethod'],
							supported:   'partially',
							description: `_Route a generic call to the method that runs._ \`UseMethod\` links to every ${LinkTo('function-definitions', 'definition')} named \`generic.class\` in scope, so the ${LinkTo('oop-s3-construction', 'class')} an object carries narrows the target only where it is known (heavily over-approximating).`,
							url:         [RLang('UseMethod'), RLang('Method dispatching')]
						},
						{
							name:        'Inheritance',
							id:          'oop-s3-inheritance',
							code:        ['NextMethod'],
							supported:   'partially',
							description: `_Walk the class vector with \`NextMethod\`._ It reaches the generic's ${LinkTo('oop-s3-dispatch', 'methods')}, the one it stands in included, rather than only the next class in the vector.`,
							url:         [RLang('NextMethod'), RLang('Inheritance')]
						}
					]
				},
				{
					name:         'S4',
					id:           'oop-s4',
					url:          [AdvancedR('S4', 's4.html')],
					description:  `_Formal classes and methods declared with \`setClass\`, \`setGeneric\`, and \`setMethod\`._ Unlike ${LinkTo('oop-s3', 'S3')} the class is declared, with named slots read through ${LinkTo('slot-access', '`@`')}.`,
					example:      codeBlock('r', 'setClass("P", representation(x = "numeric"))\nsetGeneric("desc", function(o) standardGeneric("desc"))\nsetMethod("desc", "P", function(o) o@x)\ndesc(new("P", x = 1))'),
					capabilities: [
						{
							name:        'Class Construction',
							id:          'oop-s4-construction',
							code:        ['setClass'],
							supported:   'fully',
							description: `_Declare a class with \`setClass\` and build one with \`new\`._ The \`new\` call is linked to the \`setClass\` that declared the class, and a slot is read through ${LinkTo('slot-access', '`@`')} like any other access.`,
							url:         [RLang('Classes')]
						},
						{
							name:        'Dispatch',
							id:          'oop-s4-dispatch',
							code:        ['standardGeneric', 'setGeneric', 'setMethod'],
							supported:   'partially',
							description: `_Route a generic call to the method \`setMethod\` registered._ The generic reaches its methods through the chain they register in, but the signature does not narrow which of them runs, as ${LinkTo('types-inference', 'no type is inferred')} for the argument.`,
							url:         [RLang('Method dispatching')]
						},
						{
							name:        'Inheritance',
							id:          'oop-s4-inheritance',
							code:        ['callNextMethod'],
							supported:   'not',
							description: `_Reach a parent method with \`callNextMethod\`, and inherit through \`contains\`._ \`callNextMethod\` is left unresolved, so nothing links it to the ${LinkTo('oop-s4-dispatch', 'method')} it would call, unlike ${LinkTo('oop-s3-inheritance', 'S3 inheritance')}.`,
							url:         [RLang('Inheritance')]
						}
					]
				},
				{
					name:        'RC/R5',
					id:          'oop-rc',
					code:        ['setRefClass'],
					url:         [AdvancedR('R5 / Reference classes', 'r6.html#why-r6')],
					supported:   'partially',
					description: `_Reference classes made with \`setRefClass\`, whose objects are mutable and thus behave like the ${LinkTo('environment-sharing', 'shared environments')} they are built on._ \`$new()\` and \`$method()\` on an instance are unknown side effects, and no call links to the body it runs.`,
					example:     codeBlock('r', 'Acc <- setRefClass("Acc",\n  fields = list(bal = "numeric"),\n  methods = list(dep = function(v) bal <<- bal + v))\na <- Acc$new(bal = 0)\na$dep(5)')
				},
				{
					name:        'R6',
					id:          'oop-r6',
					code:        ['R6Class'],
					url:         [AdvancedR('R6', 'r6.html')],
					supported:   'partially',
					description: `_Classes made with \`R6::R6Class\`, read as one unit rather than as the environment behind them._ Like ${LinkTo('oop-rc', 'RC')} an R6 object is mutable, and typing, inheritance, private/active bindings, and handling objects fully "as units" are not supported.`,
					example:     codeBlock('r', 'Counter <- R6::R6Class("Counter", public = list(\n  i = 0,\n  add = function() {\n    self$i <- self$i + 1\n    invisible(self)\n  }\n))\nCounter$new()$add()$i')
				},
				{
					name:        'R7/S7',
					id:          'oop-r7-s7',
					code:        ['new_class'],
					url:         [{ name: 'R7', href: 'https://www.r-bloggers.com/2022/12/what-is-r7-a-new-oop-system-for-r/' }, { name: 'S7', href: 'https://cran.r-project.org/web/packages/S7/index.html' }],
					supported:   'partially',
					description: `_Classes made with \`S7::new_class\`, read as one unit, dispatch and inheritance included._ ${LinkTo('types-inference', 'Typing')} is not supported, nor are objects handled fully "as units."`,
					example:     codeBlock('r', 'Person <- S7::new_class("Person", properties = list(name = S7::class_character))\nPerson(name = "ada")@name')
				},
				{
					name:         'Class-Based Dependency Attribution',
					id:           'oop-class-dependency-attribution',
					supported:    'partially',
					description:  `_Attribute the use of a class to the package that owns it, so a class use implies a dependency for library detection and version guessing._ It is the class counterpart of resolving a ${LinkTo('accessing-exported-names', 'name to its package')}.`,
					capabilities: [
						{
							name:        'S3 class ownership',
							id:          'class-owner-s3',
							supported:   'partially',
							description: `_Attribute an ${LinkTo('oop-s3', 'S3')} class to the package that owns it._ Only a class written as a ${LinkTo('strings', 'string literal')} is attributed, not one from a variable or a \`c(...)\` vector.`
						},
						{
							name:        'S4 class ownership',
							id:          'class-owner-s4',
							supported:   'partially',
							description: `_Attribute an ${LinkTo('oop-s4', 'S4')} class to the package that owns it._ S4 ownership is not in the ${Wiki('Signature Database', 'signature database')}, so a bare class use is not attributed.`
						}
					]
				}
			]
		},
		{
			name:         'R File Structure',
			id:           'structure',
			description:  'The lexical shape of a source file, down to its line endings and encoding.',
			capabilities: [
				{
					name:        'Comments',
					id:          'comments',
					supported:   'fully',
					description: `_A comment like \`# this is a comment\`, a shebang line included._ It is never read as code, so no ${LinkTo('name-normal', 'name')} in it resolves.`,
					example:     codeBlock('r', '#!/usr/bin/env Rscript\n# a comment\nx <- 1 # a trailing comment'),
					url:         [RLang('Comments')]
				},
				{
					name:        'Line Directive',
					id:          'line-directive',
					supported:   'partially',
					description: '_Recognize `#line n "file"` as its own node (r-shell only)._ It is parsed but never retargets a location, and tree-sitter reads it as a comment.',
					example:     codeBlock('r', 'x <- 1\n#line 42 "other.R"\ny <- 2'),
					url:         [{ name: 'R Definition/parse', href: 'https://stat.ethz.ch/R-manual/R-devel/library/base/html/parse.html' }]
				},
				{
					name:        'Semicolons',
					id:          'semicolons',
					supported:   'fully',
					description: `_A semicolon separating two expressions on one line, as in \`a; b; c\`._ It says the same as a ${LinkTo('newlines', 'newline')}: the expressions run in the order they are written.`,
					example:     codeBlock('r', 'a <- 1; b <- 2; a + b'),
					url:         [RLang('Separators')]
				},
				{
					name:        'Newlines',
					id:          'newlines',
					supported:   'fully',
					description: '_Recognize and resolve newlines like `a\\nb\\nc`, where a newline ends an expression unless it is still incomplete._ A trailing operator or an unclosed bracket continues on the next line.',
					example:     codeBlock('r', 'x <- 1 +\n  2\ny <- 1\n  + 2'),
					url:         [RLang('Separators')]
				},
				{
					name:        'Line Endings',
					id:          'line-endings',
					supported:   'fully',
					description: '_Recognize `\\n` (Unix), `\\r\\n` (Windows), and a lone `\\r` (classic Mac)._ Normalized at the r-bridge boundary, with both engines.',
					example:     codeBlock('r', 'x <- 1\r\ny <- x + 1')
				},
				{
					name:        'Source Encoding',
					id:          'source-encoding',
					supported:   'fully',
					description: `_UTF-8 beyond ASCII in ${LinkTo('strings', 'string literals')}, in a ${LinkTo('comments', 'comment')}, and in names (plain as well as ${LinkTo('name-escaped', 'backtick-escaped')})._ Such names bind and resolve like any other, with both engines.`,
					example:     codeBlock('r', 'st\u00e4rke <- "caf\u00e9"\n`\u03b1 \u03b2` <- 2\nst\u00e4rke'),
					url:         [RLang('Tokens')]
				},
				{
					name:        'Byte-Order Mark',
					id:          'byte-order-mark',
					supported:   'partially',
					description: '_Recognize a UTF-8 byte-order mark at the start of a file._ The tree-sitter engine reads past it, the r-shell engine rejects the same input as unparsable.'
				},
				{
					name:        'Syntax Errors',
					id:          'syntax-errors',
					supported:   'partially',
					description: `_Handle source that does not parse._ The ${Wiki('Linter', '`syntactically-valid` rule')} locates the region and offers a fix. The strict parser rejects the file, while tree-sitter's lax mode (off by default) drops the region.`,
					example:     codeBlock('r', 'x <- 1\ny <- (\nz <- 3'),
					url:         [RLang('The parsing process')]
				},
				{
					name:        'Reserved Words',
					id:          'reserved-words',
					supported:   'partially',
					description: `_Reject a syntactic keyword like \`\` \`if\` \`\` or \`\` \`function\` \`\` where R's grammar requires an expression._ The r-shell engine rejects \`\` if <- 5\`\`, while tree-sitter's grammar parses it as an ordinary ${LinkTo('local-left-assignment', 'assignment')}.`,
					example:     codeBlock('r', 'if <- 5'),
					url:         [RLang('Reserved words', 'Reserved-words-1')]
				}
			]
		},
		{
			name:         'Project',
			id:           'project',
			description:  `The files around the R code, from the ${LinkTo('project-metadata', 'package metadata')} and the packages a ${LinkTo('project-dependency-managers', 'version manager')} pins to what runs ${LinkTo('project-startup-files', 'before a script does')}.`,
			capabilities: [
				{
					name:         'Package Metadata',
					id:           'project-metadata',
					description:  'The files that describe the package itself, what it needs, and what it offers.',
					capabilities: [
						{
							name:        'DESCRIPTION',
							id:          'project-description',
							supported:   'fully',
							description: "_Read a package's `DESCRIPTION`._ Its DCF records give the package name, version, R version, dependency fields, and `Collate` order.",
							url:         [
								Plugin('src/project/plugins/file-plugins/files/flowr-description-file.ts'),
								{ name: 'Writing R Extensions/The DESCRIPTION file', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#The-DESCRIPTION-file' }
							]
						},
						{
							name:        'NAMESPACE',
							id:          'project-namespace',
							supported:   'fully',
							description: `_Read a package's \`NAMESPACE\`._ Acts on \`import\`/\`importFrom\`, \`importClassesFrom\`/\`importMethodsFrom\` for ${LinkTo('oop-s4', 'S4')}, and \`export\`/\`S3method\`, which is what says whether a name is ${LinkTo('namespace-exports', 'exported or internal')}.`,
							url:         [
								Plugin('src/project/plugins/file-plugins/files/flowr-namespace-file.ts'),
								{ name: 'Writing R Extensions/Package namespaces', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Package-namespaces' }
							]
						},
						{
							name:        'Documentation (`.Rd`)',
							id:          'project-rd',
							supported:   'fully',
							description: '_Read the `.Rd` pages under `man/`, their macros, and the indices beside them._ A documented name is tied back to the page that documents it.',
							url:         [
								Plugin('src/project/plugins/file-plugins/files/flowr-rd-file.ts'),
								{ name: 'Writing R Extensions/Rd format', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Rd-format' }
							]
						},
						{
							name:        'NEWS',
							id:          'project-news',
							supported:   'fully',
							description: "_Read a package's `NEWS`/`NEWS.md`._ We parse the versions it announces and what each changed, which is what a version guess is checked against.",
							url:         [
								Plugin('src/project/plugins/file-plugins/files/flowr-news-file.ts'),
								{ name: 'Writing R Extensions/Package subdirectories', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Package-subdirectories' }
							]
						},
						{
							name:        'Package Data (`sysdata.rda`)',
							id:          'project-sysdata',
							supported:   'partially',
							description: '_Read the `R/sysdata.rda` a package keeps its internal data in, and the `data/` files it exports._ What those bindings hold is not reconstructed.',
							url:         [
								Plugin('src/project/plugins/file-plugins/files/flowr-sysdata-file.ts'),
								{ name: 'Writing R Extensions/Data in packages', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Data-in-packages' }
							]
						}
					]
				},
				{
					name:         'Dependency Managers',
					id:           'project-dependency-managers',
					description:  'The lockfiles and manifests a version manager pins a project\'s packages with.',
					capabilities: [
						{
							name:        'renv',
							id:          'version-manager-renv',
							supported:   'fully',
							description: '_Read the configuration of [renv](https://rstudio.github.io/renv/), the most widespread R project-library manager._ The library it points at is neither installed nor restored.',
							url:         [
								Plugin('src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts'),
								{ name: 'renv', href: 'https://rstudio.github.io/renv/' }
							]
						},
						{
							name:        'packrat',
							id:          'version-manager-packrat',
							supported:   'fully',
							description: '_Read the configuration of [packrat](https://rstudio.github.io/packrat/), the predecessor of renv._ The `packrat/lib` library beside it is not loaded.',
							url:         [
								Plugin('src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts'),
								{ name: 'packrat', href: 'https://rstudio.github.io/packrat/' }
							]
						},
						{
							name:        'rv',
							id:          'version-manager-rv',
							supported:   'fully',
							description: '_Read the configuration of [rv](https://a2-ai.github.io/rv-docs/), a declarative project manager in the style of cargo._ Parses `rproject.toml` and the resolved `rv.lock`.',
							url:         [Plugin('src/project/plugins/file-plugins/files/flowr-manifest-files.ts'), { name: 'rv', href: 'https://a2-ai.github.io/rv-docs/' }]
						},
						{
							name:        'uvr',
							id:          'version-manager-uvr',
							supported:   'fully',
							description: '_Read the configuration of [uvr](https://github.com/nbafrank/uvr), an R project manager modelled on uv._ Parses `uvr.toml` and the `uvr.lock` beside it.',
							url:         [Plugin('src/project/plugins/file-plugins/files/flowr-manifest-files.ts'), { name: 'uvr', href: 'https://github.com/nbafrank/uvr' }]
						},
						{
							name:        'Installed Library',
							id:          'project-library',
							supported:   'partially',
							description: '_Read the package library a project installs into (`renv/library`, `packrat/lib`, or the platform library)._ Their code is not read.',
							url:         [Plugin('src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-library-plugin.ts')]
						}
					]
				},
				{
					name:         'Startup and Discovery',
					id:           'project-startup-and-discovery',
					description:  'What runs before a script does and what counts as part of the project at all.',
					capabilities: [
						{
							name:        'Startup Files',
							id:          'project-startup-files',
							supported:   'partially',
							description: '_Read the files R runs or reads before a script (`.Rprofile`, `Rprofile.site`, `.Renviron`, `Renviron.site`)._ An `.Rprofile` is read as R code whose bindings precede the script, but variables set by an environment file are not interpreted.',
							url:         [
								Plugin('src/project/plugins/file-plugins/flowr-analyzer-rprofile-file-plugin.ts'),
								{ name: 'R Definition/Startup', href: 'https://stat.ethz.ch/R-manual/R-devel/library/base/html/Startup.html' }
							]
						},
						{
							name:        'Ignore Files',
							id:          'project-ignore-files',
							supported:   'fully',
							description: '_Read the `.gitignore` and `.Rbuildignore` that say which files are not part of the project._ Follows gitignore globs and the regular expressions `R CMD build` uses.',
							url:         [
								Plugin('src/project/plugins/project-discovery/flowr-analyzer-ignore-file-project-discovery-plugin.ts'),
								{ name: 'gitignore', href: 'https://git-scm.com/docs/gitignore' }
							]
						}
					]
				},
				{
					name:         'Pre-Processors/external Tooling',
					id:           'pre-processors-external-tooling',
					description:  'The tooling around R code rather than the R in it, such as roxygen2 blocks and woven documents.',
					capabilities: [
						{
							name:        'roxygen2',
							id:          'roxygen2',
							supported:   'partially',
							description: `_Handle the roxygen2 blocks that precede a definition._ They are read as a ${LinkTo('comments', 'comment')} and what a tag states does not reach ${LinkTo('resolution', 'how a name resolves')}, so an \`importFrom\` tag leaves the name below it unqualified.`,
							example:     codeBlock('r', "#' @param x a number\n#' @importFrom stats median\n#' @export\nmid <- function(x) median(x)"),
							url:         [{ name: 'roxygen2', href: 'https://roxygen2.r-lib.org/' }]
						},
					]
				}
			]
		},
		{
			name:         'System, I/O, FFI, and Other Files',
			id:           'system-i-o-ffi-and-other-files',
			description:  `Everything a program reaches for beyond its own code, from ${LinkTo('sourcing-external-files', 'files it sources')} to calls it makes out of R.`,
			capabilities: [
				{
					name:        'Sourcing External Files',
					id:          'sourcing-external-files',
					code:        ['source', 'sys.source'],
					supported:   'partially',
					description: `_Pull another file's code into the analysis with \`source\`, \`sys.source\`, ..._ A sourced file's ${LinkTo('global-scope', 'top-level bindings')} become visible to the code below the call. Only \`source\` is handled so far, and only where its path resolves.`,
					example:     codeBlock('r', 'source("helpers.R")\nsys.source("setup.R", envir = environment())')
				},
				{
					name:        'Handling Binary Files',
					id:          'handling-binary-riles',
					code:        ['save', 'load', 'readRDS'],
					supported:   'partially',
					description: '_Files a program writes objects to and reads them back from, with [`save`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/save), `load`, `readRDS`, ..._ A `load` binds names we cannot know, so neither the names nor the values behind them are reconstructed.',
					example:     codeBlock('r', 'save(x, file = "x.RData")\nload("x.RData")\nreadRDS("y.rds")'),
					url:         [{ name: 'R Definition/save', href: 'https://stat.ethz.ch/R-manual/R-devel/library/base/html/save.html' }]
				},
				{
					name:        'I/O',
					id:          'i-o',
					code:        ['read.csv', 'write.csv'],
					supported:   'partially',
					description: `_Reading and writing data files with \`read.csv\`, \`write.csv\`, ..._ What a file contains does not enter the analysis, which is also why ${LinkTo('data-masking', 'the columns of a data frame')} stay unknown.`,
					example:     codeBlock('r', 'd <- read.csv("in.csv")\nwrite.csv(d, "out.csv")'),
					url:         [RLang('Operating system access')]
				},
				{
					name:        'Foreign Function Interface',
					id:          'foreign-function-interface',
					code:        ['.C', '.Call', '.External', '.Fortran'],
					supported:   'partially',
					description: `_Calling out to compiled code with \`.C\`, \`.Call\`, \`.External\`, \`.Fortran\`, ..._ The call carries an unknown side effect, like a write through a ${LinkTo('environment-sharing', 'shared environment')}, and the foreign code itself is not analyzed.`,
					example:     codeBlock('r', '.Call("my_c_fn", 1)\n.Fortran("my_f_sub", x = 1)')
				},
				{
					name:        'System Calls',
					id:          'system-calls',
					code:        ['system', 'system2'],
					supported:   'partially',
					description: '_Handle [`system`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/system), `system.*`, ..._ An injectable command built from user input is flagged by the `problematic-inputs` and `unescaped-arguments` rules.',
					example:     codeBlock('r', 'system("ls -la")\nsystem2("git", c("status"))'),
					url:         [RLang('Operating system access')]
				},
				{
					name:        'R-Markdown files',
					id:          'file:rmd',
					supported:   'partially',
					description: 'Support R-Markdown files as R sources. Code chunks are extracted, but not inline `r expr` or the `params` of the YAML front matter.',
					url:         [{ name: 'R Markdown', href: 'https://rmarkdown.rstudio.com/' }]
				},
				{
					name:        'Jupyter Notebook',
					id:          'file:ipynb',
					supported:   'partially',
					description: 'Support Jupyter Notebooks as R sources. Cells are read in document order, not execution order, and the kernel is not checked.',
					url:         [{ name: 'Jupyter Notebook Format', href: 'https://nbformat.readthedocs.io/en/latest/format_description.html' }]
				},
				{
					name:        'Quarto',
					id:          'file:qmd',
					supported:   'partially',
					description: 'Support Quarto files as R sources. Code chunks are extracted, but not inline `r expr` or the `params` of the YAML front matter.',
					url:         [{ name: 'Quarto', href: 'https://quarto.org/' }]
				},
				{
					name:        'Sweave',
					id:          'file:rnw',
					supported:   'partially',
					description: 'Support for Sweave files as R sources. Code chunks are extracted, `\\Sexpr{}` inline expressions are not.',
					url:         [{ name: 'Sweave', href: 'https://stat.ethz.ch/R-manual/R-devel/library/utils/doc/Sweave.pdf' }]
				}
			]
		},
		{
			name:         'Types',
			id:           'types',
			description:  `What a value is, how we ${LinkTo('types-inference', 'infer it')} from the code, and the ${LinkTo('types-coercion', 'coercions')} R applies between types.`,
			capabilities: [
				{
					name:        'Primitive',
					id:          'types-primitive',
					code:        ['typeof', 'mode'],
					supported:   'not',
					description: `_The atomic types \`numeric\`, \`character\`, \`logical\`, ..._ \`typeof\`, \`class\`, and \`mode\` are not evaluated and resolve to the unknown top value, so not even a ${LinkTo('literal-values', 'literal')} yields its type.`,
					example:     codeBlock('r', 'typeof(1L)\nclass(1)\nmode("a")'),
					url:         [RLang('Basic types')]
				},
				{
					name:        'Non-Primitive',
					id:          'types-non-primitive',
					supported:   'not',
					description: `_The composite types a list, a data frame, or an ${LinkTo('object-oriented-programming', 'object')} has._ None of them is tracked, so \`class(list(1, 2))\` resolves to the unknown top value.`,
					url:         [RLang('Vector objects')]
				},
				{
					name:        'Inference',
					id:          'types-inference',
					supported:   'not',
					description: `_Derive the type of an expression from the code that produces it._ A type predicate never narrows a ${LinkTo('if', 'branch')}, so \`if(is.numeric(1)) y <- 1 else y <- "a"\` still leaves \`y\` as both alternatives.`
				},
				{
					name:        'Coercion',
					id:          'types-coercion',
					code:        ['as.integer', 'as.numeric', 'as.character'],
					supported:   'partially',
					description: '_The type R silently converts a value to, as `c(1, "a")` or `TRUE + 1` do._ A vector is not unified, so `c(1, "a")` keeps a number beside a string, and the `as.*` converters are not evaluated.',
					example:     codeBlock('r', 'c(1, "a")\nTRUE + 1\nas.integer("3")'),
					url:         [RLang('Basic types')]
				},
			]
		}
	]
} as const satisfies FlowrCapabilities;
