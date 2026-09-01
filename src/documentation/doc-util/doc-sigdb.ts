import { defaultSigDbPath } from '../../project/sigdb/manifest';
import { bold, ColorEffect, Colors, ansiFormatter } from '../../util/text/ansi';

/** Whether a CRAN signature database is installed, i.e. more than the `base` shard every checkout ships. */
export function cranDatabaseAvailable(): boolean {
	return defaultSigDbPath('current') !== undefined || defaultSigDbPath('full') !== undefined;
}

/** The warning shown when a page that documents the signature database is generated without one. */
export function missingSigDbWarning(target: string): string {
	const warn = (s: string) => ansiFormatter.format(s, { color: Colors.Yellow, effect: ColorEffect.Foreground });
	return warn(`
${bold('!! no signature database installed !!', ansiFormatter)}
   [${target}] documents the signature database, but only the bundled base shard is present.
   Generating it now would replace the committed page with base-R-only numbers and examples.
   Run ${bold('npm run sync:sigdb', ansiFormatter)} first (see wiki/Signature Database), or leave the page as it is.`);
}

/**
 * Warns that `target` documents the signature database while none is installed, so whatever it would write
 * shows base R alone. Returns whether the database is missing, so a caller can skip the page instead.
 */
export function warnMissingSigDb(target: string): boolean {
	if(cranDatabaseAvailable()) {
		return false;
	}
	console.warn(missingSigDbWarning(target));
	return true;
}
