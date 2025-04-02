import type {
  ScaleContinuousNumeric,
  ScaleQuantize,
  ScaleQuantile,
  ScaleThreshold,
  ScaleOrdinal,
  ScaleBand,
  ScaleSequential,
} from 'd3-scale';

type ScaleMaybeWithUnknown = { [k: string]: any };

/**
 * Checks if the scale is continuous (like Linear, Log, Pow, Time) AND has
 * an `.interpolate()` method.
 */
export function isScaleContinuousWithInterpolate<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & {
  interpolate: () => (a: any, b: any) => (t: number) => any;
} & ScaleContinuousNumeric<any, any> {
  if (!scale) return false;
  return typeof scale.clamp === 'function' && typeof scale.interpolate === 'function';
}

/**
 * Checks if the scale is sequential or diverging (has an `.interpolator()` method).
 */
export function isScaleSequential<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & ScaleSequential<any> {
  if (!scale) return false;
  return typeof scale.interpolator === 'function';
}

/**
 * Checks if the scale is a quantizing type (Quantize, Quantile, Threshold) by checking
 * for `.invertExtent()`.
 */
export function isScaleQuantizing<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & (ScaleQuantize<any> | ScaleQuantile<any> | ScaleThreshold<any, any>) {
  if (!scale) return false;
  return typeof scale.invertExtent === 'function';
}

/**
 * Checks specifically if the scale is ScaleQuantize (has `.thresholds()` and `.invertExtent()`).
 */
export function isScaleQuantize<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & ScaleQuantize<any> {
  if (!scale) return false;
  // ensure it meets the base quantizing criteria
  return typeof scale.thresholds === 'function' && isScaleQuantizing(scale);
}

/**
 * Checks specifically if the scale is ScaleQuantile (has `.quantiles()` and `.invertExtent()`).
 */
export function isScaleQuantile<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & ScaleQuantile<any> {
  if (!scale) return false;
  // ensure it meets the base quantizing criteria
  return typeof scale.quantiles === 'function' && isScaleQuantizing(scale);
}

/**
 * Checks specifically if the scale is ScaleThreshold (must be quantizing but not
 * Quantize or Quantile).
 */
export function isScaleThreshold<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & ScaleThreshold<any, any> {
  if (!scale) return false;
  // check it's quantizing but _doesn't_ have the methods specific to Quantize/Quantile
  return (
    isScaleQuantizing(scale) &&
    typeof scale.thresholds !== 'function' &&
    typeof scale.quantiles !== 'function'
  );
}

/**
 * Checks if the scale is ScaleBand (has `.bandwidth()`).
 */
export function isScaleBand<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & ScaleBand<any> {
  if (!scale) return false;
  return typeof scale.bandwidth === 'function';
}

/**
 * Checks if the scale appears to be ordinal-like (has `.domain()` and `.range()`)
 * but isn't identified as a more specific type like ScaleBand.
 */
export function isScaleOrdinalLike<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & ScaleOrdinal<any, any> {
  if (!scale) return false;
  return (
    typeof scale.domain === 'function' &&
    typeof scale.range === 'function' &&
    // exclude types already identified by more specific guards
    typeof scale.bandwidth !== 'function' && // not band
    typeof scale.clamp !== 'function' // not continuous
  );
}

/**
 * Checks if the scale object has a callable `.ticks()` method.
 */
export function hasTicks<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & { ticks: (count?: number) => any[] } {
  if (!scale) return false;
  return typeof scale.ticks === 'function';
}

/**
 * Checks if the scale object has a callable `.tickFormat()` method.
 */
export function hasTickFormat<T extends ScaleMaybeWithUnknown>(
  scale: T | null | undefined
): scale is T & { tickFormat: (count?: number, specifier?: string) => (d: any) => string } {
  if (!scale) return false;
  return typeof scale.tickFormat === 'function';
}
