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
import { FlowrAnalyzerNamespaceFilesPlugin } from './file-plugins/flowr-analyzer-namespace-files-plugin';
import { FlowrAnalyzerNewsFilePlugin } from './file-plugins/flowr-analyzer-news-file-plugin';
import { FlowrAnalyzerMetaVignetteFilesPlugin } from './file-plugins/flowr-analyzer-vignette-file-plugin';
import { FlowrAnalyzerMetaTestFilesPlugin } from './file-plugins/flowr-analyzer-test-file-plugin';
import { FlowrAnalyzerLicenseFilePlugin } from './file-plugins/flowr-analyzer-license-file-plugin';
import {
	FlowrAnalyzerMetaDescriptionFilePlugin
} from './package-version-plugins/flowr-analyzer-meta-description-file-plugin';
import { FlowrAnalyzerSweaveFilePlugin } from './file-plugins/notebooks/flowr-analyzer-sweave-file-plugin';

/**
 * Provides the default set of Flowr Analyzer plugins.
 */
export function FlowrAnalyzerPluginDefaults(): FlowrAnalyzerPlugin[] {
	return [
		new FlowrAnalyzerMetaVignetteFilesPlugin(),
		new FlowrAnalyzerMetaTestFilesPlugin(),
		new FlowrAnalyzerDescriptionFilePlugin(),
		new FlowrAnalyzerPackageVersionsDescriptionFilePlugin(),
		new FlowrAnalyzerLoadingOrderDescriptionFilePlugin(),
		new FlowrAnalyzerMetaDescriptionFilePlugin(),
		new FlowrAnalyzerRmdFilePlugin(),
		new FlowrAnalyzerQmdFilePlugin(),
		new FlowrAnalyzerSweaveFilePlugin(),
		new FlowrAnalyzerLicenseFilePlugin(),
		new FlowrAnalyzerJupyterFilePlugin(),
		new FlowrAnalyzerNamespaceFilesPlugin(),
		new FlowrAnalyzerNewsFilePlugin()
	];
}
