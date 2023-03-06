import { Component, createRef } from "react";
import type { DebouncedFunc } from "lodash";
import debounce from "lodash/debounce";
import throttle from "lodash/throttle";
import first from "lodash/first";
import last from "lodash/last";
import isEqual from "lodash/isEqual";
import findLast from "lodash/findLast";
import { memoize } from "./utils";
import Anchor from "./Anchor";
import { DataItem } from "./DataItem";
import { Positioning } from "./Positioning";
import { IViewport, WindowViewport } from "./Viewport";
import VirtualScrollerCell from "./VirtualScrollerCell";
import PositioningContext from "./PositioningContext";
import Rectangle from "./Rectangle";
import { onEnterFullscreen, onExitFullscreen } from "./fullscreen";
import { RestorationAnchor } from "./CustomLocation";

export type InitialAnchor = {
  itemId?: string;
  type: string;
  anchor?: RestorationAnchor;
};

export type Slice = {
  start: number;
  end: number;
};

type FinalRenderedItem = {
  offset: number;
  item: DataItem;
  visible?: boolean;
};

export type VirtualScrollerRendererProps = {
  cacheKey: string;
  list: DataItem[];
  isManualScrollRestoration: boolean;
  initialAnchor?: InitialAnchor;
  centerInitialAnchor: boolean;
  onPositionUpdate: (positioning: Positioning) => void;
  onScrollEnd: () => void;
  analytics?: {
    scribe: (param: object) => void;
  };
  minimumOffscreenToViewportRatio: number;
  preferredOffscreenToViewportRatio: number;
  pinToNewestWhenAtNewest?: boolean;
  assumedItemHeight: number;
  hasNewContentAtBottom: boolean;
  viewport: IViewport;
  withoutHeadroom?: boolean;
  accessibilityRole?: string;
  className?: string;
};

export type VirtualScrollerRendererState = {
  listHeightWithHeadroom: number;
  shouldAnimate: boolean;
  renderedItems: Anchor[];
};

export const AnchorTypes = Object.freeze({
  FocusedItem: "focusedItem",
  Anchor: "anchor",
});

const getCssPixelsWithDpr = ({
  cssPixels,
  dpr,
}: {
  cssPixels: number;
  dpr: number;
}) => Math.ceil(cssPixels * dpr) / dpr;

const shrink = (rect: Rectangle, ratio: number) => {
  const h = ratio * rect.getHeight();
  return new Rectangle(rect.getTop() - h, rect.getHeight() + 2 * h);
};

const heightsCache = new Map<string, Map<string, number>>();
const isIOS = false;
const isSafari = false;

export class VirtualScrollerRenderer extends Component<
  VirtualScrollerRendererProps,
  VirtualScrollerRendererState
> {
  areAnchorsInvalidated = false;
  cells = new Map<string, VirtualScrollerCell>();
  heights: Map<string, number>;
  cellAnimations = new Set<string>();
  cellAnimationStyle = "transform 0.15s linear";
  currentHeadroom = 0;
  shouldUseTopPositioning = true;
  isFullScreened = false;
  isIdle = true;
  pendingHeightUpdates = new Map<string, number>();
  previousScrollPosition = 0;
  renderedItemsStatus = new Set<string>();
  rootRef: React.RefObject<HTMLDivElement>;
  slice: Slice;
  shouldScribeNextScroll = true;
  visibilityMeasurements = new Map<string, number>();
  isInitialAnchoring?: boolean;
  hasUserChangedFocus?: boolean;
  wasPreviouslyAtNewestEnd: boolean;
  activeEntryId?: string;
  updateScrollEnd: DebouncedFunc<() => void>;
  viewport: IViewport;
  previousItemMap?: Map<string, DataItem>;
  devicePixelRatio = window.devicePixelRatio || 1;
  getPositioningContext: (heightsReady: boolean) => { heightsReady: boolean };
  getItemMapMemoized: (list: DataItem[]) => Map<string, DataItem>;
  getFinalRenderedItemsMemoized: (
    list: DataItem[],
    renderedItems: Anchor[]
  ) => FinalRenderedItem[];

  static defaultProps: {
    centerInitialAnchor: boolean;
    nearEndProximityRatio: number;
    nearStartProximityRatio: number;
    assumedItemHeight: number;
    hasNewContentAtBottom: boolean;
    minimumOffscreenToViewportRatio: number;
    preferredOffscreenToViewportRatio: number;
  };

  scheduleCriticalUpdate: () => number;
  scheduleUpdate: () => number;
  scheduleUpdateDebounced: DebouncedFunc<() => number>;
  scheduleCriticalUpdateThrottled: DebouncedFunc<() => void>;
  removeViewportResizeHandler: () => void;
  removeScrollHandler: any;
  removeProgrammaticScrollHandler: any;
  removeFullscreenEnterHandler: any;
  removeFullscreenExitHandler: any;

  // static contextType = ViewportContext;

  constructor(props: VirtualScrollerRendererProps) {
    super(props);
    this.rootRef = createRef<HTMLDivElement>();
    this.slice = {
      start: 0,
      end: 0,
    };
    this.viewport = props.viewport;
    this.wasPreviouslyAtNewestEnd = !props.initialAnchor;

    this.state = {
      renderedItems: [],
      listHeightWithHeadroom: 0,
      shouldAnimate: false,
    };

    const { cacheKey } = props;

    if (cacheKey && heightsCache.has(cacheKey)) {
      this.heights = heightsCache.get(cacheKey) ?? new Map<string, number>();
    } else {
      this.heights = new Map<string, number>();
      heightsCache.set(cacheKey, this.heights);
    }

    this.update = this.update.bind(this);

    this.scheduleCriticalUpdate = () =>
      window.requestAnimationFrame(() => this.update());

    this.scheduleCriticalUpdate = () =>
      window.requestAnimationFrame(() => this.update());

    this.scheduleUpdate = window.requestIdleCallback
      ? () => window.requestIdleCallback(() => this.update())
      : this.scheduleCriticalUpdate;

    this.scheduleCriticalUpdateThrottled = throttle(
      () => {
        this.scheduleCriticalUpdate();
      },
      100,
      { trailing: true }
    );

    this.scheduleUpdateDebounced = debounce(this.scheduleUpdate, 250);

    this.updateScrollEnd = debounce(() => {
      const { onScrollEnd } = this.props;
      this.previousScrollPosition = this.viewport.scrollY();
      this.isIdle = true;
      onScrollEnd();
      this.scheduleCriticalUpdate();
    }, 200);

    this.getPositioningContext = memoize((heightsReady: boolean) => ({
      heightsReady,
    }));

    this.getItemMapMemoized = memoize((list: DataItem[]) => {
      const map = new Map<string, DataItem>();
      list.forEach((item) => {
        map.set(item.id, item);
      });
      return map;
    });

    this.getFinalRenderedItemsMemoized = memoize(
      (list: DataItem[], renderedItems: Anchor[]) => {
        const itemsMap = this.getItemMapMemoized(list);
        return renderedItems.reduce((acc, renderedItem) => {
          const { itemId, ...rest } = renderedItem;
          const item = itemsMap.get(itemId);
          if (item) {
            acc.push({
              ...rest,
              item,
            });
          }
          return acc;
        }, [] as FinalRenderedItem[]);
      }
    );

    this.removeViewportResizeHandler = this.viewport.addRectChangeListener(
      this.scheduleCriticalUpdateThrottled
    );

    this.setItemRef = this.setItemRef.bind(this);
    this.handleHeightChanged = this.handleHeightChanged.bind(this);
    this.handleItemVisible = this.handleItemVisible.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleProgrammaticScroll = this.handleProgrammaticScroll.bind(this);
    this.handleEnterFullscreen = this.handleEnterFullscreen.bind(this);
    this.handleExitFullscreen = this.handleExitFullscreen.bind(this);
    this.handleAnimationEnded = this.handleAnimationEnded.bind(this);
    this.handleAnimationStarted = this.handleAnimationStarted.bind(this);
  }

  handleScroll() {
    this.wasPreviouslyAtNewestEnd = this.isAtNewest();
    if (this.isInitialAnchoring || this.viewport.scrollY() < 0) {
      return;
    }
    this.isIdle = false;
    this.updateScrollEnd();
    this.scheduleCriticalUpdateThrottled();
  }

  handleProgrammaticScroll() {
    this.shouldScribeNextScroll = false;
  }

  handleEnterFullscreen() {
    this.isFullScreened = true;
  }

  handleExitFullscreen() {
    this.isFullScreened = false;
    this.scheduleCriticalUpdate();
  }

  getInitialRenderedItems() {
    const { centerInitialAnchor, initialAnchor, list } = this.props;
    const renderedItems: Anchor[] = [];
    if (!initialAnchor) {
      return renderedItems;
    }

    if (initialAnchor.type === AnchorTypes.FocusedItem) {
      let offset = 0;
      if (centerInitialAnchor) {
        const vh = this.getDocumentViewportHeight();
        const h = this.getHeightForItemId(initialAnchor.itemId);
        offset = Math.ceil(vh / 2) - h / 2;
      }
      const item = list.find((it) => it.id === initialAnchor.itemId);
      if (item) {
        renderedItems.push(new Anchor(item.id, offset, true, item.canBeAnchor));
      }
    } else if (
      initialAnchor.type === AnchorTypes.Anchor &&
      typeof initialAnchor.anchor?.distanceToViewportTop === "number"
    ) {
      const { anchor } = initialAnchor;
      const viewportHeight = this.getDocumentViewportHeight();
      let offset = anchor.distanceToViewportTop || 0;
      let index = list.findIndex((item) => item.id === anchor.id);
      let i = index;
      for (; i > -1 && i < list.length && offset < viewportHeight; ) {
        const item = list[i];
        const height = this.heights.get(item.id);
        if (typeof height !== "number") {
          break;
        }

        renderedItems.push(new Anchor(item.id, offset, true, item.canBeAnchor));

        offset += height;
        i += 1;
      }

      offset = anchor.distanceToViewportTop || 0;
      i = index - 1;
      for (; i > -1 && offset > 0; ) {
        const item = list[i];
        const height = this.heights.get(item.id);
        if (typeof height !== "number") {
          break;
        }
        offset -= height;
        renderedItems.unshift(
          new Anchor(item.id, offset, true, item.canBeAnchor)
        );
        i -= 1;
      }
    }
    return renderedItems;
  }

  getViewportOffsetCorrection() {
    const rect = this.rootRef.current?.getBoundingClientRect();
    if (!rect || !this.viewport) {
      return 0;
    }

    const top =
      this.viewport instanceof WindowViewport
        ? 0
        : this.viewport.getRect().getTop();

    return getCssPixelsWithDpr({
      cssPixels: rect.top - top,
      dpr: this.devicePixelRatio,
    });
  }

  getAnchors(): RestorationAnchor[] {
    const rect = this.rootRef?.current?.getBoundingClientRect();
    const viewportRect = this.measureRelativeViewportRect();
    if (rect && viewportRect) {
      return this.getItemsWithin(viewportRect)
        .filter((listItem) => listItem.item.canBeAnchor)
        .map((listItem) => ({
          id: listItem.item.id,
          distanceToViewportTop: getCssPixelsWithDpr({
            cssPixels: listItem.offset + this.getViewportOffsetCorrection(),
            dpr: this.devicePixelRatio,
          }),
          wasFocused:
            this.hasUserChangedFocus && listItem.item.id === this.activeEntryId,
        }));
    }
    return [];
  }

  update() {
    const rect = this.measureRelativeViewportRect();
    if (!rect) {
      return;
    }

    if (this.isFullScreened) {
      return;
    }

    const anchor = this.getAnchor(rect);
    this.measureHeights();

    if (anchor) {
      this.updateRenderedItems(anchor, rect);
      this.areAnchorsInvalidated = false;
    }
  }

  getItemsWithPositions(anchor: Anchor) {
    const { list } = this.props;
    const distance = this.getDistanceFromTop(anchor.itemId);
    let offset = anchor.offset - distance;
    const anchors: Anchor[] = [];
    list.forEach((item) => {
      const height = this.getHeight(item);
      anchors.push(
        new Anchor(
          item.id,
          offset,
          this.heights.has(item.id),
          item.canBeAnchor,
          height
        )
      );
      offset += height;
    });
    return anchors;
  }

  getSliceForCandidates(visibileItems: Anchor[], items: Anchor[]) {
    const firstItem = first(visibileItems);
    const lastItem = last(visibileItems);

    return {
      start: firstItem ? items.indexOf(firstItem) : 0,
      end: lastItem ? items.indexOf(lastItem) + 1 : 0,
    };
  }

  getRenderCandidates(anchor: Anchor, relativeViewportRect: Rectangle) {
    const {
      minimumOffscreenToViewportRatio,
      preferredOffscreenToViewportRatio,
    } = this.props;
    const minimumOffscreenToViewport = shrink(
      relativeViewportRect,
      minimumOffscreenToViewportRatio
    );
    const preferredOffscreenToViewport = shrink(
      relativeViewportRect,
      preferredOffscreenToViewportRatio
    );
    const arePreferredItemsRendered = this.isIdle && !this.isInitialAnchoring;
    const allItemsWithPositions = this.getItemsWithPositions(anchor);
    const visibileItems = allItemsWithPositions.filter((anchor) =>
      this.getRenderedItemRectInViewport(anchor).doesIntersectWith(
        arePreferredItemsRendered
          ? preferredOffscreenToViewport
          : minimumOffscreenToViewport
      )
    );

    const sliceForCandidates = this.getSliceForCandidates(
      visibileItems,
      allItemsWithPositions
    );

    const getSlice = (): Slice => {
      if (arePreferredItemsRendered) {
        return sliceForCandidates;
      }
      if (
        sliceForCandidates.start >= this.slice.start &&
        sliceForCandidates.end <= this.slice.end &&
        this.slice.end - this.slice.start <= 50
      ) {
        return this.slice;
      }

      if (
        sliceForCandidates.start >= this.slice.end ||
        sliceForCandidates.end <= this.slice.start
      ) {
        return sliceForCandidates;
      }

      const minimumOffscreenToViewportRatio = Math.max(
        this.slice.start - sliceForCandidates.start,
        sliceForCandidates.end - this.slice.end,
        0
      );

      return {
        start: Math.min(
          this.slice.start + minimumOffscreenToViewportRatio,
          sliceForCandidates.start
        ),
        end: Math.max(
          this.slice.end - minimumOffscreenToViewportRatio,
          sliceForCandidates.end
        ),
      };
    };

    const slice = getSlice();

    const newRenderedItems: Anchor[] = allItemsWithPositions.slice(
      slice.start,
      slice.end
    );

    return {
      allItemsWithPositions,
      newRenderedItems,
      slice,
      arePreferredItemsRendered,
    };
  }

  getIsHeightsReady(items: Anchor[]) {
    return items.some(({ itemId }) => this.heights.has(itemId));
  }

  getHeightBetweenItems(first: Anchor | undefined, last: Anchor | undefined) {
    if (first && last) {
      return (
        this.getRenderedItemRectInViewport(last).getBottom() -
        this.getRenderedItemRectInViewport(first).getTop()
      );
    }
    return 0;
  }

  getRenderedItemRectInViewport(anchor: Anchor) {
    return anchor.getRectInViewport();
  }

  updateRenderedItems(anchor: Anchor, relativeViewportRect: Rectangle) {
    const {
      newRenderedItems,
      allItemsWithPositions,
      arePreferredItemsRendered,
      slice,
    } = this.getRenderCandidates(anchor, relativeViewportRect);
    const hasAnimations = this.cellAnimations.size !== 0;
    const normalize = this.shouldNormalize(anchor);
    const firstItem = first(allItemsWithPositions);
    const lastItem = last(allItemsWithPositions);
    const height = this.getHeightBetweenItems(firstItem, lastItem);
    const listHeightWithHeadroom =
      height +
      this.calculateHeadroom(allItemsWithPositions, relativeViewportRect);
    const heightsReady = this.getIsHeightsReady(newRenderedItems);
    const isNotSafariOrIOS = !(isSafari || isIOS);
    const readyForMeasuring =
      (!hasAnimations &&
        heightsReady &&
        (this.isIdle ||
          isNotSafariOrIOS ||
          listHeightWithHeadroom <= relativeViewportRect.getHeight())) ||
      (heightsReady && this.isInitialAnchoring);
    let renderedItems = newRenderedItems;
    this.slice = slice;
    if (heightsReady) {
      this.isInitialAnchoring = false;
    }
    if (normalize && readyForMeasuring) {
      const { offset, renderedItems: normalizationItems } = this.normalization(
        anchor,
        newRenderedItems
      );
      renderedItems = normalizationItems;
      this.setState(
        {
          renderedItems,
          listHeightWithHeadroom,
          shouldAnimate: !normalize,
        },
        () => {
          let rect: Rectangle | undefined = relativeViewportRect;
          if (offset !== 0) {
            this.viewport.scrollBy(-offset);
            rect = this.measureRelativeViewportRect();
          }
          if (rect) {
            this.updatePositioning({
              renderedItems,
              relativeViewportRect: rect,
              firstItem,
              newListHeight: height,
            });
          }
        }
      );
    } else
      this.setState(
        {
          renderedItems: newRenderedItems,
          listHeightWithHeadroom,
          shouldAnimate: true,
        },
        () => {
          if (normalize || !arePreferredItemsRendered) {
            this.scheduleUpdateDebounced();
          }

          this.updatePositioning({
            renderedItems,
            relativeViewportRect,
            firstItem,
            newListHeight: height,
          });
        }
      );
  }

  updatePositioning({
    renderedItems,
    relativeViewportRect,
    firstItem,
    newListHeight,
  }: {
    renderedItems: Anchor[];
    relativeViewportRect: Rectangle;
    firstItem?: Anchor;
    newListHeight: number;
  }) {
    const { list, onPositionUpdate } = this.props;
    if (!this.getIsHeightsReady(renderedItems)) {
      return;
    }

    onPositionUpdate(
      new Positioning({
        viewportRect: relativeViewportRect,
        listRect: new Rectangle(
          firstItem
            ? this.getRenderedItemRectInViewport(firstItem).getTop()
            : 0,
          newListHeight
        ),
        listLength: list.length,
        renderedItems: renderedItems.map((item) => ({
          id: item.itemId,
          rectangle: new Rectangle(
            item.offset,
            this.getHeightForItemId(item.itemId)
          ),
        })),
      })
    );
  }

  shouldNormalize(anchor: Anchor): boolean {
    if (this.props.hasNewContentAtBottom) {
      return this.getListOffset(anchor) - this.currentHeadroom !== 0;
    }
    return 0 !== this.getListOffset(anchor);
  }

  normalization(anchor: Anchor, renderedItems: Anchor[]) {
    const offset = this.getListOffset(anchor);

    return {
      offset,
      renderedItems: renderedItems.map(
        (item) =>
          new Anchor(
            item.itemId,
            item.offset - offset,
            item.visible,
            item.canBeAnchor
          )
      ),
    };
  }

  calculateHeadroom(positions: Anchor[], relativeViewportRect: Rectangle) {
    const { withoutHeadroom, centerInitialAnchor, hasNewContentAtBottom } =
      this.props;
    if (withoutHeadroom) {
      this.currentHeadroom = 0;
      return 0;
    }

    if (centerInitialAnchor) {
      return (
        this.calculateTopHeadroom(positions, relativeViewportRect) +
        this.calculateBottomHeadroom(positions, relativeViewportRect)
      );
    }

    if (hasNewContentAtBottom) {
      return this.calculateTopHeadroom(positions, relativeViewportRect);
    }

    return this.calculateBottomHeadroom(positions, relativeViewportRect);
  }

  calculateBottomHeadroom(
    positions: Anchor[],
    relativeViewportRect: Rectangle
  ) {
    const lastPositionCanBeAnchor = findLast(
      positions,
      (item) => item.canBeAnchor
    );
    const lastPosition = last(positions);
    if (!lastPosition) {
      this.currentHeadroom = 0;
      return 0;
    }

    const height =
      this.getRenderedItemRectInViewport(lastPosition).getBottom() -
      this.getRenderedItemRectInViewport(
        lastPositionCanBeAnchor ?? lastPosition
      ).getTop();
    this.currentHeadroom = Math.max(
      0,
      relativeViewportRect.getHeight() -
        height +
        this.viewport.getOffsetBottom()
    );
    return this.currentHeadroom;
  }

  calculateTopHeadroom(positions: Anchor[], relativeViewportRect: Rectangle) {
    const lastPositionCanBeAnchor = findLast(
      positions,
      (item) => item.canBeAnchor
    );

    const firstPosition = first(positions);
    if (!firstPosition) {
      this.currentHeadroom = 0;
      return 0;
    }
    const height =
      this.getRenderedItemRectInViewport(
        lastPositionCanBeAnchor ?? firstPosition
      ).getBottom() -
      this.getRenderedItemRectInViewport(firstPosition).getTop();
    const space =
      this.getDocumentViewportHeight() - relativeViewportRect.getHeight();
    this.currentHeadroom = Math.max(
      0,
      relativeViewportRect.getHeight() - height - space
    );
    return this.currentHeadroom;
  }

  getListOffset(anchor: Anchor) {
    const { hasNewContentAtBottom } = this.props;
    if (!anchor) {
      return hasNewContentAtBottom ? this.currentHeadroom : 0;
    }

    const distance = this.getDistanceFromTop(anchor.itemId);
    const offset = anchor.offset - distance;
    if (hasNewContentAtBottom) {
      return offset - this.currentHeadroom;
    }
    return offset;
  }

  getAnchorItemCandidates() {
    const items = this.getFinalRenderedItems().filter(
      ({ item }) =>
        item.canBeAnchor &&
        (this.isInitialAnchoring || !!this.heights.get(item.id))
    );

    return items;
  }

  shouldPinToNewest() {
    return (
      !this.isInitialAnchoring &&
      !!this.props.pinToNewestWhenAtNewest &&
      this.isAtNewest()
    );
  }

  getAnchor(viewportRect: Rectangle) {
    const { hasNewContentAtBottom, centerInitialAnchor, list } = this.props;
    if (this.shouldPinToNewest() && !centerInitialAnchor) {
      if (hasNewContentAtBottom) {
        const item = last(this.state.renderedItems);
        return item ? new Anchor(item.itemId, item.offset) : undefined;
      }
      const item = first(list);
      return item ? new Anchor(item.id) : undefined;
    }

    const isVisible = (rect: Rectangle) => {
      const visibleHeight = Math.max(
        0,
        Math.min(rect.getBottom(), viewportRect.getBottom()) -
          Math.max(rect.getTop(), viewportRect.getTop())
      );
      return (rect.getHeight() > 0 ? visibleHeight / rect.getHeight() : 0) >
        0.01
        ? 1
        : 0;
    };
    const getVisibleHeight = (rect: Rectangle) =>
      rect.getBottom() - viewportRect.getTop();
    const candidates = this.getAnchorItemCandidates();
    const bestCandidate = findTheBest(candidates, (item1, item2) => {
      const rect1 = new Rectangle(item1.offset, this.getHeight(item1.item));
      const rect2 = new Rectangle(item2.offset, this.getHeight(item2.item));
      return (
        isVisible(rect1) - isVisible(rect2) ||
        getVisibleHeight(rect2) - getVisibleHeight(rect1)
      );
    });

    if (bestCandidate) {
      return new Anchor(bestCandidate.item.id, bestCandidate.offset);
    }

    const firstCandidate = first(candidates);
    if (firstCandidate) {
      return new Anchor(firstCandidate.item.id, firstCandidate.offset);
    }

    const firstItem = first(list);
    return firstItem ? new Anchor(firstItem.id) : undefined;
  }

  measureRelativeViewportRect() {
    const rootElement = this.rootRef?.current;
    if (rootElement) {
      return this.viewport
        .getRect()
        .translateBy(-rootElement.getBoundingClientRect().top);
    }
    return undefined;
  }

  getHeight(item: DataItem) {
    return this.getHeightForItemId(item.id);
  }

  getHeightForItemId(id: string | undefined) {
    const { assumedItemHeight } = this.props;
    const heightStored = id !== undefined ? this.heights.get(id) : undefined;
    const height =
      typeof heightStored === "number" ? heightStored : assumedItemHeight;

    return getCssPixelsWithDpr({
      cssPixels: height,
      dpr: this.devicePixelRatio,
    });
  }

  getDistanceFromTop(id: string) {
    const { list } = this.props;
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) {
      return list
        .slice(0, index)
        .reduce((distance, item) => this.getHeight(item) + distance, 0);
    }
    return 0;
  }

  getItemsWithin(viewportRect: Rectangle) {
    return this.getFinalRenderedItems().filter(({ item, offset }) =>
      new Rectangle(offset, this.getHeight(item)).doesIntersectWith(
        viewportRect
      )
    );
  }

  measureHeights() {
    this.cells.forEach((cell, id) => {
      this.heights.set(id, cell.measureHeight());
    });
  }

  handleAnimationStarted(id: string, cellAnimationStyle: string) {
    this.cellAnimations.add(id);
    if (cellAnimationStyle) {
      this.cellAnimationStyle = cellAnimationStyle;
    }
  }

  handleAnimationEnded(id: string) {
    this.cellAnimations.delete(id);
    this.cellAnimationStyle = "transform 0.15s linear";
  }

  handleItemVisible(id: string, duration: number) {
    if (!this.visibilityMeasurements.has(id)) {
      this.visibilityMeasurements.set(id, duration);
    }
  }

  reportVisibilityMeasurements() {
    if (!this.visibilityMeasurements.size) {
      return;
    }

    let total = 0;
    this.visibilityMeasurements.forEach((duration) => (total += duration));

    this.visibilityMeasurements.clear();
  }

  updateItemHeight(id: string, height: number) {
    this.pendingHeightUpdates.set(id, height);
    const { renderedItems } = this.state;
    if (
      renderedItems.some(
        ({ itemId }) =>
          this.heights.has(itemId) ||
          this.pendingHeightUpdates.has(itemId) ||
          this.pendingHeightUpdates.size > 50
      )
    ) {
      this.update();
      this.pendingHeightUpdates.clear();
    }
  }

  handleHeightChanged(id: string, height: number) {
    if (this.heights.get(id) === height) {
      return;
    }
    if (this.cellAnimations.has(id)) {
      this.scheduleCriticalUpdate();
    } else {
      this.updateItemHeight(id, height);
    }
  }

  setItemRef(id: string, ref?: VirtualScrollerCell) {
    if (ref) {
      this.cells.set(id, ref);
      this.renderedItemsStatus.add(id);
    } else {
      this.cells.delete(id);
      this.renderedItemsStatus.delete(id);
    }
  }

  getRenderedItemsWithFocusability() {
    return this.getFinalRenderedItems().map(({ item, visible }) => {
      const i = this.cells.get(item.id);
      return {
        id: item.id,
        focusable: !(!i || !i.isFocusable()),
        visible: visible,
      };
    });
  }

  findNewestVisibleId() {
    const rect = this.measureRelativeViewportRect();
    if (!rect) {
      return undefined;
    }

    const renderedItem = this.getFinalRenderedItems().find(({ item, offset }) =>
      new Rectangle(offset, this.getHeight(item)).doesIntersectWith(rect)
    );
    return renderedItem?.item.id;
  }

  adjustFocusBy(by: number) {
    this.hasUserChangedFocus = true;
    const renderedItems = this.getRenderedItemsWithFocusability();
    let itemId: string | undefined = undefined;
    if (this.activeEntryId) {
      const activeIndex = renderedItems.findIndex(
        (item) => item.id === this.activeEntryId
      );
      if (activeIndex >= 0) {
        itemId = this.activeEntryId;
        for (
          let i = activeIndex + by;
          i >= 0 && i < renderedItems.length;
          i += by
        ) {
          if (renderedItems[i].focusable) {
            itemId = renderedItems[i].id;
            break;
          }
        }
      }
    }

    if (!itemId) {
      const newestId = this.findNewestVisibleId();
      if (newestId) {
        const newestIndex = renderedItems.findIndex(
          (item) => (item.id = newestId)
        );
        if (newestIndex >= 0) {
          const item = renderedItems.find(
            (item, i) => i >= newestIndex && item.focusable
          );
          itemId = item?.id ?? findFocusableId(renderedItems);
        }
      } else {
        itemId = findFocusableId(renderedItems);
      }
    }

    if (itemId) {
      this.updateFocusToItem(itemId);
    }
  }

  updateFocusToItem(itemId: string, options?: ScrollIntoViewOptions) {
    if (itemId === this.activeEntryId) {
      return;
    }
    const visibleItem = this.getRenderedItemsWithFocusability().find(
      (item) => item.visible && item.id === itemId
    );
    const cell = this.cells.get(itemId);
    const element = cell && cell.getElement();
    if (!visibleItem) {
      return;
    }

    this.activeEntryId = itemId;
    if (!element) {
      return;
    }

    const link = element.querySelector("a, [tabindex='0']");
    if (link) {
      link.scrollIntoView(options);
      const viewport = /*this.context.viewport ??*/ WindowViewport.root();
      const top = viewport.getRect().getTop();
      if (top > 0) {
        window.scrollBy(0, -1 * top);
      }
    }
  }

  scrollToNewest(update: boolean = false) {
    this.hasUserChangedFocus = true;

    this.props.hasNewContentAtBottom
      ? this.viewport.scrollTo(0, this.state.listHeightWithHeadroom)
      : this.viewport.scrollToTop();
    if (!update) {
      return;
    }
    this.update();

    window.setImmediate(() => {
      const renderedItems = this.getRenderedItemsWithFocusability();
      const focusableId = findFocusableId(renderedItems);
      if (focusableId) {
        this.updateFocusToItem(focusableId, {
          block: "nearest",
        });
      }
    });
  }

  isAtNewest() {
    const rect = this.measureRelativeViewportRect();
    if (!rect) {
      return true;
    }

    if (this.props.hasNewContentAtBottom) {
      return rect.getBottom() >= this.state.listHeightWithHeadroom - 50;
    }

    return rect.getTop() <= 50;
  }

  getDocumentViewportHeight() {
    return document.documentElement?.clientHeight || 0;
  }

  getFinalRenderedItems() {
    const { list } = this.props;
    const { renderedItems } = this.state;
    return this.getFinalRenderedItemsMemoized(list, renderedItems);
  }

  render() {
    const { listHeightWithHeadroom, shouldAnimate, renderedItems } = this.state;
    const heightsReady = this.getIsHeightsReady(renderedItems);

    return (
      <PositioningContext.Provider
        value={this.getPositioningContext(heightsReady)}
      >
        <div
          ref={this.rootRef}
          role={this.props.accessibilityRole}
          style={{
            position: "relative",
            minHeight: listHeightWithHeadroom,
          }}
          className={this.props.className}
        >
          {this.getFinalRenderedItems().map(({ item, offset, visible }) => (
            <VirtualScrollerCell
              item={item}
              key={item.id}
              positioningStyle={{
                top: this.shouldUseTopPositioning ? `${offset}px` : undefined,
                transform: this.shouldUseTopPositioning
                  ? undefined
                  : `translateY(${offset}px)`,
              }}
              onAnimationEnded={this.handleAnimationEnded}
              onAnimationStarted={this.handleAnimationStarted}
              onHeightChanged={this.handleHeightChanged}
              onVisible={this.handleItemVisible}
              setAPI={this.setItemRef}
              shouldAnimate={shouldAnimate}
              translationTransitionStyle={this.cellAnimationStyle}
              visible={visible ?? true}
            />
          ))}
        </div>
      </PositioningContext.Provider>
    );
  }

  shouldComponentUpdate(
    nextProps: VirtualScrollerRendererProps,
    nextState: VirtualScrollerRendererState
  ) {
    return !isEqual(this.props, nextProps) || !isEqual(this.state, nextState);
  }

  componentDidUpdate(prevProps: VirtualScrollerRendererProps) {
    if (prevProps.list === this.props.list) {
      return;
    }
    if (!this.isInitialAnchoring) {
      this.previousItemMap = new Map();
      prevProps.list.forEach((item) => {
        this.previousItemMap?.set(item.id, item);
      });
      this.areAnchorsInvalidated = true;
    }
    this.scheduleCriticalUpdate();
    if (prevProps.cacheKey !== this.props.cacheKey) {
      this.hasUserChangedFocus = false;
    }

    if (
      this.wasPreviouslyAtNewestEnd &&
      this.props.list.find((item) => item.id === "typingIndicator") &&
      this.getHeightForItemId("typingIndicator") > 0 &&
      !this.props.centerInitialAnchor
    ) {
      this.scrollToNewest();
    }
  }

  componentDidMount() {
    const { initialAnchor, isManualScrollRestoration, centerInitialAnchor } =
      this.props;
    this.removeScrollHandler = this.viewport.addScrollListener(
      this.handleScroll
    );
    this.removeProgrammaticScrollHandler =
      this.viewport.addProgrammaticScrollListener(
        this.handleProgrammaticScroll
      );
    this.removeFullscreenEnterHandler = onEnterFullscreen(
      this.handleEnterFullscreen
    );
    this.removeFullscreenExitHandler = onExitFullscreen(
      this.handleExitFullscreen
    );

    const renderedItems = this.getInitialRenderedItems();
    if (isManualScrollRestoration) {
      this.viewport.scrollBy(-1);
    }
    this.isInitialAnchoring = true;
    if (renderedItems.length > 0) {
      const listHeightWithHeadroom = this.getDocumentViewportHeight();
      this.setState(
        {
          renderedItems,
          shouldAnimate: true,
          listHeightWithHeadroom,
        },
        () => {
          if (initialAnchor && initialAnchor.type === AnchorTypes.Anchor) {
            this.viewport.scrollBy(this.getViewportOffsetCorrection());
            if (initialAnchor.anchor?.wasFocused) {
              this.updateFocusToItem(initialAnchor.anchor.id);
            }
          } else if (
            initialAnchor &&
            initialAnchor.type === AnchorTypes.FocusedItem &&
            initialAnchor.itemId
          ) {
            const options: ScrollIntoViewOptions | undefined =
              centerInitialAnchor
                ? {
                    behavior: "smooth",
                    block: "center",
                  }
                : undefined;
            this.updateFocusToItem(initialAnchor.itemId, options);
          }

          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => this.scheduleCriticalUpdate())
          );
        }
      );
    } else {
      this.update();
    }
  }

  componentWillUnmount() {
    this.removeScrollHandler?.();
    this.removeProgrammaticScrollHandler?.();
    this.removeFullscreenEnterHandler?.();
    this.removeFullscreenExitHandler?.();
    this.removeViewportResizeHandler?.();
    this.reportVisibilityMeasurements();
  }
}

const findFocusableId = (items: any[]) =>
  items.find((item) => item.focusable)?.id;

function findTheBest<T>(items: T[], compare: (item1: T, item2: T) => number) {
  if (!items.length) {
    return undefined;
  }

  return items.reduce((acc, item) => (compare(item, acc) > 0 ? item : acc));
}

VirtualScrollerRenderer.defaultProps = {
  centerInitialAnchor: false,
  nearEndProximityRatio: 1.75,
  nearStartProximityRatio: 0.25,
  assumedItemHeight: 400,
  hasNewContentAtBottom: false,
  minimumOffscreenToViewportRatio: 0.5,
  preferredOffscreenToViewportRatio: 2.5,
};
