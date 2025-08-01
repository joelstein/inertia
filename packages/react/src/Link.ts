import {
  CacheForOption,
  FormDataConvertible,
  LinkPrefetchOption,
  mergeDataIntoQueryString,
  Method,
  PendingVisit,
  PreserveStateOption,
  Progress,
  router,
  shouldIntercept,
} from '@inertiajs/core'
import { createElement, forwardRef, useEffect, useMemo, useRef, useState } from 'react'

const noop = () => undefined

interface BaseInertiaLinkProps {
  as?: string
  data?: Record<string, FormDataConvertible>
  href: string | { url: string; method: Method }
  method?: Method
  headers?: Record<string, string>
  onClick?: (event: React.MouseEvent<Element>) => void
  preserveScroll?: PreserveStateOption
  preserveState?: PreserveStateOption
  replace?: boolean
  only?: string[]
  except?: string[]
  onCancelToken?: (cancelToken: import('axios').CancelTokenSource) => void
  onBefore?: () => void
  onStart?: (event: PendingVisit) => void
  onProgress?: (progress: Progress) => void
  onFinish?: (event: PendingVisit) => void
  onCancel?: () => void
  onSuccess?: () => void
  onError?: () => void
  queryStringArrayFormat?: 'indices' | 'brackets'
  async?: boolean
  cacheFor?: CacheForOption | CacheForOption[]
  prefetch?: boolean | LinkPrefetchOption | LinkPrefetchOption[]
}

export type InertiaLinkProps = BaseInertiaLinkProps &
  Omit<React.HTMLAttributes<HTMLElement>, keyof BaseInertiaLinkProps> &
  Omit<React.AllHTMLAttributes<HTMLElement>, keyof BaseInertiaLinkProps>

const Link = forwardRef<unknown, InertiaLinkProps>(
  (
    {
      children,
      as = 'a',
      data = {},
      href,
      method = 'get',
      preserveScroll = false,
      preserveState = null,
      replace = false,
      only = [],
      except = [],
      headers = {},
      queryStringArrayFormat = 'brackets',
      async = false,
      onClick = noop,
      onCancelToken = noop,
      onBefore = noop,
      onStart = noop,
      onProgress = noop,
      onFinish = noop,
      onCancel = noop,
      onSuccess = noop,
      onError = noop,
      prefetch = false,
      cacheFor = 0,
      ...props
    },
    ref,
  ) => {
    const [inFlightCount, setInFlightCount] = useState(0)
    const hoverTimeout = useRef<number>(null)

    const _method = useMemo(() => {
      return typeof href === 'object' ? href.method : (method.toLowerCase() as Method)
    }, [href, method])

    const _as = useMemo(() => {
      as = as.toLowerCase()

      return _method !== 'get' ? 'button' : as
    }, [as, _method])

    const mergeDataArray = useMemo(
      () =>
        mergeDataIntoQueryString(
          _method,
          typeof href === 'object' ? href.url : href || '',
          data,
          queryStringArrayFormat,
        ),
      [href, _method, data, queryStringArrayFormat],
    )

    const url = useMemo(() => mergeDataArray[0], [mergeDataArray])
    const _data = useMemo(() => mergeDataArray[1], [mergeDataArray])

    const baseParams = useMemo(
      () => ({
        data: _data,
        method: _method,
        preserveScroll,
        preserveState: preserveState ?? _method !== 'get',
        replace,
        only,
        except,
        headers,
        async,
      }),
      [_data, _method, preserveScroll, preserveState, replace, only, except, headers, async],
    )

    const visitParams = useMemo(
      () => ({
        ...baseParams,
        onCancelToken,
        onBefore,
        onStart(event) {
          setInFlightCount((count) => count + 1)
          onStart(event)
        },
        onProgress,
        onFinish(event) {
          setInFlightCount((count) => count - 1)
          onFinish(event)
        },
        onCancel,
        onSuccess,
        onError,
      }),
      [baseParams, onCancelToken, onBefore, onStart, onProgress, onFinish, onCancel, onSuccess, onError],
    )

    const doPrefetch = () => {
      router.prefetch(url, baseParams, { cacheFor: cacheForValue })
    }

    const prefetchModes: LinkPrefetchOption[] = useMemo(
      () => {
        if (prefetch === true) {
          return ['hover']
        }

        if (prefetch === false) {
          return []
        }

        if (Array.isArray(prefetch)) {
          return prefetch
        }

        return [prefetch]
      },
      Array.isArray(prefetch) ? prefetch : [prefetch],
    )

    const cacheForValue = useMemo(() => {
      if (cacheFor !== 0) {
        // If they've provided a value, respect it
        return cacheFor
      }

      if (prefetchModes.length === 1 && prefetchModes[0] === 'click') {
        // If they've only provided a prefetch mode of 'click',
        // we should only prefetch for the next request but not keep it around
        return 0
      }

      // Otherwise, default to 30 seconds
      return 30_000
    }, [cacheFor, prefetchModes])

    useEffect(() => {
      return () => {
        clearTimeout(hoverTimeout.current)
      }
    }, [])

    useEffect(() => {
      if (prefetchModes.includes('mount')) {
        setTimeout(() => doPrefetch())
      }
    }, prefetchModes)

    const regularEvents = {
      onClick: (event) => {
        onClick(event)

        if (shouldIntercept(event)) {
          event.preventDefault()

          router.visit(url, visitParams)
        }
      },
    }

    const prefetchHoverEvents = {
      onMouseEnter: () => {
        hoverTimeout.current = window.setTimeout(() => {
          doPrefetch()
        }, 75)
      },
      onMouseLeave: () => {
        clearTimeout(hoverTimeout.current)
      },
      onClick: regularEvents.onClick,
    }

    const prefetchClickEvents = {
      onMouseDown: (event) => {
        if (shouldIntercept(event)) {
          event.preventDefault()
          doPrefetch()
        }
      },
      onMouseUp: (event) => {
        event.preventDefault()
        router.visit(url, visitParams)
      },
      onClick: (event) => {
        onClick(event)

        if (shouldIntercept(event)) {
          // Let the mouseup event handle the visit
          event.preventDefault()
        }
      },
    }

    const elProps = useMemo(
      () => ({
        a: { href: url },
        button: { type: 'button' },
      }),
      [url],
    )

    return createElement(
      _as,
      {
        ...props,
        ...(elProps[_as] || {}),
        ref,
        ...(() => {
          if (prefetchModes.includes('hover')) {
            return prefetchHoverEvents
          }

          if (prefetchModes.includes('click')) {
            return prefetchClickEvents
          }

          return regularEvents
        })(),
        'data-loading': inFlightCount > 0 ? '' : undefined,
      },
      children,
    )
  },
)
Link.displayName = 'InertiaLink'

export default Link
