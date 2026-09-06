import { type StringableContent, FlowrWrappedFile } from '../../../context/flowr-file';
import type { DeepReadonly } from 'ts-essentials';
import type { DeclaredPackages } from '../../../context/flowr-analyzer-meta-context';
import { Package } from '../../package-version-plugins/package';
import { parse as parseToml } from 'smol-toml';
import { log } from '../../../../util/log';

export const manifestFileLog = log.getSubLogger({ name: 'flowr-manifest-file' });

/**
 * A project manifest that is no `DESCRIPTION` (an rv `rproject.toml`, a uvr `uvr.toml`).
 * Prefer the static `from` method of the concrete subclass, which avoids re-wrapping and handles roles.
 */
export abstract class FlowrManifestFile<Content extends StringableContent = StringableContent> extends FlowrWrappedFile<Content> {
	/** unlike the `Package` of a `DESCRIPTION` this is no namespace, such a project is no package */
	public abstract projectName(): string | undefined;
	/** `undefined` if the manifest only states a requirement like `>=4.0.0` */
	public abstract rVersion(): string | undefined;
	/** grouped as a `DESCRIPTION` groups them */
	public abstract declares(): DeclaredPackages;
}

/** the `[project]` table of an `rproject.toml`, see https://a2-ai.github.io/rv-docs/config/ */
interface RvProject {
	name?:         unknown;
	r_version?:    unknown;
	dependencies?: unknown;
}

/** The `rproject.toml` of an [rv](https://a2-ai.github.io/rv-docs/) project, lifted by {@link FlowrRProjectFile.from}. */
export class FlowrRProjectFile extends FlowrManifestFile<DeepReadonly<RvProject>> {
	protected loadContent(): RvProject {
		try {
			const toml = parseToml(this.wrapped.content().toString());
			return (toml as { project?: RvProject }).project ?? {};
		} catch(e) {
			manifestFileLog.warn(`Could not parse ${this.wrapped.path()}: ${(e as Error).message}`);
			return {};
		}
	}

	public projectName(): string | undefined {
		const name = this.content().name;
		return typeof name === 'string' ? name : undefined;
	}

	/** rv pins a concrete `r_version`, e.g. `4.5` */
	public rVersion(): string | undefined {
		const version = this.content().r_version;
		return typeof version === 'string' ? version : undefined;
	}

	/** either a plain name or a table carrying it (`{ name = "ggplot2", repository = "new-rspm" }`) */
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

	/** rv does not group its dependencies, they are all needed to run the project */
	public declares(): DeclaredPackages {
		return { imports: this.dependencies() };
	}
}

/** the parts of a `uvr.toml` we read, see https://github.com/nbafrank/uvr */
interface UvrManifest {
	project?:            { name?: unknown, r_version?: unknown };
	dependencies?:       unknown;
	'dev-dependencies'?: unknown;
}

/** The `uvr.toml` of a [uvr](https://github.com/nbafrank/uvr) project, lifted by {@link FlowrUvrManifestFile.from}. */
export class FlowrUvrManifestFile extends FlowrManifestFile<DeepReadonly<UvrManifest>> {
	protected loadContent(): UvrManifest {
		try {
			return parseToml(this.wrapped.content().toString());
		} catch(e) {
			manifestFileLog.warn(`Could not parse ${this.wrapped.path()}: ${(e as Error).message}`);
			return {};
		}
	}

	public projectName(): string | undefined {
		const name = this.content().project?.name;
		return typeof name === 'string' ? name : undefined;
	}

	/** uvr usually states a requirement (`>=4.0.0`), which pins nothing; the `uvr.lock` holds the resolved version */
	public rVersion(): string | undefined {
		const version = this.content().project?.r_version;
		const trimmed = typeof version === 'string' ? version.trim() : '';
		return /^\d/.test(trimmed) ? trimmed : undefined;
	}

	public declares(): DeclaredPackages {
		return {
			imports:  this.packagesOf(this.content().dependencies),
			suggests: this.packagesOf(this.content()['dev-dependencies'])
		};
	}

	/** a table mapping the name to a bare requirement (`">=3.0.0"`, `"*"`) or to one with its origin (`{ version = ..., git = ... }`) */
	private packagesOf(table: unknown): Package[] {
		// an array is no such table, and its indices would pass as package names
		if(typeof table !== 'object' || table === null || Array.isArray(table)) {
			return [];
		}
		const out: Package[] = [];
		for(const [name, spec] of Object.entries(table)) {
			if(name.length === 0) {
				continue;
			}
			const version = typeof spec === 'string' ? spec : (spec as { version?: unknown })?.version;
			// `*` accepts anything, so it constrains nothing
			const range = typeof version === 'string' && version !== '*' ? Package.parsePkgVersionRange(undefined, version) : undefined;
			out.push(new Package({ name, type: 'package', versionConstraints: range ? [range] : undefined }));
		}
		return out;
	}
}
