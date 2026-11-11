import { AbstractInterpreter, type AbsintVisitorConfiguration } from './absint-inference';
import { BranchPathDomain, BranchPaths, type BranchStep, type Paths } from './branch-paths';
import type { MultiValueStateDomain } from './domains/multi-value-state-domain';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RTrue, type RFalse } from '../r-bridge/lang-4.x/convert-values';
import type { DataflowGraphVertexArgument, DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import { DfgVertex } from '../dataflow/graph/vertex';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';

/** The {@link BranchPaths} as an {@link AbstractInterpreter}. */
class BranchPathsInterpreter extends AbstractInterpreter<Paths> implements BranchPaths {
	constructor(config: AbsintVisitorConfiguration) {
		super(config, {
			domains:   { paths: BranchPathDomain.start() },
			semantics: {
				paths: {
					handleFunctionDefinition: (state, vertex) => state.set(vertex.id, BranchPathDomain.start())
				}
			}
		});
	}

	public override start(): void {
		super.start();
		this.interpretUncalledFunctions();
	}

	protected override shouldEnterCall(): boolean {
		return false;
	}

	/** A call changing environments (`eval`, `rm`, ...) changes no branch taken on the way there. */
	protected override isUnsupportedFunctionCall(): boolean {
		return false;
	}

	/**
	 * The step a branch takes is the construct deciding it, as is: unlike the narrowing of values, which looks into the
	 * operands of `&&` and `||`, the right one of which has not run yet when the left decides whether it does.
	 */
	protected override handleConditionBranch(state: MultiValueStateDomain<Partial<Paths>>, conditionVertex: DataflowGraphVertexArgument, branch: typeof RTrue | typeof RFalse, target?: NodeId): MultiValueStateDomain<Partial<Paths>> {
		const step: BranchStep = { cause: conditionVertex.id, when: branch === RTrue, ...(target !== undefined && isSwitch(conditionVertex) ? { target } : {}) };
		const next = state.create(state.value);
		this.applySemantics((_semantics, view) => {
			for(const [key, value] of view.entries()) {
				if(value instanceof BranchPathDomain) {
					view.set(key, value.taking(step));
				}
			}
		}, next);
		return next;
	}

	/** The paths to the node within the body of the definition, `undefined` if they are not known; only branches `mergeable` says nothing hangs on are merged away, see {@link BranchPathDomain#paths}. */
	public pathsTo(definition: NodeId, node: NodeId, mergeable?: (cause: NodeId) => boolean): readonly (readonly BranchStep[])[] | undefined {
		const value = this.getAbstractState(node, 'paths')?.get(definition);
		return value instanceof BranchPathDomain ? value.paths(mergeable) : undefined;
	}

	public get controlFlow(): ControlFlowInformation {
		return this.config.controlFlow;
	}
}

function isSwitch(vertex: DataflowGraphVertexArgument): vertex is DataflowGraphVertexFunctionCall {
	return DfgVertex.hasOrigin(vertex, BuiltInProcName.Switch);
}

BranchPaths.register(config => new BranchPathsInterpreter(config));
