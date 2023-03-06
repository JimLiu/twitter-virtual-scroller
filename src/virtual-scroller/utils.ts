export const arraysAreEqual = (array1: any[], array2: any[]) => {
  if (array1.length !== array2.length) {
    return false;
  }

  for (let i = 0; i < array1.length; i++) {
    if (array1[i] !== array2[i]) {
      return false;
    }
  }
  return true;
};

export const memoize = <T extends (...args: any) => any>(func: T) => {
  let prevResult: ReturnType<T>;
  let prevArgs: any[];

  return (...args: any) => {
    if (prevArgs && arraysAreEqual(prevArgs, args)) {
      return prevResult;
    }

    const result = func(...args);
    prevResult = result;
    prevArgs = args;
    return result;
  };
};
