import type { SemVer } from 'semver';
import type { FlowrAnalyzer } from '../flowr-analyzer';
import type { FlowrConfigOptions } from '../../config';
import type { FlowrAnalyzerLibraryVersionsPlugin } from './flowr-analyzer-library-versions-plugin';
import type { FlowrAnalyzerLoadingOrderPlugin } from './flowr-analyzer-loading-order-plugin';
import type { FlowrAnalyzerScopingPlugin } from './flowr-analyzer-scoping-plugin';

export interface FlowrAnalyzerPlugin {
    name:          string;
    description:   string;
    version:       SemVer;
    type:          'library-versions' | 'loading-order' | 'scoping';
    dependencies?: [];
    processor(analyzer: FlowrAnalyzer, pluginConfig: FlowrConfigOptions): Promise<void>;
}

export type AnyFlowrAnalyzerPlugin =
    | FlowrAnalyzerLibraryVersionsPlugin
    | FlowrAnalyzerLoadingOrderPlugin
    | FlowrAnalyzerScopingPlugin;

