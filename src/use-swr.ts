import {
  useState,
  useLayoutEffect,
  useRef,
  useContext,
  useCallback
} from 'react'
import { unstable_batchedUpdates } from 'react-dom'
import throttle from 'lodash.throttle'
import deepEqual from 'deep-equal'

import {
  keyInterface,
  ConfigInterface,
  RevalidateOptionInterface,
  updaterInterface,
  triggerInterface,
  mutateInterface,
  responseInterface,
  fetcherFn
} from './types'

import defaultConfig, {
  CONCURRENT_PROMISES,
  CONCURRENT_PROMISES_TS,
  FOCUS_REVALIDATORS,
  CACHE_REVALIDATORS,
  MUTATION_TS,
  cacheGet,
  cacheSet
} from './config'
import SWRConfigContext from './swr-config-context'
import isDocumentVisible from './libs/is-document-visible'
import useHydration from './libs/use-hydration'

const trigger: triggerInterface = function(key, shouldRevalidate = true) {
  const updaters = CACHE_REVALIDATORS[key]
  if (updaters) {
    for (let i = 0; i < updaters.length; ++i) {
      updaters[i](shouldRevalidate)
    }
  }
}

const mutate: mutateInterface = function(key, data, shouldRevalidate = true) {
  // update timestamp
  MUTATION_TS[key] = Date.now() - 1

  // update cached data
  cacheSet(key, data)

  // update existing SWR Hooks' state
  const updaters = CACHE_REVALIDATORS[key]
  if (updaters) {
    for (let i = 0; i < updaters.length; ++i) {
      updaters[i](shouldRevalidate)
    }
  }
}

function useSWR<
  Data = any,
  Error = any,
  Fn extends fetcherFn<Data> = fetcherFn<Data>
>(
  key: keyInterface,
  fn?: Fn,
  config?: ConfigInterface<Data, Error>
): responseInterface<Data, Error>
function useSWR<
  Data = any,
  Error = any,
  Fn extends fetcherFn<Data> = fetcherFn<Data>
>(
  key: keyInterface,
  fn?: Fn,
  deps?: Parameters<Fn>,
  config?: ConfigInterface<Data, Error>
): responseInterface<Data, Error>
function useSWR<
  Data = any,
  Error = any,
  Fn extends fetcherFn<Data> = fetcherFn<Data>
>(_key: keyInterface, fn?: Fn, ...args): responseInterface<Data, Error> {
  let config: ConfigInterface<Data, Error> = {},
    fetcherArgs: any[] = []

  if (args.length === 2) {
    fetcherArgs = Array.from(args[0])
    config = args[1]
  } else if (args.length === 1 && Array.isArray(args[0])) {
    fetcherArgs = args[0]
  } else if (args.length === 1 && typeof args[0] === 'object') {
    config = args[0]
  }

  // we assume `key` as the identifier of the request
  // `key` can change but `fn` shouldn't
  // (because `revalidate` only depends on `key`)

  let key: string
  if (typeof _key === 'function') {
    try {
      key = _key()
    } catch {
      // dependencies not ready
      key = ''
    }
  } else {
    key = _key
  }

  config = Object.assign(
    {},
    defaultConfig,
    useContext(SWRConfigContext),
    config
  )

  if (typeof fn === 'undefined') {
    // use a global fetcher
    fn = config.fetcher
  }

  // stale: get from cache
  let [data, setData] = useState(useHydration() ? undefined : cacheGet(key))
  let [error, setError] = useState()
  let [isValidating, setIsValidating] = useState(false)

  // error ref inside revalidate (is last request errored?)
  const errorRef = useRef(false)
  const unmountedRef = useRef(false)
  const keyRef = useRef(key)
  const fnRef = useRef(fn)
  const fetcherArgsRef = useRef(fetcherArgs)
  const dataRef = useRef(data)

  const revalidate = useCallback(
    async (
      revalidateOpts: RevalidateOptionInterface = {}
    ): Promise<boolean> => {
      if (!key) return false
      if (unmountedRef.current) return false

      let loading = true

      try {
        setIsValidating(true)

        let newData
        let originalRequest = !!(
          CONCURRENT_PROMISES[key] === undefined || revalidateOpts.noDedupe
        )
        let ts

        if (!originalRequest) {
          // different component, dedupe requests
          // need the new data for the state
          ts = CONCURRENT_PROMISES_TS[key]
          newData = await CONCURRENT_PROMISES[key]
        } else {
          // if no cache being rendered (blank page),
          // we trigger the loading slow event
          if (!cacheGet(key)) {
            setTimeout(() => {
              if (loading) config.onLoadingSlow(key, config)
            }, config.loadingTimeout)
          }
          CONCURRENT_PROMISES[key] = fn(...fetcherArgs)
          CONCURRENT_PROMISES_TS[key] = ts = Date.now()
          setTimeout(() => {
            delete CONCURRENT_PROMISES[key]
            delete CONCURRENT_PROMISES_TS[key]
          }, config.dedupingInterval)
          newData = await CONCURRENT_PROMISES[key]

          // trigger the success event
          // (only do it for the original request)
          config.onSuccess(newData, key, config)
        }

        // if the revalidation happened earlier than local mutations,
        // we should ignore the result because it could override.
        if (MUTATION_TS[key] && ts <= MUTATION_TS[key]) {
          setIsValidating(false)
          return false
        }

        errorRef.current = false

        unstable_batchedUpdates(() => {
          setIsValidating(false)
          setError(undefined)
          if (dataRef.current && deepEqual(dataRef.current, newData)) {
            // deep compare to avoid extra re-render
            // do nothing
          } else {
            // data changed
            setData(newData)
            cacheSet(key, newData)
            if (originalRequest) {
              // also update other SWRs from cache
              trigger(key, false)
            }
            keyRef.current = key
            fnRef.current = fn
            fetcherArgsRef.current = fetcherArgs
            dataRef.current = newData
          }
        })
      } catch (err) {
        delete CONCURRENT_PROMISES[key]
        unstable_batchedUpdates(() => {
          setIsValidating(false)
          setError(err)
        })

        config.onError(err, key, config)
        errorRef.current = true

        if (config.shouldRetryOnError) {
          const retryCount = (revalidateOpts.retryCount || 0) + 1
          config.onErrorRetry(
            err,
            key,
            config,
            revalidate,
            Object.assign({}, revalidateOpts, { retryCount })
          )
        }
      }

      loading = false
      return true
    },
    [key, fn, ...fetcherArgs]
  )
  const forceRevalidate = useCallback(() => revalidate({ noDedupe: true }), [
    revalidate
  ])

  // mounted
  useLayoutEffect(() => {
    if (!key) return undefined

    // after `key` updates, we need to mark it as mounted
    unmountedRef.current = false

    const _newData = cacheGet(key)

    // update the state if the cache changed OR the key changed OR the args changed OR the fetcherFn has changed
    if (
      (_newData && !deepEqual(data, _newData)) ||
      keyRef.current !== key ||
      fnRef.current !== fn ||
      fetcherArgsRef.current !== fetcherArgs
    ) {
      setData(_newData)
      dataRef.current = _newData
      keyRef.current = key
      fnRef.current = fn
      fetcherArgsRef.current = fetcherArgs
    }

    // revalidate after mounted
    if (_newData && window['requestIdleCallback']) {
      // delay revalidate if there's cache
      // to not block the rendering
      window['requestIdleCallback'](revalidate)
    } else {
      revalidate()
    }

    // whenever the window gets focused, revalidate
    // throttle: avoid being called twice from both listeners
    // and tabs being switched quickly
    const onFocus = throttle(revalidate, config.focusThrottleInterval)

    if (config.revalidateOnFocus) {
      if (!FOCUS_REVALIDATORS[key]) {
        FOCUS_REVALIDATORS[key] = [onFocus]
      } else {
        FOCUS_REVALIDATORS[key].push(onFocus)
      }
    }

    // updater
    const onUpdate: updaterInterface = (shouldRevalidate = true) => {
      // update data from the cache
      const newData = cacheGet(key)
      if (!deepEqual(data, newData)) {
        unstable_batchedUpdates(() => {
          setError(undefined)
          setData(newData)
        })
        dataRef.current = newData
        keyRef.current = key
        fnRef.current = fn
        fetcherArgsRef.current = fetcherArgs
      }

      if (shouldRevalidate) {
        return revalidate()
      }
      return false
    }
    if (!CACHE_REVALIDATORS[key]) {
      CACHE_REVALIDATORS[key] = [onUpdate]
    } else {
      CACHE_REVALIDATORS[key].push(onUpdate)
    }

    // polling
    let id = null
    async function tick() {
      if (
        !errorRef.current &&
        (config.refreshWhenHidden || isDocumentVisible())
      ) {
        // only revalidate when the page is visible
        // if API request errored, we stop polling in this round
        // and let the error retry function handle it
        await revalidate()
      }

      const interval = config.refreshInterval
      id = setTimeout(tick, interval)
    }
    if (config.refreshInterval) {
      id = setTimeout(tick, config.refreshInterval)
    }

    return () => {
      // cleanup
      setData = () => null
      setIsValidating = () => null
      setError = () => null

      // mark it as unmounted
      unmountedRef.current = true

      if (FOCUS_REVALIDATORS[key]) {
        const index = FOCUS_REVALIDATORS[key].indexOf(onFocus)
        if (index >= 0) FOCUS_REVALIDATORS[key].splice(index, 1)
      }
      if (CACHE_REVALIDATORS[key]) {
        const index = CACHE_REVALIDATORS[key].indexOf(onUpdate)
        if (index >= 0) CACHE_REVALIDATORS[key].splice(index, 1)
      }

      if (id !== null) {
        clearTimeout(id)
      }
    }
  }, [key, config.refreshInterval, revalidate, fn, ...fetcherArgs])

  // suspense (client side only)
  if (config.suspense && !data) {
    if (typeof window !== 'undefined') {
      if (!CONCURRENT_PROMISES[key]) {
        // need to trigger revalidate immediately
        // to throw the promise
        revalidate()
      }
      throw CONCURRENT_PROMISES[key]
    }
  }

  return {
    error,
    // `key` might be changed in the upcoming hook re-render,
    // but the previous state will stay
    // so we need to match the latest key and data
    data:
      keyRef.current === key &&
      fnRef.current === fn &&
      fetcherArgsRef.current === fetcherArgs
        ? data
        : undefined,
    revalidate: forceRevalidate, // handler
    isValidating
  }
}

const SWRConfig = SWRConfigContext.Provider

export { trigger, mutate, SWRConfig }
export default useSWR
