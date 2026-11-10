/**
 * Regenerates `src/data/r-base-guards.generated.ts`: what the closures of the base packages ask of their
 * arguments, as the `inspect-fn-guards` query works it out for the R running this script.
 * The closures of a package are analyzed together, so its internal helpers count, except for `base`, which
 * defines `stop` and `stopifnot` itself and so has each of its closures analyzed on its own.
 *   ts-node --transpile-only scripts/gen-base-guards.ts [--json <path>]
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../src/r-bridge/retriever';
import { RBinaryOp } from '../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { NodeId } from '../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { StatedGuards } from '../src/dataflow/fn/guards/built-in-guards';
import { statedGuardsOf } from '../src/dataflow/fn/guards/stated-guards';
import { DefaultBuiltinConfig } from '../src/dataflow/environments/default-builtin-config';
import { builtInNames } from '../src/dataflow/environments/query-fn-props';
import { Identifier } from '../src/dataflow/environments/identifier';
import { ImplicitClasses } from '../src/dataflow/fn/guards/guard-knowledge';

const Target = path.join('src', 'data', 'r-base-guards.generated.ts');

interface Closure {
	readonly pkg:         string
	readonly name:        string
	readonly exported:    boolean
	readonly code:        string
	/** the generic and class it is the S3 method of */
	readonly methodOf?:   { readonly generic: string, readonly class: string }
	/** the formal it dispatches on, for a generic */
	readonly dispatches?: string
}

const quoted = (name: string): string => '`' + name + '`';
const definition = ({ name, code }: Closure): string => `${quoted(name)} <- ${code}\n`;

function readClosures(file: string, pkg: string): Closure[] {
	return fs.readFileSync(file, 'utf8').split('\n').filter(l => l !== '').map(line => {
		const [name, exported, code, generic, cls, dispatches] = line.split('\t');
		return {
			pkg, name, exported: exported === 'TRUE', code: code.replace(/\\(.)/g, (_, c: string) => c === 'n' ? '\n' : c),
			...(generic === '' ? {} : { methodOf: { generic, class: cls } }),
			...(dispatches === '' ? {} : { dispatches })
		};
	});
}

/** Adds what the closures state of the given names to `into`, leaving out those with nothing to state. */
async function guardsIn(closures: readonly Closure[], names: ReadonlySet<string>, into: Record<string, StatedGuards>): Promise<void> {
	const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
	analyzer.addRequest(requestFromInput(closures.map(definition).join('\n')));
	const owners = new Map(closures.map(c => [c.name, c.pkg]));
	const { idMap } = await analyzer.normalize();
	const { guards } = (await analyzer.query([{ type: 'inspect-fn-guards' }]))['inspect-fn-guards'];
	for(const [id, guard] of Object.entries(guards)) {
		const parentId = idMap.get(NodeId.normalize(id))?.info.parent;
		const parent = parentId === undefined ? undefined : idMap.get(parentId);
		const name = parent !== undefined && RBinaryOp.is(parent) ? parent.lhs.lexeme?.replaceAll('`', '') : undefined;
		const stated = statedGuardsOf(guard, idMap, n => owners.get(n)) ?? (guard.required.length > 0 ? { requires: '', required: guard.required } : undefined);
		if(name !== undefined && names.has(name) && stated !== undefined) {
			into[name] = stated;
		}
	}
}

/** What flowR models itself, which keeps its built-in meaning rather than the closure R has for it, like `stop` or `match.arg`. */
const Modeled: ReadonlySet<string> = new Set(DefaultBuiltinConfig.flatMap(d => d.type === 'constant' ? [] : builtInNames(d).map(Identifier.getName)));

/** The closures `from` calls, transitively, that flowR does not model itself, so what they check counts as well. */
function calledClosures(this: void, from: readonly Closure[], available: ReadonlyMap<string, Closure>): Closure[] {
	const found = new Map<string, Closure>();
	const queue = [...from];
	for(let next = queue.pop(); next !== undefined; next = queue.pop()) {
		for(const [, name] of next.code.matchAll(/([A-Za-z.][A-Za-z0-9._]*)\s*\(/g)) {
			const callee = available.get(name);
			if(callee !== undefined && !Modeled.has(name) && !found.has(name) && !from.includes(callee)) {
				found.set(name, callee);
				queue.push(callee);
			}
		}
	}
	return [...found.values()];
}

async function guardsOfPackage(pkg: string, closures: readonly Closure[], others: ReadonlyMap<string, Closure>): Promise<Record<string, StatedGuards>> {
	const guards: Record<string, StatedGuards> = {};
	const exported = closures.filter(c => c.exported);
	const own = new Map(closures.map(c => [c.name, c]));
	/* what a closure calls of its own package wins over a name another package has as well */
	const available = new Map([...others, ...own]);
	if(pkg === 'base') {
		for(const closure of exported) {
			/* what a value without a class attribute runs of a generic counts, the other methods would only make the program larger */
			const methods = closure.dispatches === undefined ? [] : (methodsOf.get(closure.name) ?? []).filter(m => m.methodOf?.class === 'default' || ImplicitClasses.includes(m.methodOf?.class ?? ''));
			const helpers = calledClosures([closure, ...methods], available);
			await guardsIn([closure, ...methods, ...helpers], new Set([closure.name]), guards);
		}
	} else {
		await guardsIn([...closures, ...calledClosures(closures, available)], new Set(exported.map(c => c.name)), guards);
	}
	return Object.fromEntries(Object.entries(guards).map(([name, stated]) => [name, { ...stated, ...relationOf(own.get(name)) }]));
}

/** Every S3 method of the packages, by the generic it is for. */
const methodsOf = new Map<string, Closure[]>();

/** The generic a closure is a method of, or the methods a generic has, as {@link StatedGuards} states them. */
function relationOf(this: void, closure: Closure | undefined): Pick<StatedGuards, 'methodOf' | 'methods' | 'dispatches'> {
	if(closure === undefined) {
		return {};
	}
	const generic = closure.methodOf === undefined ? undefined : genericsByName.get(closure.methodOf.generic);
	const methods = closure.dispatches === undefined ? [] : (methodsOf.get(closure.name) ?? []).map(m => `${m.pkg}::${m.name}`).sort();
	return {
		...(closure.methodOf === undefined ? {} : { methodOf: { generic: generic === undefined ? closure.methodOf.generic : `${generic.pkg}::${generic.name}`, class: closure.methodOf.class } }),
		...(closure.dispatches === undefined ? {} : { dispatches: closure.dispatches, ...(methods.length > 0 ? { methods } : {}) })
	};
}

/** The generics of the packages by name, base winning as it is attached last. */
const genericsByName = new Map<string, Closure>();

async function main(): Promise<void> {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-base-guards-'));
	execFileSync('Rscript', [path.join('scripts', 'gen-base-guards.R'), dir], { stdio: 'inherit' });
	const version = fs.readFileSync(path.join(dir, 'R-version'), 'utf8').trim();
	const all: Record<string, Record<string, StatedGuards>> = {};
	const packages = fs.readdirSync(dir).filter(f => f.endsWith('.closures.tsv')).sort().map(file => file.slice(0, -'.closures.tsv'.length)).map(pkg => [pkg, readClosures(path.join(dir, `${pkg}.closures.tsv`), pkg)] as const);
	/* the exported closures of every package, base winning a name others export as well, as it is attached last */
	const exports = new Map([...packages.filter(([pkg]) => pkg !== 'base'), ...packages.filter(([pkg]) => pkg === 'base')].flatMap(([, closures]) => closures.filter(c => c.exported).map(c => [c.name, c] as const)));
	for(const closure of packages.flatMap(([, closures]) => closures)) {
		if(closure.methodOf !== undefined) {
			methodsOf.set(closure.methodOf.generic, [...methodsOf.get(closure.methodOf.generic) ?? [], closure]);
		}
	}
	for(const closure of exports.values()) {
		if(closure.dispatches !== undefined) {
			genericsByName.set(closure.name, closure);
		}
	}
	for(const [pkg, closures] of packages) {
		all[pkg] = await guardsOfPackage(pkg, closures, exports);
		console.log(`  ${pkg}: ${Object.keys(all[pkg]).length} functions`);
	}
	fs.rmSync(dir, { recursive: true });
	const json = process.argv.indexOf('--json');
	if(json >= 0) {
		fs.writeFileSync(process.argv[json + 1], JSON.stringify(all));
	}
	/* one line per function, so what changes between versions of R stays readable and small */
	const rows = Object.entries(all).map(([pkg, guards]) => `\t${JSON.stringify(pkg)}: {\n${Object.entries(guards).map(([name, guard]) => `\t\t${JSON.stringify(name)}: ${JSON.stringify(guard)}`).join(',\n')}\n\t}`);
	fs.writeFileSync(Target, `import type { BaseGuards } from '../dataflow/fn/guards/built-in-guards';
/* GENERATED by scripts/gen-base-guards.ts from R ${version}, do not edit. */
/** What the closures of the base packages ask of their arguments, as \`package -> name -> guards\`. */
export const RBaseGuards: BaseGuards = {
${rows.join(',\n')}
};

/** The R version {@link RBaseGuards} was read off. */
export const RBaseGuardsVersion = ${JSON.stringify(version)};

/** The day {@link RBaseGuards} was read off, as an ISO date. */
export const RBaseGuardsDate = ${JSON.stringify(new Date().toISOString().slice(0, 10))};
`);
	console.log(`wrote ${Target}`);
	process.exit(0);
}

void main();
