import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { AbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { PkgName } from '../../dataflow/environments/identifier';
import { ArgProp, CallProp, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import type { TaintConditionFunction } from '../taint-mapping';
import { taintMappingFromBuiltInIndex } from '../builtin-index-bridge';

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
	(_args, taints) => taints.some(taint => taint.value === UserInput || taint.value === NetworkInput || taint.value === FileInput)
		? Bottom : AbstractDomain.joinAll(taints).value;

export const securityAnalysis = TaintAnalysisDefinition.create('security', securityDomain)
	.from([
		{
			identifier: [...BuiltInIndex.default().with(SemanticCallTag.User)],
			taint:      UserInput
		},
		{
			identifier: [...BuiltInIndex.default().with(SemanticCallTag.Network)],
			taint:      NetworkInput,
		},
		{
			identifier: [...BuiltInIndex.default().withAll([SemanticCallTag.File, SemanticCallTag.Reads])],
			condition:  {
				argValues:   [{ pos: 0, name: 'file' }],
				conditionFn: ([path]) => protocolTaint(path)
			}
		},
		{
			identifier: [
				['readLines', PkgName.Base],
				['gzcon', PkgName.Base]
			],
			condition: {
				argValues:   [{ pos: 0, name: 'con' }],
				conditionFn: ([path]) => protocolTaint(path)
			}
		},
	])
	.through([
		{
			identifier: [ 'shQuote', PkgName.Base ],
			taint:      Top
		},
		{
			identifier: [['match.arg', PkgName.Base], ['make.names', PkgName.Base]],
			taint:      Top
		}
	])
	.to([
		{
			identifier: [
				['source', PkgName.Base],
				['sys.source', PkgName.Base],
				['parse', PkgName.Base]
			],
			condition: {
				argTaints:   [{ pos: 0, name: 'file' }],
				conditionFn: securitySinkCondition
			}
		},
		{
			identifier: ['unserialize', PkgName.Base],
			condition:  {
				argTaints:   [{ pos: 0, name: 'connection' }],
				conditionFn: securitySinkCondition
			}
		},
		{
			identifier: ['serialize', PkgName.Base],
			condition:  {
				argTaints:   [{ pos: 0, name: 'object' }, { pos: 1, name: 'connection' }],
				conditionFn: securitySinkCondition
			}
		},
		{
			identifier: ['dump', PkgName.Base],
			condition:  {
				argTaints:   [{ pos: 0, name: 'list' }, { pos: 1, name: 'file' }],
				conditionFn: securitySinkCondition
			}
		},
		...taintMappingFromBuiltInIndex<typeof securityDomain>([SemanticCallTag.Eval, SemanticCallTag.Process], ArgProp.Injectable, securitySinkCondition),
		...taintMappingFromBuiltInIndex<typeof securityDomain>(CallProp.Ffi, ArgProp.Resource, securitySinkCondition),
		...taintMappingFromBuiltInIndex<typeof securityDomain>([SemanticCallTag.Writes, SemanticCallTag.Opens, SemanticCallTag.Reads], ArgProp.Resource, securitySinkCondition),
	])
	.report('Untrusted input may reach a security-sensitive sink (possible code or command injection)');
