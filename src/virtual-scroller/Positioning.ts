import Rectangle from "./Rectangle";

export type RenderedItem = {
  id: string;
  rectangle: Rectangle;
};

export class Positioning {
  viewportRect: Rectangle;
  listRect: Rectangle;
  listLength: number;
  renderedItems: RenderedItem[];

  constructor(data: {
    listLength: number;
    listRect: Rectangle;
    renderedItems: RenderedItem[];
    viewportRect: Rectangle;
  }) {
    this.viewportRect = data.viewportRect;
    this.listRect = data.listRect;
    this.listLength = data.listLength;
    this.renderedItems = data.renderedItems;
  }

  getForList() {
    return this.listRect;
  }

  getForViewport() {
    return this.viewportRect;
  }

  getListLength() {
    return this.listLength;
  }

  getRenderedItems() {
    return this.renderedItems;
  }
}
