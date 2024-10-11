import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';

export interface DependenciesQuery extends BaseQueryFormat {
    readonly type: 'dependencies';
}

export interface DependenciesQueryResult extends BaseQueryResult {
    // TODO: Result structure
    // DependencyInfo (with the value and the location)
    // ScriptDependencyInfo as an object with libraries, data (e.g. read csvs), sources (sourced R-files), outputs (written files, may include "commandline")

}
