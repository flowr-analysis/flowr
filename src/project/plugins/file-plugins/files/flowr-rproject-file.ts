import { type FlowrFileProvider, type FileRole, FlowrFile } from '../../../context/flowr-file';
import type { DeepReadonly } from 'ts-essentials';
import { Package } from '../../package-version-plugins/package';
import { parse as parseToml } from 'smol-toml';
import { log } from '../../../../util/log';

export const rProjectFileLog = log.getSubLogger({ name: 'flowr-rproject-file' });

/** The `[project]` table of an `rproject.toml`, see https://a2-ai.github.io/rv-docs/config/ */
interface RvProject {
	name?:         unknown;
	r_version?:    unknown;
	dependencies?: unknown;
}

/**
 * Decorates the `rproject.toml` of an [rv](https://a2-ai.github.io/rv-docs/) project and provides access to the
 * fields of its `[project]` table. Use the static {@link FlowrRProjectFile.from} method to create instances.
 */
export class FlowrRProjectFile extends FlowrFile<DeepReadonly<RvProject>> {
	private readonly wrapped: FlowrFileProvider;

	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	protected loadContent(): RvProject {
		try {
			const toml = parseToml(this.wrapped.content().toString());
			return (toml as { project?: RvProject }).project ?? {};
		} catch(e) {
			rProjectFileLog.warn(`Could not parse ${this.wrapped.path()}: ${(e as Error).message}`);
			return {};
		}
	}

	/** rproject lifter, this does not re-create if already an rproject file */
	public static from(file: FlowrFileProvider | FlowrRProjectFile, role?: FileRole): FlowrRProjectFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRProjectFile ? file : new FlowrRProjectFile(file);
	}

	/** The `name` of the project; unlike a `DESCRIPTION` `Package` this is no namespace, an rv project is not a package. */
	public projectName(): string | undefined {
		const name = this.content().name;
		return typeof name === 'string' ? name : undefined;
	}

	/** The `r_version` the project targets, e.g. `4.5`. */
	public rVersion(): string | undefined {
		const version = this.content().r_version;
		return typeof version === 'string' ? version : undefined;
	}

	/**
	 * The declared `dependencies`, which are either a plain name or a table carrying the name alongside its
	 * origin (`{ name = "ggplot2", repository = "new-rspm" }`).
	 */
	public dependencies(): Package[] {
		const deps = this.content().dependencies;
		if(!Array.isArray(deps)) {
			return [];
		}
		const out: Package[] = [];
		for(const dep of deps) {
			const name = typeof dep === 'string' ? dep : (dep as { name?: unknown })?.name;
			if(typeof name === 'string' && name.length > 0) {
				out.push(new Package({ name, type: 'package' }));
			}
		}
		return out;
	}
}
