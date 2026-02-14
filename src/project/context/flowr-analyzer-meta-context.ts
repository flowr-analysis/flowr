import type { SemVer } from 'semver';


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
	 * Get the project namespace.
	 * Any symbol resolve like `a::b` will resolve against this, if `a` matches the namespace.
	 */
	getNamespace(): string | undefined;
}

/**
 * This is the context responsible for managing the project metadata such as name, version, title, and namespace.
 *
 * If you are interested in inspecting this metadata, refer to {@link ReadOnlyFlowrAnalyzerMetaContext}.
 */
export class FlowrAnalyzerMetaContext implements ReadOnlyFlowrAnalyzerMetaContext {
	public readonly name = 'flowr-analyzer-meta-context';
	private projectName:    string | undefined;
	private projectTitle:   string | undefined;
	private projectVersion: SemVer & { str: string } | undefined;
	private namespace:      string | undefined;

	public reset(): void {
		this.projectName = undefined;
		this.projectTitle = undefined;
		this.projectVersion = undefined;
		this.namespace = undefined;
	}

	public setProjectName(name: string): void {
		this.projectName = name;
	}

	public getProjectName(): string | undefined {
		return this.projectName;
	}
	public setProjectTitle(title: string): void {
		this.projectTitle = title;
	}

	public getProjectTitle(): string | undefined {
		return this.projectTitle;
	}
	public setProjectVersion(version: SemVer & { str: string }): void {
		this.projectVersion = version;
	}

	public getProjectVersion(): SemVer & { str: string } | undefined {
		return this.projectVersion;
	}
	public setNamespace(namespace: string): void {
		this.namespace = namespace;
	}

	public getNamespace(): string | undefined {
		return this.namespace;
	}
}
