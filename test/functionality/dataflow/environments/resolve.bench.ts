import { bench } from 'vitest';
import { defaultEnv } from '../../_helper/dataflow/environment-builder';
import type { IdentifierDefinition } from '../../../../src/dataflow/environments/identifier';
import { ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { resolveByName } from '../../../../src/dataflow/environments/resolve-by-name';


function resolveX(cache: boolean) {
	const anythingButX: IdentifierDefinition[] =  [];
	for(const l of ['a','b','c','d','e','f','g','h','i','j']) {
		anythingButX.push({ name: l, nodeId: 43, type: ReferenceType.Unknown, definedAt: 0, controlDependencies: undefined });
	}
	let env = defaultEnv()
		.defineInEnv({ name: 'x' ,nodeId: 42, type: ReferenceType.Unknown, definedAt: 0, controlDependencies: undefined });

	for(let i = 0; i < 3; ++i) {
		env = env.pushEnv();
		for(const def of anythingButX) {
			env = env.defineInEnv(def);
		}
	}
	if(!cache) {
		let curr = env.current;
		do{
			curr.cache = undefined;
		} while(!curr.builtInEnv && (curr = curr.parent));
	}
	for(let i = 0; i < 1000; ++i) {
		resolveByName('x', env, ReferenceType.Unknown);
	}
}

bench('with cache', () => {
	resolveX(true);
});

bench('without cache', () => {
	resolveX(false);
});
