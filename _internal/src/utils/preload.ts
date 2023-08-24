import { INFINITE_PREFIX } from '../constants'
import type {
  BareFetcher,
  FetcherResponse,
  GlobalState,
  Key,
  Middleware
} from '../types'
import { cache } from './config'
import { SWRGlobalState } from './global-state'
import { serialize } from './serialize'
import { isUndefined } from './shared'
// Basically same as Fetcher but without Conditional Fetching
type PreloadFetcher<
  Data = unknown,
  SWRKey extends Key = Key
> = SWRKey extends () => infer Arg
  ? (arg: Arg) => FetcherResponse<Data>
  : SWRKey extends infer Arg
  ? (arg: Arg) => FetcherResponse<Data>
  : never

export const preload = <
  Data = any,
  SWRKey extends Key = Key,
  Fetcher extends BareFetcher = PreloadFetcher<Data, SWRKey>
>(
  key_: SWRKey,
  fetcher: Fetcher
): ReturnType<Fetcher> => {
  const [key, fnArg] = serialize(key_)
  const [, , , PRELOAD] = SWRGlobalState.get(cache) as GlobalState

  // Prevent preload to be called multiple times before used.
  if (PRELOAD[key]) return PRELOAD[key]

  const req = fetcher(fnArg) as ReturnType<Fetcher>
  PRELOAD[key] = req
  return req
}

export const middleware: Middleware =
  useSWRNext => (key_, fetcher_, config) => {
    // fetcher might be a sync function, so this should not be an async function
    const fetcher =
      fetcher_ &&
      ((...args: any[]) => {
        const [key] = serialize(key_, config.customHashes)
        const [, , , PRELOAD] = SWRGlobalState.get(cache) as GlobalState

        if (key.startsWith(INFINITE_PREFIX)) {
          // we want the infinite fetcher to be called.
          // handling of the PRELOAD cache happens there.
          return fetcher_(...args)
        }

        const req = PRELOAD[key]
        if (isUndefined(req)) return fetcher_(...args)
        delete PRELOAD[key]
        return req
      })
    return useSWRNext(key_, fetcher, config)
  }
