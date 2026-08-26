import objectHash from 'object-hash';
import type { Environment, REnvironmentInformation } from '../../dataflow/environments/environment';
import { isDefaultBuiltInEnvironment } from '../../dataflow/environments/environment';
import type { IdentifierDefinition } from '../../dataflow/environments/identifier';
import type { Frame, MemoryView } from '../../dataflow/environments/frame-memory';
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

/* definitions, definition maps, and frames are shared across the environments a slice builds, and a definition may
 * hold a whole environment of its own (`envState`), so each is hashed once instead of on every fingerprint. The
 * map is keyed separately from the frame because cloning a frame shares its definitions until one side writes
 * (see {@link Environment#clone}): the graph holds many frames per distinct set of definitions, and hashing that
 * set is what costs. */
const definitionHashes = new WeakMap<IdentifierDefinition & object, Fingerprint>();
const memoryHashes = new WeakMap<Frame, Map<number, Fingerprint>>();
const frameHashes = new WeakMap<Environment, Fingerprint>();

function definitionHash(definition: IdentifierDefinition): Fingerprint {
	let hash = definitionHashes.get(definition);
	if(hash === undefined) {
		hash = objectHash(definition, HashOptions);
		definitionHashes.set(definition, hash);
	}
	return hash;
}

function memoryHash(memory: MemoryView): Fingerprint {
	let byVersion = memoryHashes.get(memory.frame);
	if(byVersion === undefined) {
		byVersion = new Map();
		memoryHashes.set(memory.frame, byVersion);
	}
	let hash = byVersion.get(memory.version);
	if(hash === undefined) {
		const entries: string[] = [];
		for(const [name, definitions] of memory) {
			entries.push(`${String(name)}=${definitions.map(definitionHash).join(',')}`);
		}
		entries.sort();
		hash = objectHash(entries, HashOptions);
		byVersion.set(memory.version, hash);
	}
	return hash;
}

function frameHash(frame: Environment): Fingerprint {
	let hash = frameHashes.get(frame);
	if(hash === undefined) {
		hash = objectHash([frame.n, frame.t, frame.closure, frame.globalEnv === true, memoryHash(frame.memory)], HashOptions);
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
