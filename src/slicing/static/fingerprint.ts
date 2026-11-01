import objectHash from 'object-hash';
import type { Environment, REnvironmentInformation } from '../../dataflow/environments/environment';
import { isDefaultBuiltInEnvironment } from '../../dataflow/environments/environment';
import type { IdentifierDefinition } from '../../dataflow/environments/identifier';
import { Frame, type MemoryView } from '../../dataflow/environments/frame-memory';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export type Fingerprint = string;

const HashOptions = {
	algorithm:                 'md5',
	excludeKeys:               (key: string) => key === 'id' || key === 'value',
	respectFunctionProperties: false,
	respectFunctionNames:      false,
	ignoreUnknown:             true,
	replacer:                  (v: unknown) => isDefaultBuiltInEnvironment(v) ? undefined : v
} as const satisfies objectHash.NormalOption;

/* definitions, bindings, and frames are shared across the environments a slice builds, and a definition may hold
 * a whole environment of its own (`envState`), so each is hashed once instead of on every fingerprint. Bindings
 * are keyed apart from the frame because cloning shares them until one side writes (see {@link Environment#clone}):
 * the graph holds many frames per distinct set of bindings, and hashing that set is what costs. */
const definitionHashes = new WeakMap<IdentifierDefinition & object, Fingerprint>();
const memoryHashes = new WeakMap<MemoryView & object, Fingerprint>();
const frameHashes = new WeakMap<Environment, Fingerprint>();

function definitionHash(definition: IdentifierDefinition): Fingerprint {
	let hash = definitionHashes.get(definition);
	if(hash === undefined) {
		hash = objectHash(definition, HashOptions);
		definitionHashes.set(definition, hash);
	}
	return hash;
}

/** digests plain strings and primitives as one string, which spares {@link objectHash} a reflective walk (and works in the browser, where `crypto` is stubbed) */
function digest(parts: readonly (string | number | boolean | undefined)[]): Fingerprint {
	return objectHash(JSON.stringify(parts), HashOptions);
}

function memoryHash(memory: MemoryView): Fingerprint {
	let hash = memoryHashes.get(memory);
	if(hash !== undefined) {
		return hash;
	}
	const lazy = memory instanceof Frame ? memory.lazy() : undefined;
	if(lazy !== undefined) {
		/* an attached package's exports: hashing what they bind would build a definition for every one of them */
		hash = digest([lazy.origin, ...lazy.keys()]);
	} else {
		const entries: string[] = [];
		for(const [name, definitions] of memory) {
			entries.push(`${String(name)}=${definitions.map(definitionHash).join(',')}`);
		}
		entries.sort();
		hash = digest(entries);
	}
	memoryHashes.set(memory, hash);
	return hash;
}

function frameHash(frame: Environment): Fingerprint {
	let hash = frameHashes.get(frame);
	if(hash === undefined) {
		hash = digest([frame.n, frame.t, frame.closure, frame.globalEnv === true, memoryHash(frame.memory)]);
		frameHashes.set(frame, hash);
	}
	return hash;
}

/**
 * Calculate a fingerprint for the given R environment information
 * @see {@link fingerprint}
 */
export function envFingerprint(env: REnvironmentInformation): Fingerprint {
	const parts: Fingerprint[] = [String(env.level)];
	let frame: Environment | undefined = env.current;
	while(frame !== undefined && !frame.builtInEnv) {
		parts.push(frameHash(frame));
		frame = frame.parent;
	}
	return parts.join('|');
}

/**
 * Calculate a fingerprint for the given node id and environment fingerprint
 * @see {@link envFingerprint}
 */
export function fingerprint(id: NodeId, envFingerprint: Fingerprint, onlyForSideEffects: boolean): Fingerprint {
	return `${id}-${envFingerprint}-${onlyForSideEffects ? '0' : '1'}`;
}
