import type { SemVer } from 'semver';
import type { RAuthorInfo } from '../../util/r-author';
import type { RLicenseElementInfo } from '../../util/r-license';
import type { Package } from '../plugins/package-version-plugins/package';

/**
 * How much a {@link ProjectMetaFields | contribution} is trusted, in case several sources disagree.
 * A higher value wins; among equal values the first contribution stays.
 */
export enum MetaPriority {
	/** derived from a lockfile, e.g. the `r_version` of an `rv.lock` */
	Lockfile    = 0,
	/** declared in a project manifest, e.g. an `rproject.toml` */
	Manifest    = 1,
	/** declared in a `DESCRIPTION` file, which identifies an actual R package */
	Description = 2
}

/**
 * The packages a project declares, grouped as a `DESCRIPTION` groups them. A source without such groups
 * (an `rproject.toml` just lists `dependencies`) reports them as {@link DeclaredPackages#imports}.
 */
export interface DeclaredPackages {
	imports?:   readonly Package[];
	depends?:   readonly Package[];
	suggests?:  readonly Package[];
	linkingTo?: readonly Package[];
}

/** The project metadata a plugin may contribute, see {@link FlowrAnalyzerMetaContext#contribute}. */
export interface ProjectMetaFields {
	/** the project name, e.g. the `Package` of a `DESCRIPTION` or the `[project] name` of an `rproject.toml` */
	name?:      string;
	/** the human-readable project title */
	title?:     string;
	/** the project version */
	version?:   SemVer & { str: string };
	/** the R version the project targets, e.g. the `r_version` of an `rproject.toml` */
	rVersion?:  string;
	/**
	 * The namespace `a::b` resolves against. Only set this for a real R package: a plain project
	 * (e.g. an rv project) has a name but no namespace, and claiming one changes symbol resolution.
	 */
	namespace?: string;
	/** the project authors */
	authors?:   RAuthorInfo[];
	/** the encoding the project's files are written in */
	encoding?:  string;
	/** the project licenses */
	licenses?:  RLicenseElementInfo[];
	/** the packages the project declares, used to report on them; what is loadable lives in the dependency context */
	declares?:  DeclaredPackages;
}

export interface ReadOnlyFlowrAnalyzerMetaContext {
	/**
	 * The name of this context.
	 */
	readonly name: string;
	/**
	 * Get the project name.
	 */
	getProjectName(): string | undefined;
	/**
	 * Get the project title.
	 */
	getProjectTitle(): string | undefined;
	/**
	 * Get the project version.
	 */
	getProjectVersion(): SemVer & { str: string } | undefined;
	/**
	 * Get the R version the project targets, if any source declares one.
	 */
	getRVersion(): string | undefined;
	/**
	 * Get the project namespace.
	 * Any symbol resolve like `a::b` will resolve against this, if `a` matches the namespace.
	 */
	getNamespace(): string | undefined;
	/**
	 * Get the project authors.
	 */
	getAuthors(): RAuthorInfo[] | undefined;
	/**
	 * Get the encoding the project's files are written in.
	 */
	getEncoding(): string | undefined;
	/**
	 * Get the project licenses.
	 */
	getLicenses(): RLicenseElementInfo[] | undefined;
	/**
	 * Get the packages the project declares, grouped by how they are declared.
	 */
	getDeclaredPackages(): DeclaredPackages;
}

/**
 * This is the context responsible for managing the project metadata such as name, version, title, and namespace.
 *
 * The metadata is source-agnostic: plugins {@link FlowrAnalyzerMetaContext#contribute | contribute} whatever their
 * file declares (`DESCRIPTION`, `rproject.toml`, a lockfile, ...) and consumers read it from here rather than from
 * any particular file. Conflicts are settled by {@link MetaPriority}, so contributions are order-independent.
 *
 * If you are interested in inspecting this metadata, refer to {@link ReadOnlyFlowrAnalyzerMetaContext}.
 */
export class FlowrAnalyzerMetaContext implements ReadOnlyFlowrAnalyzerMetaContext {
	public readonly name = 'flowr-analyzer-meta-context';
	private readonly fields = new Map<keyof ProjectMetaFields, { value: unknown, priority: MetaPriority }>();
	/** runs the plugins that contribute the metadata, as they only do so on demand */
	private readonly ensureContributed: () => void;

	constructor(ensureContributed: () => void = () => {}) {
		this.ensureContributed = ensureContributed;
	}

	public reset(): void {
		this.fields.clear();
	}

	/**
	 * Contribute what a source declares about the project; `undefined` fields are ignored, so a plugin can pass
	 * whatever it happens to know.
	 * @param fields   - the metadata to contribute
	 * @param priority - how much to trust these fields against other sources
	 */
	public contribute(fields: ProjectMetaFields, priority: MetaPriority): this {
		for(const [key, value] of Object.entries(fields) as [keyof ProjectMetaFields, unknown][]) {
			if(value === undefined) {
				continue;
			}
			const have = this.fields.get(key);
			if(have === undefined || priority > have.priority) {
				this.fields.set(key, { value, priority });
			}
		}
		return this;
	}

	private get<T>(key: keyof ProjectMetaFields): T | undefined {
		this.ensureContributed();
		return this.fields.get(key)?.value as T | undefined;
	}

	public getProjectName(): string | undefined {
		return this.get('name');
	}

	public getProjectTitle(): string | undefined {
		return this.get('title');
	}

	public getProjectVersion(): SemVer & { str: string } | undefined {
		return this.get('version');
	}

	public getRVersion(): string | undefined {
		return this.get('rVersion');
	}

	public getNamespace(): string | undefined {
		return this.get('namespace');
	}

	public getAuthors(): RAuthorInfo[] | undefined {
		return this.get('authors');
	}

	public getEncoding(): string | undefined {
		return this.get('encoding');
	}

	public getLicenses(): RLicenseElementInfo[] | undefined {
		return this.get('licenses');
	}

	public getDeclaredPackages(): DeclaredPackages {
		return this.get<DeclaredPackages>('declares') ?? {};
	}
}
