function doesIntersect(top1: number, top2: number, bottom: number) {
  return top1 >= top2 && top1 < bottom;
}

/**
 * A rectangle class
 */
export default class Rectangle {
  top: number;

  height: number;

  constructor(top: number, height: number) {
    this.top = top;
    this.height = height;
  }

  /**
   * Get the top of the rectangle
   */
  getTop() {
    return this.top;
  }

  /**
   * Get the bottom of the rectangle
   */
  getBottom() {
    return this.top + this.height;
  }

  getCenter() {
    return this.top + this.height / 2;
  }

  /**
   * Get the height of the rectangle
   */
  getHeight() {
    return this.height;
  }

  /**
   * Check if this rectangle intersect with
   * the target rectangle
   * @param {*Rectangle} target
   */
  doesIntersectWith(target: Rectangle) {
    const top1 = this.getTop();
    const bottom1 = this.getBottom();
    const top2 = target.getTop();
    const bottom2 = target.getBottom();
    return (
      doesIntersect(top1, top2, bottom2) || doesIntersect(top2, top1, bottom1)
    );
  }

  /**
   * Translate the top by offset
   * Return a new rectangle
   * @param {*number} offset
   */
  translateBy(offset: number) {
    return new Rectangle(this.getTop() + offset, this.getHeight());
  }

  contains(top: number) {
    return doesIntersect(top, this.getTop(), this.getBottom());
  }
}
