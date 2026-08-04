import { pMatch } from '../../dataflow/internal/linker';
import type { FunctionArgument } from '../../dataflow/graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { SigParameter } from './decode';

/**
 * The {@link pMatch} parameter spec for a *known* signature (e.g. one resolved from the signature database):
 * every formal parameter name maps to itself as its own target. A `...` parameter is kept as-is, so `pMatch`
 * collects the overflow/unmatched arguments into it exactly as R does; a signature without `...` simply leaves
 * extra arguments unbound.
 */
export function signatureParameterSpec(signature: readonly SigParameter[]): Record<string, string> {
	const spec: Record<string, string> = {};
	for(const p of signature) {
		spec[p.name] = p.name;
	}
	return spec;
}

/**
 * Match a call's `args` against a *known* signature using R's argument-matching rules via the canonical
 * {@link pMatch} (exact name, then partial `pmatch`, then positional; `...` collects the rest). Returns a map
 * from parameter name to the id(s) of the argument(s) bound to it, so
 * `matchArgumentsToSignature(ggplotCall.args, ggplotSignature).get('data')` yields the node(s) passed as
 * ggplot's `data` argument. The signature typically comes from the signature database (a {@link SigParameter}
 * list, e.g. via `PackageSignatureSource.functions(pkg)`).
 */
export function matchArgumentsToSignature(args: readonly FunctionArgument[], signature: readonly SigParameter[]): Map<string, NodeId[]> {
	return pMatch(args, signatureParameterSpec(signature));
}

/**
 * The id(s) of the argument bound to a single named `parameter` of a *known* signature, or `undefined` when
 * nothing is bound to it. A convenience over {@link matchArgumentsToSignature} for the common
 * "give me one parameter's argument" query, e.g.
 * `argumentForParameter(ggplotCall.args, ggplotSignature, 'data')` returns ggplot's `data` argument node(s).
 */
export function argumentForParameter(args: readonly FunctionArgument[], signature: readonly SigParameter[], parameter: string): NodeId[] | undefined {
	return matchArgumentsToSignature(args, signature).get(parameter);
}
