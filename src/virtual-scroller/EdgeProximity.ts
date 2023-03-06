import { Positioning } from "./Positioning";
import Rectangle from "./Rectangle";

export type TriggerCause =
  | "INITIAL_POSITION"
  | "MOVEMENT"
  | "LIST_UPDATE"
  | null;

export type ZoneCallbackParam = {
  triggerCause: TriggerCause;
};
export type ZoneCallback = (param: ZoneCallbackParam) => void;

type ProximityState = "INSIDE" | "OUTSIDE" | undefined;

type Zone = {
  condition: (listRect: Rectangle, viewportRect: Rectangle) => boolean;
  callback: ZoneCallback;
};

type State = {
  proximity: ProximityState;
  listLength: number;
};

type Handler = {
  zone: Zone;
  state: State;
};

export const condition = {
  nearTop:
    (threshold: number) => (listRect: Rectangle, viewportRect: Rectangle) =>
      viewportRect.getTop() - listRect.getTop() <= threshold,
  nearBottom:
    (threshold: number) => (listRect: Rectangle, viewportRect: Rectangle) =>
      listRect.getBottom() - viewportRect.getBottom() <= threshold,
  nearTopRatio:
    (ratio: number) => (listRect: Rectangle, viewportRect: Rectangle) => {
      const viewportHeight = viewportRect.getHeight();
      const threshold = viewportHeight * ratio;
      return viewportRect.getTop() - listRect.getTop() <= threshold;
    },
  nearBottomRatio:
    (ratio: number) => (listRect: Rectangle, viewportRect: Rectangle) => {
      const viewportHeight = viewportRect.getHeight();
      const threshold = viewportHeight * ratio;
      return listRect.getBottom() - viewportRect.getBottom() <= threshold;
    },
};

export class EdgeProximity {
  handlers: Handler[];

  constructor(zones: Zone[]) {
    this.handlers = zones.map((zone) => ({
      zone,
      state: {
        proximity: undefined,
        listLength: 0,
      },
    }));
  }

  handlePositioningUpdate(positioning: Positioning) {
    this.handlers.forEach(({ zone, state }) => {
      const { callback } = zone;
      const { proximity, listLength } = state;

      const newProximity = zone.condition(
        positioning.getForList(),
        positioning.getForViewport()
      )
        ? "INSIDE"
        : "OUTSIDE";

      const newLength = positioning.getListLength();
      let triggerCause: TriggerCause = null;

      if (!proximity && newProximity === "INSIDE") {
        triggerCause = "INITIAL_POSITION";
      } else if (proximity === "OUTSIDE" && newProximity === "INSIDE") {
        triggerCause = "MOVEMENT";
      } else if (
        proximity === "INSIDE" &&
        newProximity === "INSIDE" &&
        listLength !== newLength
      ) {
        triggerCause = "LIST_UPDATE";
      }

      state.proximity = newProximity;
      state.listLength = newLength;

      if (triggerCause) {
        callback({
          triggerCause,
        });
      }
    });
  }
}
