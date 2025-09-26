import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { RParseRequest } from '../../r-bridge/retriever';
import { log } from '../../util/log';
import { arrayEqual } from '../../util/collections/arrays';
import { FlowrAnalyzerLoadingOrderPlugin } from '../plugins/loading-order-plugins/flowr-analyzer-loading-order-plugin';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';

const loadingOrderLog = log.getSubLogger({ name: 'loading-order' });

export class FlowrAnalyzerLoadingOrderContext extends AbstractFlowrAnalyzerContext<undefined, void, FlowrAnalyzerLoadingOrderPlugin> {
	public readonly name = 'flowr-analyzer-loading-order-context';

	private rerunRequired: boolean;

	constructor(ctx: FlowrAnalyzerContext, plugins: readonly FlowrAnalyzerLoadingOrderPlugin[] | undefined) {
		super(ctx, FlowrAnalyzerLoadingOrderPlugin.defaultPlugin(), plugins);
		this.rerunRequired = this.plugins.length > 0;
	}

	private knownOrder?: readonly RParseRequest[];
	private guesses:     RParseRequest[][] = [];
	/** just the base collection of requests we know nothing about the order! */
	private unordered:   RParseRequest[] = [];

	public addRequests(requests: readonly RParseRequest[]): void {
		this.unordered.push(...requests);
		if(this.knownOrder || this.guesses.length > 0) {
			loadingOrderLog.warn(`Adding requests ${requests.map(r => r.request).join(', ')} after known order!`);
			this.rerunRequired = true;
		}
	}

	public addRequest(request: RParseRequest): void  {
		this.unordered.push(request);
		if(this.knownOrder || this.guesses.length > 0) {
			loadingOrderLog.warn(`Adding request ${request.request} ${request.content} after known order!`);
			this.rerunRequired = true;
		}
	}

	public addGuess(guess: readonly RParseRequest[], certain?: boolean): void {
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
			this.applyPlugins(undefined);
		}

		return this.peekLoadingOrder() ?? this.unordered;
	}
}