import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import { linkFlowRSourceFile, RemoteFlowrFilePathBaseRef } from './doc-util/doc-files';
import { PkgDbSchema } from '../project/plugins/package-version-plugins/pkgdb';
import { FlowrAnalyzerPackageVersionsPkgDbPlugin } from '../project/plugins/package-version-plugins/flowr-analyzer-package-versions-pkgdb-plugin';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import type { KnownParser } from '../r-bridge/parser';

/** point the resolver at your own database (a file path or http(s) URL) */
function usePackageDatabase(parser: KnownParser) {
	const pkgdb = new FlowrAnalyzerPackageVersionsPkgDbPlugin('/path/to/pkgdb-all.json.br');
	return new FlowrAnalyzerBuilder().setParser(parser).registerPlugins(pkgdb).build();
}

/** link a built-in plugin key (e.g. `versions:pkgdb`) to its registration */
function pluginLink(key: string): string {
	return `[\`${key}\`](${RemoteFlowrFilePathBaseRef}src/project/plugins/plugin-registry.ts)`;
}

/**
 * https://github.com/flowr-analysis/flowr/wiki/Package-Database
 */
export class WikiPackageDatabase extends DocMaker<'wiki/Package Database.md'> {
	constructor() {
		super('wiki/Package Database.md', module.filename, 'bundled CRAN package database that resolves `library()` calls');
	}

	public text({ ctx }: DocMakerArgs): string {
		return `
# Package Database

flowR ships a database of CRAN package exports so it can resolve calls into the packages you load.
After \`library(ggplot2)\`, a call to \`ggplot()\` resolves to \`ggplot2::ggplot\`. This also backs
qualified names (a bare \`map()\` after \`library(purrr)\` is \`purrr::map\`, not the \`maps\` plot), the
${ctx.linkPage('wiki/Query API', 'dependencies and call-context queries')}, and the ${ctx.linkPage('wiki/Linter', '`undefined-symbol` rule')}.

## Configuration

The exports come from ${pluginLink('versions:pkgdb')}, which reads the bundled database (on by default;
see ${ctx.linkPage('wiki/Interface', 'configuring flowR', 'configuring-flowr')}).

*Which* version's exports are resolved is decided by the version-reading plugins that pin the packages
used in a project. These are only examples - more may be registered:

- ${pluginLink('versions:description')} reads a package's \`DESCRIPTION\` (\`Depends\` / \`Imports\`, ${linkFlowRSourceFile('src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin.ts')}).
- ${pluginLink('versions:renv')} and ${pluginLink('versions:rv')} read a project's \`renv.lock\` / \`rv.lock\`
  to pin exact versions (${linkFlowRSourceFile('src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts')}).

So \`library(pkg)\` resolves the pinned version's exports. To override or extend the bundle, hand
${pluginLink('versions:pkgdb')} extra sources (file paths, parsed objects, or \`http(s)\` URLs).

${ctx.code(usePackageDatabase, { dropLinesStart: 1 })}

File sources load lazily on the first package load, so scripts without \`library()\`/\`use()\` calls never
pay for parsing them (set \`solver.pkgdb.eagerlyLoad\` to mount the database up front, or \`solver.pkgdb.enabled: false\` to switch it off entirely).
For a URL source call ${ctx.linkM(FlowrAnalyzerPackageVersionsPkgDbPlugin, 'preload', { hideClass: true, codeFont: true })} (\`await pkgdb.preload()\`) before analysis to download it.

## Format

One JSON object (\`flowr-pkgdb\`, schema ${PkgDbSchema}) with a pooled string table.
Reader and writer both live in ${linkFlowRSourceFile('src/project/plugins/package-version-plugins/pkgdb.ts')}.
`.trim();
	}
}
