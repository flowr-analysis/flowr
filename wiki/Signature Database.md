_<span title="an overview of flowR's bundled signature database that resolves `library()` calls">Generated</span> from '[wiki-signature-database.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-signature-database.ts "src/documentation/wiki-signature-database.ts")' on 2026-08-24, 17:47:39 UTC (v2.14.3, R v4.6.1), please do not edit directly._

# Signature Database

flowR ships a database of the complete history of all exports in every version of all CRAN packages so it can resolve calls into the packages you load.
After `library(ggplot2)`, a call to `ggplot()` resolves to `ggplot2::ggplot`. The same database
qualifies bare names and backs various components like the [dependencies and call-context queries](https://github.com/flowr-analysis/flowr/wiki/Query-API) 
as well as the [undefined symbol](https://github.com/flowr-analysis/flowr/wiki/Linter) and [unused import](https://github.com/flowr-analysis/flowr/wiki/Linter) rules.

You can search what it knows at [flowr-analysis.github.io/flowr/wiki/sigdb](https://flowr-analysis.github.io/flowr/wiki/sigdb/),
a static page listing every exported name, generated from this database by `npm run gen:landing`.

## What is stored

Every function is a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L72"><code><span title="the decoded view of one function at one package version">DecodedFunction</span></code></a>:

| field | holds |
|-------|-------|
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L76"><code>DecodedFunction::<b>exported</b></code></a> | whether the name is a package export |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L78"><code>DecodedFunction::<b>signature</b></code></a> | the parameters, with their defaults and their <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L8"><code><span title="What a single argument of a call is used for, as a bitmask ( ArgProp.Forced / ArgProp.NoDefault lead, being the two bits the signature database can also state).">ArgProp</span></code></a> mask |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L79"><code>DecodedFunction::<b>callees</b></code></a> | the function's own local calls |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L81"><code><span title="the Rd help topic (man-page name) documenting this function, when it differs from name">DecodedFunction::<b>topic</b></span></code></a> | the Rd help topic when it differs from the name |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L74"><code>DecodedFunction::<b>file</b></code></a>, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L75"><code>DecodedFunction::<b>line</b></code></a> | source location |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L77"><code>DecodedFunction::<b>props</b></code></a> | flags like higher-order, recursive, deprecated |

The parameter mask is the one flowR states its own built-ins with, so a parameter carries
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L12"><code><span title="declared without a default value, like x in nchar(x, type); says nothing about whether a call must supply it">ArgProp::<b>NoDefault</b></span></code></a> when it has no default, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L10"><code><span title="evaluated whenever the call happens, even if the result goes unused, like x in force(x)">ArgProp::<b>Forced</b></span></code></a>
when the function always evaluates it, and whichever roles the extractor could infer
(<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L14"><code><span title="the result is this argument, handed back unchanged, like x in identity(x); this is what draws the Returns edge">ArgProp::<b>Alias</b></span></code></a>, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L30"><code><span title="only whether it was supplied matters, as with missing()">ArgProp::<b>Presence</b></span></code></a>,
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L28"><code><span title="called as a function, like FUN in lapply(x, FUN)">ArgProp::<b>Callee</b></span></code></a>, ...). Every bit it cannot see stays unset, so an unset bit
reads as "unknown" rather than "no"; <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L428"><code><span title="The part of a BuiltInFnInfo the signature database already knows: the parameter names in order with the ArgProp bits stored for each, plus the SigDbProps properties; everything else is dropped.">fnInfoFromSignature</span></code></a> hands the mask on unchanged, which is
what lets a package function answer the same questions a built-in does.

Per version the source also answers declared dependencies (<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L131"><code><span title="a decoded package dependency of one version (type is the compact DepType enum; map to a label via DepTypeNames )">ResolvedDependency</span></code></a>), release dates, the plain export view (<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L16"><code><span title="The resolved identifiers of a singular package version">LibraryExports</span></code></a>), the versions it carries (<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/reader.ts#L139"><code><span title="one version a source can answer for a package, with its release date when known">AvailableVersion</span></code></a>), and its class relations (<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L298"><code><span title="One class of a package version: what its declaration states, plus which package defines it -- structure s4Classes (a flat name list) has no room for, so a consumer can tell an owned class from an inherited one.">SigClassInfo</span></code></a>, via <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/reader.ts#L660"><code>SigDatabase::<b>classes</b></code></a>).

A class record states what a declaration does: its direct superclasses, its slots with the types they were declared with, whether it is virtual, and whether it is a `setClassUnion` (whose supers are the members it unites). <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L310"><code><span title="The package defining the class, when not the one carrying the record (see ClassProp.Foreign ); absent when self-defined.">SigClassInfo::<b>package</b></span></code></a> names the package *defining* a class the record only relates to, which is what tells a class the package owns from one it inherits -- something the flat name list of <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L29"><code><span title="S4 classes this package version OWNS: it exports the class via its NAMESPACE exportClasses(). See FnProp.S4Owner .">LibraryExports::<b>s4Classes</b></span></code></a> has nowhere to hang. The same shape carries Reference classes, S7 and R6, since all four declare a name, a parent and a set of members. On the analysis side <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/class-declaration.ts#L321"><code>declaredClasses</code></a> reads these off `setClass`/`setClassUnion`/`setIs`/`setRefClass`/`new_class`/`R6Class` calls and <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/class-declaration.ts#L406"><code>toSigClasses</code></a> hands them over in this form.

Beyond the flags above, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/decode.ts#L77"><code>DecodedFunction::<b>props</b></code></a> also carry <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L57"><code>FnProp::<b>NoDoc</b></code></a> (a documented package has no help page for this name), <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L58"><code>FnProp::<b>S3Method</b></code></a> (a registered S3 method, from the package NAMESPACE or base R's method table), and <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L64"><code><span title="An exported function that is also an S3 class this package OWNS: it is a same-named constructor for a class the package registers at least one S3 method for (see LibraryExports.s3Classes , derived from this bit by deriveLibraryExports ).">FnProp::<b>S3Owner</b></span></code></a> (an exported constructor for an S3 class this package OWNS: it also registers at least one S3 method for that class). The owned classes of a version are <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L27"><code><span title="S3 classes this package version OWNS: it registers at least one S3 method for the class (its NAMESPACE's S3method(generic, class)) AND exports a same-named constructor function. See FnProp.S3Owner .">LibraryExports::<b>s3Classes</b></span></code></a>, and <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/reader.ts#L585"><code>SigDatabase::<b>classOwner</b></code></a> answers, for a class name, which package owns it (backed by a reverse index built once). This lets [version guessing](https://github.com/flowr-analysis/flowr/wiki/Query-API) mark a package used when the analyzed project's own NAMESPACE registers an S3 method for a class it owns, even with no direct call, e.g. tseries's `S3method("as.irts","zoo")` marks `zoo` used.

The S4 side has <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L69"><code><span title="Set on the name of an S4 class this package OWNS: it exports the class via its NAMESPACE exportClasses() (see LibraryExports.s4Classes , derived from this bit by deriveLibraryExports ).">FnProp::<b>S4Owner</b></span></code></a> for an exported class and <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L75"><code><span title="A registered S4 method: the name is exported because the package answers a generic for one of its classes (setMethod('sin', 'float32', ...), exportMethods(sin)), not because it defines a function of its own. The S4 analogue of FnProp.S3Method .">FnProp::<b>S4Method</b></span></code></a> for a name a package exports because it answered a generic for one of its classes (`setMethod("sin", "float32", ...)` plus `exportMethods(sin)`), rather than because it defines a function of its own. Such a name is often documented only under its `sin,float32-method` Rd alias, so it also carries <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L57"><code>FnProp::<b>NoDoc</b></code></a>. Because `setMethod("Math", ...)` answers every member of a group at once, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/signature-db.ts#L54"><code><span title="The database entry for a *qualified* call, i.e. a pkg::fn Identifier . Decodes only that one function rather than the whole package. A name the package answers only as part of an S4 group falls back to the group: Matrix::sin is served by Matrix's Math entry when there is no sin of its own, because that is what an sin(x) call dispatches to. The result then carries the group's name, not the one that...">SignatureDb::<b>functionOf</b></span></code></a> falls back to the group entry for a member it finds nothing for: `pkg::sin` is served by `pkg`'s `Math`, which is what the call would dispatch to. <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/group-generics.ts#L46"><code><span title="The S4 group generic name is a member of, undefined for a name that is in none.">groupGenericOf</span></code></a> maps a member to its group.

<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L86"><code><span title="The definition is a generic others dispatch on (S3 UseMethod, S4 setGeneric/standardGeneric, S7 new_generic). The call graph only shows this for an S3 generic with a bundled body, never for S4/S7.">FnProp::<b>Generic</b></span></code></a> says the definition is one others dispatch on: an S3 generic whose body calls `UseMethod`, an S4 one from `setGeneric`, or an S7 `new_generic`. The call graph shows the same for the S3 case, but only while a bundle carries one, and never for a generic built without an R body -- which is why the bit exists next to it. <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L428"><code><span title="The part of a BuiltInFnInfo the signature database already knows: the parameter names in order with the ArgProp bits stored for each, plus the SigDbProps properties; everything else is dropped.">fnInfoFromSignature</span></code></a> reads it, falling back to the dispatching callee for a bundle written before it.

<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L81"><code><span title="The export binds a value rather than a function: a constant, a dataset, a class object (pi, LETTERS, ggplot2's class_gg). Only the extractor can tell: an entry without a definition location may equally be a function built at load time, an S4 generic or a Vectorize result, which has no source to point at.">FnProp::<b>Value</b></span></code></a> says the export binds a value rather than a function (`pi`, `LETTERS`, ggplot2's `class_gg`). Only the extractor can tell: an entry without a definition location is as likely to be a function nothing wrote down, an S4 generic `setGeneric` builds or a `Vectorize` result, so a reader that has only the location to go on can say no more than that there is none.

These are derived on demand by the [signature query](https://github.com/flowr-analysis/flowr/wiki/Query-API), not stored:
- the documentation link <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/signature-query/signature-query-format.ts#L74"><code><span title="best-effort documentation link (R's own manual for base R, rdrr.io for CRAN), when the name maps to a documentable topic">SignatureFunctionView::<b>docUrl</b></span></code></a>, omitted for a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L57"><code>FnProp::<b>NoDoc</b></code></a> function: R's own manual for a base package, rdrr.io's `/cran/<pkg>/man/<topic>` for CRAN. rdrr.io serves an older R, so everything R has gained since (`sort_by`, `array2DF`, ...) is a dead link there
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/signature-query/signature-query-format.ts#L72"><code><span title="deep link to the definition on the read-only GitHub mirror of the sources (CRAN, or R's own for a base package)">SignatureFunctionView::<b>sourceUrl</b></span></code></a> and <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/signature-query/signature-query-format.ts#L76"><code><span title="link to the .Rd help source *at the queried version*, which docUrl cannot offer (it serves the current release alone)">SignatureFunctionView::<b>manUrl</b></span></code></a>: the definition and its `.Rd` help page at the queried version, on `github.com/cran/<pkg>` (CRAN) or `github.com/wch/r-source` (base R)
- the S3 method to generic backlink <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/signature-query/signature-query-format.ts#L82"><code><span title="when the function is an S3 method, the generic it dispatches for (print.rema is print in base, class rema); lazily computed">SignatureFunctionView::<b>s3method</b></span></code></a>, for a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L58"><code>FnProp::<b>S3Method</b></code></a> function, resolving its generic
- the S4 group <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/signature-query/signature-query-format.ts#L92"><code><span title="The S4 group generic the name belongs to (sin is in Math, + in Arith). viaGroup says the view was answered by the package's entry for the group rather than by one for the name itself: a setMethod('Math', 'cls', ...) answers every member of the group at once, and that is what a sin(x) call on such a class dispatches to. A member is often documented only under its sin,cls-method Rd alias, which is w...">SignatureFunctionView::<b>s4group</b></span></code></a>, for a name that is a member of one (`sin` of `Math`), saying whether the view was answered by the package's entry for the group rather than by one for the name itself
- the transitive call graph <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/reader.ts#L644"><code>SigDatabase::<b>transitiveCallees</b></code></a>, expanding the stored local callees inside one version

## Reading It From an Analyzer

<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L181"><code>FlowrAnalyzerDependenciesContext::<b>signatures</b></code></a> is the entry point, and it is the one you want.


```ts
function fromTheAnalyzer(analyzer: FlowrAnalyzer) {
	const db = analyzer.inspectContext().deps.signatures();
	const lead = Identifier.make('lead', 'dplyr');
	return {
		version:    db.versionOf('dplyr'),      // the version this analysis assumes
		fn:         db.functionOf(lead),        // its entry, decoding only this one function
		parameters: db.parametersOf(lead),      // its formals, ready for MatchArgs.toNames
		exports:    db.exportsOf('dplyr')?.exported
	};
}
```

<i>Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-signature-database.ts#L29">src/documentation/wiki-signature-database.ts#L29</a></i>


The <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/signature-db.ts#L28"><code><span title="The signature database as the analyzed project sees it. A PackageSignatureSource answers for a version you name, and falls back to whatever it holds as newest when you name none. This adds the step above that, taking the version from what flowR resolved for the project, which is where solver.sigdb.versionOverrides, solver.sigdb.versionSelection and solver.sigdb.assumedRVersion have already been ap...">SignatureDb</span></code></a> it hands back is every loaded source as one database, answering for the version
*the analyzed project* assumes for each package, which is the version `solver.sigdb.versionOverrides`,
`solver.sigdb.versionSelection` and `solver.sigdb.assumedRVersion` produced. That matters, because a
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/reader.ts#L83"><code><span title="The read interface every package-signature source implements, so a SigDatabase and a sharded SigDatabaseSet are interchangeable. An omitted version answers for the database's newest, never the version flowR assumed for the project.">PackageSignatureSource</span></code></a> asked without a version answers for whatever it happens to hold as newest,
which is not what the analysis assumes. When the assumed version is one the database does not carry, the answer
falls back to the newest it has and says so in the log rather than quietly answering for another version.

<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/signature-db.ts#L64"><code><span title="Every loaded source as one, for the questions this interface does not ask.">SignatureDb::<b>sources</b></span></code></a> is the escape hatch to the raw sources for what the interface above does not
cover, and reaches the same functions directly.


```ts
	const fn = source.functionByName('dplyr', 'lead', '1.1.4');
	return {
		exported:   fn?.exported,
		signature:  fn?.signature.map(p => p.name),
		localCalls: fn?.callees,
		topic:      fn?.topic,
		location:   [fn?.file, fn?.line],
		transitive: source.transitiveCallees('dplyr', 'lead', '1.1.4'),
		deps:       source.dependencies('dplyr', '1.1.4'),
		exports:    source.lookup('dplyr')?.exported,
		s3Classes:  source.lookup('zoo')?.s3Classes,
		classOwner: source.classOwner('zoo')
	};
}
```

<i>Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-signature-database.ts#L40">src/documentation/wiki-signature-database.ts#L40</a></i>


To check what a project can resolve against without touching the raw sources, a [context](https://github.com/flowr-analysis/flowr/wiki/Analyzer) exposes
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L164"><code>FlowrAnalyzerDependenciesContext::<b>hasSignatureDatabase</b></code></a> (a cheap presence check) and
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L160"><code>FlowrAnalyzerDependenciesContext::<b>availableSignatureDatabases</b></code></a> (the identifying names of the loaded databases), alongside the
richer <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L153"><code>FlowrAnalyzerDependenciesContext::<b>loadedSignatureDatabases</b></code></a> metadata.

## Configuration

The exports come from [`versions:sigdb`](https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/plugin-registry.ts), which reads bundled databases. It is enabled by
default (see [configuring flowR](https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr)).

*Which* version's exports get resolved is decided by the version-reading plugins that pin the packages a
project uses.


```ts
function usePackageDatabase(parser: KnownParser) {
	const sigdb = new FlowrAnalyzerPackageVersionsSigDbPlugin('/path/to/sigs.manifest.json.br');
	return new FlowrAnalyzerBuilder().setParser(parser).registerPlugins(sigdb).build();
}
```

<i>Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-signature-database.ts#L23">src/documentation/wiki-signature-database.ts#L23</a></i>


File sources load lazily on the first package load, so a script with no `library()` or `use()` calls
never pays to parse them. Set <a href="https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr" title="Configuration Option (boolean): Parse the database up front rather than on the first package load (default false, ignored if disabled).">solver.sigdb.eagerlyLoad</a> to mount the database up front instead, or
<a href="https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr" title="Configuration Option (boolean): Resolve library()/use() exports from a signature database (default true); when false no database is consulted.">solver.sigdb.enabled</a> to `false` to switch it off entirely. For a compressed (`.br`) or manifest source,
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin.ts#L404"><code><span title="Open every source, including compressed bundles (.br/.gz) and manifests (*.manifest.json). Call once at the analyzer boundary so resolution can fall through to them.">preload</span></code></a> it before analysis to mount it.

The base-R packages (`base`, `stats`, `graphics`, ...) resolve against an assumed R version, which
defaults to `4.5.3` (<a href="https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr" title="Configuration Option (string): R version assumed when resolving versioned (base-R) exports: a pin like &quot;4.5&quot; or &quot;auto&quot; to detect the installed R (default &quot;auto&quot;).">solver.sigdb.assumedRVersion</a>, or `"auto"` to detect the local R).
So `library(stats)` attaches that release's exports, and a bare `sd()` qualifies to `stats::sd` even
without attaching the base namespaces to the graph. Set <a href="https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr" title="Configuration Option (boolean): Eagerly attach base-R namespaces so bare base calls resolve without library() (default false).">solver.sigdb.linkBaseR</a> to also link them as
dataflow edges.

Signature shards are not committed to the repository because of their size (the `current.*` and `history.*` scopes
span tens of megabytes): the `base.*` floor (self-contained base-R signatures, a few hundred KB), the
`current.*` scope (every package's latest version) and `history.*` (every older version) all live as assets on the
free <a href="https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr" title="Configuration Option (string): GitHub owner/repo the full-history bundle is downloaded from via &quot;:signature download&quot; (default &quot;flowr-analysis/flowr&quot;, release tag &quot;sigdb-v&lt;flowR-version&gt;&quot;).">solver.sigdb.downloadRepo</a> GitHub release. The only committed file is a tiny **link file**,
`src/data/sigdb/sigdb.remote.json`, which records the release tag and each shard's sha256 and size, so
<span title="Description (Repl Command): Inspect and extend the signature database: `query` (identical to :query @signature), `add <path>` to mount another database/source, `download` to fetch the full-history database. (aliases: :sig)">`:signature`</span> download builds the direct release-CDN URL, verifies every shard by content hash,
and skips any already cached. Because the link file is versioned, a `git pull` that updates it re-syncs only the
shards whose hash changed &mdash; and with <a href="https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr" title="Configuration Option (boolean): On startup, re-download shards whose committed sigdb.remote.json hash no longer matches the cache, in the background (default false; opt-in network sync after a git pull).">solver.sigdb.autoSync</a> that check runs on startup and re-downloads in the
background; `npm run build` bakes the shards in as well. The richest downloaded scope is used (order `full` >
`current` > `base`), so once fetched `library(stats)` resolves. Any path in <a href="https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr" title="Configuration Option (array): Extra directories or bundle/manifest files searched for signature databases (alongside the shipped default and $FLOWR_SIGDB_DIR); a downloaded full-history bundle placed here is mounted automatically.">solver.sigdb.additionalPaths</a> (or
`$FLOWR_SIGDB_DIR`) is searched alongside the default, so a downloaded bundle stays mounted on every start.


## Bundled Databases

The default bundle is not a single file but a set of shards that a manifest routes between (see
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/reader.ts#L755"><code><span title="A transparent, read-only view over several SigDatabase shards described by a SigDbManifest . When the manifest embeds each shard's index (the default), openManifest() reads only that small file to build the routing table.">SigDatabaseSet</span></code></a>). Nothing is read when the manifest opens. The first lookup of a package
decompresses only the one shard that holds it, plus the shared dictionary once. The following ship with this
build; the load column is the decompression time measured at generation time.

| Shard | Contents | Versions kept | Packages | Versions | Size (`.br`) | Load (first touch) |
|-------|----------|---------------|---------:|---------:|-------------:|-------------------:|
| `base-current` | base-R packages (`base`, `stats`, `graphics`, ...) | latest only | 23 | 23 | 104 KB | ≈ 600 µs |
| `base-full` | base-R packages (`base`, `stats`, `graphics`, ...) | full history | 23 | 1,626 | 468 KB | ≈ 5 ms |
| `current-top` | the 1,000 most-downloaded CRAN packages | latest only | 1,000 | 1,000 | 2.1 MB | ≈ 14 ms |
| `current-rest` | the remaining CRAN packages | latest only | 22,742 | 22,742 | 15.1 MB | ≈ 190 ms |
| `history-rest` | the remaining CRAN packages | full history | 18,466 | 140,128 | 30.7 MB | ≈ 420 ms |

Which shard answers a lookup follows from the package and the version asked for. A base-R package comes from
`base-current`, one of the 1,000 most-downloaded CRAN packages from `current-top`, and anything else from
`current-rest`. The `*-full` and `history-*` shards hold every historical version and are only touched when
an older, pinned version is requested, so a normal analysis never decompresses them. Each scope carries its own
shared dictionary that its shards depend on, so it is decompressed the first time any of its packages is looked up and then reused.
The flowR Docker images ship this dictionary already decompressed, so a container reads it in place and skips
that step (the load column above is the cost a plain npm install pays).

Every shard, dictionary, and manifest is published in both brotli (`.br`) and zstd (`.zst`, faster to decompress) compression, and flowR uses whichever the runtime supports: `.zst` when the Node version exposes [zstd](https://nodejs.org/api/zlib.html#zstd) (Node &ge; 22.15), otherwise `.br`. <span title="Description (Repl Command): Inspect and extend the signature database: `query` (identical to :query @signature), `add <path>` to mount another database/source, `download` to fetch the full-history database. (aliases: :sig)">`:signature`</span> download fetches only that one variant per file, and <span title="Description (Repl Command): Prints the version of flowR as well as the current version of R">`:version`</span> reports the format each loaded database resolved to.

## Format

The on-disk format is `flowr-sigdb` (schema 5). Beyond each version's exports it records, per
version, every function's signature (the parameters, each with its default and its <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L8"><code><span title="What a single argument of a call is used for, as a bitmask ( ArgProp.Forced / ArgProp.NoDefault lead, being the two bits the signature database can also state).">ArgProp</span></code></a> mask)
and call graph, together with that version's declared dependencies (`Depends`, `Imports`, ... with their
version qualifiers). The layout is NDJSON: a header, then a shared string dictionary, then one
self-contained blob per package, next to a sidecar `.idx`. A reader (<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/reader.ts#L363"><code><span title="Fast, partial reader for a single bundle. open()/openSync() load the string dictionary + .idx once, then every query seeks straight to one package blob; open() additionally decompresses a .br/.gz source into a hash-keyed cache.">SigDatabase</span></code></a>) therefore
loads the dictionary once and then **seeks straight to the packages it needs**, never reading the rest.
The bundle is written by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/build.ts#L236"><code><span title="Accumulates analyzed functions and serializes a SigDb . Feed it with addPackage / addVersion , then build ; pooling happens there so the result is deterministic for identical inputs.">SigDbBuilder</span></code></a> and can be split into several small shards (current-only
versus full history, top-N versus the rest) that a `flowr-sigdb-manifest` routes transparently
(<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/reader.ts#L755"><code><span title="A transparent, read-only view over several SigDatabase shards described by a SigDbManifest . When the manifest embeds each shard's index (the default), openManifest() reads only that small file to build the routing table.">SigDatabaseSet</span></code></a>), and which information gets stored is selectable (<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/sigdb/schema.ts#L324"><code><span title="Which information to store in a bundle (default: everything); turning a feature off shrinks the database. The export view (exported/internal/deprecated) is always available.">SigDbFeatures</span></code></a>).
The extractor produces the bundle from its analysis of CRAN.

## Performance

The dictionary is read once, the reader then seeks straight to each requested package, and consumers cache
what they derive (the `base`-package list is precomputed when flowR is bundled, so it costs nothing at
analysis time). After the one-time load a per-package lookup is O(1), so each `library()` or `::` a script uses is a single cached lookup.