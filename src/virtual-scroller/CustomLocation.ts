export type RestorationAnchor = {
  id: string;
  distanceToViewportTop: number;
  wasFocused?: boolean;
};

const defaultConfig = {
  alwaysRestore: true,
  key: "/home",
  fromPop: true,
  lock: false,
};

type Config = typeof defaultConfig;

const map = new Map<string, any>();

const createDefaultPositionPersistence = () => ({
  set(key: string, val: any) {
    map.set(key, val);
  },
  get(key: string) {
    return map.get(key);
  },
});

type PositionPersistence = ReturnType<typeof createDefaultPositionPersistence>;

type Position = {
  type: "CUSTOM";
  position?: RestorationAnchor[] | null;
};

export class CustomLocation {
  claimed: boolean;

  config: Config;

  positionPersistence: PositionPersistence;

  constructor(
    config = defaultConfig,
    positionPersistence = createDefaultPositionPersistence()
  ) {
    this.claimed = false;
    this.positionPersistence = positionPersistence;
    this.config = config;
  }

  claimScrollRestoration() {
    this.claimed = true;
  }

  getSavedPosition() {
    const { alwaysRestore, lock, fromPop, key } = this.config;
    const savedPosition: Position | null =
      (alwaysRestore && !lock) || fromPop
        ? this.positionPersistence.get(key)
        : null;
    return savedPosition && savedPosition.type === "CUSTOM"
      ? savedPosition.position
      : null;
  }

  savePosition(position?: RestorationAnchor[]) {
    this.positionPersistence.set(this.config.key, {
      type: "CUSTOM",
      position,
    });
  }

  isLocked() {
    const { lock, fromPop } = this.config;
    return lock && !fromPop;
  }
}
