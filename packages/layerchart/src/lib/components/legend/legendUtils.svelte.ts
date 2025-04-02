import type { SVGAttributes } from 'svelte/elements';
import { scaleBand, scaleLinear } from 'd3-scale';
import { quantize, interpolate } from 'd3-interpolate';
import { quantile, range } from 'd3-array';
import { format, type FormatType } from '@layerstack/utils';
import type { GetterValues } from 'layerchart/utils/types.js';

import {
  isScaleContinuousWithInterpolate,
  isScaleSequential,
  isScaleQuantizing,
  isScaleQuantize,
  isScaleQuantile,
  isScaleThreshold,
  isScaleBand,
  isScaleOrdinalLike,
  hasTicks,
  hasTickFormat,
} from './legendScaleUtils.js';
import type { AnyScale } from 'layerchart/utils/scales.svelte.js';

export type LegendItem = {
  id: string;
  dataKey: string;
  label: string;
  color: string;
  active: boolean;
  payload?: any;
};

export interface LegendEventPayload {
  type: 'click' | 'mouseover' | 'mouseout';
  item: LegendItem;
  source: 'legend';
  nativeEvent?: MouseEvent | TouchEvent | KeyboardEvent;
}

export type ScaleConfig = {
  xScale: AnyScale | null;
  interpolator: ((t: number) => any) | undefined | null;
  swatches: SVGAttributes<SVGRectElement>[] | undefined;
  tickLabelOffset: number;
  tickLine: boolean;
  tickValues: any[] | undefined;
  tickFormat: ((value: any) => string) | undefined;
  tickLength: number;
};

export type ResolveLegendScaleConfigOptions = GetterValues<{
  scale: AnyScale | null | undefined;
  width: number;
  height: number;
  tickLength: number;
  userTickValues: any[] | undefined;
  userTickFormat: FormatType | undefined;
  requestedTicks: number;
}>;

/**
 * Resolves the necessary configuration for rendering a legend (ramp or swatches)
 * based on a given D3 scale and layout parameters. Uses type guards for type safety.
 *
 * @param options - GetterValues object containing scale and layout details.
 * @returns A ScaleConfig object containing calculated scale, ticks, formatting, etc.
 */
export function resolveLegendScaleConfig(options: ResolveLegendScaleConfigOptions): ScaleConfig {
  // Unwrap getter values
  const scale = $derived(options.scale());
  const width = $derived(options.width());
  const height = $derived(options.height());
  const tickLength = $derived(options.tickLength());
  const userTickValues = $derived(options.userTickValues());
  const userTickFormat = $derived(options.userTickFormat());
  const requestedTicks = $derived(options.requestedTicks());

  const fallbackState = {
    xScale: null,
    interpolator: null,
    swatches: undefined,
    tickLabelOffset: 0,
    tickLine: true,
    tickLength: tickLength,
    tickFormat: undefined,
    tickValues: userTickValues,
  };

  const resolvedScale = $derived.by(() => {
    // if no scale is provided, fallback to default
    if (!scale) return fallbackState;

    // continuous Scale (e.g., Linear, Log, Pow, Time)
    if (isScaleContinuousWithInterpolate(scale)) {
      const n = Math.min(scale.domain().length, scale.range().length);
      const baseInterpolatorFactory = scale.interpolate();
      const scaleInterpolatorDomain = scale
        .copy()
        .domain(quantize(interpolate(0, 1), n)) as typeof scale;
      const interpolator = (t: number) =>
        scaleInterpolatorDomain.interpolate(baseInterpolatorFactory)(t);

      const scaleCopy = scale.copy() as typeof scale;
      // determine the target range for positioning ticks
      const targetRange = quantize(interpolate(0, width), n);
      let xScale: AnyScale | null = null;

      // check if rangeRound exists and is a function on the copied scale
      if (typeof (scaleCopy as any).rangeRound === 'function') {
        // use rangeRound if available
        xScale = scaleCopy.rangeRound(targetRange);
      } else if (typeof scaleCopy.range === 'function') {
        // fallback to range if rangeRound is not available
        console.warn(
          'Using scale.range() for legend tick positioning as .rangeRound() is not available. Positions may not be rounded integers.'
        );
        xScale = scaleCopy.range(targetRange);
      } else {
        // should not happen for continuous scales, but handle defensively
        console.error('Scale copy lacks both .rangeRound() and .range() methods.');
        // return fallback
        return fallbackState;
      }

      // determine tick values safely using 'xScale'
      // note: we need to ensure xScale is not null here if the error case above doesn't return
      const tickValues =
        userTickValues ?? (xScale && hasTicks(xScale) ? xScale.ticks(requestedTicks) : undefined);

      // determine tick format safely using 'xScale'
      let tickFormat: ((value: any) => string) | undefined;
      if (userTickFormat) {
        tickFormat = (d: any) => format(d, userTickFormat);
      } else if (xScale && hasTickFormat(xScale)) {
        tickFormat = xScale.tickFormat(requestedTicks);
      } else {
        tickFormat = (d: any) => String(d); // fallback
      }

      return {
        xScale,
        interpolator,
        swatches: undefined,
        tickLabelOffset: 0,
        tickLine: true,
        tickValues,
        tickFormat,
        tickLength,
      };
    }

    // sequential/diverging Scale
    if (isScaleSequential(scale)) {
      const interpolator = scale.interpolator();
      const domain = scale.domain();

      // use a linear scale for positioning ticks, as sequential scales often lack .ticks
      const xScale = scaleLinear().domain(domain).range([0, width]);

      // determine tick values safely
      let tickValues = userTickValues;
      if (tickValues === undefined) {
        // check if the sequential scale is also a quantile scale (uncommon but possible)
        if (isScaleQuantile(scale)) {
          const quantiles = scale.quantiles();
          tickValues = [domain[0], ...quantiles, domain[domain.length - 1]];
        } else if (hasTicks(xScale)) {
          // use linear scale's ticks
          tickValues = xScale.ticks(requestedTicks);
        } else {
          // fallback
          const n = Math.max(2, Math.round(requestedTicks));
          tickValues = range(n).map((i) => quantile(domain, i / (n - 1)));
        }
      }

      // determine tick format safely
      let tickFormat: ((value: any) => string) | undefined;
      if (userTickFormat) {
        tickFormat = (d: any) => format(d, userTickFormat);
      } else if (hasTickFormat(xScale)) {
        // try linear scale format
        tickFormat = xScale.tickFormat(requestedTicks);
      } else if (hasTickFormat(scale)) {
        // try original scale format
        tickFormat = scale.tickFormat(requestedTicks);
      } else {
        tickFormat = (d: any) => String(d); // Fallback
      }

      return {
        xScale,
        interpolator,
        swatches: undefined,
        tickLabelOffset: 0,
        tickLine: true,
        tickValues,
        tickFormat,
        tickLength,
      };
    }

    // quantizing scales (Quantize, Quantile, Threshold)
    if (isScaleQuantizing(scale)) {
      let thresholds: any[] = [];
      if (isScaleQuantize(scale)) {
        thresholds = scale.thresholds();
      } else if (isScaleQuantile(scale)) {
        thresholds = scale.quantiles();
      } else if (isScaleThreshold(scale)) {
        thresholds = scale.domain();
      } else {
        // this should not happen but we handle it defensively
        console.warn('Quantizing scale type not recognized, using [] as default thresholds.');
      }

      // use linear scale mapping indices for swatch positioning
      const rangeLength = scale.range().length;
      const swatchPosScale = scaleLinear()
        .domain([-0.5, rangeLength - 0.5])
        .range([0, width]);

      const swatches = scale.range().map((d: any, i: number) => ({
        x: swatchPosScale(i - 0.5),
        y: 0,
        width: swatchPosScale(i + 0.5) - swatchPosScale(i - 0.5),
        height: height,
        fill: `${d}`, // stringify the fill
      }));

      // tick values correspond to thresholds
      const tickValues = userTickValues ?? range(thresholds.length); // indices 0..N-1

      // use a linear scale mapping threshold indices to positions for ticks
      // place ticks at the boundaries (e.g., at 0.5, 1.5, etc. on swatchPosScale)
      const tickPosScale = scaleLinear()
        .domain([0, thresholds.length - 1]) // map threshold indices
        .range([swatchPosScale(0.5), swatchPosScale(rangeLength - 1.5)]); // to boundary positions

      // determine tick format
      const tickFormat = (indexOrValue: number) => {
        const value = userTickValues ? indexOrValue : thresholds[indexOrValue];
        return userTickFormat ? format(value, userTickFormat) : String(value);
      };

      return {
        xScale: tickPosScale, // use the scale mapping threshold indices to positions
        interpolator: undefined,
        swatches,
        tickLabelOffset: 0,
        tickLine: true,
        tickValues,
        tickFormat,
        tickLength,
      };
    }

    // Band Scale
    if (isScaleBand(scale)) {
      const domain = scale.domain();
      // xScale is the scale itself
      const xScale = scale;

      const swatches = domain.map((d: any) => ({
        x: xScale(d),
        y: 0,
        width: Math.max(0, xScale.bandwidth() - 1),
        height: height,
        fill: String(scale(d)),
      }));

      const tickValues = userTickValues ?? domain;
      const tickFormat = userTickFormat
        ? (d: any) => format(d, userTickFormat)
        : (d: any) => String(d);
      const tickLabelOffset = xScale.bandwidth() / 2;
      const tickLine = false;

      return {
        xScale,
        interpolator: undefined,
        swatches,
        tickLabelOffset,
        tickLine,
        tickValues,
        tickFormat,
        tickLength: 0,
      };
    }

    // fallback for other Ordinal-like Scales
    if (isScaleOrdinalLike(scale)) {
      const domain = scale.domain();
      const range = scale.range();

      // default to using scaleBand for positioning if width is relevant
      const xScale = scaleBand().domain(domain).rangeRound([0, width]);

      const swatches = domain.map((d: any, i: number) => ({
        x: xScale(d),
        y: 0,
        width: Math.max(0, xScale.bandwidth() - 1),
        height: height,
        fill: `${scale(d) ?? range[i % range.length]}`, // Safe access + fallback
      }));

      const tickValues = userTickValues ?? domain;
      const tickFormat = userTickFormat
        ? (d: any) => format(d, userTickFormat)
        : (d: any) => String(d);
      const tickLabelOffset = xScale.bandwidth() / 2;
      const tickLine = false;

      return {
        xScale,
        interpolator: undefined,
        swatches,
        tickLabelOffset,
        tickLine,
        tickValues,
        tickFormat,
        tickLength: 0,
      };
    }

    // final fallback if scale type wasn't handled
    console.warn('Legend scale type not recognized or supported, returning default config.', scale);
    return fallbackState;
  });

  return {
    get xScale() {
      return resolvedScale.xScale;
    },
    get interpolator() {
      return resolvedScale.interpolator;
    },
    get swatches() {
      return resolvedScale.swatches;
    },
    get tickLabelOffset() {
      return resolvedScale.tickLabelOffset;
    },
    get tickLine() {
      return resolvedScale.tickLine;
    },
    get tickLength() {
      return resolvedScale.tickLength;
    },
    get tickValues() {
      return resolvedScale.tickValues;
    },
    get tickFormat() {
      return resolvedScale.tickFormat;
    },
  };
}
