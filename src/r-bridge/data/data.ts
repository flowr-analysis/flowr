import type { FlowrCapabilities } from './types';
import { FlowrWikiBaseRef, flowrSourceFileUrl } from '../../documentation/doc-util/doc-files';
import { codeBlock } from '../../documentation/doc-util/doc-code';
import { printDfGraphForCode } from '../../documentation/doc-util/doc-dfg';
import { MIN_VERSION_LAMBDA, MIN_VERSION_PIPE, MIN_VERSION_PIPE_BIND, MIN_VERSION_RAW_STABLE } from '../lang-4.x/ast/model/versions';

const Joiner = '/';
const AdvancedR = (subname: string) => 'Advanced R' + Joiner + subname;
const RLang = (subname: string) => 'R Definition' + Joiner + subname;
const LinkTo = (id: string, label = id) => `[${label}](#${id})`;
const Wiki = (page: string, label: string) => `[${label}](${FlowrWikiBaseRef}/${page.replaceAll(' ', '-')})`;
const Plugin = (name: string, path: string) => ({ name: `plugin/${name.replace(/^flowr-/, '').replace(/-plugin$/, '')}`, href: flowrSourceFileUrl(path) });

export const flowrCapabilities = {
	name:         'Capabilities of flowR',
	description:  'This is an evolving representation of what started with #636 to formulate capabilities in a structured format.',
	version:      '0.0.2',
	capabilities: [
		{
			name:        'Names and Identifiers',
			id:          'names-and-identifiers',
			description: 'Recognizing the names an R program uses and resolving them to definitions.',
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
					capabilities: [
						{
							name:        'Normal',
							id:          'name-normal',
							supported:   'fully',
							description: '_Recognize symbol uses like `a`, `plot`, ..._  (i.e., "normal variables or function calls").',
							url:         [
								{ name: AdvancedR('Bindings'), href: 'https://adv-r.hadley.nz/names-values.html#binding-basics' },
								{ name: RLang('Identifiers'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Identifiers-1' }
							]
						},
						{
							name:        'Quoted',
							id:          'name-quoted',
							supported:   'fully',
							description: "_Recognize `\"a\"`, `'plot'`, ..._ R lets a name be quoted so it may hold spaces and the like, but only where it is defined; reaching it as a variable needs `get` or backticks.",
							example:     codeBlock('r', '"my fn" <- function(x) x\n`my fn`(3)\nget("my fn")(3)'),
							url:         [
								{ name: AdvancedR('Non-Syntactic Names'), href: 'https://adv-r.hadley.nz/names-values.html#non-syntactic' }
							]
						},
						{
							name:        'Escaped',
							id:          'name-escaped',
							supported:   'fully',
							description: '_Recognize `` `a` ``, `` `plot` ``, ..._',
							example:     codeBlock('r', '`my var` <- 1\n`my var` + 1'),
							url:         [
								{ name: AdvancedR('Non-Syntactic Names'), href: 'https://adv-r.hadley.nz/names-values.html#non-syntactic' }
							]
						},
						{
							name:        'Created',
							id:          'name-created',
							supported:   'fully',
							description: '_Recognize functions that treat a string argument as the identifier it names, such as `get`, `get0`, `mget`, `exists`, `match.fun`, and `assign`._ A name only known at runtime (`get(Sys.getenv("V"))`) names no identifier we could link.',
							example:     codeBlock('r', 'x <- 1\nr <- get("x")\nprint(r)'),
							url:         [
								{ name: RLang('Identifiers'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Identifiers-1' }
							]
						},
						{
							name:        'Resolved Name',
							id:          'name-created-resolved',
							supported:   'fully',
							description: '_Recognize a name resolved to a constant string and follow it like a written-out one._ Covers literals, variables, and `paste0`/`paste`/`file.path` folded over constants.',
							example:     codeBlock('r', 'nm <- paste0("x", 1)\nassign(nm, 42)\nget(nm)'),
							url:         [
								{ name: RLang('Identifiers'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Identifiers-1' }
							]
						}
					]
				},
				{
					name:         'Resolution',
					id:           'resolution',
					capabilities: [
						{
							name:        'Global Scope',
							id:          'global-scope',
							supported:   'fully',
							description: '_For example, tracking a big table of current identifier bindings_',
							example:     codeBlock('r', 'x <- 1\nf <- function() x\nf()'),
							url:         [
								{ name: RLang('Global environment'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Global-environment' }
							]
						},
						{
							name:        'Lexicographic Scope',
							id:          'lexicographic-scope',
							supported:   'fully',
							description: '_For example, support function definition scopes_',
							example:     codeBlock('r', 'f <- function() {\n  y <- 1\n  g <- function() y\n  g()\n}\nf()'),
							url:         [
								{ name: RLang('Lexical environment'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Lexical-environment' }
							]
						},
						{
							name:        'Closures',
							id:          'closures',
							supported:   'partially',
							description: '_Two closures from the same [factory](https://adv-r.hadley.nz/function-factories.html) keep independent state in R._ A `<<-` in one is over-approximated as reaching the other.',
							example:     codeBlock('r', 'counter <- function() {\n  i <- 0\n  function() {\n    i <<- i + 1\n    i\n  }\n}\nc1 <- counter()\nc2 <- counter()\nc1()\nc1()\nr <- c2()\nprint(r)'),
							url:         [
								{ name: AdvancedR('Function factories'), href: 'https://adv-r.hadley.nz/function-factories.html' },
								{ name: RLang('Scope of variables'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Scope-of-variables' }
							]
						},
						{
							name:        'Closure Capture',
							id:          'closure-capture',
							supported:   'fully',
							description: '_Handle ordinary [function-factory](https://adv-r.hadley.nz/function-factories.html) capture._ A closure sees later writes to its enclosing environment, including from a sibling closure.',
							example:     codeBlock('r', 'make <- function() {\n  x <- 1\n  list(get = function() x, set = function(v) x <<- v)\n}\no <- make()\no$set(5)\nr <- o$get()\nprint(r)'),
							url:         [
								{ name: AdvancedR('Function factories'), href: 'https://adv-r.hadley.nz/function-factories.html' },
								{ name: RLang('Scope of variables'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Scope-of-variables' }
							]
						},
						{
							name:         'Dynamic Environment Resolution',
							id:           'dynamic-environment-resolution',
							description:  '_For example, using `new.env` and friends._ Covers `new.env`, `assign`/`get`/`local` with `envir=`, `e$x`, `attach`, `with`, and env-variable aliasing.',
							example:      codeBlock('r', 'e <- new.env()\nassign("x", 3, envir = e)\nget("x", envir = e) + e$x'),
							capabilities: [
								{
									name:        'Environment in Control Flow',
									id:          'environment-in-conditionals',
									supported:   'fully',
									description: '_Track environment assignments and reads across branches and loop bodies, a key built at run time such as `paste0("k", i)` included._'
								},
								{
									name:        'Environment Parent',
									id:          'environment-parent',
									supported:   'partially',
									description: '_Specifying a parent for a newly-created environment from a dynamic or unknown expression (`new.env(parent = f())`)._ Such a parent falls back to the default (`parent.frame()`) instead of resolving.'
								},
								{
									name:        'Environment Parent (Tracked)',
									id:          'environment-parent-tracked',
									supported:   'fully',
									description: '_Specifying a parent for a newly-created environment from a tracked environment variable or a constant (`new.env(parent = e)`, `new.env(parent = emptyenv())`)._'
								},
								{
									name:        'Environment Alias',
									id:          'environment-alias',
									supported:   'partially',
									description: '_Aliasing a tracked environment variable (`alias <- e`)._ An assign to the original variable made AFTER the alias is not reflected through the alias.'
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
									supported:   'fully',
									description: '_Evaluating an expression inside a named environment with `with(data, expr)`._ Reads of names the tracked env defines resolve, including through a computed `data` argument or a nested call.'
								},
								{
									name:        'Parent Frame',
									id:          'parent-frame',
									supported:   'partially',
									description: '_Reading via `parent.frame()$name`, and a write escaping through `eval.parent(quote(name <- value))`._ Works only one call away; storing the frame first drops the binding.',
									url:         [
										{ name: AdvancedR('Call stacks'), href: 'https://adv-r.hadley.nz/environments.html#call-stack' }
									]
								},
								{
									name:        'Dynamic Variable Removal',
									id:          'dynamic-variable-removal',
									supported:   'partially',
									description: '_Support for `rm(list=..., envir=sys.frame(N))` removing variables from a specific call frame. Currently handles negative and zero offsets from within depth-1 functions._'
								}
							],
							url: [
								{ name: RLang('Environment objects'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Environment-objects' }
							]
						},
						{
							name:        'Environment Sharing',
							id:          'environment-sharing',
							supported:   'partially',
							description: `_Handling side-effects through environments, which act as reference types and are not copied when modified._ Not through \`assign(..., envir = <parameter>)\`; see ${LinkTo('environment-alias')} and ${LinkTo('side-effects-in-function-call')}.`,
							example:     codeBlock('r', 'e <- new.env()\nassign("x", 42, envir = e)\nprint(get("x", envir = e))'),
							url:         [
								{ name: RLang('Environment objects'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Environment-objects' },
								{ name: AdvancedR('Environments'), href: 'https://adv-r.hadley.nz/environments.html' }
							]
						},
						{
							name:        'Search Type',
							id:          'search-type',
							supported:   'fully',
							description: '_Separating the resolution for functions and symbols._',
							example:     codeBlock('r', 'c <- 1\nc(c, 2)')
						},
						{
							name:        'Search Path',
							id:          'search-path',
							supported:   'fully',
							description: "_Handling [R's search path](https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Search-path)._ Attached packages sit below `.GlobalEnv`, so a global binding shadows an export.",
							example:     codeBlock('r', 'library(dplyr)\nfilter <- function(...) "mine"\nfilter(1)')
						},
						{
							name:        'Dynamic Search Path',
							id:          'dynamic-search-path',
							supported:   'not',
							description: '_Programmatically inspecting or mutating the search path with `search()`, `searchpaths()`, or detaching by position._ None of this is modelled; `search()` reads as an unknown call.',
							example:     codeBlock('r', 'library(stats)\nn <- search()\nprint(n[2])'),
							url:         [
								{ name: RLang('Search path'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Search-path' }
							]
						},
						{
							name:        'Namespaces',
							id:          'namespaces',
							supported:   'fully',
							description: "_Handling R's namespaces ([Advanced R](https://adv-r.hadley.nz/environments.html#namespaces))._ The imports environment a package carries for itself is not modelled."
						},
						{
							name:        'Accessing Exported Names',
							id:          'accessing-exported-names',
							supported:   'fully',
							description: `_Resolving calls with \`::\` to their origin._ Depends on what the ${Wiki('Signature Database', 'signature database')} knows; an unresolved name is left unresolved rather than reported.`,
							example:     codeBlock('r', 'median <- function(x) 0\nmedian(1:3)\nstats::median(1:3)')
						},
						{
							name:        'Accessing Internal Names',
							id:          'accessing-internal-names',
							supported:   'fully',
							description: `_Similar to \`::\` but for internal names._ Whether the name was genuinely internal rather than exported is not checked (see ${LinkTo('namespace-exports')}).`,
							example:     codeBlock('r', '"C_cor" %in% getNamespaceExports("stats")\nstats:::C_cor$name')
						},
						{
							name:        'Namespace Exports',
							id:          'namespace-exports',
							supported:   'fully',
							description: `_Know which names a package's namespace declares exported versus keeps internal._ The ${Wiki('Linter', '`namespace-access` rule')} checks a \`::\`/\`:::\` choice against what the ${Wiki('Signature Database', 'signature database')} records, which omits most internal names to stay small.`,
							example:     codeBlock('r', 'stats::median(1:3)\nstats:::C_cor'),
							url:         [
								{ name: 'Writing R Extensions/Package namespaces', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Package-namespaces' }
							]
						},
						{
							name:        'Library Loading',
							id:          'library-loading',
							supported:   'fully',
							description: '_Resolve libraries identified with `library`, `require`, `attachNamespace`, ... and attach them to the search path._ A script binding still shadows an export.',
							example:     codeBlock('r', 'library(stats)\nrequire(utils)\nattachNamespace("tools")')
						},
						{
							name:        'Library Unloading',
							id:          'library-unloading',
							supported:   'not',
							description: '_Undo an attach with `detach`, `unloadNamespace`, ..._ Neither is modelled, so a name resolved after `detach` still resolves through it.',
							example:     codeBlock('r', 'library(stats)\nmedian(1:3)\ndetach("package:stats")\nmedian(1:3)'),
							url:         [
								{ name: RLang('Search path'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Search-path' }
							]
						},
						{
							name:        'Dynamic Scope Changes',
							id:          'dynamic-scope-changes',
							supported:   'fully',
							description: '_Manually changing scopes with a plain [`local`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/local) block._ It gets a scope of its own, and a `<<-` from within reaches out.',
							example:     codeBlock('r', 'x <- 1\nlocal({\n  x <- 2\n  x\n})\nx')
						},
						{
							name:        'Local with Explicit Environment',
							id:          'local-envir-argument',
							supported:   'partially',
							description: "_Send `local`'s body to a specific environment._ `new.env()` and `globalenv()` work; inside a function that already binds the name, the write lands in that frame instead.",
							example:     codeBlock('r', 'e <- new.env()\nlocal(y <- 2, envir = e)\nget("y", envir = e)'),
							url:         [
								{ name: '`local`', href: 'https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/local' }
							]
						},
						{
							name:        'Anonymous Bindings',
							id:          'anonymous-bindings',
							supported:   'fully',
							description: '_Support for [`Recall`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/Recall)_',
							example:     codeBlock('r', 'fact <- function(n) if(n <= 1) 1 else n * Recall(n - 1)\nfact(5)')
						}
					]
				}
			]
		},
		{
			name:         'Expressions',
			id:           'expressions',
			description:  'Everything comprising the structure of an R program',
			capabilities: [
				{
					name:         'Calls',
					id:           'function-calls',
					capabilities: [
						{
							name:        'Grouping',
							id:          'grouping',
							supported:   'fully',
							description: '_Recognize groups done with `(`, `{`, ... (more precisely, their default mapping to the primitive implementations)._',
							example:     codeBlock('r', 'x <- {\n  1\n  2\n}\ny <- (3)'),
							url:         [
								{ name: RLang('Grouping'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Grouping' }
							]
						},
						{
							name:         'Normal Call',
							id:           'call-normal',
							supported:    'fully',
							description:  '_Recognize and resolve calls like `f(x)`, `foo::bar(x, y)`, ..._',
							capabilities: [
								{
									name:        'Unnamed Arguments',
									id:          'unnamed-arguments',
									supported:   'fully',
									description: '_Recognize and resolve calls like `f(3)`, `foo::bar(3, c(1,2))`, ..._',
									url:         [
										{ name: RLang('Arguments'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Arguments' }
									]
								},
								{
									name:        'Empty Arguments',
									id:          'empty-arguments',
									supported:   'fully',
									description: '_Essentially a special form of an unnamed argument as in `foo::bar(3, ,42)`, ..._',
									example:     codeBlock('r', 'm <- matrix(1:6, nrow = 2)\nm[1, ]\nm[, 2]'),
									url:         [
										{ name: RLang('Arguments'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Arguments' }
									]
								},
								{
									name:        'Named Arguments',
									id:          'named-arguments',
									supported:   'fully',
									description: '_Recognize and resolve calls like `f(x = 3)`, `foo::bar(x = 3, y = 4)`, ..._',
									url:         [
										{ name: RLang('Argument matching'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Argument-matching' }
									]
								},
								{
									name:        'String Arguments',
									id:          'string-arguments',
									supported:   'fully',
									description: '_Recognize and resolve calls like `f(\'x\' = 3)`, `foo::bar(\'x\' = 3, "y" = 4)`, ..._'
								},
								{
									name:        'Resolve Arguments',
									id:          'resolve-arguments',
									supported:   'fully',
									description: '_Correctly bind arguments (including [`pmatch`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/pmatch))._ A formal behind `...` matches only exactly, and an ambiguous prefix binds nothing.',
									example:     codeBlock('r', 'f <- function(verbose = FALSE, value = 0) c(verbose, value)\nf(TRUE, val = 3)\nf(verb = TRUE)'),
									url:         [
										{ name: RLang('Argument matching'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Argument-matching' }
									]
								},
								{
									name:        'Side-Effects in Argument',
									id:          'side-effects-in-argument',
									supported:   'partially',
									description: '_Handle side-effects of arguments (e.g., `f(x <- 3)`, `f(x = y <- 3)`, ...)._ Whether the argument is ever forced is not modelled, so `f <- function(a) 1; f(x <- 3)` still believes `x` is 3.',
									example:     codeBlock('r', 'f <- function(a) a\nf(x <- 3)\nx'),
									url:         [
										{ name: RLang('Argument evaluation'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Argument-evaluation' }
									]
								},
								{
									name:        'Side-Effects in Function Call',
									id:          'side-effects-in-function-call',
									supported:   'partially',
									description: '_Handle side-effects of function calls (e.g., `setXTo(3)`, ...) achieved via super assignment._ A `<<-` reaches the caller through several call levels; a write through a shared environment is missed.',
									example:     codeBlock('r', 'set_x <- function(v) x <<- v\nset_x(3)\nx')
								}
							],
							url: [
								{ name: RLang('Function calls'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Function-calls' }
							]
						},
						{
							name:        'Recursion',
							id:          'recursion',
							supported:   'fully',
							description: '_Recognize and resolve recursive calls like `f(3)` inside the definition of `f`, ..._',
							example:     codeBlock('r', 'fib <- function(n) if(n < 2) n else fib(n - 1) + fib(n - 2)\nfib(10)')
						},
						{
							name:        'Anonymous Calls',
							id:          'call-anonymous',
							supported:   'fully',
							description: '_Recognize and resolve calls like `(function(x) x)(3)`, `factory(0)()`, ..._',
							example:     codeBlock('r', '(function(x) x + 1)(3)\nfactory <- function() function() 42\nfactory()()')
						},
						{
							name:        'Infix Calls',
							id:          'infix-calls',
							supported:   'fully',
							description: '_Recognize and resolve calls like `x + y`, `x %>% f(y)`, ..._',
							example:     codeBlock('r', 'identical(1 + 2, `+`(1, 2))'),
							url:         [
								{ name: RLang('Infix and prefix operators'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Infix-and-prefix-operators' }
							]
						},
						{
							name:        'Redefinition of Built-In Functions/primitives',
							id:          'redefinition-of-built-in-functions-primitives',
							supported:   'fully',
							description: '_Handle cases like `print <- function(x) x`, `` `for` <- function(a,b,c) a``, ..._ A redefined name wins wherever the built-in would have been used, with scope and order respected. Only `::`/`:::` are exempt.',
							example:     codeBlock('r', '`+` <- function(a, b) a * b\n2 + 3'),
							url:         [
								{ name: RLang('Builtin objects and special forms'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Builtin-objects-and-special-forms' }
							]
						},
						{
							name:        'Functions with global side effects',
							id:          'functions-with-global-side-effects',
							supported:   'partially',
							description: '_Support functions like `setwd` which have an impact on the subsequent program._ Only the working directory is interpreted; other ambient state is an unknown side effect.',
							example:     codeBlock('r', 'setwd("/tmp")\nread.csv("data.csv")')
						},
						{
							name:        'Working Directory',
							id:          'working-directory',
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
							supported:   'fully',
							description: '_Detect calls like `x[i]`, `x[i, ,b]`, `x[3][y]`, ... This does not include the real separation of cells, which is handled extra._',
							example:     codeBlock('r', 'l <- list(a = 1, b = 2)\nl["a"]\nl[c("a", "b")]')
						},
						{
							name:        'Double Bracket Access',
							id:          'double-bracket-access',
							supported:   'fully',
							description: '_Detect calls like `x[[i]]`, `x[[i, b]]`, ... Similar to single bracket._',
							example:     codeBlock('r', 'l <- list(a = 1, b = 2)\nl[["a"]]\nl[[2]]')
						},
						{
							name:        'Dollar Access',
							id:          'dollar-access',
							supported:   'fully',
							description: '_Detect calls like `x$y`, `x$"y"`, `x$y$z`, ..._ On a list, `$` matches the name partially, so `l$al` reaches an element named `alpha`.',
							example:     codeBlock('r', 'l <- list(alpha = 1)\nl$alpha\nl$al'),
							url:         [
								{ name: RLang('Operators'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Operators' }
							]
						},
						{
							name:        'Slot Access',
							id:          'slot-access',
							supported:   'fully',
							description: '_Detect calls like `x@y`, `x@y@z`, ..._',
							example:     codeBlock('r', 'setClass("P", representation(x = "numeric"))\np <- new("P", x = 1)\np@x'),
							url:         [
								{ name: RLang('Classes'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Classes' }
							]
						},
						{
							name:        'Access with Argument-Names',
							id:          'access-with-argument-names',
							supported:   'fully',
							description: '_Detect calls like `x[i = 3]`, `x[[i=]]`, ..._'
						},
						{
							name:        'Access with Empty',
							id:          'access-with-empty',
							supported:   'fully',
							description: '_Detect calls like `x[]`, `x[2,,42]`, ..._'
						},
						{
							name:        'Subsetting (Multiple Indices)',
							id:          'subsetting-multiple',
							supported:   'fully',
							description: '_Detect calls like `x[i > 3]`, `x[c(1,3)]`, ..._',
							example:     codeBlock('r', 'v <- c(a = 1, b = 2, c = 3)\nv[c(1, 3)]\nv[v > 1]')
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
							description: '_Recognize and resolve calls like `+3`, `-3`, ..._',
							url:         [
								{ name: RLang('Operators'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Operators' }
							]
						},
						{
							name:         'Binary Operator',
							id:           'binary-operator',
							supported:    'fully',
							description:  '_Recognize and resolve calls like `3 + 4`, `3 * 4`, ..._',
							capabilities: [
								{
									name:        'Special Operator',
									id:          'special-operator',
									supported:   'fully',
									description: '_Recognize and resolve calls like `3 %in% 4`, `3 %*% 4`, ..._',
									example:     codeBlock('r', '`%between%` <- function(x, r) x >= r[1] & x <= r[2]\n5 %between% c(1, 10)'),
									url:         [
										{ name: RLang('Operator tokens'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Operator-tokens' }
									]
								},
								{
									name:        'Model Formula',
									id:          'model-formula',
									supported:   'partially',
									description: '_Recognize and resolve calls like `y ~ x`, `y ~ x + z`, ..._ The operands of `~` are non-standard evaluation, so a bare `y ~ x` reads neither name.',
									example:     codeBlock('r', 'k <- 2\nf <- y ~ poly(x, k)\nall.vars(f)')
								},
								{
									name:         'Assignments and Bindings',
									id:           'assignments-and-bindings',
									capabilities: [
										{
											name:        'Local Left Assignment',
											id:          'local-left-assignment',
											supported:   'fully',
											description: '_Handle `x <- 3`, `x$y <- 3`, ..._'
										},
										{
											name:        'Local Right Assignment',
											id:          'local-right-assignment',
											supported:   'fully',
											description: '_Handle `3 -> x`, `3 -> x$y`, ..._'
										},
										{
											name:        'Local Equal Assignment',
											id:          'local-equal-assignment',
											supported:   'fully',
											description: '_Handle `x = 3`, `x$y = 3`, ..._ At the start of an expression `=` binds a name, while inside a call it names an argument (`f(a = 3)`).',
											example:     codeBlock('r', 'x = 3\nf <- function(a) a\nf(a = x)')
										},
										{
											name:        'Local Table Assignment',
											id:          'local-table-assignment',
											supported:   'fully',
											description: '_Handle `x[,a:=3,]`, ..._'
										},
										{
											name:        'Super Left Assignment',
											id:          'super-left-assignment',
											supported:   'fully',
											description: '_Handle `x <<- 42`, `x$y <<- 42`, ..._'
										},
										{
											name:        'Super Right Assignment',
											id:          'super-right-assignment',
											supported:   'fully',
											description: '_Handle `42 ->> x`, `42 ->> x$y`, ..._'
										},
										{
											name:        'Return Value of Assignments',
											id:          'return-value-of-assignments',
											supported:   'fully',
											description: '_Handle `x <- 3` returning `3`, e.g., in `x <- y <- 3`_',
											example:     codeBlock('r', 'x <- y <- 3\nprint(x <- 4)')
										},
										{
											name:        'Assignment Functions',
											id:          'assignment-functions',
											supported:   'partially',
											description: '_Handle `assign(x, 3)`, `delayedAssign(x, 3)`, ..._ What a delayed assignment does when forced is not modelled.',
											example:     codeBlock('r', 'assign("x", 3)\ndelayedAssign("y", x * 2)\ny')
										},
										{
											name:        'Range Assignment',
											id:          'range-assignment',
											supported:   'fully',
											description: '_Handle `x[1:3] <- 3`, `x$y[1:3] <- 3`, ..._',
											example:     codeBlock('r', 'x <- 1:5\nx[2:3] <- 0\nx')
										},
										{
											name:        'Replacement Functions',
											id:          'replacement-functions',
											supported:   'partially',
											description: '_Handle `x[i] <- 3`, `x$y <- 3`, ... as `` `[<-`(x, 3) ``, ..._ A named argument in such a call (`g(v, k = 2) <- 3`) leaves its argument edge dangling.',
											example:     codeBlock('r', '`second<-` <- function(x, value) {\n  x[2] <- value\n  x\n}\nv <- 1:3\nsecond(v) <- 9\nv')
										},
										{
											name:        'Locked Bindings',
											id:          'locked-bindings',
											supported:   'not',
											description: '_Handle `lockBinding(x, 3)`, ..._ `lockBinding` is not recognized as a built-in, so the assignment it should have rejected is analyzed as an ordinary redefinition.',
											example:     codeBlock('r', 'x <- 1\nlockBinding("x", environment())\nx <- 2'),
											url:         [
												{ name: RLang('Environment objects'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Environment-objects' }
											]
										}
									]
								}
							],
							url: [
								{ name: RLang('Operators'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Operators' }
							]
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
							supported:   'fully',
							description: '_Handle `if (x) y else z`, `if (x) y`, ..._',
							example:     codeBlock('r', 'x <- if(TRUE) 1 else 2\ny <- if(FALSE) 3\ny'),
							url:         [
								{ name: RLang('if'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#if' }
							]
						},
						{
							name:        'for loop',
							id:          'for-loop',
							supported:   'fully',
							description: '_Handle `for (i in 1:3) print(i)`, ..._',
							example:     codeBlock('r', 'for(i in 1:3) print(i)\ni'),
							url:         [
								{ name: RLang('Looping'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Looping' }
							]
						},
						{
							name:        'while loop',
							id:          'while-loop',
							supported:   'fully',
							description: '_Handle `while (x) b`, ..._',
							example:     codeBlock('r', 'i <- 0\nwhile(i < 3) i <- i + 1\ni'),
							url:         [
								{ name: RLang('while'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#while' }
							]
						},
						{
							name:        'repeat loop',
							id:          'repeat-loop',
							supported:   'fully',
							description: '_Handle `repeat {b; if (x) break}`, ..._',
							example:     codeBlock('r', 'i <- 0\nrepeat {\n  i <- i + 1\n  if(i > 2) break\n}\ni'),
							url:         [
								{ name: RLang('repeat'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#repeat' }
							]
						},
						{
							name:        'break',
							id:          'break',
							supported:   'fully',
							description: '_Handle `break` (including `break()`) ..._',
							example:     codeBlock('r', 'for(i in 1:5) {\n  if(i == 4) break\n  print(i)\n}'),
							url:         [
								{ name: RLang('Control structures'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Control-structures' }
							]
						},
						{
							name:        'next',
							id:          'next',
							supported:   'fully',
							description: '_Handle `next` (including `next()`) ..._',
							example:     codeBlock('r', 'for(i in 1:5) {\n  if(i %% 2 == 0) next\n  print(i)\n}'),
							url:         [
								{ name: RLang('Control structures'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Control-structures' }
							]
						},
						{
							name:        'switch',
							id:          'switch',
							supported:   'fully',
							description: '_Handle `switch(3, "a", "b", "c")`, ..._',
							example:     codeBlock('r', 'switch("b", a = , b = "ab", c = "c")\nswitch(2, "one", "two")'),
							url:         [
								{ name: RLang('Control structures'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Control-structures' }
							]
						},
						{
							name:        'return',
							id:          'return',
							supported:   'fully',
							description: '_Handle `return(3)`, ... in function definitions_',
							example:     codeBlock('r', 'f <- function(x) {\n  if(x > 0) return("pos")\n  "non-pos"\n}\nf(1)')
						},
						{
							name:        'Exceptions and Errors',
							id:          'exceptions-and-errors',
							supported:   'partially',
							description: '_Handle `try`, `stop`, ..._ A path where a call throws before a write is not kept open, so `tryCatch({ risky(); x <- 2 }, ...)` loses `x`.',
							example:     codeBlock('r', 'tryCatch(\n  stop("boom"),\n  error = function(e) conditionMessage(e),\n  finally = print("done")\n)'),
							url:         [
								{ name: RLang('Exception handling'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Exception-handling' },
								{ name: AdvancedR('Conditions'), href: 'https://adv-r.hadley.nz/conditions.html' }
							]
						}
					]
				},
				{
					name:         'Function Definitions',
					id:           'function-definitions',
					description:  'Parameters and their defaults, `...`, promises, and the value a function hands back.',
					capabilities: [
						{
							name:        'Normal',
							id:          'normal-definition',
							supported:   'fully',
							description: '_Handle `function() 3`, ..._',
							url:         [
								{ name: RLang('Function definitions'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Function-definitions' }
							]
						},
						{
							name:         'Formals',
							id:           'formals',
							capabilities: [
								{
									name:        'Named',
									id:          'formals-named',
									supported:   'fully',
									description: '_Handle `function(x) x`, ..._',
									url:         [
										{ name: RLang('Arguments'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Arguments' }
									]
								},
								{
									name:        'Default',
									id:          'formals-default',
									supported:   'fully',
									description: '_Handle `function(x = 3) x`, ..._',
									example:     codeBlock('r', 'f <- function(x, y = x * 2) y\nf(3)')
								},
								{
									name:        'Dot-Dot-Dot',
									id:          'formals-dot-dot-dot',
									supported:   'fully',
									description: '_Handle `function(...) 3`, ..._',
									example:     codeBlock('r', 'f <- function(...) sum(...)\ng <- function(...) f(..., 1)\ng(2, 3)'),
									url:         [
										{ name: RLang('Dot-dot-dot'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Dot_002ddot_002ddot' }
									]
								},
								{
									name:        'Promises',
									id:          'formals-promises',
									supported:   'partially',
									description: '_Handle `function(x = y) { y <- 3; x }`, ..._ We do not model when a promise is forced, nor the writes forcing it performs.',
									example:     codeBlock('r', 'f <- function(x = y) {\n  y <- 3\n  x\n}\nf()'),
									url:         [
										{ name: RLang('Promise objects'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Promise-objects' },
										{ name: AdvancedR('Lazy evaluation'), href: 'https://adv-r.hadley.nz/functions.html' }
									]
								}
							]
						},
						{
							name:        'Implicit Return',
							id:          'implicit-return',
							supported:   'fully',
							description: '_Handle the return of `function() 3`, ..._',
							url:         [
								{ name: RLang('Function definitions'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Function-definitions' }
							]
						},
						{
							name:        'Lambda Syntax',
							id:          'lambda-syntax',
							supported:   'fully',
							minRVersion: MIN_VERSION_LAMBDA,
							description: '_Support `\\(x) x`, ..._',
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
							supported:   'fully',
							description: '_Handle `&&`, `||`, ..._',
							example:     codeBlock('r', 'FALSE && stop("never evaluated")\nTRUE || stop("never evaluated")'),
							url:         [
								{ name: RLang('Operators'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Operators' }
							]
						},
						{
							name:        'Pipe',
							id:          'pipe-and-pipe-bind',
							supported:   'fully',
							minRVersion: MIN_VERSION_PIPE,
							description: '_Handle the [native pipe](https://www.r-bloggers.com/2021/05/the-new-r-pipe/) `|>`._ The left-hand side becomes the first argument or fills the `_` placeholder.',
							example:     codeBlock('r', 'c(1, 2, 3) |> sum() |> sqrt()\nmtcars |> subset(cyl == 4)'),
							url:         [
								{ name: RLang('Function calls'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Function-calls' }
							]
						},
						{
							name:        'Pipe-Bind',
							id:          'pipe-bind',
							supported:   'partially',
							minRVersion: MIN_VERSION_PIPE_BIND,
							description: '_Handle the experimental pipe-bind `=>`, which R only enables under `_R_USE_PIPEBIND_`._ Off by default; needs `engine.r-shell.pipeBind`. Tree-sitter\'s grammar has no production for it at all.',
							example:     codeBlock('r', 'mtcars |> df => lm(mpg ~ cyl, data = df)'),
							url:         [
								{ name: RLang('Function calls'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Function-calls' }
							]
						},
						{
							name:        'Sequencing',
							id:          'built-in-sequencing',
							supported:   'partially',
							description: '_Handle `:`, `seq`, ... by gathering value information using abstract interpretation._ `seq`, `seq_len`, `seq_along`, and `rep` are not folded even for literal arguments.',
							example:     codeBlock('r', 'n <- 0\n1:n\nseq_len(n)')
						},
						{
							name:        'Internal and Primitive Functions',
							id:          'built-in-internal-and-primitive-functions',
							supported:   'partially',
							description: '_Handle `.Internal`, `.Primitive`, ..._ The call is kept and its arguments read, but the primitive a `.Primitive("sum")` names is not resolved to the built-in of that name.',
							example:     codeBlock('r', '.Primitive("+")(1, 2)\n.Internal(inspect(1))'),
							url:         [
								{ name: RLang('.Internal and .Primitive'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#g_t_002eInternal-and-_002ePrimitive' }
							]
						},
						{
							name:        'Options',
							id:          'built-in-options',
							supported:   'partially',
							description: '_Handle `options`, `getOption`, ..._ Option values are not tracked, so `getOption("digits")` does not reach a preceding `options(digits = 3)`.',
							example:     codeBlock('r', 'old <- options(digits = 3)\ngetOption("digits")\noptions(old)')
						},
						{
							name:        'Help',
							id:          'built-in-help',
							supported:   'partially',
							description: '_Handle `help`, `?`, ..._ `?` and `??` are recognized, but their topic is read as an ordinary variable where R only looks it up, and `help`/`help.search` are not known at all.',
							example:     codeBlock('r', '?sum\nhelp("sum")')
						},
						{
							name:         'Reflection / "Computing on the Language"',
							id:           'reflection-"computing-on-the-language"',
							capabilities: [
								{
									name:        'Get Function Structure',
									id:          'get-function-structure',
									supported:   'partially',
									description: '_Handle `body`, `formals`, `args`, `environment` to access the respective parts of a function._ What comes back is opaque, and reading only `formals(f)` keeps all of `f`\'s body in a slice.',
									example:     codeBlock('r', 'f <- function(x) x + 1\nbody(f)\nformals(f)\nenvironment(f)'),
									url:         [
										{ name: RLang('Manipulation of functions'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Manipulation-of-functions' }
									]
								},
								{
									name:        'Modify Function Structure',
									id:          'modify-function-structure',
									supported:   'partially',
									description: '_Handle `body<-`, `formals<-`, `environment<-` to modify the respective parts of a function._ The function is redefined, so a later call reaches the new part as well as the original one.',
									example:     codeBlock('r', 'f <- function(x) x + 1\nbody(f) <- quote(x * 2)\nf(3)'),
									url:         [
										{ name: RLang('Manipulation of functions'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Manipulation-of-functions' }
									]
								},
								{
									name:        'Quoting',
									id:          'built-in-quoting',
									supported:   'partially',
									description: "_Handle `quote`, `substitute`, `bquote`, ..._ A quoted argument is non-standard evaluation; `substitute` does not reach the caller's expression.",
									example:     codeBlock('r', 'x <- 1\nquote(x + y)\nbquote(.(x) + y)'),
									url:         [
										{ name: RLang('Computing on the language'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Computing-on-the-language' },
										{ name: AdvancedR('Metaprogramming'), href: 'https://adv-r.hadley.nz/metaprogramming.html' }
									]
								},
								{
									name:        'Evaluation',
									id:          'built-in-evaluation',
									supported:   'partially',
									description: '_Handle `eval`, `evalq`, `eval.parent`, ..._ `eval(expr, envir)` runs elsewhere, so we mark it an unknown side effect.',
									example:     codeBlock('r', 'e <- quote(x + 1)\nx <- 2\neval(e)'),
									url:         [
										{ name: RLang('Evaluation of expressions'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Evaluation-of-expressions' },
										{ name: AdvancedR('Evaluation'), href: 'https://adv-r.hadley.nz/evaluation.html' }
									]
								},
								{
									name:        'String Templates',
									id:          'string-templates',
									supported:   'partially',
									description: '_Handle `glue::glue("{x}")`, `cli::cli_alert_info("{.val {x}}")`, `stringr::str_glue`, ..._ A template aimed at another scope (`.envir`, `.con`, `glue_data`) becomes an unknown side effect.',
									example:     codeBlock('r', 'x <- 2\nglue::glue("x plus one is {x + 1}")')
								},
								{
									name:        'Parsing',
									id:          'built-in-parsing',
									supported:   'partially',
									description: '_Handle `parse`, `deparse`, ..._ `deparse` is not modelled beyond reading its argument.',
									example:     codeBlock('r', 'eval(parse(text = "1 + 1"))\ndeparse(quote(x + y))'),
									url:         [
										{ name: RLang('The parsing process'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#The-parsing-process' },
										{ name: RLang('Deparsing'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Deparsing' }
									]
								}
							]
						}
					]
				},
				{
					name:         'Literal Values',
					id:           'literal-values',
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
									url:         [
										{ name: RLang('Literal constants'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Literal-constants' }
									]
								}
							],
							url: [
								{ name: RLang('Literal constants'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Literal-constants' }
							]
						},
						{
							name:         'Strings',
							id:           'strings',
							supported:    'fully',
							description:  "_Recognize strings like `\"a\"`, `'b'`, ..._",
							capabilities: [
								{
									name:        'Raw Strings',
									id:          'raw-strings',
									supported:   'fully',
									minRVersion: MIN_VERSION_RAW_STABLE,
									description: '_Recognize raw strings like `r"(a)"`, ..._',
									example:     codeBlock('r', 'r"(C:\\Users\\me)"\nr"[\\d+]"')
								}
							],
							url: [
								{ name: RLang('Literal constants'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Literal-constants' }
							]
						},
						{
							name:        'Logical',
							id:          'logical',
							supported:   'fully',
							description: '_Recognize the logicals `TRUE` and `FALSE`, ..._ Their short forms `T` and `F` are ordinary bindings and can be reassigned, while `TRUE` and `FALSE` are reserved.',
							example:     codeBlock('r', 'TRUE && FALSE\nT <- FALSE\nT'),
							url:         [
								{ name: RLang('Constants'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Constants' }
							]
						},
						{
							name:        'NULL',
							id:          'null',
							supported:   'fully',
							description: '_Recognize `NULL`_',
							example:     codeBlock('r', 'c(1, NULL, 2)\nl <- list(a = 1)\nl$a <- NULL\nlength(l)'),
							url:         [
								{ name: RLang('NULL object'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#NULL-object' }
							]
						},
						{
							name:        'Inf and NaN',
							id:          'inf-and-nan',
							supported:   'fully',
							description: '_Recognize `Inf` and `NaN`_',
							example:     codeBlock('r', '1 / 0\n-1 / 0\n0 / 0\nis.nan(NA)')
						}
					]
				}
			]
		},
		{
			name:         'Non-Standard Evaluations/Semantics',
			id:           'non-standard-evaluations-semantics',
			description:  'Specific support for R\'s NSE/Reflection semantics',
			capabilities: [
				{
					name:        'Data Masking',
					id:          'data-masking',
					supported:   'partially',
					description: '_Handle `subset(d, col > 1)`, dplyr verbs, `ggplot2::aes`, data.table `:=`, ..._ Which columns exist is unknown to us, so a column shadowing a variable still resolves to the variable.',
					example:     codeBlock('r', 'd <- data.frame(x = 1:3)\nthreshold <- 2\nsubset(d, x > threshold)')
				},
				{
					name:        'Recycling',
					id:          'recycling',
					supported:   'not',
					description: '_Handle recycling of vectors as explained in [Advanced R](https://adv-r.hadley.nz/vectors-chap.html)._ We do not support recycling.',
					example:     codeBlock('r', 'c(1, 2, 3, 4) + c(10, 20)'),
					url:         [
						{ name: RLang('Recycling rules'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Recycling-rules' },
						{ name: AdvancedR('Vectors'), href: 'https://adv-r.hadley.nz/vectors-chap.html' }
					]
				},
				{
					name:        'Vectorized Operator or Functions',
					id:          'vectorized-operator-or-functions',
					supported:   'partially',
					description: '_Handle vectorized operations as explained in [Advanced R](https://adv-r.hadley.nz/perf-improve.html?q=vectorised#vectorise)._ Comparisons, the reducing functions, and `ifelse` widen to the unknown value.',
					example:     codeBlock('r', 'x <- 1:5\nx * 2\nifelse(x > 2, "big", "small")')
				},
				{
					name:        'Hooks',
					id:          'hooks',
					supported:   'partially',
					description: '_Handle hooks like [`userhooks`](https://stat.ethz.ch/R-manual/R-devel/library/base/html/userhooks.html) and [`on.exit`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/on.exit)._ `setHook` is not modelled.',
					example:     codeBlock('r', 'f <- function() {\n  on.exit(print("bye"))\n  1\n}\nf()')
				},
				{
					name:        'Precedence',
					id:          'precedence',
					supported:   'fully',
					description: '_Handle the precedence of operators as explained in the [Documentation](https://rdrr.io/r/base/Syntax.html)._ We handle the precedence of operators (implicitly with the parser).',
					example:     codeBlock('r', '-2^2\n1:3 - 1\n!TRUE == FALSE'),
					url:         [
						{ name: RLang('Operator tokens'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Operator-tokens' }
					]
				},
				{
					name:         'Attributes',
					id:           'attributes',
					capabilities: [
						{
							name:        'User-Defined',
							id:          'user-defined',
							supported:   'partially',
							description: '_Handle [attributes](https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Attributes) like `attr`, `attributes`, ..._ Which attributes an object carries is not part of the value we track.',
							example:     codeBlock('r', 'x <- 1:3\nattr(x, "unit") <- "cm"\nattributes(x)'),
							url:         [
								{ name: RLang('Attributes'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Attributes' }
							]
						},
						{
							name:        'Built-In',
							id:          'built-in',
							supported:   'partially',
							description: '_Handle built-in attributes like `dim`, ..._ `dim<-`, `names<-`, `class<-` track shape on a data frame; elsewhere the attribute values are not tracked.',
							example:     codeBlock('r', 'x <- 1:6\ndim(x) <- c(2, 3)\nclass(x)'),
							url:         [
								{ name: RLang('Dimensional attributes'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Dimensional-attributes' }
							]
						}
					]
				}
			]
		},
		{
			name:         'Object-Oriented Programming',
			id:           'object-oriented-programming',
			description:  "R's object systems and what their classes and dispatch tell us about a program.",
			capabilities: [
				{
					name: 'S3',
					id:   'oop-s3',
					url:  [
						{ name: AdvancedR('S3'), href: 'https://adv-r.hadley.nz/s3.html' },
						{ name: RLang('Object-oriented programming'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Object_002doriented-programming' }
					],
					description:  '_Classes and methods built on the `class` attribute and `UseMethod` dispatch._',
					example:      codeBlock('r', 'p <- structure(list(n = "ada"), class = "pt")\nprint.pt <- function(x, ...) cat("pt", x$n, "\\n")\np'),
					capabilities: [
						{
							name:        'Class Construction',
							id:          'oop-s3-construction',
							supported:   'fully',
							description: '_Give an object its class with `structure(..., class =)`, `class<-`, or `oldClass<-`._ The class a literal names is tracked and reaches the dispatch that follows it.',
							url:         [
								{ name: RLang('Objects'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Objects' }
							]
						},
						{
							name:        'Dispatch',
							id:          'oop-s3-dispatch',
							supported:   'partially',
							description: '_Route a generic call to the method that runs._ `UseMethod` links to every `generic.class` in scope; the class does not narrow it and `registerS3method` is not followed.',
							url:         [
								{ name: RLang('UseMethod'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#UseMethod' },
								{ name: RLang('Method dispatching'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Method-dispatching' }
							]
						},
						{
							name:        'Inheritance',
							id:          'oop-s3-inheritance',
							supported:   'partially',
							description: '_Walk the class vector with `NextMethod`._ It reaches the generic\'s methods, the one it stands in included, rather than only the next class in the vector.',
							url:         [
								{ name: RLang('NextMethod'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#NextMethod' },
								{ name: RLang('Inheritance'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Inheritance' }
							]
						}
					]
				},
				{
					name: 'S4',
					id:   'oop-s4',
					url:  [
						{ name: AdvancedR('S4'), href: 'https://adv-r.hadley.nz/s4.html' }
					],
					description:  '_Formal classes and methods declared with `setClass`, `setGeneric`, and `setMethod`._',
					example:      codeBlock('r', 'setClass("P", representation(x = "numeric"))\nsetGeneric("desc", function(o) standardGeneric("desc"))\nsetMethod("desc", "P", function(o) o@x)\ndesc(new("P", x = 1))'),
					capabilities: [
						{
							name:        'Class Construction',
							id:          'oop-s4-construction',
							supported:   'fully',
							description: '_Declare a class with `setClass` and build one with `new`._ The `new` call is linked to the `setClass` that declared the class, and a slot is read through `@` like any other access.',
							url:         [
								{ name: RLang('Classes'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Classes' }
							]
						},
						{
							name:        'Dispatch',
							id:          'oop-s4-dispatch',
							supported:   'partially',
							description: '_Route a generic call to the method `setMethod` registered._ The generic reaches its methods through the chain they register in, but the signature does not narrow which of them runs.',
							url:         [
								{ name: RLang('Method dispatching'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Method-dispatching' }
							]
						},
						{
							name:        'Inheritance',
							id:          'oop-s4-inheritance',
							supported:   'not',
							description: '_Reach a parent method with `callNextMethod`, and inherit through `contains`._ `callNextMethod` is left unresolved, so nothing links it to the method it would call.',
							url:         [
								{ name: RLang('Inheritance'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Inheritance' }
							]
						}
					]
				},
				{
					name: 'RC/R5',
					id:   'oop-rc',
					url:  [
						{ name: AdvancedR('R5 / Reference classes'), href: 'https://adv-r.hadley.nz/r6.html#r6-vs-rc' }
					],
					supported:   'partially',
					description: '_Reference classes made with `setRefClass`, whose objects are mutable._ `$new()` and `$method()` on an instance are unknown side effects; no call links to the body it runs.',
					example:     codeBlock('r', 'Acc <- setRefClass("Acc",\n  fields = list(bal = "numeric"),\n  methods = list(dep = function(v) bal <<- bal + v))\na <- Acc$new(bal = 0)\na$dep(5)')
				},
				{
					name: 'R6',
					id:   'oop-r6',
					url:  [
						{ name: AdvancedR('R6'), href: 'https://adv-r.hadley.nz/r6.html' }
					],
					supported:   'partially',
					description: '_Handle R6 classes and methods as one unit._ We do not support typing, inheritance, private/active bindings, or handling objects fully "as units."',
					example:     codeBlock('r', 'Counter <- R6::R6Class("Counter", public = list(\n  i = 0,\n  add = function() {\n    self$i <- self$i + 1\n    invisible(self)\n  }\n))\nCounter$new()$add()$i')
				},
				{
					name: 'R7/S7',
					id:   'oop-r7-s7',
					url:  [
						{ name: 'R7', href: 'https://www.r-bloggers.com/2022/12/what-is-r7-a-new-oop-system-for-r/' },
						{ name: 'S7', href: 'https://cran.r-project.org/web/packages/S7/index.html' }
					],
					supported:   'partially',
					description: '_Handle R7 classes and methods as one unit, dispatch and inheritance included._ Typing is not supported, nor are objects handled fully "as units."',
					example:     codeBlock('r', 'Person <- S7::new_class("Person", properties = list(name = S7::class_character))\nPerson(name = "ada")@name')
				},
				{
					name:         'Class-Based Dependency Attribution',
					id:           'oop-class-dependency-attribution',
					supported:    'partially',
					description:  '_Attribute the use of a class to the package that owns it, so a class use implies a dependency for library detection and version guessing._',
					capabilities: [
						{
							name:        'S3 class ownership',
							id:          'class-owner-s3',
							supported:   'partially',
							description: '_Attribute an S3 class to the package that owns it._ A class name from a variable or a `c(...)` vector is not resolved.'
						},
						{
							name:        'S4 class ownership',
							id:          'class-owner-s4',
							supported:   'partially',
							description: '_Attribute an S4 class to the package that owns it._ S4 ownership is not in the signature database, so a bare class use is not attributed.'
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
					description: '_Recognize comments like `# this is a comment`, including a shebang line, ..._',
					example:     codeBlock('r', '#!/usr/bin/env Rscript\n# a comment\nx <- 1 # a trailing comment'),
					url:         [
						{ name: RLang('Comments'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Comments' }
					]
				},
				{
					name:        'Line Directive',
					id:          'line-directive',
					supported:   'partially',
					description: '_Recognize `#line n "file"` as its own node (r-shell only)._ It is parsed but never retargets a location; tree-sitter reads it as a comment.',
					example:     codeBlock('r', 'x <- 1\n#line 42 "other.R"\ny <- 2'),
					url:         [
						{ name: 'R Definition/parse', href: 'https://stat.ethz.ch/R-manual/R-devel/library/base/html/parse.html' }
					]
				},
				{
					name:        'Semicolons',
					id:          'semicolons',
					supported:   'fully',
					description: '_Recognize and resolve semicolons like `a; b; c`, ..._',
					example:     codeBlock('r', 'a <- 1; b <- 2; a + b'),
					url:         [
						{ name: RLang('Separators'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Separators' }
					]
				},
				{
					name:        'Newlines',
					id:          'newlines',
					supported:   'fully',
					description: '_Recognize and resolve newlines like `a\\nb\\nc`; a newline ends an expression unless it is still incomplete._ A trailing operator or an unclosed bracket continues on the next line.',
					example:     codeBlock('r', 'x <- 1 +\n  2\ny <- 1\n  + 2'),
					url:         [
						{ name: RLang('Separators'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Separators' }
					]
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
					description: '_Recognize non-ASCII source, i.e., UTF-8 in string literals, in comments, and in identifiers (plain as well as backtick-escaped)._ Such names bind and resolve like any other, with both engines.',
					example:     codeBlock('r', 'st\u00e4rke <- "caf\u00e9"\n`\u03b1 \u03b2` <- 2\nst\u00e4rke'),
					url:         [
						{ name: RLang('Tokens'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Tokens' }
					]
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
					description: `_Handle source that does not parse._ The ${Wiki('Linter', '`syntactically-valid` rule')} locates the region and offers a fix; the strict parser rejects the file, tree-sitter's lax mode (off by default) drops the region.`,
					example:     codeBlock('r', 'x <- 1\ny <- (\nz <- 3'),
					url:         [
						{ name: RLang('The parsing process'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#The-parsing-process' }
					]
				},
				{
					name:        'Reserved Words',
					id:          'reserved-words',
					supported:   'partially',
					description: "_Reject a syntactic keyword like `` `if` `` or `` `function` `` where R's grammar requires an expression._ The r-shell engine rejects `` if <- 5``; tree-sitter's grammar parses it as an ordinary assignment.",
					example:     codeBlock('r', 'if <- 5'),
					url:         [
						{ name: RLang('Reserved words'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Reserved-words-1' }
					]
				}
			]
		},
		{
			name:         'Project',
			id:           'project',
			description:  'Support for non-R/project files (dependencies, etc.).',
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
								Plugin('flowr-description-file', 'src/project/plugins/file-plugins/files/flowr-description-file.ts'),
								{ name: 'Writing R Extensions/The DESCRIPTION file', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#The-DESCRIPTION-file' }
							]
						},
						{
							name:        'NAMESPACE',
							id:          'project-namespace',
							supported:   'fully',
							description: "_Read a package's `NAMESPACE`._ Acts on `import`/`importFrom`, `importClassesFrom`/`importMethodsFrom` for S4, and `export`/`S3method`.",
							url:         [
								Plugin('flowr-namespace-file', 'src/project/plugins/file-plugins/files/flowr-namespace-file.ts'),
								{ name: 'Writing R Extensions/Package namespaces', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Package-namespaces' }
							]
						},
						{
							name:        'Documentation (`.Rd`)',
							id:          'project-rd',
							supported:   'fully',
							description: '_Read the `.Rd` pages under `man/`, their macros, and the indices beside them._ A documented name is tied back to the page that documents it.',
							url:         [
								Plugin('flowr-rd-file', 'src/project/plugins/file-plugins/files/flowr-rd-file.ts'),
								{ name: 'Writing R Extensions/Rd format', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Rd-format' }
							]
						},
						{
							name:        'NEWS',
							id:          'project-news',
							supported:   'fully',
							description: "_Read a package's `NEWS`/`NEWS.md`._ We parse the versions it announces and what each changed, which is what a version guess is checked against.",
							url:         [
								Plugin('flowr-news-file', 'src/project/plugins/file-plugins/files/flowr-news-file.ts'),
								{ name: 'Writing R Extensions/Package subdirectories', href: 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Package-subdirectories' }
							]
						},
						{
							name:        'Package Data (`sysdata.rda`)',
							id:          'project-sysdata',
							supported:   'partially',
							description: '_Read the `R/sysdata.rda` a package keeps its internal data in, and the `data/` files it exports._ What those bindings hold is not reconstructed.',
							url:         [
								Plugin('flowr-sysdata-file', 'src/project/plugins/file-plugins/files/flowr-sysdata-file.ts'),
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
								Plugin('flowr-analyzer-package-versions-lockfile-plugin', 'src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts'),
								{ name: 'renv', href: 'https://rstudio.github.io/renv/' }
							]
						},
						{
							name:        'packrat',
							id:          'version-manager-packrat',
							supported:   'fully',
							description: '_Read the configuration of [packrat](https://rstudio.github.io/packrat/), the predecessor of renv._ The `packrat/lib` library beside it is not loaded.',
							url:         [
								Plugin('flowr-analyzer-package-versions-lockfile-plugin', 'src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts'),
								{ name: 'packrat', href: 'https://rstudio.github.io/packrat/' }
							]
						},
						{
							name:        'rv',
							id:          'version-manager-rv',
							supported:   'fully',
							description: '_Read the configuration of [rv](https://a2-ai.github.io/rv-docs/), a declarative project manager in the style of cargo._ Parses `rproject.toml` and the resolved `rv.lock`.',
							url:         [
								Plugin('flowr-manifest-files', 'src/project/plugins/file-plugins/files/flowr-manifest-files.ts'),
								{ name: 'rv', href: 'https://a2-ai.github.io/rv-docs/' }
							]
						},
						{
							name:        'uvr',
							id:          'version-manager-uvr',
							supported:   'fully',
							description: '_Read the configuration of [uvr](https://github.com/nbafrank/uvr), an R project manager modelled on uv._ Parses `uvr.toml` and the `uvr.lock` beside it.',
							url:         [
								Plugin('flowr-manifest-files', 'src/project/plugins/file-plugins/files/flowr-manifest-files.ts'),
								{ name: 'uvr', href: 'https://github.com/nbafrank/uvr' }
							]
						},
						{
							name:        'Installed Library',
							id:          'project-library',
							supported:   'partially',
							description: '_Read the package library a project installs into (`renv/library`, `packrat/lib`, or the platform library)._ Their code is not read.',
							url:         [
								Plugin('flowr-analyzer-package-versions-library-plugin', 'src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-library-plugin.ts')
							]
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
							description: '_Read the files R runs or reads before a script (`.Rprofile`, `Rprofile.site`, `.Renviron`, `Renviron.site`)._ Variables set by an environment file are not interpreted.',
							url:         [
								Plugin('flowr-analyzer-rprofile-file-plugin', 'src/project/plugins/file-plugins/flowr-analyzer-rprofile-file-plugin.ts'),
								{ name: 'R Definition/Startup', href: 'https://stat.ethz.ch/R-manual/R-devel/library/base/html/Startup.html' }
							]
						},
						{
							name:        'Ignore Files',
							id:          'project-ignore-files',
							supported:   'fully',
							description: '_Read the `.gitignore` and `.Rbuildignore` that say which files are not part of the project._ Follows gitignore globs and the regular expressions `R CMD build` uses.',
							url:         [
								Plugin('flowr-analyzer-ignore-file-project-discovery-plugin', 'src/project/plugins/project-discovery/flowr-analyzer-ignore-file-project-discovery-plugin.ts'),
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
							description: '_Handle the roxygen2 blocks that precede a definition._ What a tag states does not reach name resolution, so an `@importFrom` leaves the name below it unqualified.',
							example:     codeBlock('r', "#' @param x a number\n#' @importFrom stats median\n#' @export\nmid <- function(x) median(x)"),
							url:         [
								{ name: 'roxygen2', href: 'https://roxygen2.r-lib.org/' }
							]
						},
					]
				}
			]
		},
		{
			name:         'System, I/O, FFI, and Other Files',
			id:           'system-i-o-ffi-and-other-files',
			description:  'Everything a program reaches for beyond its own code, from files it reads to calls it makes out of R.',
			capabilities: [
				{
					name:        'Sourcing External Files',
					id:          'sourcing-external-files',
					supported:   'partially',
					description: '_Handle `source`, `sys.source`, ..._ We are currently working on supporting the inclusion of external files. Currently we can handle `source`.',
					example:     codeBlock('r', 'source("helpers.R")\nsys.source("setup.R", envir = environment())')
				},
				{
					name:        'Handling Binary Files',
					id:          'handling-binary-riles',
					supported:   'partially',
					description: '_Handle files dumped with, e.g., [`save`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/save), ..._ The values behind a `load`ed name are not reconstructed.',
					example:     codeBlock('r', 'save(x, file = "x.RData")\nload("x.RData")\nreadRDS("y.rds")'),
					url:         [
						{ name: 'R Definition/save', href: 'https://stat.ethz.ch/R-manual/R-devel/library/base/html/save.html' }
					]
				},
				{
					name:        'I/O',
					id:          'i-o',
					supported:   'partially',
					description: '_Handle `read.csv`, `write.csv`, ..._ What a file contains does not enter the analysis.',
					example:     codeBlock('r', 'd <- read.csv("in.csv")\nwrite.csv(d, "out.csv")'),
					url:         [
						{ name: RLang('Operating system access'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Operating-system-access' }
					]
				},
				{
					name:        'Foreign Function Interface',
					id:          'foreign-function-interface',
					supported:   'partially',
					description: '_Handle `.C`, `.Call`, `.External`, `.Fortran`, ..._ The call carries an unknown side effect; the foreign code behind it is not analyzed.',
					example:     codeBlock('r', '.Call("my_c_fn", 1)\n.Fortran("my_f_sub", x = 1)')
				},
				{
					name:        'System Calls',
					id:          'system-calls',
					supported:   'partially',
					description: '_Handle [`system`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/system), `system.*`, ..._ An injectable command built from user input is flagged by the `problematic-inputs` and `unescaped-arguments` rules.',
					example:     codeBlock('r', 'system("ls -la")\nsystem2("git", c("status"))'),
					url:         [
						{ name: RLang('Operating system access'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Operating-system-access' }
					]
				},
				{
					name:        'R-Markdown files',
					id:          'file:rmd',
					supported:   'partially',
					description: 'Support R-Markdown files as R sources. Code chunks are extracted; inline `r expr` and the `params` object of the YAML front matter are not.',
					url:         [
						{ name: 'R Markdown', href: 'https://rmarkdown.rstudio.com/' }
					]
				},
				{
					name:        'Jupyter Notebook',
					id:          'file:ipynb',
					supported:   'partially',
					description: 'Support Jupyter Notebooks as R sources. Cells are read in document order, not execution order, and the kernel is not checked.',
					url:         [
						{ name: 'Jupyter Notebook Format', href: 'https://nbformat.readthedocs.io/en/latest/format_description.html' }
					]
				},
				{
					name:        'Quarto',
					id:          'file:qmd',
					supported:   'partially',
					description: 'Support Quarto files as R sources. Code chunks are extracted; inline `r expr` and the `params` object of the YAML front matter are not.',
					url:         [
						{ name: 'Quarto', href: 'https://quarto.org/' }
					]
				},
				{
					name:        'Sweave',
					id:          'file:rnw',
					supported:   'partially',
					description: 'Support for Sweave files as R sources. Code chunks are extracted, `\\Sexpr{}` inline expressions are not.',
					url:         [
						{ name: 'Sweave', href: 'https://stat.ethz.ch/R-manual/R-devel/library/utils/doc/Sweave.pdf' }
					]
				}
			]
		},
		{
			name:         'Types',
			id:           'types',
			description:  'What a value is, how we infer it from the code, and the coercions R applies between types.',
			capabilities: [
				{
					name:        'Primitive',
					id:          'types-primitive',
					supported:   'not',
					description: '_Recognize and resolve primitive types like `numeric`, `character`, ..._ `typeof`, `class`, and `mode` are not evaluated and resolve to the unknown top value.',
					example:     codeBlock('r', 'typeof(1L)\nclass(1)\nmode("a")'),
					url:         [
						{ name: RLang('Basic types'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Basic-types' }
					]
				},
				{
					name:        'Non-Primitive',
					id:          'types-non-primitive',
					supported:   'not',
					description: '_Recognize and resolve non-primitive/composite types._ The type of a list, a data frame, or any other composite is not tracked, so `class(list(1, 2))` resolves to the unknown top value.',
					url:         [
						{ name: RLang('Vector objects'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Vector-objects' }
					]
				},
				{
					name:        'Inference',
					id:          'types-inference',
					supported:   'not',
					description: '_Infer types from the code._ A type predicate never narrows a branch, so `if(is.numeric(1)) y <- 1 else y <- "a"` still leaves `y` as both alternatives.'
				},
				{
					name:        'Coercion',
					id:          'types-coercion',
					supported:   'partially',
					description: '_Handle coercion of types._ A vector is not unified: `c(1, "a")` keeps a number beside a string, and the `as.*` converters are not evaluated.',
					example:     codeBlock('r', 'c(1, "a")\nTRUE + 1\nas.integer("3")'),
					url:         [
						{ name: RLang('Basic types'), href: 'https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Basic-types' }
					]
				},
			]
		}
	]
} as const satisfies FlowrCapabilities;
