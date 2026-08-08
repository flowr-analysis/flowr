import path from 'path';
import os from 'os';

export const GlobalSummaryFile = path.join(os.tmpdir(), 'flowr-label-summary.json');
