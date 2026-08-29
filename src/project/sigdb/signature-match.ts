import type { FunctionArgument } from '../../dataflow/graph/graph';
import { Fn } from '../../dataflow/fn/fn';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SigParameter } from './decode';

/**
 * The {@link Fn.call.match.toSpec} parameter spec of a *known* signature, where every formal maps to itself.
 * @useInstead {@link Fn.call.match.toSpec}
 */
export function signatureParameterSpec(signature: readonly SigParameter[]): Record<string, string> {
	const spec: Record<string, string> = {};
	for(const p of signature) {
		spec[p.name] = p.name;
	}
	return spec;
}

/**
 * Matches a call's `args` against a *known* signature, returning per parameter name the id(s) bound to it.
 * @useInstead {@link Fn.call.match.toSpec}
 */
export function matchArgumentsToSignature(args: readonly FunctionArgument[], signature: readonly SigParameter[]): Map<string, NodeId[]> {
	return Fn.call.match.toSpec(args, signature);
}

/**
 * The id(s) a *known* signature binds to a single `parameter`, `undefined` if nothing is.
 * @useInstead {@link Fn.call.match.toSpec}
 */
export function argumentForParameter(args: readonly FunctionArgument[], signature: readonly SigParameter[], parameter: string): NodeId[] | undefined {
	return Fn.call.match.toSpec(args, signature).get(parameter);
}
