import  { FlowrAnalyzerPlugin } from '../flowr-analyzer-plugin';
import type { PathLike } from 'fs';

export abstract class FlowrAnalyzerLoadingOrderPlugin extends FlowrAnalyzerPlugin {
	readonly type = 'loading-order';
	public loadingOrder: PathLike[] = [];
}