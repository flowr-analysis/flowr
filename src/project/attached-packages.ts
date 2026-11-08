import { DepType } from './sigdb/schema';
import type { PackageSignatureSource } from './sigdb/reader';
import { uniqueArray } from '../util/collections/arrays';
import { RVersion } from '../util/r-version';

/**
 * Packages that attach further packages from their `.onAttach` hook, which no package metadata records: their core
 * set sits in `Imports`, indistinguishable from the packages they merely use. Whoever loads one of them gets the
 * whole set on the search path, so `library(tidyverse)` has to resolve `ggplot()`.
 * Each entry lists, from the release it first appeared in, the core set in the order the hook attaches it (each
 * on top of the last), as read from the hook's source in every CRAN release.
 * `Depends` is handled generally by {@link attachedAlongside} and hence not repeated here.
 */
const MetaPackageCores: ReadonlyMap<string, readonly (readonly [since: string, core: readonly string[]])[]> = new Map([
	['tidyverse', [
		['1.0.0', ['ggplot2', 'tibble', 'tidyr', 'readr', 'purrr', 'dplyr']],
		['1.2.0', ['ggplot2', 'tibble', 'tidyr', 'readr', 'purrr', 'dplyr', 'stringr', 'forcats']],
		['2.0.0', ['ggplot2', 'tibble', 'tidyr', 'readr', 'purrr', 'dplyr', 'stringr', 'forcats', 'lubridate']]
	]],
	['tidymodels', [
		['0.0.1', ['ggplot2', 'tibble', 'purrr', 'dplyr', 'rsample', 'recipes', 'broom', 'yardstick', 'infer']],
		['0.0.2', ['broom', 'dials', 'dplyr', 'ggplot2', 'infer', 'parsnip', 'purrr', 'recipes', 'rsample', 'tibble', 'yardstick']],
		['0.1.0', ['broom', 'dials', 'dplyr', 'ggplot2', 'infer', 'parsnip', 'purrr', 'recipes', 'rsample', 'tibble', 'tune', 'workflows', 'yardstick']],
		['0.1.1', ['broom', 'dials', 'dplyr', 'ggplot2', 'infer', 'modeldata', 'parsnip', 'purrr', 'recipes', 'rsample', 'tibble', 'tidyr', 'tune', 'workflows', 'yardstick']],
		['0.1.3', ['broom', 'dials', 'dplyr', 'ggplot2', 'infer', 'modeldata', 'parsnip', 'purrr', 'recipes', 'rsample', 'tibble', 'tidyr', 'tune', 'workflows', 'workflowsets', 'yardstick']],
		['1.4.1', ['broom', 'dials', 'dplyr', 'ggplot2', 'infer', 'modeldata', 'parsnip', 'purrr', 'recipes', 'rsample', 'tailor', 'tidyr', 'tune', 'workflows', 'workflowsets', 'yardstick']]
	]],
	['easystats', [
		['0.5.2', ['insight', 'datawizard', 'bayestestR', 'performance', 'parameters', 'effectsize', 'modelbased', 'correlation', 'see', 'report']]
	]],
	['fpp3', [
		['0.1', ['tibble', 'dplyr', 'tidyr', 'lubridate', 'ggplot2', 'tsibble', 'tsibbledata', 'feasts', 'fable']],
		['0.5', ['tibble', 'dplyr', 'tidyr', 'lubridate', 'ggplot2', 'tsibble', 'tsibbledata', 'feasts', 'fable', 'fabletools']],
		['1.0.1', ['tibble', 'dplyr', 'tidyr', 'lubridate', 'ggplot2', 'tsibble', 'tsibbledata', 'feasts', 'fable']],
		['1.0.3', ['tibble', 'dplyr', 'tidyr', 'lubridate', 'ggplot2', 'tsibble', 'tsibbledata', 'ggtime', 'feasts', 'fable']]
	]]
]);

/**
 * The core set the {@link MetaPackageCores|meta-package} `pack` attaches from its `.onAttach` hook at `version`
 * (the newest release's when unknown, the oldest one's for a version predating every recorded release), empty for any other package.
 */
export function metaPackageCore(pack: string, version?: string): readonly string[] {
	const releases = MetaPackageCores.get(pack) ?? [];
	const matching = version === undefined ? releases : releases.filter(([since]) => RVersion.compare(since, version) <= 0);
	return (matching.at(-1) ?? releases[0])?.[1] ?? [];
}

/** What attaching a package puts on the search path with it, in the order R attaches them. */
export interface AttachedAlongside {
	/** what it `Depends` on: R attaches these first, so they end up below it */
	readonly depends:  readonly string[];
	/** the core set a {@link MetaPackageCores|meta-package} attaches from its `.onAttach` hook, above it */
	readonly onAttach: readonly string[];
}

/**
 * The packages that end up on the search path alongside `pack` when it is attached: everything it `Depends` on
 * (which R attaches with it) and, for a {@link MetaPackageCores|meta-package}, the core set it attaches itself.
 */
export function attachedAlongside(pack: string, sources: readonly PackageSignatureSource[], version?: string): AttachedAlongside {
	const depends = sources
		.flatMap(src => src.dependencies(pack, version) ?? [])
		.filter(d => d.type === DepType.Depends && d.name !== 'R')
		.map(d => d.name);
	return { depends: uniqueArray(depends), onAttach: metaPackageCore(pack, version) };
}
