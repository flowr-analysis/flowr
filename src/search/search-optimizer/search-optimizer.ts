import type { FlowrSearchGeneratorNode, GeneratorNames } from '../search-executor/search-generators';
import type { FlowrSearchTransformerNode, TransformerNames } from '../search-executor/search-transformer';
import type { FlowrSearch } from '../flowr-search-builder';
import type { FlowrSearchElement, FlowrSearchElements } from '../flowr-search';

function fingerPrintTransformer(transformer: readonly FlowrSearchTransformerNode[]): string {
	return JSON.stringify(transformer);
}

/**
 * Optimizations are currently not reflected
 * in an update of the search object.
 */
export function optimize<
    Info,
    Generator extends GeneratorNames,
    Transformers extends TransformerNames[],
    ElementType extends FlowrSearchElements<Info, FlowrSearchElement<Info>[]>
>(generator: FlowrSearchGeneratorNode, search: readonly FlowrSearchTransformerNode[]): FlowrSearch<Info, Generator, Transformers, ElementType> {
	let searchToOptimize = search.slice();
	let fingerprint = fingerPrintTransformer(searchToOptimize);
	generator = optimizeGenerator(generator);
	let lastFingerprint = '{}';
	/* maybe we want shared optimizers in the future, but for now we let it be :sparkles: */
	while(fingerprint !== lastFingerprint) {
		lastFingerprint = fingerprint;
		searchToOptimize = optimizeSearch(searchToOptimize, generator);
		fingerprint = fingerPrintTransformer(searchToOptimize);
	}
	return {
		generator,
		search: searchToOptimize
	};
}


function optimizeGenerator(generator: FlowrSearchGeneratorNode): FlowrSearchGeneratorNode {
	return dropAnyNameRegex(generator);
}

function optimizeSearch(
	search: FlowrSearchTransformerNode[],
	_generator: FlowrSearchGeneratorNode
): FlowrSearchTransformerNode[] {
	search = dropDuplicateNoops(search);
	return search;
}

const noopTransformers = new Set(['first', 'last']);
/* yes we could optimize something like first, last, first too, but why bother :D*/
function dropDuplicateNoops(transformers: FlowrSearchTransformerNode[]): FlowrSearchTransformerNode[]  {
	const newTransformers = [];
	let lastTransformer: FlowrSearchTransformerNode | undefined;
	for(const transformer of transformers) {
		if(lastTransformer === undefined || lastTransformer.name !== transformer.name || !noopTransformers.has(transformer.name)) {
			newTransformers.push(transformer);
		} else {
			console.log(`Dropping duplicate noop transformer: ${transformer.name}`);
		}
		lastTransformer = transformer;
	}
	return newTransformers;
}

function dropAnyNameRegex(generator: FlowrSearchGeneratorNode): FlowrSearchGeneratorNode {
	if(generator.name !== 'get' || !generator.args.filter.nameIsRegex) {
		return generator;
	}
	if(generator.args.filter.name === '.') {
		console.log('Dropping any name regex');
		return {
			...generator,
			args: {
				...generator.args,
				filter: {
					...generator.args.filter,
					name:        undefined,
					nameIsRegex: undefined
				}
			}
		};
	}
	return generator;
}
