import type { FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrWrappedFile } from '../../../context/flowr-file';
import type { SexpType } from './flowr-rda-file';
import { elementOf, FlowrRDAFile, namesOf, RDAParser } from './flowr-rda-file';
import { log } from '../../../../util/log';

const sysdataLog = log.getSubLogger({ name: 'flowr-sysdata-file' });

/** an installed package ships a lazy-load database, `sysdata.rdb`, with this index beside it */
const LazyLoadIndexPattern = /\.rdx$/i;
const LazyLoadVariablesEntry = 'variables';

/** One R object a package's system data provides. */
export interface SysdataObject {
	readonly name:  string;
	/** `undefined` when only the name is known, i.e. for an installed package's `sysdata.rdx` */
	readonly type?: SexpType;
}

/**
 * Decorates a package's system data (`R/sysdata.rda`, or the `R/sysdata.rdx` an installed package ships) to
 * expose the objects it lazy-loads into the package namespace.
 * Prefer {@link FlowrSysdataFile.from}, which avoids re-wrapping and handles roles.
 * @see https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Data-in-packages
 */
export class FlowrSysdataFile extends FlowrWrappedFile<readonly SysdataObject[]> {
	protected loadContent(): readonly SysdataObject[] {
		try {
			return LazyLoadIndexPattern.test(this.path()) ? readLazyLoadIndex(this.wrapped) : readSavedImage(this.wrapped);
		} catch(e) {
			sysdataLog.warn(`Failed to read ${JSON.stringify(this.path())} as package system data: ${String(e)}`);
			return [];
		}
	}
}

/** a source package's `sysdata.rda`, a saved image whose top-level objects are the system data */
function readSavedImage(file: FlowrFileProvider): readonly SysdataObject[] {
	return FlowrRDAFile.from(file).content()
		.filter((o): o is typeof o & { name: string } => o.name !== undefined)
		.map(o => ({ name: o.name, type: o.type }));
}

/** an installed package's `sysdata.rdx`: the names of its `variables` are what the database holds */
function readLazyLoadIndex(file: FlowrFileProvider): readonly SysdataObject[] {
	const index = new RDAParser(file, false).parseObject();
	return namesOf(elementOf(index, LazyLoadVariablesEntry)).map(name => ({ name }));
}
