import { Base, Location, NoInfo } from '../model'
import { Type } from '../type'

// combines '{', '}', '(', ')', and other delimiters used by R, they are ignored for most analysis
// but helpful during reconstruction
export interface RDelimiter<Info = NoInfo> extends Base<Info>, Location {
  readonly type:    Type.Delimiter;
  readonly subtype: string; // can be one of Type, but i do not guard it atm.
}
