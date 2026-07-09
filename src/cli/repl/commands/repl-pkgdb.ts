import fs from 'fs';
import { type ReplCommand, printUsage } from './repl-main';
import { buildPkgDbFromInstalled } from '../../../project/plugins/package-version-plugins/pkgdb-local';
import { splitAtEscapeSensitive } from '../../../util/text/args';

export const pkgDbAddCommand: ReplCommand = {
	description:   'Extract the exports of a locally installed R package (or a whole library folder) into a flowr-pkgdb file (load it via the FLOWR_PKGDB environment variable)',
	isCodeCommand: false,
	usageExample:  ':pkgdb-add <installed-package-or-library-dir> <output.json>',
	aliases:       [],
	script:        false,
	fn:            async({ output, analyzer, remainingLine }) => {
		const [dir, out] = splitAtEscapeSensitive(remainingLine.trim());
		if(!dir || !out) {
			printUsage(output, pkgDbAddCommand);
			return;
		}
		const { db, added } = await buildPkgDbFromInstalled(analyzer.flowrConfig, dir, {
			date:      new Date().toISOString().slice(0, 10),
			generated: Date.now()
		});
		if(added.length === 0) {
			output.stderr(`No installed R packages found in ${dir}`);
			return;
		}
		try {
			fs.writeFileSync(out, JSON.stringify(db));
		} catch(e) {
			output.stderr(`Could not write ${out}: ${(e as Error).message}`);
			return;
		}
		output.stdout(`Wrote ${added.length} package${added.length === 1 ? '' : 's'} to ${out}: ${added.join(', ')}`);
	}
};
