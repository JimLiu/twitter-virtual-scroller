import React, { Component } from "react";
import isEqual from "lodash/isEqual";
import AnimationContext from "./AnimationContext";
import { DataItem } from "./DataItem";

type VirtualScrollerCellProps = {
  onHeightChanged: (id: string, height: number) => void;
  item: DataItem;
  setAPI: (id: string, target?: VirtualScrollerCell) => void;
  onAnimationStarted: (id: string, translationTransitionStyle: string) => void;
  onAnimationEnded: (id: string) => void;
  visible: boolean;
  shouldAnimate: boolean;
  translationTransitionStyle: string;
  positioningStyle: Record<string, string | undefined>;
  onVisible: (id: string, duration: number) => void;
};

const getTimestamp = () =>
  window.performance ? window.performance.now() : Date.now();

export default class VirtualScrollerCell extends Component<VirtualScrollerCellProps> {
  contentsFocusable = false;

  perfReported = false;

  shouldAnimateTranslate = false;

  currentHeight = 0;

  perfStart: number;

  isAnimationDisabled: boolean;

  shouldUseTopPositioning: boolean;

  resizeObserver: ResizeObserver;

  element?: HTMLDivElement;

  animationContext = {
    onAnimationEnded: this.handleAnimationEnded,
    onAnimationStarted: this.handleAnimationStarted,
    onHeightChanged: this.handleHeightChanged,
  };

  animationTTLTimeoutId?: number | null;

  static defaultProps: { translationTransitionStyle: string };

  constructor(props: VirtualScrollerCellProps) {
    super(props);

    this.perfStart = getTimestamp();

    this.isAnimationDisabled = false;
    this.shouldUseTopPositioning = true;

    this.observeElement = this.observeElement.bind(this);

    this.handleResize = this.handleResize.bind(this);
    this.setRef = this.setRef.bind(this);
    this.setIsItemFocusable = this.setIsItemFocusable.bind(this);
    this.handleAnimationStarted = this.handleAnimationStarted.bind(this);
    this.handleAnimationEnded = this.handleAnimationEnded.bind(this);
    this.handleHeightChanged = this.handleHeightChanged.bind(this);

    this.resizeObserver = new ResizeObserver(this.handleResize);
  }

  observeElement(element: HTMLElement) {
    this.resizeObserver.disconnect();
    this.resizeObserver.observe(element);
  }

  handleResize(elements: ResizeObserverEntry[]) {
    const { onHeightChanged, item } = this.props;
    const [element] = elements;
    const heightChanged =
      (element && Math.floor(element.contentRect.height)) !==
      (this.currentHeight && Math.floor(this.currentHeight));
    if (element && heightChanged) {
      this.currentHeight = element.contentRect.height;
      onHeightChanged(item.id, element.contentRect.height);
    }
    this.recordTTFV();
  }

  setRef(element: HTMLDivElement) {
    const { item, setAPI } = this.props;
    if (element) {
      this.element = element;
      setAPI(item.id, this);
      this.observeElement(element);
    } else {
      setAPI(item.id);
      this.element = undefined;
    }
  }

  setIsItemFocusable(focusable: boolean) {
    this.contentsFocusable = focusable;
  }

  handleAnimationStarted(
    translationTransitionStyle = "transform 0.15s linear"
  ) {
    this.resizeObserver.disconnect();
    this.props.onAnimationStarted(
      this.props.item.id,
      translationTransitionStyle
    );
    if (this.animationTTLTimeoutId) {
      clearTimeout(this.animationTTLTimeoutId);
    }
    this.animationTTLTimeoutId = window.setTimeout(
      this.handleAnimationEnded,
      1000
    );
  }

  handleAnimationEnded() {
    if (this.animationTTLTimeoutId) {
      clearTimeout(this.animationTTLTimeoutId);
      this.animationTTLTimeoutId = null;
    }
    if (this.element) {
      this.observeElement(this.element);
    }
    this.props.onAnimationEnded(this.props.item.id);
  }

  handleHeightChanged(height: number) {
    this.currentHeight = height;
    this.props.onHeightChanged(this.props.item.id, height);
  }

  shouldComponentUpdate(nextProps: VirtualScrollerCellProps) {
    const { item, visible, shouldAnimate, positioningStyle } = this.props;
    this.shouldAnimateTranslate =
      nextProps.positioningStyle !== positioningStyle &&
      nextProps.visible === visible;
    return (
      !isEqual(nextProps.item, item) ||
      this.shouldAnimateTranslate ||
      nextProps.visible !== visible ||
      nextProps.shouldAnimate !== shouldAnimate
    );
  }

  componentWillUnmount() {
    if (this.animationTTLTimeoutId) {
      clearTimeout(this.animationTTLTimeoutId);
      this.props.onAnimationEnded(this.props.item.id);
    }
    this.resizeObserver.disconnect();
  }

  componentDidUpdate(prevProps: VirtualScrollerCellProps) {
    const { item, setAPI } = this.props;
    if (prevProps.item.id !== item.id) {
      setAPI(prevProps.item.id);
      setAPI(item.id, this);
    }
    this.recordTTFV();
  }

  getElement() {
    return this.element;
  }

  isFocusable() {
    return this.contentsFocusable;
  }

  measureHeight() {
    if (!this.currentHeight) {
      this.currentHeight = this.element
        ? this.element.getBoundingClientRect().height
        : 0;
    }
    return this.currentHeight;
  }

  render() {
    const {
      item,
      visible,
      shouldAnimate,
      translationTransitionStyle,
      positioningStyle,
    } = this.props;
    const transition = this.shouldAnimateTranslate
      ? translationTransitionStyle
      : "opacity 0.3s ease-out";

    return (
      <AnimationContext.Provider value={this.animationContext}>
        <div
          ref={this.setRef}
          data-testid="cellInnerDiv"
          style={{
            ...positioningStyle,
            position: "absolute",
            opacity: visible ? undefined : 0.01,
            width: "100%",
            transition:
              shouldAnimate && !this.isAnimationDisabled
                ? transition
                : undefined,
          }}
        >
          {item.render(this.setIsItemFocusable)}
        </div>
      </AnimationContext.Provider>
    );
  }

  recordTTFV() {
    const { item, onVisible, visible } = this.props;
    if (this.currentHeight !== undefined && !this.perfReported && visible) {
      onVisible(item.id, getTimestamp() - this.perfStart);
      this.perfReported = true;
    }
  }
}

VirtualScrollerCell.defaultProps = {
  translationTransitionStyle: "transform 0.15s linear",
};
