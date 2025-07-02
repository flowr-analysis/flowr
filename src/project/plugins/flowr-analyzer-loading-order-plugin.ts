import type { FlowrAnalyzerPlugin } from './flowr-analyzer-plugin';
import type { PathLike } from 'fs';

export interface FlowrAnalyzerLoadingOrderPlugin extends FlowrAnalyzerPlugin {
    type:         'loading-order';
    loadingOrder: PathLike[];
}