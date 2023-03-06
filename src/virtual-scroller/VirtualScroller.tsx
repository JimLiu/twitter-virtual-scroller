import type { DebouncedFunc } from "lodash";
import throttle from "lodash/throttle";
import React, { createRef, PureComponent, ReactNode } from "react";
import { CustomLocation, RestorationAnchor } from "./CustomLocation";
import { createDataItem, DataItem } from "./DataItem";
import { condition, EdgeProximity, ZoneCallback } from "./EdgeProximity";
import { Positioning, RenderedItem } from "./Positioning";
import Rectangle from "./Rectangle";
import { memoize } from "./utils";
import { IViewport } from "./Viewport";
import {
  AnchorTypes,
  InitialAnchor,
  VirtualScrollerRenderer,
} from "./VirtualScrollerRenderer";

export type VirtualScrollerProps<T> = {
  onAtStart: ZoneCallback;
  onNearStart: ZoneCallback;
  onNearEnd: ZoneCallback;
  onAtEnd: ZoneCallback;
  nearStartProximityRatio: number;
  nearEndProximityRatio: number;
  viewport: IViewport;
  cacheKey: string;
  assumedItemHeight: number;
  customLocation: CustomLocation;
  items: T[];
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  initialAnchor?: RestorationAnchor;
  centerInitialAnchor?: boolean;
  accessibilityRole?: string;
  hasNewContentAtBottom?: boolean;
  withoutHeadroom?: boolean;
  pinToNewestWhenAtNewest?: boolean;
  identityFunction: (data: T) => string;
  sortIndexFunction?: (data: T) => number;
  onItemsRendered?: (data: {
    positions: RenderedItem[];
    viewport: Rectangle;
  }) => void;
  onPositionRestored: () => void;
  noItemsRenderer: () => ReactNode;
  renderer: (data: T) => ReactNode;
  onScrollEnd: () => void;
  onKeyboardRefresh?: () => void;
};

export class VirtualScroller<T extends any> extends PureComponent<
  VirtualScrollerProps<T>
> {
  renderer: React.RefObject<VirtualScrollerRenderer>;

  isModal: boolean;

  edgeProximity: EdgeProximity;

  viewport: IViewport;

  customLocation: CustomLocation;

  scrollRestorationAnchor?: {
    [key: string]: RestorationAnchor | undefined;
  };

  getList: (
    header: ReactNode,
    footer: ReactNode,
    items: T[],
    renderer: (data: T) => ReactNode,
    identityFunction: (data: T) => string,
    sortIndexFunction?: (data: T) => number
  ) => DataItem[];
  handleKeyboardRefresh: DebouncedFunc<() => {}>;
  static defaultProps: {
    customLocation: CustomLocation;
    centerInitialAnchor: boolean;
    hasNewContentAtBottom: boolean;
    onPositionRestored: () => void;
    onAtEnd: () => void;
    onAtStart: () => void;
    onNearEnd: () => void;
    onNearStart: () => void;
    onScrollEnd: () => void;
    nearEndProximityRatio: number;
    nearStartProximityRatio: number;
    noItemsRenderer: () => null;
    assumedItemHeight: number;
    minimumOffscreenToViewportRatio: number;
    preferredOffscreenToViewportRatio: number;
    withoutHeadroom: boolean;
    withKeyboardShortcuts: boolean;
  };

  constructor(props: VirtualScrollerProps<T>) {
    super(props);
    this.renderer = createRef();
    this.isModal = false;
    this.customLocation = props.customLocation;
    this.viewport = props.viewport;
    this.loadStoredPosition(props);

    this.getList = memoize(
      (
        header: ReactNode,
        footer: ReactNode,
        items: T[],
        renderer: (data: T) => ReactNode,
        identityFunction: (data: T) => string,
        sortIndexFunction?: (data: T) => number
      ) => {
        const result: DataItem[] = [];

        header &&
          result.push(createDataItem("$header", "header", () => header, true));

        result.push(
          ...items.map((item) =>
            createDataItem(
              identityFunction(item),
              item,
              renderer,
              true,
              sortIndexFunction?.(item)
            )
          )
        );

        footer &&
          result.push(createDataItem("$footer", "footer", () => footer, true));
        return result;
      }
    );

    this.edgeProximity = new EdgeProximity([
      {
        condition: condition.nearTop(5),
        callback: (data) => this.props.onAtStart(data),
      },
      {
        condition: condition.nearTopRatio(props.nearStartProximityRatio),
        callback: (data) => this.props.onNearStart(data),
      },
      {
        condition: condition.nearBottomRatio(props.nearEndProximityRatio),
        callback: (data) => this.props.onNearEnd(data),
      },
      {
        condition: condition.nearBottom(5),
        callback: (data) => this.props.onAtEnd(data),
      },
    ]);

    this.handleKeyboardRefresh = throttle(() => {
      const { onKeyboardRefresh } = this.props;
      if (!this.shouldPreventKeyboardShortcuts()) {
        onKeyboardRefresh?.();
      }
    }, 1000);

    this.handlePositionUpdate = this.handlePositionUpdate.bind(this);
    this.handleScrollEnd = this.handleScrollEnd.bind(this);
  }

  handleScrollEnd() {
    this.props.onScrollEnd?.();
  }

  handlePositionUpdate(positioning: Positioning) {
    const { onItemsRendered } = this.props;
    this.edgeProximity.handlePositioningUpdate(positioning);
    onItemsRendered?.({
      positions: positioning.getRenderedItems(),
      viewport: positioning.getForViewport(),
    });
    this.preservePosition(this.customLocation);
  }

  shouldPreventKeyboardShortcuts() {
    return !this.isModal;
  }

  handleKeyboardFocusNext() {
    if (this.shouldPreventKeyboardShortcuts()) {
      this.adjustFocusBy(1);
    }
  }

  handleKeyboardFocusPrevious() {
    if (this.shouldPreventKeyboardShortcuts()) {
      this.adjustFocusBy(-1);
    }
  }

  preservePosition(customLocation?: CustomLocation) {
    if (customLocation && this.renderer?.current) {
      const anchors = this.renderer.current.getAnchors();
      customLocation.savePosition(anchors);
    }
  }

  loadStoredPosition(props: VirtualScrollerProps<T>) {
    this.customLocation = props.customLocation;

    const { cacheKey, items, identityFunction } = props;
    let anchors: RestorationAnchor[] = [];

    if (this.customLocation) {
      const savedAnchors = this.customLocation.getSavedPosition() ?? [];
      if (savedAnchors.length > 0) {
        anchors = savedAnchors;
      }
      if (savedAnchors) {
        this.customLocation.claimScrollRestoration();
      }
    }

    const anchor =
      anchors.find(
        ({ id, wasFocused }) =>
          wasFocused && items.some((item) => identityFunction(item) === id)
      ) ??
      anchors.find(({ id }) =>
        items.some((item) => identityFunction(item) === id)
      );

    this.scrollRestorationAnchor = {
      [cacheKey]: anchor,
    };
  }

  isAtNewest() {
    return !this.renderer.current || this.renderer.current.isAtNewest();
  }

  adjustFocusBy(by: number) {
    this.renderer.current?.adjustFocusBy(by);
  }

  scrollToNewest(update: boolean) {
    this.renderer.current?.scrollToNewest(update);
  }

  componentDidMount() {
    const { onPositionRestored } = this.props;
    onPositionRestored();
  }

  componentDidUpdate(prevProps: VirtualScrollerProps<T>) {
    const { cacheKey, onPositionRestored } = this.props;
    if (cacheKey !== prevProps.cacheKey) {
      this.loadStoredPosition(this.props);
      onPositionRestored();
    }
  }

  render() {
    const {
      assumedItemHeight,
      cacheKey,
      footer,
      header,
      identityFunction,
      initialAnchor,
      items,
      noItemsRenderer,
      renderer,
      sortIndexFunction,
      centerInitialAnchor,
      accessibilityRole,
      hasNewContentAtBottom,
      withoutHeadroom,
      pinToNewestWhenAtNewest,
    } = this.props;

    if (!items.length) {
      return noItemsRenderer();
    }

    const restorationAnchor = this.scrollRestorationAnchor?.[cacheKey];
    let anchor: InitialAnchor | undefined;
    if (restorationAnchor) {
      anchor = {
        anchor: restorationAnchor,
        type: AnchorTypes.Anchor,
      };
    } else if (initialAnchor) {
      anchor = {
        itemId: initialAnchor.id,
        type: AnchorTypes.FocusedItem,
      };
    }

    // todo: handle keyboard

    return (
      <VirtualScrollerRenderer
        assumedItemHeight={assumedItemHeight}
        centerInitialAnchor={centerInitialAnchor}
        accessibilityRole={accessibilityRole}
        cacheKey={cacheKey}
        hasNewContentAtBottom={hasNewContentAtBottom}
        initialAnchor={anchor}
        isManualScrollRestoration={
          window.history && window.history.scrollRestoration === "manual"
        }
        key={cacheKey}
        list={this.getList(
          header,
          footer,
          items,
          renderer,
          identityFunction,
          sortIndexFunction
        )}
        onPositionUpdate={this.handlePositionUpdate}
        onScrollEnd={this.handleScrollEnd}
        pinToNewestWhenAtNewest={pinToNewestWhenAtNewest}
        withoutHeadroom={withoutHeadroom}
        ref={this.renderer}
        viewport={this.viewport}
        className={this.props.className}
      />
    );
  }
}

const noop = () => {};

VirtualScroller.defaultProps = {
  centerInitialAnchor: false,
  hasNewContentAtBottom: false,
  customLocation: new CustomLocation(),
  onPositionRestored: noop,
  onAtEnd: noop,
  onAtStart: noop,
  onNearEnd: noop,
  onNearStart: noop,
  onScrollEnd: noop,
  nearEndProximityRatio: 1.75,
  nearStartProximityRatio: 0.25,
  noItemsRenderer: () => null,
  assumedItemHeight: 400,
  minimumOffscreenToViewportRatio: 0.5,
  preferredOffscreenToViewportRatio: 2.5,
  withoutHeadroom: false,
  withKeyboardShortcuts: false,
};
