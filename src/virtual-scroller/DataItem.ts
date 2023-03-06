import { ReactNode } from "react";

export class DataItem<T = any> {
  id: string;

  data: T;

  renderer: (
    data: T,
    setIsItemFocusable: (focusable: boolean) => void
  ) => ReactNode;

  canBeAnchor: boolean;

  sortIndex: number;

  constructor(
    id: string,
    data: T,
    renderer: (data: T) => ReactNode,
    canBeAnchor: boolean,
    sortIndex: number = -1
  ) {
    this.id = id;
    this.renderer = renderer;
    this.canBeAnchor = canBeAnchor;
    this.data = data;
    this.sortIndex = sortIndex;
  }

  render(setIsItemFocusable: (focusable: boolean) => void) {
    return this.renderer(this.data, setIsItemFocusable);
  }
}

export function createDataItem<T = any>(
  id: string,
  data: T,
  renderer: (data: T) => ReactNode,
  canBeAnchor: boolean,
  sortIndex = -1
) {
  return new DataItem(id, data, renderer, canBeAnchor, sortIndex);
}
