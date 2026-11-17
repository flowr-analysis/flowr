import { AbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import { ArgProp, CallProp, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import { PkgName } from '../../dataflow/environments/identifier';
import { BuiltInIndex } from '../../dataflow/environments/query-fn-props';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { taintMappingFromBuiltInIndex } from '../builtin-index-bridge';
import { TaintFnCategory } from '../function-categories';
import type { TaintConditionFunction } from '../taint-mapping';
import { FileInput, NetworkInput, NetworkProtocolRegex, securityDomain, UserInput } from './security-analysis';

export const securityDomainLifted = securityDomain.setLift();

export const UserInputLifted = securityDomainLifted.create(UserInput).value;
export const NetworkInputLifted = securityDomainLifted.create(NetworkInput).value;
export const FileInputLifted = securityDomainLifted.create(FileInput).value;
export const BottomLifted = securityDomainLifted.bottom().value;
export const TopLifted = securityDomainLifted.top().value;

const protocolTaintLifted: TaintConditionFunction<typeof securityDomainLifted> =
	([path]) => typeof path === 'string'
        && NetworkProtocolRegex.test(path)
		? NetworkInputLifted
		: FileInputLifted;

const securitySinkConditionLifted: TaintConditionFunction<typeof securityDomainLifted> =
	(_args, taints) => taints.some(
		taint => taint.value === UserInputLifted
        || taint.value === NetworkInputLifted
        || taint.value === FileInputLifted)
		? BottomLifted
		: taints.length > 0 ? AbstractDomain.joinAll(taints).value : TopLifted;

export const securityAnalysisLifted = TaintAnalysisDefinition.create('security', securityDomainLifted)
	.on(TaintFnCategory.pureAlias)
	.on(TaintFnCategory.pureComputer)
	.on(TaintFnCategory.pureShape)
	.from(
		{
			identifier: [...BuiltInIndex.default().with(SemanticCallTag.User, [SemanticCallTag.Network, SemanticCallTag.File])],
			taint:      UserInputLifted
		},
		{
			identifier: [...BuiltInIndex.default().with(SemanticCallTag.Network, SemanticCallTag.User)],
			taint:      NetworkInputLifted,
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
				conditionFn: protocolTaintLifted
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
				conditionFn: protocolTaintLifted
			}
		},
	)
	.through(
		{
			identifier: ['shQuote', PkgName.Base],
			taint:      TopLifted
		},
		{
			identifier: [['match.arg', PkgName.Base], ['make.names', PkgName.Base]],
			taint:      TopLifted
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
				conditionFn:   securitySinkConditionLifted
			}
		},
		{
			identifier: ['unserialize', PkgName.Base],
			condition:  {
				argDefinition: [{ pos: 0, name: 'connection' }],
				conditionFn:   securitySinkConditionLifted
			}
		},
		{
			identifier: ['serialize', PkgName.Base],
			condition:  {
				argDefinition: [{ pos: 0, name: 'object' }, { pos: 1, name: 'connection' }],
				conditionFn:   securitySinkConditionLifted
			}
		},
		{
			identifier: ['dump', PkgName.Base],
			condition:  {
				argDefinition: [{ pos: 0, name: 'list' }, { pos: 1, name: 'file' }],
				conditionFn:   securitySinkConditionLifted
			}
		},
		...taintMappingFromBuiltInIndex<typeof securityDomainLifted>([SemanticCallTag.Eval, SemanticCallTag.Process], ArgProp.Injectable, securitySinkConditionLifted),
		...taintMappingFromBuiltInIndex<typeof securityDomainLifted>(CallProp.Ffi, ArgProp.Resource, securitySinkConditionLifted),
		...taintMappingFromBuiltInIndex<typeof securityDomainLifted>([SemanticCallTag.Writes, SemanticCallTag.Opens, SemanticCallTag.Reads], ArgProp.Resource, securitySinkConditionLifted),
	).report((f) => {
		return f.functionName ? `Untrusted input reached security-sensitive sink function '${f.functionName}' [${f.locString}]`
			: `Untrusted input reached a security-sensitive sink (possible code or command injection) [${f.locString}]`;
	});