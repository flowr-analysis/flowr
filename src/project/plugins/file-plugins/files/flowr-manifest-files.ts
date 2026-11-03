import { type StringableContent, FlowrWrappedFile } from '../../../context/flowr-file';
import type { DeepReadonly } from 'ts-essentials';
import type { DeclaredPackages } from '../../../context/flowr-analyzer-meta-context';
import { Package } from '../../package-version-plugins/package';
import { parse as parseToml } from 'smol-toml';
import { log } from '../../../../util/log';

export const manifestFileLog = log.getSubLogger({ name: 'flowr-manifest-file' });

/** what a project manifest declares, whether it is a file of its own or a block within a script */
export interface ProjectManifest {
	/** unlike the `Package` of a `DESCRIPTION` this is no namespace, such a project is no package */
	projectName(): string | undefined;
	/** `undefined` if the manifest only states a requirement like `>=4.0.0` */
	rVersion(): string | undefined;
	/** grouped as a `DESCRIPTION` groups them */
	declares(): DeclaredPackages;
}

/**
 * A project manifest that is no `DESCRIPTION` (an rv `rproject.toml`, a uvr `uvr.toml`, a rig `rproj.toml`).
 * Prefer the static `from` method of the concrete subclass, which avoids re-wrapping and handles roles.
 */
export abstract class FlowrManifestFile<Content extends StringableContent = StringableContent> extends FlowrWrappedFile<Content> implements ProjectManifest {
	/** unlike the `Package` of a `DESCRIPTION` this is no namespace, such a project is no package */
	public abstract projectName(): string | undefined;
	/** `undefined` if the manifest only states a requirement like `>=4.0.0` */
	public abstract rVersion(): string | undefined;
	/** grouped as a `DESCRIPTION` groups them */
	public abstract declares(): DeclaredPackages;

	/** the parsed TOML of the wrapped file, empty (with a warning) if it does not parse */
	protected parseTomlContent(): Record<string, unknown> {
		return parseTomlOrEmpty(this.wrapped.content().toString(), this.wrapped.path());
	}
}

function parseTomlOrEmpty(toml: string, origin: string): Record<string, unknown> {
	try {
		return parseToml(toml);
	} catch(e) {
		manifestFileLog.warn(`Could not parse ${origin}: ${(e as Error).message}`);
		return {};
	}
}

/** a requirement that starts with a version (`4.4`) pins one; `>= 4.4` or `*` only constrains */
function pinnedVersion(version: unknown): string | undefined {
	const trimmed = typeof version === 'string' ? version.trim() : '';
	return /^\d/.test(trimmed) ? trimmed : undefined;
}

/**
 * The entries of a table mapping a package name to a bare requirement (`">=3.0.0"`, `"*"`, `">= 1.0, < 2.0"`) or to
 * one with its origin (`{ version = ..., git = ... }`), as uvr and rig write them. Anything else (an array such as
 * rig's `include-groups`) names no package.
 */
function dependencyEntries(table: unknown): [string, string | Readonly<Record<string, unknown>>][] {
	// an array is no such table, and its indices would pass as package names
	if(!isTable(table)) {
		return [];
	}
	return Object.entries(table).filter((e): e is [string, string | Record<string, unknown>] => e[0].length > 0 && (typeof e[1] === 'string' || isTable(e[1])));
}

function isTable(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function packageOf([name, spec]: readonly [string, string | Readonly<Record<string, unknown>>]): Package {
	const version = typeof spec === 'string' ? spec : spec.version;
	// `*` accepts anything, so it constrains nothing
	const range = typeof version === 'string' && version !== '*' ? Package.parsePkgVersionRange(undefined, version) : undefined;
	return new Package({ name, type: 'package', versionConstraints: range ? [range] : undefined });
}

function packagesOf(table: unknown): Package[] {
	return dependencyEntries(table).map(packageOf);
}

/** the packages of every table in `groups` (`[dependency-groups.dev]`, `[optional-dependencies.plot]`) */
function packagesOfGroups(groups: unknown): Package[] {
	return isTable(groups) ? Object.values(groups).flatMap(packagesOf) : [];
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
		return (this.parseTomlContent() as { project?: RvProject }).project ?? {};
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
		return this.parseTomlContent();
	}

	public projectName(): string | undefined {
		const name = this.content().project?.name;
		return typeof name === 'string' ? name : undefined;
	}

	/** uvr usually states a requirement (`>=4.0.0`), which pins nothing; the `uvr.lock` holds the resolved version */
	public rVersion(): string | undefined {
		return pinnedVersion(this.content().project?.r_version);
	}

	public declares(): DeclaredPackages {
		return {
			imports:  packagesOf(this.content().dependencies),
			suggests: packagesOf(this.content()['dev-dependencies'])
		};
	}
}

/**
 * The tables of a [rig](https://rig.r-lib.org/proj-guide.html) project manifest (`src/rproj.rs` of rig), of which a
 * script states `[dependencies]` in its inline block.
 */
interface RigManifest {
	project?:                 { name?: unknown };
	dependencies?:            unknown;
	'linking-dependencies'?:  unknown;
	'dependency-groups'?:     unknown;
	'optional-dependencies'?: unknown;
}

function rigRVersion(manifest: DeepReadonly<RigManifest>): string | undefined {
	const deps = manifest.dependencies;
	return isTable(deps) ? pinnedVersion(deps.R) : undefined;
}

/**
 * Grouped as a `DESCRIPTION` groups them: `R` in `[dependencies]` is the requirement on R itself (`Depends`), an entry
 * marked `enhances = true` is an `Enhances`, `[linking-dependencies]` is `LinkingTo`. Dependency groups and optional
 * dependencies are reported but not needed to run the project, like `Suggests`.
 */
function rigDeclares(manifest: DeepReadonly<RigManifest>): DeclaredPackages {
	const deps = dependencyEntries(manifest.dependencies);
	const enhances = (e: (typeof deps)[number]) => typeof e[1] !== 'string' && e[1].enhances === true;
	return {
		depends:   deps.filter(e => e[0] === 'R').map(packageOf),
		imports:   deps.filter(e => e[0] !== 'R' && !enhances(e)).map(packageOf),
		enhances:  deps.filter(enhances).map(packageOf),
		linkingTo: packagesOf(manifest['linking-dependencies']),
		suggests:  [...packagesOfGroups(manifest['dependency-groups']), ...packagesOfGroups(manifest['optional-dependencies'])]
	};
}

/** The `rproj.toml` of a [rig](https://rig.r-lib.org/proj-guide.html) project, lifted by {@link FlowrRigProjectFile.from}. */
export class FlowrRigProjectFile extends FlowrManifestFile<DeepReadonly<RigManifest>> {
	protected loadContent(): RigManifest {
		return this.parseTomlContent();
	}

	public projectName(): string | undefined {
		const name = this.content().project?.name;
		return typeof name === 'string' ? name : undefined;
	}

	public rVersion(): string | undefined {
		return rigRVersion(this.content());
	}

	public declares(): DeclaredPackages {
		return rigDeclares(this.content());
	}
}

/** the comment markers a rig script block may use, `##` first as `#` is its prefix */
const RigBlockMarkers = ['##', '#'] as const;
/** the only tables a script block may hold, rig rejects the script for any other */
const RigScriptTables: ReadonlySet<string> = new Set(['dependencies', 'repository', 'tool']);

/**
 * The manifest a rig script states inline, read as rig reads it (`src/script_meta.rs` of rig): the one comment block
 * opened by a line that is exactly `# /// script` (or `## /// script`), anywhere in the file, and closed by `# ///`
 * with the same marker. Every line in between starts with that marker, and without it (and one space) the lines are
 * TOML holding `[dependencies]`, `[[repository]]` and `[tool]`. As rig refuses to run the script otherwise, a second
 * block, an unclosed block, a line without the marker, broken TOML or any other table declare nothing.
 */
export function rigScriptManifest(code: string, origin: string): ProjectManifest | undefined {
	const lines = code.split('\n').map(l => l.replace(/\r$/, ''));
	const opens = lines.flatMap((line, i) => {
		const marker = RigBlockMarkers.find(m => line.trimEnd() === `${m} /// script`);
		return marker === undefined ? [] : [{ i, marker }];
	});
	if(opens.length !== 1) {
		return undefined;
	}
	const { i: start, marker } = opens[0];
	const body: string[] = [];
	for(const line of lines.slice(start + 1)) {
		if(line.trimEnd() === `${marker} ///`) {
			return rigScriptOf(body.join('\n'), origin);
		}
		if(!line.startsWith(marker)) {
			return undefined;
		}
		const rest = line.slice(marker.length);
		body.push(rest.startsWith(' ') ? rest.slice(1) : rest);
	}
	return undefined;
}

function rigScriptOf(toml: string, origin: string): ProjectManifest | undefined {
	let parsed: Record<string, unknown>;
	try {
		parsed = parseToml(toml);
	} catch(e) {
		manifestFileLog.warn(`Could not parse the rig script block of ${origin}: ${(e as Error).message}`);
		return undefined;
	}
	if(Object.keys(parsed).some(k => !RigScriptTables.has(k))) {
		manifestFileLog.warn(`The rig script block of ${origin} holds a table rig does not allow, rig would not run it`);
		return undefined;
	}
	const manifest: DeepReadonly<RigManifest> = { dependencies: parsed.dependencies };
	return { projectName: () => undefined, rVersion: () => rigRVersion(manifest), declares: () => rigDeclares(manifest) };
}
