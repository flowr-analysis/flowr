import type { REnvironmentInformation } from '../../dataflow'
import { BuiltInEnvironment } from '../../dataflow'
import objectHash from 'object-hash'
import type { NodeId } from '../../r-bridge'

export type Fingerprint = string

export function envFingerprint(env: REnvironmentInformation): Fingerprint {
	return objectHash(env, { excludeKeys: key => key === 'id', replacer: (v: unknown) => v === BuiltInEnvironment ? undefined : v })
}

export function fingerprint(id: NodeId, envFingerprint: Fingerprint, onlyForSideEffects: boolean): Fingerprint {
	return `${id}-${envFingerprint}-${onlyForSideEffects ? '0' : '1'}`
}
