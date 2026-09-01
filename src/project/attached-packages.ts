import { DepType } from './sigdb/schema';
import type { PackageSignatureSource } from './sigdb/reader';
import { uniqueArray } from '../util/collections/arrays';

/**
 * Packages that attach further packages from their `.onAttach` hook, which no package metadata records: their core
 * set sits in `Imports`, indistinguishable from the packages they merely use. Whoever loads one of them gets the
 * whole set on the search path, so `library(tidyverse)` has to resolve `ggplot()`.
 * `Depends` is handled generally by {@link attachedAlongside} and hence not repeated here.
 */
export const MetaPackageCores: ReadonlyMap<string, readonly string[]> = new Map([
	['tidyverse', ['ggplot2', 'tibble', 'tidyr', 'readr', 'purrr', 'dplyr', 'stringr', 'forcats', 'lubridate']],
	['tidymodels', ['broom', 'dials', 'dplyr', 'ggplot2', 'infer', 'modeldata', 'parsnip', 'purrr', 'recipes',
		'rsample', 'tailor', 'tibble', 'tidyr', 'tune', 'workflows', 'workflowsets', 'yardstick']],
	['easystats', ['bayestestR', 'correlation', 'datawizard', 'effectsize', 'insight', 'modelbased', 'parameters',
		'performance', 'report', 'see']],
	['fpp3', ['tibble', 'dplyr', 'tidyr', 'lubridate', 'ggplot2', 'tsibble', 'tsibbledata', 'ggtime', 'feasts', 'fable']]
]);

/**
 * The packages that end up on the search path alongside `pack` when it is attached: everything it `Depends` on
 * (which R attaches with it) and, for a {@link MetaPackageCores|meta-package}, the core set it attaches itself.
 */
export function attachedAlongside(pack: string, sources: readonly PackageSignatureSource[], version?: string): readonly string[] {
	const depends = sources
		.flatMap(src => src.dependencies(pack, version) ?? [])
		.filter(d => d.type === DepType.Depends && d.name !== 'R')
		.map(d => d.name);
	return uniqueArray([...depends, ...MetaPackageCores.get(pack) ?? []]);
}
