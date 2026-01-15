/* v8 ignore start */
/* this is a test-only utility */
import { assertUnreachable, isNotUndefined } from '../../../../src/util/assert';
import { wrap, wrapControlDependencies } from './printer';
import type {
	IEnvironment,
	REnvironmentInformation
} from '../../../../src/dataflow/environments/environment';
import { type IdentifierDefinition , ReferenceType } from '../../../../src/dataflow/environments/identifier';

export class EnvironmentBuilderPrinter {
	private readonly env:   REnvironmentInformation;
	private readonly lines: string[] = [];

	constructor(env: REnvironmentInformation) {
		this.env = env;
	}

	private process() {
		let current = this.env.current;
		let i = this.env.level;
		while(!current?.builtInEnv) {
			if(i-- > 0) {
				this.push();
			}
			this.processEnvironment(current);
			current = current.parent;
		}
	}

	private processEnvironment(env: IEnvironment) {
		for(const [name, defs] of env.memory.entries()) {
			for(const def of defs) {
				this.processDefinition(name, def);
			}
		}
	}

	private processDefinition(name: string, def: IdentifierDefinition) {
		const { type } = def;
		switch(type) {
			case ReferenceType.Unknown:
			case ReferenceType.Variable:
				this.recordFnCall('defineVariable', [
					wrap(name),
					wrap(def.nodeId),
					wrap(def.definedAt),
					this.getControlDependencyArgument(def)
				]);
				break;
			case ReferenceType.Function:
				this.recordFnCall('defineFunction', [
					wrap(name),
					wrap(def.nodeId),
					wrap(def.definedAt),
					this.getControlDependencyArgument(def)
				]);
				break;
				/* shouldn't happen here :D */
			case ReferenceType.Constant:
			case ReferenceType.BuiltInFunction:
			case ReferenceType.BuiltInConstant:
				/* shouldn't happen, only we can define built-in stuff */
				break;
			case ReferenceType.Argument:
				this.recordFnCall('defineArgument', [
					wrap(name),
					wrap(def.nodeId),
					wrap(def.definedAt),
					this.getControlDependencyArgument(def)
				]);
				break;
			case ReferenceType.Parameter:
				this.recordFnCall('defineParameter', [
					wrap(name),
					wrap(def.nodeId),
					wrap(def.definedAt),
					this.getControlDependencyArgument(def)
				]);
				break;
			default:
				assertUnreachable(type);
		}
	}

	private getControlDependencyArgument(def: IdentifierDefinition) {
		return def.cds ? wrapControlDependencies(def.cds) : undefined;
	}

	private push() {
		this.recordFnCall('pushEnv', []);
	}

	private recordFnCall(name: string, args: (string | undefined)[]): void {
		this.lines.push(`.${name}(${args.filter(isNotUndefined).join(', ')})`);
	}

	public print(): string {
		if(this.env.level === 0 && this.env.current.memory.size === 0) {
			return '';
		}
		this.process();
		return 'defaultEnv()' + this.lines.join('');
	}
}

/* v8 ignore stop */
