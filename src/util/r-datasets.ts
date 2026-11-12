import { RDatasets } from '../data/r-datasets.generated';
import { BaseDatasets } from './r-base-packages';
import type { BrandedIdentifier, BrandedNamespace } from '../dataflow/environments/identifier';

/** The shape of a data set a package ships as a data frame, like `penguins` of `datasets` or `starwars` of `dplyr`. */
export interface DatasetShape {
	/** the package shipping the data set */
	readonly pkg:     BrandedNamespace
	/** the name of the data set */
	readonly name:    BrandedIdentifier
	/** the number of rows */
	readonly rows:    number
	/** the column names, in order */
	readonly columns: readonly string[]
	/** the class of every column, as the first entry of `class()` */
	readonly classes: readonly string[]
}

/** the packages shipping a data set of each name, to look up a name that names no package */
let byName: Map<string, BrandedNamespace[]> | undefined;

function packagesWith(name: BrandedIdentifier): readonly BrandedNamespace[] {
	if(byName === undefined) {
		byName = new Map();
		for(const [pkg, sets] of Object.entries(RDatasets())) {
			for(const set of Object.keys(sets)) {
				const known = byName.get(set);
				if(known === undefined) {
					byName.set(set, [pkg]);
				} else {
					known.push(pkg);
				}
			}
		}
	}
	return byName.get(String(name)) ?? [];
}

/**
 * The shape of the data set `name`, which R finds as lazy data: from `pkg` if given (as in `pkg::name`), otherwise
 * from `datasets` (always attached) or from the first package `isLoaded` holds that ships a data set of that name.
 * The shapes are read from the packages installed where flowR was built, see `scripts/gen-r-datasets.ts`.
 * @example
 * ```ts
 * datasetShape('penguins')?.columns            // ['species', 'island', ...]
 * datasetShape('starwars', 'dplyr')?.rows      // 87
 * ```
 */
export function datasetShape(name: BrandedIdentifier, pkg?: BrandedNamespace, isLoaded: (pkg: BrandedNamespace) => boolean = () => false): DatasetShape | undefined {
	const from = pkg ?? (BaseDatasets.has(name) ? 'datasets' : packagesWith(name).find(isLoaded));
	const shape = from === undefined ? undefined : RDatasets()[String(from)]?.[String(name)];
	return shape === undefined || from === undefined ? undefined : { pkg: from, name, rows: shape[0], columns: shape[1], classes: shape[2] };
}

/** Every data set `pkg` ships as a data frame, by name. */
export function datasetsOf(pkg: BrandedNamespace): readonly BrandedIdentifier[] {
	return Object.keys(RDatasets()[String(pkg)] ?? {});
}
