import Rectangle from "./Rectangle";

export default class Anchor {
  itemId: string;

  offset: number;

  visible: boolean;

  canBeAnchor: boolean;

  height: number;

  constructor(
    itemId: string,
    offset: number = 0,
    visible: boolean = false,
    canBeAnchor: boolean = false,
    height: number = 0
  ) {
    this.itemId = itemId;
    this.offset = offset;
    this.visible = visible;
    this.canBeAnchor = canBeAnchor;
    this.height = height;
  }

  getRectInViewport() {
    return new Rectangle(this.offset, this.height);
  }
}
