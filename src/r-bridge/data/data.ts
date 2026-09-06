import type { FlowrCapabilities } from './types';
import { FlowrGithubBaseRef } from '../../documentation/doc-util/doc-files';
import { codeBlock } from '../../documentation/doc-util/doc-code';
import { printDfGraphForCode } from '../../documentation/doc-util/doc-dfg';

const Joiner = '/';
const AdvancedR = (subname: string) => 'Advanced R' + Joiner + subname;
const RLang = (subname: string) => 'R Definition' + Joiner + subname;
const Issue = (num: number) => `${FlowrGithubBaseRef}/flowr/issues/${num}`;
const LinkTo = (id: string, label = id) => `[${label}](#${id})`;

export const flowrCapabilities = {
	name:         'Capabilities of flowR',
	description:  'This is an evolving representation of what started with #636 to formulate capabilities in a structured format.',
	version:      '0.0.2',
	capabilities: [
		{
			name:        'Names and Identifiers',
			id:          'names-and-identifiers',
			description: 'The recognition of syntactical and non-syntactical names, including their resolutions to corresponding definitions.',
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

${await printDfGraphForCode(parser, code, { simplified: true })}
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
							description: "_Recognize `\"a\"`, `'plot'`, ..._ In general, R allows to envelop names in quotations to allow for special characters such as spaces in variable names. However, this only works in the context of definitions. To access these names as variables, one has to either use function such as `get` or escape the name with backticks.",
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
							supported:   'partially',
							description: '_Recognize functions which resolve strings as identifiers, such as `get`, ..._',
							example:     codeBlock('r', 'nm <- paste0("x", 1)\nassign(nm, 42)\nget(nm)'),
							url:         [
								{ name: 'flowr#633', href: Issue(633) }
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
							example:     codeBlock('r', 'x <- 1\nf <- function() x\nf()')
						},
						{
							name:        'Lexicographic Scope',
							id:          'lexicographic-scope',
							supported:   'fully',
							description: '_For example, support function definition scopes_',
							example:     codeBlock('r', 'f <- function() {\n  y <- 1\n  g <- function() y\n  g()\n}\nf()')
						},
						{
							name:        'Closures',
							id:          'closures',
							supported:   'partially',
							description: '_Handling [function factories](https://adv-r.hadley.nz/function-factories.html) and friends._ Currently, we do not have enough tests to be sure.',
							example:     codeBlock('r', 'counter <- function() {\n  i <- 0\n  function() {\n    i <<- i + 1\n    i\n  }\n}\nnext_one <- counter()\nnext_one()\nnext_one()')
						},
						{
							name:         'Dynamic Environment Resolution',
							id:           'dynamic-environment-resolution',
							supported:    'partially',
							description:  '_For example, using `new.env` and friends. Supports `new.env`/`new.environment`/`rlang::new_environment`, `assign`/`get`/`local` with `envir=`, dollar-sign access (`e$x`), `attach`, `with`/`within`, and env-variable aliasing (`alias <- e`). Static parent-argument resolution (`parent = e`, `parent = emptyenv()`) is supported._',
							example:      codeBlock('r', 'e <- new.env()\nassign("x", 3, envir = e)\nget("x", envir = e) + e$x'),
							capabilities: [
								{
									name:        'Environment in Conditionals',
									id:          'environment-in-conditionals',
									supported:   'partially',
									description: '_Tracking environment assignments and reads across if-then-else branches. flowR propagates envState through branch merging, but cross-branch name resolution inside the env is not guaranteed._'
								},
								{
									name:        'Environment in Loops',
									id:          'environment-in-loops',
									supported:   'partially',
									description: '_Tracking environment assignments inside loop constructs (for, while, repeat). The env variable is correctly attributed in each iteration body, but dynamic key generation (e.g., `paste0`) prevents static name resolution._'
								},
								{
									name:        'Environment Parent',
									id:          'environment-parent',
									supported:   'partially',
									description: '_Specifying a parent for a newly-created environment (`new.env(parent = e)`, `new.env(parent = emptyenv())`). Tracked-env-variable parents and `emptyenv()`/`NULL` are resolved statically; dynamic or unknown parents fall back to the default (`parent.frame()`)._'
								},
								{
									name:        'Environment Alias',
									id:          'environment-alias',
									supported:   'partially',
									description: '_Aliasing a tracked environment variable (`alias <- e`). The `envState` snapshot at assignment time is propagated, so assigns made BEFORE the alias are visible through it. Assigns made AFTER the alias to the original variable are not reflected._'
								},
								{
									name:        'With / Within',
									id:          'environment-with',
									supported:   'partially',
									description: '_Evaluating an expression inside a named environment with `with(data, expr)` or `within(data, expr)`. When `data` is a tracked env variable, reads of names defined in that env resolve correctly. Writes inside `expr` are ephemeral (not persisted back to the env)._'
								},
								{
									name:        'Dynamic Variable Removal',
									id:          'dynamic-variable-removal',
									supported:   'partially',
									description: '_Support for `rm(list=..., envir=sys.frame(N))` removing variables from a specific call frame. Currently handles negative and zero offsets from within depth-1 functions._'
								}
							]
						},
						{
							name:        'Environment Sharing',
							id:          'environment-sharing',
							supported:   'not',
							description: '_Handling side-effects by environments which are not copied when modified_',
							example:     codeBlock('r', 'e <- new.env()\nf <- function(env) env$x <- 2\nf(e)\ne$x')
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
							supported:   'partially',
							description: "_Handling [R's search path](https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Search-path) as explained in [Advanced R](https://adv-r.hadley.nz/environments.html#search-path)._ Attached packages and `attach`ed environments are placed below `.GlobalEnv` (so global bindings shadow package exports, matching R), attaching inside/through function calls propagates to the caller, and re-attaching is a no-op. Not yet handled: dynamic `search`/`fn_env` manipulation.",
							example:     codeBlock('r', 'library(dplyr)\nfilter <- function(...) "mine"\nfilter(1)')
						},
						{
							name:        'Namespaces',
							id:          'namespaces',
							supported:   'partially',
							description: "_Handling R's namespaces as explained in [Advanced R](https://adv-r.hadley.nz/environments.html#namespaces)_"
						},
						{
							name:        'Accessing Exported Names',
							id:          'accessing-exported-names',
							supported:   'partially',
							description: '_Resolving calls with `::` to their origin._ Accessing external files is allowed, although the name of packages etc. is not resolved correctly.',
							example:     codeBlock('r', 'median <- function(x) 0\nmedian(1:3)\nstats::median(1:3)')
						},
						{
							name:        'Accessing Internal Names',
							id:          'accessing-internal-names',
							supported:   'partially',
							description: '_Similar to `::` but for internal names._',
							example:     codeBlock('r', '"C_cor" %in% getNamespaceExports("stats")\nstats:::C_cor$name')
						},
						{
							name:        'Library Loading',
							id:          'library-loading',
							supported:   'partially',
							description: '_Resolve libraries identified with `library`, `require`, `attachNamespace`, ... and attach them to the search path_',
							example:     codeBlock('r', 'library(stats)\nrequire(utils)\nattachNamespace("tools")')
						},
						{
							name:        'Dynamic Scope Changes',
							id:          'dynamic-scope-changes',
							supported:   'partially',
							description: '_Manually changing scopes like [`local`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/eval)_',
							example:     codeBlock('r', 'x <- 1\nlocal({\n  x <- 2\n  x\n})\nx')
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
			capabilities: [
				{
					name:         'Function Calls',
					id:           'function-calls',
					capabilities: [
						{
							name:        'Grouping',
							id:          'grouping',
							supported:   'fully',
							description: '_Recognize groups done with `(`, `{`, ... (more precisely, their default mapping to the primitive implementations)._',
							example:     codeBlock('r', 'x <- {\n  1\n  2\n}\ny <- (3)')
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
									description: '_Recognize and resolve calls like `f(3)`, `foo::bar(3, c(1,2))`, ..._'
								},
								{
									name:        'Empty Arguments',
									id:          'empty-arguments',
									supported:   'fully',
									description: '_Essentially a special form of an unnamed argument as in `foo::bar(3, ,42)`, ..._',
									example:     codeBlock('r', 'm <- matrix(1:6, nrow = 2)\nm[1, ]\nm[, 2]')
								},
								{
									name:        'Named Arguments',
									id:          'named-arguments',
									supported:   'fully',
									description: '_Recognize and resolve calls like `f(x = 3)`, `foo::bar(x = 3, y = 4)`, ..._'
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
									description: '_Correctly bind arguments (including [`pmatch`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/pmatch))._ Currently, we do not have a correct implementation for `pmatch`. Furthermore, more tests would be nice.',
									example:     codeBlock('r', 'f <- function(verbose = FALSE, value = 0) c(verbose, value)\nf(TRUE, val = 3)\nf(verb = TRUE)')
								},
								{
									name:        'Side-Effects in Argument',
									id:          'side-effects-in-argument',
									supported:   'partially',
									description: '_Handle side-effects of arguments (e.g., `f(x <- 3)`, `f(x = y <- 3)`, ...)._ We have not enough tests to be sure',
									example:     codeBlock('r', 'f <- function(a) a\nf(x <- 3)\nx')
								},
								{
									name:        'Side-Effects in Function Call',
									id:          'side-effects-in-function-call',
									supported:   'partially',
									description: '_Handle side-effects of function calls (e.g., `setXTo(3)`, ...) for example achieved with the super assignment._ We need more tests and handlings. Furthermore, we do not detect side effects with external files, network, logging, etc.',
									example:     codeBlock('r', 'set_x <- function(v) x <<- v\nset_x(3)\nx')
								}
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
							example:     codeBlock('r', 'identical(1 + 2, `+`(1, 2))')
						},
						{
							name:        'Redefinition of Built-In Functions/primitives',
							id:          'redefinition-of-built-in-functions-primitives',
							supported:   'partially',
							description: '_Handle cases like `print <- function(x) x`, `` `for` <- function(a,b,c) a``, ..._ Currently, we can not handle all of them there are no tests. Still wip as part of desugaring',
							example:     codeBlock('r', '`+` <- function(a, b) a * b\n2 + 3')
						},
						{
							name:        'Functions with global side effects',
							id:          'functions-with-global-side-effects',
							supported:   'partially',
							description: '_Support functions like `setwd` which have an impact on the subsequent program._',
							example:     codeBlock('r', 'setwd("/tmp")\nread.csv("data.csv")')
						},
						{
							name:        'Working Directory',
							id:          'working-directory',
							supported:   'partially',
							description: '_Track the effective working directory across `setwd` (control-flow- and location-sensitive) to resolve relative file paths. Interprocedural, sourced, and loop cases are treated as unbounded rather than guessed._'
						},
						{
							name:         'Index Access',
							id:           'index-access',
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
									example:     codeBlock('r', 'l <- list(alpha = 1)\nl$alpha\nl$al')
								},
								{
									name:        'Slot Access',
									id:          'slot-access',
									supported:   'fully',
									description: '_Detect calls like `x@y`, `x@y@z`, ..._',
									example:     codeBlock('r', 'setClass("P", representation(x = "numeric"))\np <- new("P", x = 1)\np@x')
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
							capabilities: [
								{
									name:        'Unary Operator',
									id:          'unary-operator',
									supported:   'fully',
									description: '_Recognize and resolve calls like `+3`, `-3`, ..._'
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
											example:     codeBlock('r', '`%between%` <- function(x, r) x >= r[1] & x <= r[2]\n5 %between% c(1, 10)')
										},
										{
											name:        'Model Formula',
											id:          'model-formula',
											supported:   'partially',
											description: '_Recognize and resolve calls like `y ~ x`, `y ~ x + z`, ... including their implicit redefinitions of some functions._ Currently, we do not handle their redefinition and only treat model formulas as normal binary operators',
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
													description: '_Handle `assign(x, 3)`, `delayedAssign(x, 3)`, ..._ Currently we can not handle all of them and tests are rare.',
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
													description: '_Handle `x[i] <- 3`, `x$y <- 3`, ... as `` `[<-`(x, 3) ``, ..._ Currently work in progress as part of the desugaring but still untested.',
													example:     codeBlock('r', '`second<-` <- function(x, value) {\n  x[2] <- value\n  x\n}\nv <- 1:3\nsecond(v) <- 9\nv')
												},
												{
													name:        'Locked Bindings',
													id:          'locked-bindings',
													supported:   'not',
													description: '_Handle `lockBinding(x, 3)`, ..._',
													example:     codeBlock('r', 'x <- 1\nlockBinding("x", environment())\nx <- 2')
												}
											]
										}
									]
								}
							]
						},
						{
							name:         'Control-Flow',
							id:           'control-flow',
							capabilities: [
								{
									name:        'if',
									id:          'if',
									supported:   'fully',
									description: '_Handle `if (x) y else z`, `if (x) y`, ..._',
									example:     codeBlock('r', 'x <- if(TRUE) 1 else 2\ny <- if(FALSE) 3\ny')
								},
								{
									name:        'for loop',
									id:          'for-loop',
									supported:   'fully',
									description: '_Handle `for (i in 1:3) print(i)`, ..._',
									example:     codeBlock('r', 'for(i in 1:3) print(i)\ni')
								},
								{
									name:        'while loop',
									id:          'while-loop',
									supported:   'fully',
									description: '_Handle `while (x) b`, ..._',
									example:     codeBlock('r', 'i <- 0\nwhile(i < 3) i <- i + 1\ni')
								},
								{
									name:        'repeat loop',
									id:          'repeat-loop',
									supported:   'fully',
									description: '_Handle `repeat {b; if (x) break}`, ..._',
									example:     codeBlock('r', 'i <- 0\nrepeat {\n  i <- i + 1\n  if(i > 2) break\n}\ni')
								},
								{
									name:        'break',
									id:          'break',
									supported:   'fully',
									description: '_Handle `break` (including `break()`) ..._',
									example:     codeBlock('r', 'for(i in 1:5) {\n  if(i == 4) break\n  print(i)\n}')
								},
								{
									name:        'next',
									id:          'next',
									supported:   'fully',
									description: '_Handle `next` (including `next()`) ..._',
									example:     codeBlock('r', 'for(i in 1:5) {\n  if(i %% 2 == 0) next\n  print(i)\n}')
								},
								{
									name:        'switch',
									id:          'switch',
									supported:   'fully',
									description: '_Handle `switch(3, "a", "b", "c")`, ..._',
									example:     codeBlock('r', 'switch("b", a = , b = "ab", c = "c")\nswitch(2, "one", "two")')
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
									description: '_Handle `try`, `stop`, ..._',
									example:     codeBlock('r', 'tryCatch(\n  stop("boom"),\n  error = function(e) conditionMessage(e),\n  finally = print("done")\n)')
								}
							]
						},
						{
							name:         'Function Definitions',
							id:           'function-definitions',
							capabilities: [
								{
									name:        'Normal',
									id:          'normal-definition',
									supported:   'fully',
									description: '_Handle `function() 3`, ..._'
								},
								{
									name:         'Formals',
									id:           'formals',
									capabilities: [
										{
											name:        'Named',
											id:          'formals-named',
											supported:   'fully',
											description: '_Handle `function(x) x`, ..._'
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
											example:     codeBlock('r', 'f <- function(...) sum(...)\ng <- function(...) f(..., 1)\ng(2, 3)')
										},
										{
											name:        'Promises',
											id:          'formals-promises',
											supported:   'partially',
											description: '_Handle `function(x = y) { y <- 3; x }`, `function(x = { x <- 3; x}) { x * x }`, ..._ A default argument resolves in the function\'s own environment and an argument passed in resolves in the caller\'s, both as R does it. We do not model _when_ a promise is forced: a `delayedAssign`ed expression is linked to every binding it may be forced against, which never misses the one that feeds it but may name others as well. What forcing _does_ is not modelled either, so the writes a promise performs when it is forced (`delayedAssign("x", { x <- 99; 2 })`, where reading `x` yields `2` and leaves `x` at `99`) do not reach the reads that follow.',
											example:     codeBlock('r', 'f <- function(x = y) {\n  y <- 3\n  x\n}\nf()')
										}
									]
								},
								{
									name:        'Implicit Return',
									id:          'implicit-return',
									supported:   'fully',
									description: '_Handle the return of `function() 3`, ..._'
								},
								{
									name:        'Lambda Syntax',
									id:          'lambda-syntax',
									supported:   'fully',
									description: '_Support `\\(x) x`, ..._',
									example:     codeBlock('r', 'sapply(1:3, \\(x) x^2)')
								}
							]
						},
						{
							name:         'Important Built-Ins',
							id:           'important-built-ins',
							capabilities: [
								{
									name:        'Non-Strict Logical Operators',
									id:          'non-strict-logical-operators',
									supported:   'fully',
									description: '_Handle `&&`, `||`, ..._',
									example:     codeBlock('r', 'FALSE && stop("never evaluated")\nTRUE || stop("never evaluated")')
								},
								{
									name:        'Pipe and Pipe-Bind',
									id:          'pipe-and-pipe-bind',
									supported:   'partially',
									description: '_Handle the [new (4.1) pipe and pipe-bind syntax](https://www.r-bloggers.com/2021/05/the-new-r-pipe/): `|>`, and `=>`._; Similarly support the other pipe binds',
									example:     codeBlock('r', 'c(1, 2, 3) |> sum()\nmtcars |> lm(mpg ~ cyl, data = _)')
								},
								{
									name:        'Sequencing',
									id:          'built-in-sequencing',
									supported:   'not',
									description: '_Handle `:`, `seq`, ... by gathering value information using abstract interpretation._',
									example:     codeBlock('r', 'n <- 0\n1:n\nseq_len(n)')
								},
								{
									name:        'Internal and Primitive Functions',
									id:          'built-in-internal-and-primitive-functions',
									supported:   'partially',
									description: '_Handle `.Internal`, `.Primitive`, ..._ In general we can not handle them as they refer to non-R code. We currently do not support them when used with the function.',
									example:     codeBlock('r', '.Primitive("+")(1, 2)\n.Internal(inspect(1))')
								},
								{
									name:        'Options',
									id:          'built-in-options',
									supported:   'not',
									description: '_Handle `options`, `getOption`, ..._ Currently, we do not support the function at all.',
									example:     codeBlock('r', 'old <- options(digits = 3)\ngetOption("digits")\noptions(old)')
								},
								{
									name:        'Help',
									id:          'built-in-help',
									supported:   'partially',
									description: '_Handle `help`, `?`, ..._ We do not support the function in a sensible way but just ignore it (although this does not happen resolved).',
									example:     codeBlock('r', '?sum\nhelp("sum")')
								},
								{
									name:         'Reflection / "Computing on the Language"',
									id:           'reflection-"computing-on-the-language"',
									capabilities: [
										{
											name:        'Get Function Structure',
											id:          'get-function-structure',
											supported:   'not',
											description: '_Handle `body`, `formals`, `environment` to access the respective parts of a function._ We do not support the functions at all.',
											example:     codeBlock('r', 'f <- function(x) x + 1\nbody(f)\nformals(f)\nenvironment(f)')
										},
										{
											name:        'Modify Function Structure',
											id:          'modify-function-structure',
											supported:   'not',
											description: '_Handle `body<-`, `formals<-`, `environment<-` to modify the respective parts of a function._ We do not support the functions at all.',
											example:     codeBlock('r', 'f <- function(x) x + 1\nbody(f) <- quote(x * 2)\nf(3)')
										},
										{
											name:        'Quoting',
											id:          'built-in-quoting',
											supported:   'partially',
											description: '_Handle `quote`, `substitute`, `bquote`, ..._ A quoted argument is marked as [non-standard evaluation](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph#non-standard-evaluation) as a whole, so nothing within it counts as read. We model the escapes back to standard evaluation that a quoting function offers: rlang\'s `!!`/`!!!` (in `expr`, `quo`, `enquo`, ... and in data-masking arguments) and `bquote`\'s `.()`. Base `quote`/`substitute` have no such escape, and `substitute` does not reach the caller\'s expression when used on a function argument.',
											example:     codeBlock('r', 'x <- 1\nquote(x + y)\nbquote(.(x) + y)')
										},
										{
											name:        'Evaluation',
											id:          'built-in-evaluation',
											supported:   'partially',
											description: '_Handle `eval`, `evalq`, `eval.parent`, ..._ `eval` of a string we can resolve is analyzed as if it were written in its place. A language object reaches the `eval` that forces it even across assignments, branches, loop iterations, and function calls, and its names resolve in the scope evaluating it, as R does. `eval(expr, envir)` runs elsewhere, so we mark the call as an unknown side effect instead of guessing. `evalq` quotes its first argument and we do not follow it into the given environment.',
											example:     codeBlock('r', 'e <- quote(x + 1)\nx <- 2\neval(e)')
										},
										{
											name:        'String Templates',
											id:          'string-templates',
											supported:   'partially',
											description: '_Handle `glue::glue("{x}")`, `cli::cli_alert_info("{.val {x}}")`, `stringr::str_glue`/`str_interp`, ..._ The `{...}` of a template carries R code that runs where the call is, so we analyze it as if it were written there: it reads, it writes, and its side effects land in the calling scope. Doubled delimiters escape, `.open`/`.close` are honored when they are literal, and cli markup (`{.cls ...}`) contributes only the interpolations nested in it. A template aimed at another scope (`.envir`, `.con`, `glue_data`) is marked as an unknown side effect instead.',
											example:     codeBlock('r', 'x <- 2\nglue::glue("x plus one is {x + 1}")')
										},
										{
											name:        'Parsing',
											id:          'built-in-parsing',
											supported:   'not',
											description: '_Handle `parse`, `deparse`, ..._ We handle them as unknown function calls, but not specifically besides that.',
											example:     codeBlock('r', 'eval(parse(text = "1 + 1"))\ndeparse(quote(x + y))')
										}
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
							name:        'Numbers',
							id:          'numbers',
							supported:   'fully',
							description: '_Recognize numbers like `3`, `3.14`, the integer `3L`, hexadecimals such as `0xFF` and `0x1p3`, as well as the typed missings `NA_integer_`/`NA_real_`, ..._',
							example:     codeBlock('r', '1L\n0xFF\n1e-3\n0x1p3\nNA_real_')
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
									description: '_Recognize raw strings like `r"(a)"`, ..._',
									example:     codeBlock('r', 'r"(C:\\Users\\me)"\nr"[\\d+]"')
								}
							]
						},
						{
							name:        'Logical',
							id:          'logical',
							supported:   'fully',
							description: '_Recognize the logicals `TRUE` and `FALSE`, ..._ Their short forms `T` and `F` are ordinary bindings and can be reassigned, while `TRUE` and `FALSE` are reserved.',
							example:     codeBlock('r', 'TRUE && FALSE\nT <- FALSE\nT')
						},
						{
							name:        'NULL',
							id:          'null',
							supported:   'fully',
							description: '_Recognize `NULL`_',
							example:     codeBlock('r', 'c(1, NULL, 2)\nl <- list(a = 1)\nl$a <- NULL\nlength(l)')
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
			capabilities: [
				{
					name:        'Data Masking',
					id:          'data-masking',
					supported:   'partially',
					description: '_Handle `subset(d, col > 1)`, dplyr verbs, `ggplot2::aes`, data.table `:=`, ..._ In a masked argument, a name the caller binds is read as that variable and any other name is taken to come from the data. Which names a data frame actually offers is unknown to us, so a column shadowing a variable of the same name still resolves to the variable. rlang\'s `!!`/`!!!` and its `:=` name-value pair are recognised; `[` on a `data.table` does not mask its `j`/`by` yet.',
					example:     codeBlock('r', 'd <- data.frame(x = 1:3)\nthreshold <- 2\nsubset(d, x > threshold)')
				},
				{
					name:        'Recycling',
					id:          'recycling',
					supported:   'not',
					description: '_Handle recycling of vectors as explained in [Advanced R](https://adv-r.hadley.nz/vectors-chap.html)._ We do not support recycling.',
					example:     codeBlock('r', 'c(1, 2, 3, 4) + c(10, 20)')
				},
				{
					name:        'Vectorized Operator or Functions',
					id:          'vectorized-operator-or-functions',
					supported:   'not',
					description: '_Handle vectorized operations as explained in [Advanced R](https://adv-r.hadley.nz/perf-improve.html?q=vectorised#vectorise)._ We do not support vectorized operations.',
					example:     codeBlock('r', 'x <- 1:5\nx * 2\nifelse(x > 2, "big", "small")')
				},
				{
					name:        'Hooks',
					id:          'hooks',
					supported:   'partially',
					description: '_Handle hooks like [`userhooks`](https://stat.ethz.ch/R-manual/R-devel/library/base/html/userhooks.html) and [`on.exit`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/on.exit)._ We support `on.exit` and rlang\'s [`on_load`/`run_on_load`/`on_package_load`](https://rlang.r-lib.org/reference/on_load.html), whose expressions we analyze where they are registered. `setHook` and the other user hooks are not modelled.',
					example:     codeBlock('r', 'f <- function() {\n  on.exit(print("bye"))\n  1\n}\nf()')
				},
				{
					name:        'Precedence',
					id:          'precedence',
					supported:   'fully',
					description: '_Handle the precedence of operators as explained in the [Documentation](https://rdrr.io/r/base/Syntax.html)._ We handle the precedence of operators (implicitly with the parser).',
					example:     codeBlock('r', '-2^2\n1:3 - 1\n!TRUE == FALSE')
				},
				{
					name:         'Attributes',
					id:           'attributes',
					capabilities: [
						{
							name:        'User-Defined',
							id:          'user-defined',
							supported:   'not',
							description: '_Handle [attributes](https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Attributes) like `attr`, `attributes`, ..._ We do not support attributes.',
							example:     codeBlock('r', 'x <- 1:3\nattr(x, "unit") <- "cm"\nattributes(x)')
						},
						{
							name:        'Built-In',
							id:          'built-in',
							supported:   'not',
							description: '_Handle built-in attributes like `dim`, ..._ We do not support them.',
							example:     codeBlock('r', 'x <- 1:6\ndim(x) <- c(2, 3)\nclass(x)')
						}
					]
				}
			]
		},
		{
			name:         'Types',
			id:           'types',
			capabilities: [
				{
					name:        'Primitive',
					id:          'types-primitive',
					supported:   'not',
					description: '_Recognize and resolve primitive types like `numeric`, `character`, ..._ We do not support typing currently.',
					example:     codeBlock('r', 'typeof(1L)\nclass(1)\nmode("a")')
				},
				{
					name:        'Non-Primitive',
					id:          'types-non-primitive',
					supported:   'not',
					description: '_Recognize and resolve non-primitive/composite types._ We do not support typing currently.'
				},
				{
					name:        'Inference',
					id:          'types-inference',
					supported:   'not',
					description: '_Infer types from the code._ We do not support typing currently.'
				},
				{
					name:        'Coercion',
					id:          'types-coercion',
					supported:   'not',
					description: '_Handle coercion of types._ We do not support typing currently.',
					example:     codeBlock('r', 'c(1, "a")\nTRUE + 1\nas.integer("3")')
				},
				{
					name:         'Object-Oriented Programming',
					id:           'object-oriented-programming',
					capabilities: [
						{
							name: 'S3',
							id:   'oop-s3',
							url:  [
								{ name: AdvancedR('S3'), href: 'https://adv-r.hadley.nz/s3.html' }
							],
							supported:   'partially',
							description: '_Handle S3 classes and methods as one unit (with attributes etc.). Including Dispatch and Inheritance._ We do not support typing currently and do not handle objects of these classes "as units."',
							example:     codeBlock('r', 'p <- structure(list(n = "ada"), class = "pt")\nprint.pt <- function(x, ...) cat("pt", x$n, "\\n")\np')
						},
						{
							name: 'S4',
							id:   'oop-s4',
							url:  [
								{ name: AdvancedR('S4'), href: 'https://adv-r.hadley.nz/s4.html' }
							],
							supported:   'partially',
							description: '_Handle S4 classes and methods as one unit. Including Dispatch and Inheritance_ We do not support typing currently and do not handle objects of these classes "as units."',
							example:     codeBlock('r', 'setClass("P", representation(x = "numeric"))\nsetGeneric("desc", function(o) standardGeneric("desc"))\nsetMethod("desc", "P", function(o) o@x)\ndesc(new("P", x = 1))')
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
							description: '_Handle R7 classes and methods as one unit. Including Dispatch and Inheritance, as well as its Reference Semantics, Validators, ..._ We do not support typing currently and do not handle objects of these classes "as units."',
							example:     codeBlock('r', 'Person <- S7::new_class("Person", properties = list(name = S7::class_character))\nPerson(name = "ada")@name')
						},
						{
							name:         'Class-Based Dependency Attribution',
							id:           'oop-class-dependency-attribution',
							supported:    'partially',
							description:  '_Attribute the use of a class to the package that owns it (registers a method for it and exports a same-named constructor), so a class use implies a dependency for library detection and version guessing (backed by the signature database\'s class-ownership map)._',
							capabilities: [
								{
									name:        'S3 class ownership',
									id:          'class-owner-s3',
									supported:   'partially',
									description: '_The signature database records which package owns each S3 class. A class use is attributed to the owning package -- both from a project\'s NAMESPACE `S3method(generic, class)` registrations (e.g. `S3method("as.irts","zoo")` marks `zoo` used) and from class-name string literals in plain code (`inherits(x, "zoo")`, `methods::is`, `new`, `structure(..., class=)`), marking the owner used and bounding its version below by the same-named constructor\'s export history. Class names that come from a variable or a `c(...)` vector, and method-definition names like `print.zoo`, are not yet resolved._'
								},
								{
									name:        'S4 class ownership',
									id:          'class-owner-s4',
									supported:   'partially',
									description: '_A project\'s `importClassesFrom`/`importMethodsFrom` NAMESPACE directives are tracked, so the source package is attached and marked used like a plain `importFrom`. S4 class ownership itself (`exportClasses`, `setClass`) is not yet recorded in the signature database, so a bare S4 class use is not attributed to its owning package._'
								}
							]
						}
					]
				}
			]
		},
		{
			name:         'Structure',
			id:           'structure',
			capabilities: [
				{
					name:        'Comments',
					id:          'comments',
					supported:   'fully',
					description: '_Recognize comments like `# this is a comment`, ... and line-directives_',
					example:     codeBlock('r', '# a comment\nx <- 1 # a trailing comment\n#line 42 "other.R"')
				},
				{
					name:        'Semicolons',
					id:          'semicolons',
					supported:   'fully',
					description: '_Recognize and resolve semicolons like `a; b; c`, ..._',
					example:     codeBlock('r', 'a <- 1; b <- 2; a + b')
				},
				{
					name:        'Newlines',
					id:          'newlines',
					supported:   'fully',
					description: '_Recognize and resolve newlines like `a\\nb\\nc`, i.e., a newline ends an expression unless it is still incomplete, ..._',
					example:     codeBlock('r', 'x <- 1 +\n  2\ny <- 1\n  + 2')
				}
			]
		},
		{
			name:         'System, I/O, FFI, and Other Files',
			id:           'system-i-o-ffi-and-other-files',
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
					supported:   'not',
					description: '_Handle files dumped with, e.g., [`save`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/save), ... due to their frequent usage._ We do not support binary files.',
					example:     codeBlock('r', 'save(x, file = "x.RData")\nload("x.RData")\nreadRDS("y.rds")')
				},
				{
					name:        'I/O',
					id:          'i-o',
					supported:   'not',
					description: '_Handle `read.csv`, `write.csv`, ..._ We do not support I/O for the time being but treat them as unknown function calls.',
					example:     codeBlock('r', 'd <- read.csv("in.csv")\nwrite.csv(d, "out.csv")')
				},
				{
					name:        'Foreign Function Interface',
					id:          'foreign-function-interface',
					supported:   'not',
					description: '_Handle `.C`, `.Call`, `.External`, `.Fortran`, ..._ We do not support FFI but treat them as unknown function calls.',
					example:     codeBlock('r', '.Call("my_c_fn", 1)\n.Fortran("my_f_sub", x = 1)')
				},
				{
					name:        'System Calls',
					id:          'system-calls',
					supported:   'not',
					description: '_Handle [`system`](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/system), `system.*`, ..._ We do not support system calls but treat them as unknown function calls.',
					example:     codeBlock('r', 'system("ls -la")\nsystem2("git", c("status"))')
				},
				{
					name:        'R-Markdown files',
					id:          'file:rmd',
					supported:   'fully',
					description: 'Support R-Markdown files as R sources.'
				},
				{
					name:        'Jupyter Notebook',
					id:          'file:ipynb',
					supported:   'partially',
					description: 'Support Jupyter Notebooks as R sources.'
				},
				{
					name:        'Quarto',
					id:          'file:qmd',
					supported:   'partially',
					description: 'Support Quarto files as R sources.'
				},
				{
					name:        'Sweave',
					id:          'file:rnw',
					supported:   'partially',
					description: 'Support for Sweave files as R sources.'
				}
			]
		},
		{
			name:        'Pre-Processors/external Tooling',
			id:          'pre-processors-external-tooling',
			supported:   'fully',
			description: '_Handle pre-processors like `knitr`, `rmarkdown`, `roxygen2` ..._ We do not support pre-processors for the time being (being unable to handle things like `@importFrom`)'
		}
	]
} as const satisfies FlowrCapabilities;
