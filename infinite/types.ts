import { SWRConfiguration, SWRResponse, Arguments } from 'swr'

type FetcherReturnValue<Data = unknown> = Data | Promise<Data>

export type InfiniteFetcher<
  Args extends Arguments = Arguments,
  Data = any
> = Args extends (readonly [...infer K])
  ? ((...args: [...K]) => FetcherReturnValue<Data>)
  : Args extends null
  ? never
  : Args extends (infer T)
  ? (...args: [T]) => FetcherReturnValue<Data>
  : never

export type InfiniteKeyLoader<Args extends Arguments = Arguments> =
  | ((index: number, previousPageData: any | null) => Args)
  | null

export type SWRInfiniteConfiguration<
  Data = any,
  Error = any,
  Args extends Arguments = Arguments
> = SWRConfiguration<Data[], Error, Args> & {
  initialSize?: number
  revalidateAll?: boolean
  persistSize?: boolean
}

export interface SWRInfiniteResponse<Data = any, Error = any>
  extends SWRResponse<Data[], Error> {
  size: number
  setSize: (
    size: number | ((_size: number) => number)
  ) => Promise<Data[] | undefined>
}

export interface SWRInfiniteHook {
  <Data = any, Error = any, SWRInfiniteArguments extends Arguments = Arguments>(
    getKey: InfiniteKeyLoader<SWRInfiniteArguments>
  ): SWRInfiniteResponse<Data, Error>
  <Data = any, Error = any, SWRInfiniteArguments extends Arguments = Arguments>(
    getKey: InfiniteKeyLoader<SWRInfiniteArguments>,
    fetcher: InfiniteFetcher<SWRInfiniteArguments, Data> | null
  ): SWRInfiniteResponse<Data, Error>
  <Data = any, Error = any, SWRInfiniteArguments extends Arguments = Arguments>(
    getKey: InfiniteKeyLoader<SWRInfiniteArguments>,
    config:
      | SWRInfiniteConfiguration<Data, Error, SWRInfiniteArguments>
      | undefined
  ): SWRInfiniteResponse<Data, Error>
  <Data = any, Error = any, SWRInfiniteArguments extends Arguments = Arguments>(
    getKey: InfiniteKeyLoader<SWRInfiniteArguments>,
    fetcher: InfiniteFetcher<SWRInfiniteArguments, Data> | null,
    config:
      | SWRInfiniteConfiguration<Data, Error, SWRInfiniteArguments>
      | undefined
  ): SWRInfiniteResponse<Data, Error>
}
