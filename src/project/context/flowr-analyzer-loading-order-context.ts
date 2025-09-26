import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { RParseRequest } from '../../r-bridge/retriever';
import { log } from '../../util/log';
import { arrayEqual } from '../../util/collections/arrays';
import type { FlowrAnalyzerLoadingOrderPlugin } from '../plugins/loading-order-plugins/flowr-analyzer-loading-order-plugin';

const loadingOrderLog = log.getSubLogger({ name: 'loading-order' });

export interface LoadingOrderPluginInterface {
    currentGuesses(): readonly RParseRequest[][];
    peekLoadingOrder(): readonly RParseRequest[] | undefined;
    currentKnownOrder(): readonly RParseRequest[] | undefined;
    addGuess(guess: readonly RParseRequest[], certain?: boolean): void;
}

export class FlowrAnalyzerLoadingOrderContext extends AbstractFlowrAnalyzerContext {
	public readonly name = 'flowr-analyzer-loading-order-context';

	private plugins:       readonly FlowrAnalyzerLoadingOrderPlugin[];
	private rerunRequired: boolean;

	constructor(plugins: readonly FlowrAnalyzerLoadingOrderPlugin[] | undefined) {
		super();
		this.plugins = plugins ?? [];
		this.rerunRequired = this.plugins.length > 0;
	}

	private knownOrder?: readonly RParseRequest[];
	private guesses:     RParseRequest[][] = [];
	/** just the base collection of requests we know nothing about the order! */
	private unordered:   RParseRequest[] = [];

	public addRequest(request: RParseRequest): void  {
		this.unordered?.push(request);
		if(this.knownOrder || this.guesses.length > 0) {
			loadingOrderLog.warn(`Adding request ${request.request} ${request.content} after known order!`);
			this.rerunRequired = true;
		}
	}

	protected addGuess(guess: readonly RParseRequest[], certain?: boolean): void {
		if(certain) {
			if(this.knownOrder) {
				loadingOrderLog.warn(`Adding certain guess ${guess.map(g => g.request).join(', ')} after known order!`);
				if(!arrayEqual(this.knownOrder, guess)) {
					loadingOrderLog.error(`Certain guess ${guess.map(g => g.request).join(', ')} does not match known order ${this.knownOrder.map(g => g.request).join(', ')}`);
				}
			} else {
				this.knownOrder = guess;
			}
		}
	}

	public currentGuesses(): readonly RParseRequest[][] {
		return this.guesses;
	}

	public currentKnownOrder(): readonly RParseRequest[] | undefined {
		return this.knownOrder;
	}

	/** peek whether we have a loading order known or guessed */
	public peekLoadingOrder(): readonly RParseRequest[] | undefined {
		return this.knownOrder ?? (this.guesses.length > 0 ? this.guesses[0] : undefined);
	}

	public getLoadingOrder(): readonly RParseRequest[] {
		if(this.rerunRequired) {
			this.rerunRequired = false;
		}

		return this.peekLoadingOrder() ?? this.unordered;
	}
}