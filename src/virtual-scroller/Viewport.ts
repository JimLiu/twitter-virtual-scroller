import Rectangle from "./Rectangle";

type ScrollListener = () => void;

type ScrolledByListener = (y: number) => void;

export interface IViewport {
  getRect(): Rectangle;
  getOffsetBottom(): number;
  scrollY(): number;
  scrollBy(y: number): void;
  scrollTo(x: number, y: number): void;
  scrollToTop(): void;
  scrollToBottom(): void;
  addRectChangeListener(listener: ScrollListener): () => void;
  addScrollListener(listener: ScrollListener): () => void;
  addProgrammaticScrollListener(listener: ScrolledByListener): () => void;
}

let rootViewport: WindowViewport;

export class WindowViewport implements IViewport {
  offsetTop: number;
  offsetBottom: number;
  programmaticScrollListeners: ScrolledByListener[];
  window: Window;
  suppressListeners: boolean;

  constructor(window: Window) {
    this.window = window;
    this.programmaticScrollListeners = [];
    this.offsetTop = 0;
    this.offsetBottom = 0;
    this.suppressListeners = false;
  }

  static root() {
    if (!rootViewport) {
      rootViewport = new WindowViewport(window);
    }
    return rootViewport;
  }

  setOffsetTop(top: number) {
    this.offsetTop = top;
  }

  setOffsetBottom(bottom: number) {
    this.offsetBottom = bottom;
  }

  getOffsetTop() {
    return this.offsetTop;
  }

  getOffsetBottom() {
    return this.offsetBottom;
  }

  getRect() {
    const height = this.getHeight();
    return new Rectangle(this.offsetTop, height);
  }

  getWidth() {
    return Math.ceil(this.window.document.documentElement.clientWidth);
  }

  scrollBy(y: number) {
    this.window.scrollBy(0, y);
    this.programmaticScrollListeners.forEach((listener) => listener(y));
  }

  scrollTo(x: number, y: number) {
    const offset = y - this.scrollY();
    this.window.scrollTo(x, y);
    this.programmaticScrollListeners.forEach((listener) => listener(offset));
  }

  scrollToTop() {
    this.scrollTo(0, 0);
  }

  scrollToBottom() {
    this.scrollTo(0, this.getHeight());
  }

  temporarilySuppressScrollListeners(duration: number) {
    this.suppressListeners = true;
    window.setTimeout(() => {
      this.suppressListeners = false;
    }, duration);
  }

  addProgrammaticScrollListener(listener: ScrolledByListener) {
    if (!this.programmaticScrollListeners.includes(listener)) {
      this.programmaticScrollListeners.push(listener);
    }

    return () => {
      this.removeProgrammaticScrollListener(listener);
    };
  }

  removeProgrammaticScrollListener(listener: ScrolledByListener) {
    const index = this.programmaticScrollListeners.indexOf(listener);
    if (index > -1) {
      this.programmaticScrollListeners.splice(index, 1);
    }
  }

  addRectChangeListener(listener: ScrollListener) {
    return this.addListener("resize", listener);
  }

  addScrollListener(listener: ScrollListener) {
    return this.addListener("scroll", () => {
      if (!this.suppressListeners) {
        listener();
      }
    });
  }

  scrollX() {
    return -1 * this.window.document.body.getBoundingClientRect().left;
  }

  scrollY() {
    return -1 * this.window.document.body.getBoundingClientRect().top;
  }

  addListener(name: string, listener: ScrollListener) {
    function listenerWrapper() {
      return listener();
    }

    this.window.addEventListener(name, listenerWrapper);

    return () => {
      this.window.removeEventListener(name, listenerWrapper);
    };
  }

  getHeight() {
    const clientHeight = Math.ceil(
      this.window.document.documentElement.clientHeight
    );
    return Math.max(0, clientHeight - this.offsetTop - this.offsetBottom);
  }
}
