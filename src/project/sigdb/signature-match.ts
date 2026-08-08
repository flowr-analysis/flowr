import { pMatch } from '../../dataflow/internal/linker';
import type { FunctionArgument } from '../../dataflow/graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SigParameter } from './decode';

/** the {@link pMatch} parameter spec of a *known* signature: every formal maps to itself as its own target */
export function signatureParameterSpec(signature: readonly SigParameter[]): Record<string, string> {
	const spec: Record<string, string> = {};
	for(const p of signature) {
		spec[p.name] = p.name;
	}
	return spec;
}

/**
 * {@link pMatch|Matches} a call's `args` against a *known* signature (typically from the signature database via
 * `PackageSignatureSource.functions(pkg)`), returning per parameter name the id(s) bound to it, e.g.
 * `matchArgumentsToSignature(ggplotCall.args, ggplotSignature).get('data')`.
 */
export function matchArgumentsToSignature(args: readonly FunctionArgument[], signature: readonly SigParameter[]): Map<string, NodeId[]> {
	return pMatch(args, signatureParameterSpec(signature));
}

/** the id(s) {@link matchArgumentsToSignature} binds to a single `parameter`, `undefined` if nothing is */
export function argumentForParameter(args: readonly FunctionArgument[], signature: readonly SigParameter[], parameter: string): NodeId[] | undefined {
	return matchArgumentsToSignature(args, signature).get(parameter);
}
