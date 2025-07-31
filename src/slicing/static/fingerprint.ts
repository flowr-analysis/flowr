import objectHash from 'object-hash';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { isDefaultBuiltIn } from '../../dataflow/environments/environment';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

export type Fingerprint = string

export function envFingerprint(env: REnvironmentInformation): Fingerprint {
	return objectHash(env, {
		algorithm:                 'md5',
		excludeKeys:               key => key === 'id' || key === 'value',
		respectFunctionProperties: false,
		respectFunctionNames:      false,
		ignoreUnknown:             true,
		replacer:                  (v: unknown) => isDefaultBuiltIn(v) ? undefined : v
	});
}

export function fingerprint(id: NodeId, envFingerprint: Fingerprint, onlyForSideEffects: boolean): Fingerprint {
	return `${id}-${envFingerprint}-${onlyForSideEffects ? '0' : '1'}`;
}
