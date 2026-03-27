import { css, cx } from '@emotion/css';
import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import uPlot from 'uplot';

import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { DashboardCursorSync } from '@grafana/schema';

import { usePlotConfigHook } from '../../../../../../public/app/plugins/panel/timeseries/hooks/usePlotConfigHook';
import { AdHocFilterModel } from '../../../internal';
import { useStyles2 } from '../../../themes/ThemeContext';
import { OnSelectRangeCallback, RangeSelection1D, RangeSelection2D } from '../../PanelChrome';
import { getPortalContainer } from '../../Portal/Portal';
import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { CloseButton } from './CloseButton';
import { initConstVars } from './TooltipUtils';

export const TOOLTIP_OFFSET = 10;

// todo: barchart? histogram?
export const enum TooltipHoverMode {
  // Single mode in TimeSeries, Candlestick, Trend, StateTimeline, Heatmap?
  xOne,
  // All mode in TimeSeries, Candlestick, Trend, StateTimeline, Heatmap?
  xAll,
  // Single mode in XYChart, Heatmap?
  xyOne,
}

type GetDataLinksCallback = (seriesIdx: number, dataIdx: number) => LinkModel[];
type GetAdHocFiltersCallback = (seriesIdx: number, dataIdx: number) => AdHocFilterModel[];

interface TooltipPlugin2Props {
  config: UPlotConfigBuilder;
  hoverMode: TooltipHoverMode;

  syncMode?: DashboardCursorSync;
  syncScope?: string;

  // x only
  queryZoom?: (range: { from: number; to: number }) => void;
  // y-only, via shiftKey
  clientZoom?: boolean;

  onSelectRange?: OnSelectRangeCallback;
  getDataLinks?: GetDataLinksCallback;
  getAdHocFilters?: GetAdHocFiltersCallback;

  render: (
    u: uPlot,
    dataIdxs: Array<number | null>,
    seriesIdx: number | null,
    isPinned: boolean,
    dismiss: (u: uPlot) => void,
    // selected time range (for annotation triggering)
    timeRange: TimeRange2 | null,
    viaSync: boolean,
    dataLinks: LinkModel[],
    adHocFilters: AdHocFilterModel[]
  ) => React.ReactNode;

  maxWidth?: number;
}

interface TooltipContainerSize {
  observer: ResizeObserver;
  width: number;
  height: number;
}

export interface TimeRange2 {
  from: number;
  to: number;
}

// min px width that triggers zoom
const MIN_ZOOM_DIST = 5;

const maybeZoomAction = (e?: MouseEvent | null) => e != null && !e.ctrlKey && !e.metaKey;

const getDataLinksFallback: GetDataLinksCallback = () => [];
const getAdHocFiltersFallback: GetAdHocFiltersCallback = () => [];

const userAgentIsMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

/**
 * @alpha
 */
export const TooltipPlugin2 = ({
  config,
  hoverMode,
  render,
  clientZoom = false,
  queryZoom,
  onSelectRange,
  maxWidth,
  syncMode = DashboardCursorSync.Off,
  syncScope = 'global', // eventsScope
  getDataLinks = getDataLinksFallback,
  getAdHocFilters = getAdHocFiltersFallback,
}: TooltipPlugin2Props) => {
  const styles = useStyles2(getStyles, maxWidth);
  const domRef = useRef<HTMLDivElement>(null);
  const portalRoot = useRef<HTMLElement | null>(null);

  // State
  const [isHovering, setIsHovering] = useState(false);
  // @todo currently unused, audit and hook back up?
  const [pendingRender, setPendingRender] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [content, setContent] = useState<React.ReactNode>(null);
  const [style, setStyle] = useState<Partial<React.CSSProperties>>({ transform: '', pointerEvents: 'none' });
  const [annotationRange, setAnnotationRange] = useState<TimeRange2 | null>(null);
  const [seriesIdxs, setSeriesIdxs] = useState<Array<number | null>>([]);
  const [yDrag, setYDrag] = useState<boolean>(false);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [closestSeriesIdx, setClosestSeriesIdx] = useState<number | null>(null);
  // const [plotVisible, setPlotVisible] = useState<boolean>(false);
  const [winWid, setWinWidth] = useState(0);
  const [winHgt, setWinHeight] = useState(0);
  const [pendingPinned, setPendingPinned] = useState(false);
  const [dataLinks, setDataLinks] = useState<LinkModel[]>([]);
  const [adHocFilters, setAdHocFilters] = useState<AdHocFilterModel[]>([]);
  // // for onceClick link rendering during mousemoves we use these pre-generated first links or actions
  // // these will be wrong if the titles have interpolation using the hovered *value*
  // // but this should be quite rare. we'll fix it if someone actually encounters this
  const [persistentLinks, setPersistentLinks] = useState<LinkModel[][]>([]);
  const [yZoomed, setYZoomed] = useState(false);

  // Consts
  const syncTooltip = syncMode === DashboardCursorSync.Tooltip;
  // Window vars
  const scrollbarWidth = 16;

  if (portalRoot.current == null) {
    portalRoot.current = getPortalContainer();
  }

  // Refs
  const sizeRef = useRef<TooltipContainerSize | undefined>(undefined);
  const renderRef = useRef(render);
  renderRef.current = render;

  const getLinksRef = useRef(getDataLinks);
  getLinksRef.current = getDataLinks;

  const getAdHocFiltersRef = useRef(getAdHocFilters);
  getAdHocFiltersRef.current = getAdHocFilters;

  const { defaultStyles } = initConstVars(style);

  if (syncMode !== DashboardCursorSync.Off && config.scales[0].props.isTime) {
    config.setCursor({
      sync: {
        key: syncScope,
        scales: ['x', null],
      },
    });
  }

  const renderTooltip = useCallback(
    (u: uPlot, setHover = true) => {
      if (!u) {
        throw new Error('[TooltipPlugin2::renderTooltip] Plot is not defined!');
      }

      console.log('[TooltipPlugin2::renderTooltip]', { isHovering, u, setHover, annotationRange });

      if (!pendingRender) {
        setPendingRender(true);
      }

      setIsHovering(setHover);
    },
    [annotationRange, isHovering, pendingRender]
  );

  const dismiss = useCallback(
    (u: uPlot) => {
      if (!u) {
        throw new Error('[TooltipPlugin2::dismiss] - plot not initiated!');
      }
      console.log('[TooltipPlugin2::dismiss]', { isHovering, isPinned });
      const prevIsPinned = isPinned;
      setIsPinned(false);
      setIsHovering(false);
      setAnnotationRange(null);
      u.setCursor({ left: -10, top: -10 });
      setDataLinks([]);
      setAdHocFilters([]);

      console.log('[TooltipPlugin2::dismiss] renderTooltip');
      renderTooltip(u, prevIsPinned);
    },
    [isHovering, isPinned, renderTooltip]
  );

  // in some ways this is similar to ClickOutsideWrapper.tsx
  const downEventOutside = useCallback(
    (u: uPlot, e: Event) => {
      if (!u) {
        throw new Error('[TooltipPlugin2::downEventOutside] plot is undefined!');
      }
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          dismiss(u);
        }
        return;
      }

      // this tooltip is Portaled, but actions inside it create forms in Modals
      const isModalOrPortaled = '[role="dialog"], #grafana-portal-container';

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if ((e.target as HTMLElement).closest(isModalOrPortaled) == null) {
        dismiss(u);
      }
    },
    [dismiss]
  );

  // @todo externalize and pass in all state vars
  const setTooltipContent = useCallback(
    (u: uPlot, hover = false) => {
      if (!u) {
        throw new Error('[TooltipPlugin2::setTooltipContent] plot not initiated!');
      }

      // @todo DRY
      const viaSync = u.cursor.event == null;

      setPendingRender(false);
      let pointerEventsStyles: Partial<React.CSSProperties> | null = null;

      if (pendingPinned) {
        pointerEventsStyles = { pointerEvents: isPinned ? 'all' : 'none' };

        //@ts-expect-error access private method @todo narrow
        u.cursor['_lock'] = _isPinned;

        if (isPinned) {
          document.addEventListener('mousedown', (e) => downEventOutside(u, e), true);
          document.addEventListener('keydown', (e) => downEventOutside(u, e), true);
        } else {
          document.removeEventListener('mousedown', (e) => downEventOutside(u, e), true);
          document.removeEventListener('keydown', (e) => downEventOutside(u, e), true);
        }

        setPendingPinned(false);
      }

      // @todo clean up
      setStyle(pointerEventsStyles ?? defaultStyles);
      setIsPinned(isPinned);

      if (hover !== isHovering) {
        console.log('[TooltipPlugin2::setTooltipContent] setIsHovering');
        setIsHovering(hover);
      }

      const isWipAnnotationActive = annotationRange != null;
      const isTooltipActive = isWipAnnotationActive || hover;

      console.log('[TooltipPlugin2::setTooltipContent] setTooltipContent', {
        hover,
        isWipAnnotationActive,
        isPinned,
        style: pointerEventsStyles ?? defaultStyles,
        isTooltipActive,
        annotationRange,
      });

      setContent(
        isTooltipActive
          ? renderRef.current(
              u,
              seriesIdxs,
              closestSeriesIdx,
              isPinned,
              dismiss,
              annotationRange,
              viaSync,
              isPinned ? dataLinks : closestSeriesIdx != null ? persistentLinks[closestSeriesIdx] : [],
              isPinned ? adHocFilters : []
            )
          : null
      );

      // TODO: set u.over.style.cursor = 'pointer' if we hovered a oneClick point
      // else revert to default...but only when the new pointer is different from prev
    },
    [
      adHocFilters,
      annotationRange,
      closestSeriesIdx,
      dataLinks,
      defaultStyles,
      dismiss,
      downEventOutside,
      isHovering,
      isPinned,
      pendingPinned,
      persistentLinks,
      seriesIdxs,
    ]
  );

  const hasSomeSeriesIdx = useCallback(() => {
    return seriesIdxs.some((v, i) => i > 0 && v != null);
  }, [seriesIdxs]);

  // @todo don't set to state
  const updateWinSize = useCallback(
    (u: uPlot) => {
      isHovering && !isPinned && dismiss(u);

      setWinWidth(window.innerWidth - scrollbarWidth);
      setWinHeight(window.innerHeight - scrollbarWidth);
    },
    [dismiss, isHovering, isPinned]
  );

  const isPlotVisible = useCallback(
    (u: uPlot) => {
      return u.rect.bottom <= winHgt && u.rect.top >= 0 && u.rect.left >= 0 && u.rect.right <= winWid;
    },
    [winHgt, winWid]
  );

  const isUserHovering = useCallback(
    (u: uPlot, viaSync: boolean) => {
      if (!u) {
        throw new Error('[isUserHovering]:: plot not defined!');
      }

      console.log('isUserHovering', {
        isPlotVis: isPlotVisible(u),
        hasSomeSeriesIdx: hasSomeSeriesIdx(),
        syncTooltip,
        closestSeriesIdx,
      });

      return viaSync
        ? isPlotVisible(u) && hasSomeSeriesIdx() && syncTooltip
        : closestSeriesIdx != null || (hoverMode === TooltipHoverMode.xAll && hasSomeSeriesIdx());
    },
    [isPlotVisible, hasSomeSeriesIdx, syncTooltip, closestSeriesIdx, hoverMode]
  );

  /**
   * fires on data value hovers/unhovers
   */
  const setLegend = useCallback(
    (u: uPlot) => {
      if (!u.cursor.idxs) {
        throw new Error('cursor must be defined!');
      }

      const seriesIndiciesTmp = u.cursor.idxs.slice();
      setSeriesIdxs(seriesIndiciesTmp);
      if (persistentLinks.length === 0) {
        setPersistentLinks(
          seriesIndiciesTmp.map((_, seriesIdx) => {
            if (seriesIdx > 0) {
              const links = getDataLinks(seriesIdx, seriesIndiciesTmp[seriesIdx]!);
              const oneClickLink = links.find((dataLink) => dataLink.oneClick === true);

              if (oneClickLink) {
                return [oneClickLink];
              }
            }

            return [];
          })
        );
      }

      const viaSync = u.cursor.event == null;
      const prevIsHovering = isHovering;
      const currentIsHovering = isUserHovering(u, viaSync);

      if (currentIsHovering || currentIsHovering !== prevIsHovering) {
        console.log('[TooltipPlugin2::setLegend] renderTooltip hover - true');
        renderTooltip(u, true);
      } else {
        console.log('[TooltipPlugin2::setLegend] renderTooltip hover - false');
        renderTooltip(u, false);
      }
    },
    [getDataLinks, isHovering, isUserHovering, persistentLinks.length, renderTooltip]
  );
  const setSelect = useCallback(
    (u: uPlot) => {
      const isXAxisHorizontal = u.scales.x.ori === 0;
      const viaSync = u.cursor.event == null;

      if (!viaSync && (clientZoom || queryZoom != null)) {
        if (maybeZoomAction(u.cursor!.event)) {
          if (onSelectRange != null) {
            let selections: RangeSelection2D[] = [];

            if (!u.cursor.drag) {
              throw new Error('[TooltipPlugin2::hooks::setSelect] cursor drag offset not defined!');
            }

            const yDrag = Boolean(u.cursor.drag.y);
            const xDrag = Boolean(u.cursor.drag.x);

            let xSel = null;
            const ySels: RangeSelection1D[] = [];

            // get x selection
            if (xDrag) {
              xSel = {
                from: isXAxisHorizontal
                  ? u.posToVal(u.select.left!, 'x')
                  : u.posToVal(u.select.top + u.select.height, 'x'),
                to: isXAxisHorizontal
                  ? u.posToVal(u.select.left! + u.select.width, 'x')
                  : u.posToVal(u.select.top, 'x'),
              };
            }

            // get y selections
            if (yDrag) {
              config.scales.forEach((scale) => {
                const key = scale.props.scaleKey;

                if (key !== 'x') {
                  const ySel = {
                    from: isXAxisHorizontal
                      ? u.posToVal(u.select.top + u.select.height, key)
                      : u.posToVal(u.select.left + u.select.width, key),
                    to: isXAxisHorizontal ? u.posToVal(u.select.top, key) : u.posToVal(u.select.left, key),
                  };

                  ySels.push(ySel);
                }
              });
            }

            if (xDrag) {
              if (yDrag) {
                // x + y
                selections = ySels.map((ySel) => ({ x: xSel!, y: ySel }));
              } else {
                // x only
                selections = [{ x: xSel! }];
              }
            } else {
              if (yDrag) {
                // y only
                selections = ySels.map((ySel) => ({ y: ySel }));
              }
            }

            onSelectRange(selections);
          } else if (clientZoom && yDrag) {
            if (u.select.height >= MIN_ZOOM_DIST) {
              for (const key in u.scales) {
                if (key !== 'x') {
                  const maxY = isXAxisHorizontal
                    ? u.posToVal(u.select.top, key)
                    : u.posToVal(u.select.left + u.select.width, key);
                  const minY = isXAxisHorizontal
                    ? u.posToVal(u.select.top + u.select.height, key)
                    : u.posToVal(u.select.left, key);

                  u.setScale(key, { min: minY, max: maxY });
                }
              }

              setYZoomed(true);
            }

            setYDrag(false);
          } else if (queryZoom != null) {
            if (u.select.width >= MIN_ZOOM_DIST) {
              const minX = isXAxisHorizontal
                ? u.posToVal(u.select.left, 'x')
                : u.posToVal(u.select.top + u.select.height, 'x');
              const maxX = isXAxisHorizontal
                ? u.posToVal(u.select.left + u.select.width, 'x')
                : u.posToVal(u.select.top, 'x');

              queryZoom({ from: minX, to: maxX });

              setYZoomed(false);
            }
          }
        } else {
          console.log('[TooltipPlugin2::setSelect] setAnnotationRange');
          setAnnotationRange({
            from: isXAxisHorizontal ? u.posToVal(u.select.left, 'x') : u.posToVal(u.select.top + u.select.height, 'x'),
            to: isXAxisHorizontal ? u.posToVal(u.select.left + u.select.width, 'x') : u.posToVal(u.select.top, 'x'),
          });

          console.log('[TooltipPlugin2::setSelect] renderTooltip');
          renderTooltip(u, true);
        }
      }

      // manually hide selected region (since cursor.drag.setScale = false)
      u.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
    },
    [clientZoom, config.scales, onSelectRange, queryZoom, renderTooltip, yDrag]
  );
  const setData = useCallback(
    (u: uPlot) => {
      setYZoomed(false);
      setYDrag(false);

      if (isPinned) {
        dismiss(u);
      }
    },
    [dismiss, isPinned]
  );

  /**
   * fires on series focus/proximity changes
   * e.g. to highlight the hovered/closest series
   * TODO: we only need this for multi/all mode?
   */
  const setSeries = useCallback(
    (u: uPlot, seriesIdx: number | null) => {
      console.log('[TooltipPlugin2::setSeries] setClosestSeriesIdx', seriesIdx);
      setClosestSeriesIdx(seriesIdx);

      const viaSync = u.cursor.event == null;
      const hovering = isUserHovering(u, viaSync);
      if (hovering) {
        console.log('[TooltipPlugin2::setSeries] renderTooltip');
        renderTooltip(u);
      }
    },
    [isUserHovering, renderTooltip]
  );

  /**
   * fires on mouse moves
   */
  const setCursor = useCallback(
    (u: uPlot) => {
      if (!sizeRef.current) {
        console.warn('[TooltipPlugin2::setCursor] sizeRef not defined!');
        return;
      }

      if (!isHovering) {
        console.warn('[TooltipPlugin2::setCursor] not hovering!');
        return;
      }

      const { left = -10, top = -10 } = u.cursor;

      if (left >= 0 || top >= 0) {
        const clientX = u.rect.left + left;
        const clientY = u.rect.top + top;

        let transform = '';

        let { width, height } = sizeRef.current;
        width += TOOLTIP_OFFSET;
        height += TOOLTIP_OFFSET;

        if (offsetY !== 0) {
          if (clientY + height < winHgt || clientY - height < 0) {
            setOffsetY(0);
          } else if (offsetY !== -height) {
            setOffsetY(-height);
          }
        } else {
          if (clientY + height > winHgt && clientY - height >= 0) {
            setOffsetY(-height);
          }
        }

        if (offsetX !== 0) {
          if (clientX + width < winWid || clientX - width < 0) {
            setOffsetX(0);
          } else if (offsetX !== -width) {
            setOffsetX(-width);
          }
        } else {
          if (clientX + width > winWid && clientX - width >= 0) {
            setOffsetX(-width);
          }
        }

        const shiftX = clientX + (offsetX === 0 ? TOOLTIP_OFFSET : -TOOLTIP_OFFSET);
        const shiftY = clientY + (offsetY === 0 ? TOOLTIP_OFFSET : -TOOLTIP_OFFSET);

        const reflectX = offsetX === 0 ? '' : 'translateX(-100%)';
        const reflectY = offsetY === 0 ? '' : 'translateY(-100%)';

        transform = `translateX(${shiftX}px) ${reflectX} translateY(${shiftY}px) ${reflectY}`;

        // @todo fix mutating domRef styles
        if (domRef.current != null) {
          console.warn('[TooltipPlugin2::setCursor] transform', transform);
          domRef.current.style.transform = transform;
        } else {
          console.warn('[TooltipPlugin2::setCursor] renderTooltip', { transform, style });
          setStyle({ ...style, transform });
          renderTooltip(u);
        }
      }
    },
    [isHovering, offsetX, offsetY, renderTooltip, style, winHgt, winWid]
  );

  const onClick = useCallback(
    (u: uPlot, e: PointerEvent) => {
      if (!u.cursor) {
        throw new Error('[TooltipPlugin2::onClick] cursor not defined!');
      }
      if (u.cursor.left === undefined) {
        throw new Error('[TooltipPlugin2::onClick] cursor left undefined!');
      }

      console.log('[TooltipPlugin2::onClick]', { e, over: u.over, ctrl: e.ctrlKey, meta: e.metaKey });
      if (e.target === u.over) {
        console.log('[TooltipPlugin2::onClick] - target is u.over');
        const isWipAnnotationModifierActive = e.ctrlKey || e.metaKey;
        if (isWipAnnotationModifierActive) {
          let xVal;

          const isXAxisHorizontal = u.scales.x.ori === 0;
          if (isXAxisHorizontal) {
            xVal = u.posToVal(u.cursor.left, 'x');
          } else {
            xVal = u.posToVal(u.select.top + u.select.height, 'x');
          }

          setAnnotationRange({
            from: xVal,
            to: xVal,
          });

          console.log('[TooltipPlugin2::onClick] - renderTooltip (anno)');
          renderTooltip(u, false);
        }
        // if tooltip visible, not pinned, and within proximity to a series/point
        else if (isHovering && !isPinned && closestSeriesIdx != null) {
          const seriesIndex = seriesIdxs[closestSeriesIdx];
          if (seriesIndex === null) {
            throw new Error('[TooltipPlugin2::onClick] - seriesIndex not defined!');
          }
          setDataLinks(getLinksRef.current(closestSeriesIdx, seriesIndex));
          setAdHocFilters(getAdHocFiltersRef.current(closestSeriesIdx, seriesIndex));

          const oneClickLink = dataLinks.find((dataLink) => dataLink.oneClick === true);

          if (oneClickLink != null) {
            window.open(oneClickLink.href, oneClickLink.target ?? '_self');
          } else {
            setIsPinned(true);
            console.log('[TooltipPlugin2::onClick] - renderTooltip (hover)');
            renderTooltip(u, true);
          }
        }
      }
    },
    [closestSeriesIdx, dataLinks, isHovering, isPinned, renderTooltip, seriesIdxs]
  );

  const onConfigChange = useCallback((u: uPlot) => {
    sizeRef.current?.observer.disconnect();

    if (!u) {
      // @todo remove debug
      console.warn('[useLayoutEffect::config] Plot not initiated!');
      return;
    }

    console.log('[useLayoutEffect::config] Plot initiated!');

    sizeRef.current = {
      width: 0,
      height: 0,
      observer: new ResizeObserver((entries) => {
        const size = sizeRef.current;
        if (!size) {
          throw new Error('[useLayoutEffect::config] sizeRef undefined!');
        }

        for (const entry of entries) {
          if (entry.borderBoxSize?.length > 0) {
            size.width = entry.borderBoxSize[0].inlineSize;
            size.height = entry.borderBoxSize[0].blockSize;
          } else {
            size.width = entry.contentRect.width;
            size.height = entry.contentRect.height;
          }
        }
      }),
    };

    if (clientZoom || queryZoom != null) {
      config.setCursor({
        bind: {
          dblclick: (u) => () => {
            if (!maybeZoomAction(u.cursor!.event)) {
              return null;
            }

            if (clientZoom && yZoomed) {
              for (const key in u.scales) {
                if (key !== 'x') {
                  // @ts-ignore (this is not typed correctly in uPlot, assigning nulls means auto-scale / reset)
                  u.setScale(key, { min: null, max: null });
                }
              }

              setYZoomed(false);
            } else if (queryZoom != null) {
              const xScale = u.scales.x;
              const frTs = xScale.min!;
              const toTs = xScale.max!;
              const pad = (toTs - frTs) / 2;

              queryZoom({ from: frTs - pad, to: toTs + pad });
            }

            return null;
          },
        },
      });
    }

    const onscroll = (u: uPlot, e: Event) => {
      isHovering && e.target instanceof Node && e.target.contains(u.root) && dismiss(u);
    };

    window.addEventListener('resize', () => updateWinSize(u));
    window.addEventListener('scroll', (e) => onscroll(u, e), true);

    return () => {
      sizeRef.current?.observer.disconnect();

      //@todo does this clean up?
      window.removeEventListener('resize', () => updateWinSize(u));
      window.removeEventListener('scroll', (e) => onscroll(u, e), true);

      // in case this component unmounts while anchored (due to data auto-refresh + re-config)
      document.removeEventListener('mousedown', (e) => downEventOutside(u, e), true);
      document.removeEventListener('keydown', (e) => downEventOutside(u, e), true);
    };

    // Only run on config change!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = useCallback(
    (u: uPlot) => {
      // detect shiftKey and mutate drag mode from x-only to y-only
      if (clientZoom) {
        u.over.addEventListener(
          'mousedown',
          (e) => {
            if (!maybeZoomAction(e)) {
              return;
            }

            if (e.button === 0 && e.shiftKey) {
              setYDrag(true);

              if (!u.cursor.drag) {
                throw new Error('[TooltipPlugin2::uPlot::mousedown] cursor drag not defined!');
              }
              u.cursor.drag.x = false;
              u.cursor.drag.y = true;

              const onUp = (_: MouseEvent) => {
                if (!u.cursor.drag) {
                  throw new Error('[TooltipPlugin2::uPlot::mousedown::onUp] cursor drag not defined!');
                }
                u.cursor.drag.x = true;
                u.cursor.drag.y = false;
                document.removeEventListener('mouseup', onUp, true);
              };

              document.addEventListener('mouseup', onUp, true);
            }
          },
          true
        );
      }

      // add zoom-in cursor during drag-to-zoom interaction
      if (queryZoom != null || clientZoom) {
        u.over.addEventListener(
          'mousedown',
          (e) => {
            if (!maybeZoomAction(e)) {
              return;
            }

            if (e.button === 0) {
              u.over.classList.add('zoom-drag');

              const onUp = () => {
                u.over.classList.remove('zoom-drag');
                document.removeEventListener('mouseup', onUp, true);
              };

              document.addEventListener('mouseup', onUp, true);
            }
          },
          true
        );
      }

      // this handles pinning, 0-width range selection, and one-click
      // @todo clean up event listener on uplot destruct
      u.over.addEventListener('click', (e) => onClick(u, e));

      updateWinSize(u);

      onConfigChange(u);
    },
    [clientZoom, onClick, onConfigChange, queryZoom, updateWinSize]
  );

  const plot = usePlotConfigHook(config, 'init', init);
  console.log('plot', plot);

  // @todo don't need to set this to state
  // const updatePlotVisible = useCallback(
  //   (plot: uPlot | null) => {
  //     if (!plot) {
  //       throw new Error('[updatePlotVisible] Plot not initiated!');
  //     }
  //     setPlotVisible(
  //       plot.rect.bottom <= winHgt && plot.rect.top >= 0 && plot.rect.left >= 0 && plot.rect.right <= winWid
  //     );
  //     console.log(
  //       'updatePlotVisible',
  //       plot.rect.bottom <= winHgt && plot.rect.top >= 0 && plot.rect.left >= 0 && plot.rect.right <= winWid
  //     );
  //   },
  //   [winHgt, winWid]
  // );

  // uPlot hooks
  usePlotConfigHook(config, 'setLegend', setLegend);
  usePlotConfigHook(config, 'setSelect', setSelect);
  usePlotConfigHook(config, 'setData', setData);
  usePlotConfigHook(config, 'setSeries', setSeries);
  // usePlotConfigHook(config, 'ready', updatePlotVisible);
  usePlotConfigHook(config, 'setCursor', setCursor);

  // layout effects
  // useLayoutEffect(, [config]);

  useLayoutEffect(() => {
    const size = sizeRef.current;

    if (!size) {
      console.warn('[useLayoutEffect::hover] sizeRef not defined!');
      return;
    }

    size.width = 0;
    size.height = 0;

    if (!domRef.current) {
      console.warn('[useLayoutEffect::hover] domRef not defined!');
      return;
    }
    size.observer.disconnect();
    size.observer.observe(domRef.current);

    // since the above observer is attached after container is in DOM, we need to manually update sizeRef
    // and re-trigger a cursor move to do initial positioning math
    const { width, height } = domRef.current.getBoundingClientRect();
    size.width = width;
    size.height = height;

    // @todo don't mutate this
    let event = plot?.cursor.event;

    // if not viaSync, re-dispatch real event
    if (event != null) {
      // we expect to re-dispatch mousemove, but may have a different event type, so create a mousemove event and fire that instead
      // this doesn't work for every mobile device, so fall back to checking the useragent as well
      const isMobile = event.type !== 'mousemove' || userAgentIsMobile;

      if (isMobile) {
        event = new MouseEvent('mousemove', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: event.clientX,
          clientY: event.clientY,
          screenX: event.screenX,
          screenY: event.screenY,
        });
      }

      // this works around the fact that uPlot does not unset cursor.event (for perf reasons)
      // so if the last real mouse event was mouseleave and you manually trigger u.setCursor()
      // it would end up re-dispatching mouseleave
      const isStaleEvent = isMobile ? false : performance.now() - event.timeStamp > 16;

      !isStaleEvent && plot?.over.dispatchEvent(event);
    } else {
      plot?.setCursor(
        {
          left: plot.cursor.left!,
          top: plot.cursor.top!,
        },
        true
      );
    }
  }, [isHovering, plot]);

  // set tooltip on annotation range state change
  useEffect(() => {
    if (!plot) {
      return;
    }

    setTooltipContent(plot);
  }, [annotationRange, plot, setTooltipContent]);
  // set tooltip on hovering state change
  useEffect(() => {
    if (!plot) {
      return;
    }

    console.log('useEffect::onHover', { isHovering, seriesIdxs, offsetY, offsetX });

    if (isHovering) {
      queueMicrotask(() => setTooltipContent(plot, true));
    } else {
      // @todo delay/debounce (100ms)
      setTooltipContent(plot, false);
    }
  }, [isHovering, plot, seriesIdxs, offsetX, offsetY, yDrag, isPinned, winHgt, winWid, setTooltipContent]);

  const isRenderingTooltip = plot && isHovering;
  console.log('[TooltipPlugin2::RENDER]', { annotationRange, isPinned, isHovering, isRenderingTooltip });

  if (isRenderingTooltip) {
    return createPortal(
      <div
        className={cx(styles.tooltipWrapper, isPinned && styles.pinned)}
        style={style}
        aria-live="polite"
        aria-atomic="true"
        ref={domRef}
      >
        {isPinned && <CloseButton onClick={() => dismiss(plot)} />}
        {content}
      </div>,
      portalRoot.current
    );
  }

  return null;
};

const getStyles = (theme: GrafanaTheme2, maxWidth?: number) => ({
  tooltipWrapper: css({
    top: 0,
    left: 0,
    zIndex: theme.zIndex.tooltip,
    whiteSpace: 'pre',
    borderRadius: theme.shape.radius.default,
    position: 'fixed',
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z2,
    userSelect: 'text',
    maxWidth: maxWidth ?? 'none',
  }),
  pinned: css({
    boxShadow: theme.shadows.z3,
  }),
});
