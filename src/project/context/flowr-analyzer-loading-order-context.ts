import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { RParseRequest } from '../../r-bridge/retriever';
import { log } from '../../util/log';
import { arrayEqual } from '../../util/collections/arrays';
import { FlowrAnalyzerLoadingOrderPlugin } from '../plugins/loading-order-plugins/flowr-analyzer-loading-order-plugin';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';

/**
 * Read-only interface for the loading order context, which is used to determine the order in which script files are loaded in a project.
 *
 * This interface prevents you from modifying the available files, but allows you to inspect them (which is probably what you want when using the {@link FlowrAnalyzer}).
 * If you are a {@link FlowrAnalyzerLoadingOrderPlugin} and want to modify the available orders, you can use the {@link FlowrAnalyzerLoadingOrderContext} directly.
 */
export interface ReadOnlyFlowrAnalyzerLoadingOrderContext {
	/**
	 * The name of this context.
	 */
	readonly name: string;
	/**
	 * Peek whether we have a loading order known or guessed, this does not trigger any plugin runs.
	 * If you want to get the current loading order, including potential recompoutations, use {@link getLoadingOrder} instead.
	 */
	peekLoadingOrder(): readonly RParseRequest[] | undefined;
	/**
	 * Get the current loading order of requests, potentially triggering a re-computation if new requests have been added since the last computation.
	 */
	getLoadingOrder(): readonly RParseRequest[];
	/**
	 * Get all requests that have been added to this context, but for which no loading order is known or guessed.
	 */
	getUnorderedRequests(): readonly RParseRequest[];
	/**
	 * Get the current guesses for the loading order, if any. These are populated by {@link FlowrAnalyzerLoadingOrderPlugin}s.
	 */
	currentGuesses(): readonly RParseRequest[][];
	/**
	 * Get the current known loading order, if any. This is populated by {@link FlowrAnalyzerLoadingOrderPlugin}s if they have a source of identifying the order definitively.
	 */
	currentKnownOrder(): readonly RParseRequest[] | undefined;
}

const loadingOrderLog = log.getSubLogger({ name: 'loading-order' });

/**
 * This context is responsible for managing the loading order of script files in a project, including guesses and known orders provided by {@link FlowrAnalyzerLoadingOrderPlugin}s.
 *
 * If you are interested in inspecting these orders, refer to {@link ReadOnlyFlowrAnalyzerLoadingOrderContext}.
 * Plugins, however, can use this context directly to modify order guesses.
 */
export class FlowrAnalyzerLoadingOrderContext extends AbstractFlowrAnalyzerContext<undefined, void, FlowrAnalyzerLoadingOrderPlugin> implements ReadOnlyFlowrAnalyzerLoadingOrderContext{
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

	/**
	 * Add one or multiple requests to the context.
	 * These are considered unordered (i.e., ordered implicitly by the order of addition) until a plugin provides either a guess or a known order.
	 *
	 * This is a batched version of {@link addRequest}.
	 */
	public addRequests(requests: readonly RParseRequest[]): void {
		this.unordered.push(...requests);
		if(this.knownOrder || this.guesses.length > 0) {
			loadingOrderLog.warn(`Adding requests ${requests.map(r => r.request).join(', ')} after known order!`);
			this.rerunRequired = true;
		}
	}

	/**
	 * Add a single request to the context.
	 * This is considered unordered (i.e., ordered implicitly by the order of addition) until a plugin provides either a guess or a known order.
	 *
	 * If you want to add multiple requests, consider using {@link addRequests} instead for efficiency.
	 */
	public addRequest(request: RParseRequest): void  {
		this.unordered.push(request);
		if(this.knownOrder || this.guesses.length > 0) {
			loadingOrderLog.warn(`Adding request ${request.request} ${request.content} after known order!`);
			this.rerunRequired = true;
		}
	}

	/**
	 * Add a guess for the loading order. This is mostly for plugins to use.
	 * In case you have a certain order, use the `certain` flag to indicate this -- but please take care of *really* being certain!
	 */
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

	public peekLoadingOrder(): readonly RParseRequest[] | undefined {
		return this.knownOrder ?? (this.guesses.length > 0 ? this.guesses[0] : undefined);
	}

	public getUnorderedRequests(): readonly RParseRequest[] {
		return this.unordered;
	}

	public getLoadingOrder(): readonly RParseRequest[] {
		if(this.rerunRequired) {
			this.rerunRequired = false;
			this.applyPlugins(undefined);
		}

		return this.peekLoadingOrder() ?? this.unordered;
	}
}