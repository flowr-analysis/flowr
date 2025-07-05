import type { FlowrAnalyzerPlugin } from './flowr-analyzer-plugin';

export interface FlowrAnalyzerScopingPlugin extends FlowrAnalyzerPlugin {
    type: 'scoping';
}