import * as revalidateEvents from './constants/revalidate-events'

export type Result<T = unknown> = T | Promise<T>

export type Fetcher<Data = unknown, Args extends Key = Key> =
  /**
   * () => [{ foo: string }, { bar: number }] | null
   *
   * () => ( [{ foo: string }, { bar: number } ] as const | null )
   */
  Args extends (() => readonly [...infer K] | null)
    ? ((...args: [...K]) => Result<Data>)
      /**
       * [{ foo: string }, { bar: number } ] | null
       *
       * [{ foo: string }, { bar: number } ] as const | null
       */
    : Args extends (readonly [...infer K])
    ? ((...args: [...K]) => Result<Data>)
      /**
       * () => string | null
       * () => Record<any, any> | null
       */
    : Args extends (() => infer T | null)
    ? (...args: [T]) => Result<Data>
      /**
       *  string | null
       */
    : Args extends (string | null)
      /**
       * when key is Record<any, any> | null
       * use { foo: string, bar: number } | null as example
       *
       * the fetcher would be
       * (arg0: string) => any | (arg0: { foo: string, bar: number }) => any
       * so we add this condition to make (arg0: string) => any to be never
       */
    ? Args extends (Record<any, any> | null)
      ? never
      : (...args: [string]) => Result<Data>
    : Args extends (infer T)
    ? (...args: [T]) => Result<Data>
    : never

// Configuration types that are only used internally, not exposed to the user.
export interface InternalConfiguration {
  cache: Cache
  mutate: ScopedMutator
}

export interface PublicConfiguration<
  Data = any,
  Error = any,
  Args extends Key = Key,
  Fn = Fetcher<Data, Args>
> {
  errorRetryInterval: number
  errorRetryCount?: number
  loadingTimeout: number
  focusThrottleInterval: number
  dedupingInterval: number
  refreshInterval?: number
  refreshWhenHidden?: boolean
  refreshWhenOffline?: boolean
  revalidateOnFocus: boolean
  revalidateOnReconnect: boolean
  revalidateOnMount?: boolean
  revalidateIfStale: boolean
  shouldRetryOnError: boolean
  suspense?: boolean
  fallbackData?: Data
  fetcher?: Fn
  use?: Middleware[]
  fallback: { [key: string]: any }

  isPaused: () => boolean
  onLoadingSlow: (
    key: string,
    config: Readonly<PublicConfiguration<Data, Error, Args, Fn>>
  ) => void
  onSuccess: (
    data: Data,
    key: string,
    config: Readonly<PublicConfiguration<Data, Error, Args, Fn>>
  ) => void
  onError: (
    err: Error,
    key: string,
    config: Readonly<PublicConfiguration<Data, Error, Args, Fn>>
  ) => void
  onErrorRetry: (
    err: Error,
    key: string,
    config: Readonly<PublicConfiguration<Data, Error, Args, Fn>>,
    revalidate: Revalidator,
    revalidateOpts: Required<RevalidatorOptions>
  ) => void

  compare: (a: Data | undefined, b: Data | undefined) => boolean

  isOnline: () => boolean
  isVisible: () => boolean
}

export type FullConfiguration = InternalConfiguration & PublicConfiguration

export type ConfigOptions = {
  initFocus: (callback: () => void) => (() => void) | void
  initReconnect: (callback: () => void) => (() => void) | void
}
export interface SWRHook {
  <Data = any, Error = any, Args extends Key = Key>(args: Args): SWRResponse<
    Data,
    Error
  >
  <Data = any, Error = any, Args extends Key = Key>(
    args: Args,
    fn: Fetcher<Data, Args> | null
  ): SWRResponse<Data, Error>
  <Data = any, Error = any, Args extends Key = Key>(
    args: Args,
    config: SWRConfiguration<Data, Error, Args, Fetcher<Data, Args>> | undefined
  ): SWRResponse<Data, Error>
  <Data = any, Error = any, Args extends Key = Key>(
    args: Args,
    fn: Fetcher<Data, Args>,
    config: SWRConfiguration<Data, Error, Args, Fetcher<Data, Args>>
  ): SWRResponse<Data, Error>
  <Data = any, Error = any, Args extends Key = Key>(
    ...args:
      | [Args]
      | [Args, Fetcher<Data, Args> | null]
      | [
          Args,
          SWRConfiguration<Data, Error, Args, Fetcher<Data, Args>> | undefined
        ]
      | [
          Args,
          Fetcher<Data, Key> | null,
          SWRConfiguration<Data, Error, Args, Fetcher<Data, Args>>
        ]
  ): SWRResponse<Data, Error>
}

// Middlewares guarantee that a SWRHook receives a key, fetcher, and config as the argument
type SWRHookWithMiddleware = <Data = any, Error = any, Args extends Key = Key>(
  key: Args,
  fetcher: Fetcher<Data, Args> | null,
  config: SWRConfiguration<Data, Error>
) => SWRResponse<Data, Error>

export type Middleware = (useSWRNext: SWRHook) => SWRHookWithMiddleware
export type TupleKey = [any, ...unknown[]] | readonly [any, ...unknown[]]
export type ValueKey = string | null | TupleKey | Record<any, any>
export type Key = ValueKey | (() => ValueKey)

export type MutatorCallback<Data = any> = (
  currentValue?: Data
) => Promise<undefined | Data> | undefined | Data

export type Broadcaster<Data = any, Error = any> = (
  cache: Cache<Data>,
  key: string,
  data: Data,
  error?: Error,
  isValidating?: boolean,
  shouldRevalidate?: boolean
) => Promise<Data>

export type State<Data, Error> = {
  data?: Data
  error?: Error
  isValidating?: boolean
}

export type Mutator<Data = any> = (
  cache: Cache,
  key: Key,
  data?: Data | Promise<Data> | MutatorCallback<Data>,
  shouldRevalidate?: boolean
) => Promise<Data | undefined>

export interface ScopedMutator<Data = any> {
  /** This is used for bound mutator */
  (
    key: Key,
    data?: Data | Promise<Data> | MutatorCallback<Data>,
    shouldRevalidate?: boolean
  ): Promise<Data | undefined>
  /** This is used for global mutator */
  <T = any>(
    key: Key,
    data?: T | Promise<T> | MutatorCallback<T>,
    shouldRevalidate?: boolean
  ): Promise<T | undefined>
}

export type KeyedMutator<Data> = (
  data?: Data | Promise<Data> | MutatorCallback<Data>,
  shouldRevalidate?: boolean
) => Promise<Data | undefined>

// Public types

export type SWRConfiguration<
  Data = any,
  Error = any,
  Args extends Key = Key,
  Fn = Fetcher<any, Args>
> = Partial<PublicConfiguration<Data, Error, Args, Fn>>

export interface SWRResponse<Data, Error> {
  data?: Data
  error?: Error
  mutate: KeyedMutator<Data>
  isValidating: boolean
}

export type KeyLoader<Args extends ValueKey = ValueKey> =
  | ((index: number, previousPageData: any | null) => Args)
  | null

export interface RevalidatorOptions {
  retryCount?: number
  dedupe?: boolean
}

export type Revalidator = (
  revalidateOpts?: RevalidatorOptions
) => Promise<boolean> | void

export type RevalidateEvent =
  | typeof revalidateEvents.FOCUS_EVENT
  | typeof revalidateEvents.RECONNECT_EVENT
  | typeof revalidateEvents.MUTATE_EVENT

type RevalidateCallbackReturnType = {
  [revalidateEvents.FOCUS_EVENT]: void
  [revalidateEvents.RECONNECT_EVENT]: void
  [revalidateEvents.MUTATE_EVENT]: Promise<boolean>
}
export type RevalidateCallback = <K extends RevalidateEvent>(
  type: K
) => RevalidateCallbackReturnType[K]

export type StateUpdateCallback<Data = any, Error = any> = (
  data?: Data,
  error?: Error,
  isValidating?: boolean
) => void

export interface Cache<Data = any> {
  get(key: Key): Data | null | undefined
  set(key: Key, value: Data): void
  delete(key: Key): void
}
