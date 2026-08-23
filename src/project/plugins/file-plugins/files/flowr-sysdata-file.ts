import type { FileRole, FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile } from '../../../context/flowr-file';
import type { RObject, SexpType } from './flowr-rda-file';
import { FlowrRDAFile, RDAParser } from './flowr-rda-file';
import { log } from '../../../../util/log';

const sysdataLog = log.getSubLogger({ name: 'flowr-sysdata-file' });

/** an installed package ships a lazy-load database, `sysdata.rdb`, with this index beside it */
const LazyLoadIndexPattern = /\.rdx$/i;
const LazyLoadVariablesEntry = 'variables';
const NamesAttribute = 'names';

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
export class FlowrSysdataFile extends FlowrFile<readonly SysdataObject[]> {
	private readonly wrapped: FlowrFileProvider;

	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	protected loadContent(): readonly SysdataObject[] {
		try {
			return LazyLoadIndexPattern.test(this.path()) ? readLazyLoadIndex(this.wrapped) : readSavedImage(this.wrapped);
		} catch(e) {
			sysdataLog.warn(`Failed to read ${JSON.stringify(this.path())} as package system data: ${String(e)}`);
			return [];
		}
	}

	/** Lifts a file to a {@link FlowrSysdataFile}, reusing it if already one and assigning `role`. */
	public static from(file: FlowrFileProvider | FlowrSysdataFile, role?: FileRole): FlowrSysdataFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrSysdataFile ? file : new FlowrSysdataFile(file);
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
	return (namesOf(elementOf(index, LazyLoadVariablesEntry)) ?? []).map(name => ({ name }));
}

/** the element called `name` of a serialized named list */
function elementOf(obj: RObject | undefined, name: string): RObject | undefined {
	const at = namesOf(obj)?.indexOf(name) ?? -1;
	const elements = typeof obj === 'object' && obj !== null ? obj.value : undefined;
	return at < 0 || !Array.isArray(elements) ? undefined : elements[at] as RObject;
}

/** the `names` attribute of a serialized object */
function namesOf(obj: RObject | undefined): readonly string[] | undefined {
	if(typeof obj !== 'object' || obj === null) {
		return undefined;
	}
	for(const attribute of obj.attributes ?? []) {
		for(let node: RObject | undefined = attribute; typeof node === 'object' && node !== null; node = node.cdr) {
			if(typeof node.tag !== 'object' || node.tag === null || node.tag.name !== NamesAttribute) {
				continue;
			}
			const names = typeof node.car === 'object' && node.car !== null ? node.car.value : undefined;
			return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : undefined;
		}
	}
	return undefined;
}
