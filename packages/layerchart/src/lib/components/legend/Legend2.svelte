<script lang="ts" module>
  import type { Without } from '$lib/utils/types.js';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { AnyScale } from '$lib/utils/scales.svelte.js';
  import type { FormatType } from '@layerstack/utils';
  import type { LegendItem, LegendEventPayload } from './legendUtils.svelte.js';

  type Placement =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';

  export type LegendPropsWithoutHTML = {
    scale?: AnyScale;
    items?: LegendItem[];
    title?: string;
    width?: number;
    height?: number;
    ticks?: number;
    tickFormat?: FormatType;
    tickValues?: any[];
    tickFontSize?: number;
    tickLength?: number;
    placement?: Placement;
    orientation?: 'horizontal' | 'vertical';
    onLegendInteract?: (payload: LegendEventPayload) => void;
    variant?: 'ramp' | 'swatches';
    classes?: {
      root?: string;
      title?: string;
      label?: string;
      tick?: string;
      swatches?: string;
      swatch?: string;
      item?: (item: LegendItem) => string;
    };
    ref?: HTMLElement;
    children?: Snippet<[{ values: any[]; scale: AnyScale | null }]>;
  };

  export type LegendProps = LegendPropsWithoutHTML &
    Without<HTMLAttributes<HTMLElement>, LegendPropsWithoutHTML>;
</script>

<script lang="ts">
  import { format } from '@layerstack/utils';

  import { cls } from '@layerstack/tailwind';
  import { extractLayerProps, layerClass } from '$lib/utils/attributes.js';
  import { resolveLegendScaleConfig } from './legendUtils.svelte.js';
  import { getChartContext } from '../Chart.svelte';
  import ColorRamp from '../ColorRamp.svelte';

  let {
    scale: scaleProp,
    items: itemsProp = [],
    title = '',
    width = 320,
    height = 10,
    ticks: ticksProp,
    tickFormat: tickFormatProp,
    tickValues: tickValuesProp,
    tickFontSize = 10,
    tickLength: tickLengthProp = 4,
    placement,
    orientation = 'horizontal',
    variant = 'ramp',
    classes = {},
    ref = $bindable(),
    class: className,
    children,
    onLegendInteract = () => {},
    ...restProps
  }: LegendProps = $props();
  const ticks = $derived(ticksProp ?? width / 64);

  const ctx = getChartContext();
  const scale = $derived(scaleProp ?? ctx.cScale);

  const items = $derived.by(() => {
    if (
      variant === 'swatches' &&
      itemsProp.length === 0 &&
      scale &&
      !scale.interpolate &&
      !scale.interpolator
    ) {
      console.warn(
        "Legend 'swatches' variant expects an 'items' prop. Deriving from scale as fallback."
      );
      const derivedValues = scaleConfig.tickValues ?? scale.domain?.() ?? [];
      return derivedValues.map((tickValue: any) => {
        const color = scale(tickValue) ?? '#ccc'; // Handle potential undefined color
        const label = tickFormatProp ? format(tickValue, tickFormatProp) : String(tickValue);
        return {
          // use tickValue for both id and dataKey as a sensible default when deriving
          id: tickValue,
          dataKey: tickValue,
          label: label,
          color: color,
          active: true, // default to active
          payload: { derivedFrom: 'scale', originalValue: tickValue },
        };
      });
    }
    return itemsProp.map((item) => ({ ...item, active: item.active ?? true }));
  });

  const scaleConfig = resolveLegendScaleConfig({
    height: () => height,
    width: () => width,
    scale: () => scale,
    requestedTicks: () => ticks,
    tickLength: () => tickLengthProp,
    userTickFormat: () => tickFormatProp,
    userTickValues: () => tickValuesProp,
  });

  function handleClick(index: number, event: MouseEvent) {
    const currentItem = items[index];
    if (!currentItem) return;

    // Prepare payload with the *new* state
    const payload: LegendEventPayload = {
      type: 'click',
      item: { ...currentItem },
      source: 'legend',
      nativeEvent: event,
    };
    onLegendInteract(payload);
  }

  function handlePointerEnter(index: number, event: MouseEvent) {
    const currentItem = items[index];
    if (!currentItem) return;
    const payload: LegendEventPayload = {
      type: 'mouseover',
      item: { ...currentItem },
      source: 'legend',
      nativeEvent: event,
    };
    onLegendInteract(payload);
  }

  function handlePointerLeave(index: number, event: MouseEvent) {
    const currentItem = items[index];
    if (!currentItem) return;
    const payload: LegendEventPayload = {
      type: 'mouseout',
      item: { ...currentItem },
      source: 'legend',
      nativeEvent: event,
    };
    onLegendInteract(payload);
  }
</script>

<div
  bind:this={ref}
  {...restProps}
  data-placement={placement}
  class={cls(
    layerClass('legend-container'),
    'inline-block',
    'z-1',
    placement && [
      'absolute',
      {
        'top-left': 'top-0 left-0',
        top: 'top-0 left-1/2 -translate-x-1/2',
        'top-right': 'top-0 right-0',
        left: 'top-1/2 left-0 -translate-y-1/2',
        center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        right: 'top-1/2 right-0 -translate-y-1/2',
        'bottom-left': 'bottom-0 left-0',
        bottom: 'bottom-0 left-1/2 -translate-x-1/2',
        'bottom-right': 'bottom-0 right-0',
      }[placement],
    ],
    className,
    classes.root
  )}
>
  <div class={cls(layerClass('legend-title'), 'text-[10px] font-semibold', classes.title)}>
    {title}
  </div>

  {#if children}
    {@render children({
      values: scaleConfig.tickValues ?? scaleConfig.xScale?.ticks?.(ticks) ?? [],
      scale,
    })}
  {:else if variant === 'ramp'}
    <svg
      {width}
      height={height + tickLengthProp + tickFontSize}
      viewBox="0 0 {width} {height + tickLengthProp + tickFontSize}"
      class={cls(layerClass('legend-ramp-svg'), 'overflow-visible')}
    >
      <g class={layerClass('legend-ramp-g')}>
        {#if scaleConfig.interpolator}
          <ColorRamp
            {width}
            {height}
            interpolator={scaleConfig.interpolator}
            class={layerClass('legend-color-ramp')}
          />
        {:else if scaleConfig.swatches}
          {#each scaleConfig.swatches as swatch, i}
            <rect {...extractLayerProps(swatch, 'legend-swatch')} />
          {/each}
        {/if}
      </g>
      <g class={layerClass('legend-tick-group')}>
        {#each scaleConfig.tickValues ?? scaleConfig.xScale?.ticks?.(ticks) ?? [] as tickValue, i}
          {#if scaleConfig.xScale}
            <text
              text-anchor="middle"
              x={scaleConfig.xScale(tickValue) + scaleConfig.tickLabelOffset}
              y={height + tickLengthProp + tickFontSize}
              style:font-size={tickFontSize}
              class={cls(
                layerClass('legend-tick-text'),
                'text-[10px] fill-surface-content',
                classes.label
              )}
            >
              {scaleConfig.tickFormat ? scaleConfig.tickFormat(tickValue) : tickValue}
            </text>

            {#if scaleConfig.tickLine}
              <line
                x1={scaleConfig.xScale(tickValue)}
                y1={0}
                x2={scaleConfig.xScale(tickValue)}
                y2={height + tickLengthProp}
                class={cls(layerClass('legend-tick-line'), 'stroke-surface-content', classes.tick)}
              />
            {/if}
          {/if}
        {/each}
      </g>
    </svg>
  {:else if variant === 'swatches'}
    <div
      class={cls(
        layerClass('legend-swatch-group'),
        'flex flex-wrap gap-4', // flex-wrap for better layout
        orientation === 'vertical' && 'flex-col gap-1',
        classes.swatches
      )}
    >
      {#each items as item, i}
        <button
          type="button"
          class={cls(
            layerClass('legend-swatch-button'),
            'flex items-center gap-1', // align items center
            'cursor-pointer', // always pointer if interactive
            classes.item?.(item)
          )}
          onclick={(e) => handleClick(i, e)}
          onpointerenter={(e) => handlePointerEnter(i, e)}
          onpointerleave={(e) => handlePointerLeave(i, e)}
          aria-pressed={item.active}
        >
          <div
            class={cls(layerClass('legend-swatch'), 'h-3 w-3 rounded-sm', classes.swatch)}
            style:background-color={item.color}
          ></div>
          <div
            class={cls(
              layerClass('legend-swatch-label'),
              'text-xs text-surface-content whitespace-nowrap',
              classes.label
            )}
          >
            {item.label}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
