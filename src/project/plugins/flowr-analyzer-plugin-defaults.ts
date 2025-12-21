import type { FlowrAnalyzerPlugin } from './flowr-analyzer-plugin';
import { FlowrAnalyzerDescriptionFilePlugin } from './file-plugins/flowr-analyzer-description-file-plugin';
import {
	FlowrAnalyzerPackageVersionsDescriptionFilePlugin
} from './package-version-plugins/flowr-analyzer-package-versions-description-file-plugin';
import {
	FlowrAnalyzerLoadingOrderDescriptionFilePlugin
} from './loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin';
import { FlowrAnalyzerRmdFilePlugin } from './file-plugins/notebooks/flowr-analyzer-rmd-file-plugin';
import { FlowrAnalyzerQmdFilePlugin } from './file-plugins/notebooks/flowr-analyzer-qmd-file-plugin';
import { FlowrAnalyzerJupyterFilePlugin } from './file-plugins/notebooks/flowr-analyzer-jupyter-file-plugin';
import { FlowrAnalyzerNamespaceFilePlugin } from './file-plugins/flowr-analyzer-namespace-file-plugin';
import { FlowrAnalyzerNewsFilePlugin } from './file-plugins/flowr-analyzer-news-file-plugin';

/**
 * Provides the default set of Flowr Analyzer plugins.
 */
export function FlowrAnalyzerPluginDefaults(): FlowrAnalyzerPlugin[] {
	return [
		new FlowrAnalyzerDescriptionFilePlugin(),
		new FlowrAnalyzerPackageVersionsDescriptionFilePlugin(),
		new FlowrAnalyzerLoadingOrderDescriptionFilePlugin(),
		new FlowrAnalyzerRmdFilePlugin(),
		new FlowrAnalyzerQmdFilePlugin(),
		new FlowrAnalyzerJupyterFilePlugin(),
		new FlowrAnalyzerNamespaceFilePlugin()
		new FlowrAnalyzerNewsFilePlugin()
	];
}
