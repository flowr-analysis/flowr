import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { AbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { PkgName } from '../../dataflow/environments/identifier';
import { ArgProp, CallProp, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import type { TaintConditionFunction } from '../taint-mapping';
import { taintMappingFromBuiltInIndex } from '../builtin-index-bridge';
import { TaintFnCategory } from '../function-categories';

export const UserInput = Symbol('User Input');
export const NetworkInput = Symbol('Network Input');
export const FileInput = Symbol('File Input');

type SecurityLatticeElements = [typeof UserInput, typeof NetworkInput, typeof FileInput];


export const securityDomain = new FiniteDomainBuilder<Top, Bottom, [Top, Bottom, ...SecurityLatticeElements]>()
	.addLeqOrder(Bottom, [UserInput, NetworkInput, FileInput])
	.addLeqOrder(UserInput, Top)
	.addLeqOrder(NetworkInput, Top)
	.addLeqOrder(FileInput, Top)
	.build();

/** Matches network protocols in a path argument. */
const NetworkProtocolRegex = /^(https?|ftps?):\/\//;

/** Maps a resolved path argument to a network or file taint depending on its protocol. */
const protocolTaint = (path: unknown) =>
	typeof path === 'string' && NetworkProtocolRegex.test(path) ? NetworkInput : FileInput;

/** Tainted input on any argument leads to Bottom taint at sinks */
const securitySinkCondition: TaintConditionFunction<typeof securityDomain> =
	(_args, taints) => taints.some(taint => taint.value === UserInput || taint.value === NetworkInput || taint.value === FileInput) ? Bottom
		: taints.length > 0 ? AbstractDomain.joinAll(taints).value : Top;

export const securityAnalysis = TaintAnalysisDefinition.create('security', securityDomain)
	.on(TaintFnCategory.pureAlias)
	.on(TaintFnCategory.pureComputer)
	.on(TaintFnCategory.pureShape)
	.from(
		{
			identifier: [...BuiltInIndex.default().with(SemanticCallTag.User, [SemanticCallTag.Network, SemanticCallTag.File])],
			taint:      UserInput
		},
		{
			identifier: [...BuiltInIndex.default().with(SemanticCallTag.Network, SemanticCallTag.User)],
			taint:      NetworkInput,
		},
		{
			identifier: [
				['readRDS', PkgName.Base],
				['load', PkgName.Base],
				['read.table', PkgName.Utils],
				['read.csv', PkgName.Utils],
				['read.csv2', PkgName.Utils],
				['read.delim', PkgName.Utils],
				['read.delim2', PkgName.Utils],
			],
			condition: {
				argValues:   [{ pos: 0, name: 'file' }],
				conditionFn: protocolTaint
			}
		},
		{
			identifier: [
				['readBin', PkgName.Base],
				['readChar', PkgName.Base],
				['readLines', PkgName.Base],
				['gzcon', 'base']
			],
			condition: {
				argValues:   [{ pos: 0, name: 'con' }],
				conditionFn: protocolTaint
			}
		},
	)
	.through(
		{
			identifier: [ 'shQuote', PkgName.Base ],
			taint:      Top
		},
		{
			identifier: [['match.arg', PkgName.Base], ['make.names', PkgName.Base]],
			taint:      Top
		},
		{
			// additional common functions
			identifier: [
				['rep', PkgName.Base],
				['which', PkgName.Base]
			],
			condition: {
				argDefinition: [{ pos: 0, name: 'x' }],
				conditionFn:   (_args, [taint]) => taint.value
			}
		}
	)
	.to(
		{
			identifier: [
				['source', PkgName.Base],
				['sys.source', PkgName.Base],
				['parse', PkgName.Base]
			],
			condition: {
				argDefinition: [{ pos: 0, name: 'file' }],
				conditionFn:   securitySinkCondition
			}
		},
		{
			identifier: ['unserialize', PkgName.Base],
			condition:  {
				argDefinition: [{ pos: 0, name: 'connection' }],
				conditionFn:   securitySinkCondition
			}
		},
		{
			identifier: ['serialize', PkgName.Base],
			condition:  {
				argDefinition: [{ pos: 0, name: 'object' }, { pos: 1, name: 'connection' }],
				conditionFn:   securitySinkCondition
			}
		},
		{
			identifier: ['dump', PkgName.Base],
			condition:  {
				argDefinition: [{ pos: 0, name: 'list' }, { pos: 1, name: 'file' }],
				conditionFn:   securitySinkCondition
			}
		},
		...taintMappingFromBuiltInIndex<typeof securityDomain>([SemanticCallTag.Eval, SemanticCallTag.Process], ArgProp.Injectable, securitySinkCondition),
		...taintMappingFromBuiltInIndex<typeof securityDomain>(CallProp.Ffi, ArgProp.Resource, securitySinkCondition),
		...taintMappingFromBuiltInIndex<typeof securityDomain>([SemanticCallTag.Writes, SemanticCallTag.Opens, SemanticCallTag.Reads], ArgProp.Resource, securitySinkCondition),
	).report((f) => {
		return f.functionName ? `Untrusted input reached security-sensitive sink function '${f.functionName}' [${f.locString}]`
			: `Untrusted input reached a security-sensitive sink (possible code or command injection) [${f.locString}]`;
	});
