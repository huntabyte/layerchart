<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { range, ticks } from 'd3-array';
  import { scaleLinear, scaleSequential } from 'd3-scale';
  import { interpolateTurbo } from 'd3-scale-chromatic';

  import { BarChart, Bars, LinearGradient, LineChart } from 'layerchart';

  import Preview from '$lib/docs/Preview.svelte';

  // Inspired by: https://observablehq.com/@visnup/microphone-oscilloscope and https://codepen.io/agalliat/pen/PoZLBxP

  let timeData: { key: number; value: number }[] = [];
  let frequencyData: { key: number; value: number }[] = [];

  let ctx: AudioContext;
  let analyser: AnalyserNode;

  $: frequency = scaleLinear()
    .domain([0, analyser?.frequencyBinCount - 1])
    .range([0, analyser?.context.sampleRate / 2 / 1000]);

  $: decibels = scaleLinear()
    .domain([0, 255])
    .range([analyser?.minDecibels, analyser?.maxDecibels]);

  let active = true;
  onMount(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // @ts-expect-error
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // @ts-expect-error
    analyser = ctx
      .createMediaStreamSource(stream)
      .connect(new AnalyserNode(ctx, { fftSize: 2048 }));

    const time = new Uint8Array(analyser.fftSize);
    const frequency = new Uint8Array(analyser.frequencyBinCount);

    let start: DOMHighResTimeStamp;

    function step(timeStamp: DOMHighResTimeStamp) {
      if (start === undefined) {
        start = timeStamp;
      }
      const elapsed = timeStamp - start;

      analyser.getByteTimeDomainData(time);
      analyser.getByteFrequencyData(frequency);
      frequencyData = [...frequency].map((value, i) => ({ key: i, value }));
      timeData = [...time].map((value, i) => ({ key: i, value }));

      if (active) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  });

  onDestroy(() => {
    active = false;
    ctx?.close();
  });

  const colorScale = scaleSequential([0, 256], interpolateTurbo);
</script>

<h1>Examples</h1>

<h2>Time</h2>

<Preview>
  <div class="h-[100px] p-4 border rounded">
    <LineChart
      data={timeData}
      x="key"
      y="value"
      yDomain={[0, 256]}
      axis={false}
      grid={false}
      props={{ spline: { class: 'stroke-surface-content' } }}
      tooltip={{ mode: 'manual' }}
    />
  </div>
</Preview>

<h2>Frequency</h2>

<Preview>
  <div class="h-[150px] p-4 border rounded">
    <BarChart
      data={frequencyData}
      x="key"
      xDomain={range(0, 128)}
      y="value"
      yDomain={[0, 256]}
      bandPadding={0.2}
      padding={{ left: 24 }}
      axis="y"
      tooltip={{ mode: 'manual' }}
      props={{
        yAxis: { format: (d) => decibels(d)?.toFixed(1) },
      }}
    >
      <svelte:fragment slot="marks">
        <LinearGradient
          stops={ticks(1, 0, 10).map(colorScale.interpolator())}
          vertical
          units="userSpaceOnUse"
          let:gradient
        >
          <Bars radius={1} fill={gradient} />
        </LinearGradient>
      </svelte:fragment>
    </BarChart>
  </div>
</Preview>
