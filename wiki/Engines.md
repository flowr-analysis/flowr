_This document was generated from '[src/documentation/print-engines-wiki.ts](https://github.com/flowr-analysis/flowr/tree/main//src/documentation/print-engines-wiki.ts)' on 2025-06-23, 12:00:53 UTC presenting an overview of flowR's engines (v2.2.15, using R v4.5.0). Please do not edit this file/wiki page directly._

To analyze R scripts, flowR needs to parse the R code and for that, we require a parser.
Originally, flowR shipped with an <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/shell.ts#L140"><code><span title="The RShell represents an interactive session with the R interpreter. You can configure it by RShellOptions .  At the moment we are using a live R session (and not networking etc.) to communicate with R easily, which allows us to install packages etc. However, this might and probably will change in the future (leaving this as a legacy mode :D)">RShell</span></code></a>, an asynchronous interface to the R interpreter, still available today.
Later we extended this with the <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/shell-executor.ts#L25"><code><span title="This is a synchronous alternative to the RShell . Please be aware that using this is expensive. Every request effectively causes a new initialization of the R interpreter.  With this class you can run(command) commands, that are potentially decorated with prerequisites . For compatibility, we provide parse(request) and rVersion() .">RShellExecutor</span></code></a>, the synchronous counterpart to the <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/shell.ts#L140"><code><span title="The RShell represents an interactive session with the R interpreter. You can configure it by RShellOptions .  At the moment we are using a live R session (and not networking etc.) to communicate with R easily, which allows us to install packages etc. However, this might and probably will change in the future (leaving this as a legacy mode :D)">RShell</span></code></a>.
However, these interfaces are relatively slow as they require communication with an underlying R interpreter. 
Using [tree-sitter](https://tree-sitter.github.io/tree-sitter/), with its [node bindings](https://github.com/tree-sitter/node-tree-sitter)
and [R grammar](https://github.com/r-lib/tree-sitter-r), we can provide the <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor.ts#L17"><code><span title="Synchronous and (way) faster alternative to the RShell using tree-sitter.">TreeSitterExecutor</span></code></a> which
is synchronous, faster, and no longer needs an R installation, but requires the appropriate bindings.
To allow users of R to freely choose their backend between the R interpreter and the tree-sitter parser,
we provide the concept of engines. 

Engines can be loaded with [flowR's configuration file](https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr). Additionally, they
are exposed with some command line options (e.g., when using the docker image of flowR):

- <span title="Description (Command Line Argument): Disable the R shell engine">`--engine.r-shell.disabled`</span> to disable the <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/shell.ts#L140"><code><span title="The RShell represents an interactive session with the R interpreter. You can configure it by RShellOptions .  At the moment we are using a live R session (and not networking etc.) to communicate with R easily, which allows us to install packages etc. However, this might and probably will change in the future (leaving this as a legacy mode :D)">RShell</span></code></a> engine
- <span title="Description (Command Line Argument): The path to the R executable to use. Defaults to your PATH.">`--engine.r-shell.r-path`</span> (which is the canonical version of <span title="Description (Command Line Argument): The path to the R executable to use. Defaults to your PATH. This option is being phased out in favor of the engine configuration option &quot;engine.r-shell.r-path&quot;, which should be used instead.">`--r-path`</span>)
- <span title="Description (Command Line Argument): Disable the tree-sitter engine">`--engine.tree-sitter.disabled`</span> to disable the <a href="https://github.com/flowr-analysis/flowr/tree/main//src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor.ts#L17"><code><span title="Synchronous and (way) faster alternative to the RShell using tree-sitter.">TreeSitterExecutor</span></code></a> engine
- <span title="Description (Command Line Argument): Use the lax parser for parsing R code (allowing for syntax errors).">`--engine.tree-sitter.lax`</span> to use lax parsing with tree-sitter
- <span title="Description (Command Line Argument): The path to the tree-sitter-r WASM binary to use. Defaults to the one shipped with flowR.">`--engine.tree-sitter.wasm-path`</span> pass the path to the wasm of the r grammar of tree-sitter (see [below](#tree-sitter))
- <span title="Description (Command Line Argument): The path to the tree-sitter WASM binary to use. Defaults to the path specified by the tree-sitter package.">`--engine.tree-sitter.tree-sitter-wasm-path`</span> pass the path to the wasm of tree-sitter (see [below](#tree-sitter))
- <span title="Description (Command Line Argument): The default engine to use for interacting with R code. If this is undefined, an arbitrary engine from the specified list will be used.">`--default-engine`</span> to set the default engine to use

<a id="tree-sitter"></a>
## Dealing with the Tree-Sitter Engine


> [!WARNING]
> As the tree-sitter engine is only for parsing, it cannot execute R code. This engine is now the default.


In general, there is no need for you to pass custom paths using either 
<span title="Description (Command Line Argument): The path to the tree-sitter-r WASM binary to use. Defaults to the one shipped with flowR.">`--engine.tree-sitter.wasm-path`</span> or
<span title="Description (Command Line Argument): The path to the tree-sitter WASM binary to use. Defaults to the path specified by the tree-sitter package.">`--engine.tree-sitter.tree-sitter-wasm-path`</span>.
However, you may want to experiment with the R grammar or provide a newer
one in case that of _flowR_ is outdated. 

To use a newer [R grammar](https://github.com/r-lib/tree-sitter-r),
you first must build the new wasm file. For this you have to:

1. Install the dependencies with `npm ci` in the tree-sitter-r repository.
2. Build the wasm using `tree-sitter build --wasm .` the [tree sitter cli](https://github.com/tree-sitter/tree-sitter)
   which should be a dev dependency.
3. Pass the `tree-sitter-r.wasm` to flowR. 

For tree-sitter, please rely on the [releases](https://github.com/tree-sitter/tree-sitter/releases).


