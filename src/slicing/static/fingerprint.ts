import objectHash from 'object-hash';
import { isDefaultBuiltInEnvironment, type REnvironmentInformation } from '../../dataflow/environments/environment';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export type Fingerprint = string

/**
 * Calculate a fingerprint for the given R environment information
 * @see {@link fingerprint}
 */
export function envFingerprint(env: REnvironmentInformation): Fingerprint {
	return objectHash(env, {
		algorithm:                 'md5',
		excludeKeys:               key => key === 'id' || key === 'value',
		respectFunctionProperties: false,
		respectFunctionNames:      false,
		ignoreUnknown:             true,
		replacer:                  (v: unknown) => isDefaultBuiltInEnvironment(v) ? undefined : v
	});
}

/**
 * Calculate a fingerprint for the given node id and environment fingerprint
 * @see {@link envFingerprint}
 */
export function fingerprint(id: NodeId, envFingerprint: Fingerprint, onlyForSideEffects: boolean): Fingerprint {
	return `${id}-${envFingerprint}-${onlyForSideEffects ? '0' : '1'}`;
}
