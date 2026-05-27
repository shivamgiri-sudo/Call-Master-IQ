// public/callmaster/js/shared/charts.js
// All functions create/update ApexCharts instances.
// ApexCharts is loaded via CDN in index.html.

const CHART_DEFAULTS = {
  theme: { mode: 'dark' },
  chart: { background: 'transparent', fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 3 },
  tooltip: { theme: 'dark' },
  colors: ['#3b82f6','#06d6a0','#f59e0b','#ef4444','#8b5cf6','#14b8a6'],
};

function lineChart(elId, series, categories, { title = '', yFormatter = v => v, targetLine = null } = {}) {
  const annotations = targetLine ? {
    yaxis: [{ y: targetLine, borderColor: '#f59e0b', strokeDashArray: 4, label: { text: `Target ${targetLine}%`, style: { color: '#f59e0b', background: 'transparent' } } }]
  } : {};

  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(series); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'line', height: 260, id: elId },
    series,
    xaxis: { categories, labels: { style: { colors: '#64748b', fontSize: '11px' } } },
    yaxis: { labels: { formatter: yFormatter, style: { colors: '#64748b' } } },
    stroke: { width: 2, curve: 'smooth' },
    markers: { size: 3 },
    annotations,
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function barChart(elId, series, categories, { title = '', horizontal = false, yFormatter = v => v } = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(series); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'bar', height: 260, id: elId },
    series,
    plotOptions: { bar: { horizontal, borderRadius: 4, columnWidth: '60%' } },
    xaxis: { categories, labels: { style: { colors: '#64748b', fontSize: '11px' } } },
    yaxis: { labels: { formatter: yFormatter, style: { colors: '#64748b' } } },
    dataLabels: { enabled: false },
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function donutChart(elId, labels, values, { title = '' } = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(values); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'donut', height: 260, id: elId },
    series: values,
    labels,
    legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
    dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(1)}%` },
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function heatmapChart(elId, series, { title = '', yFormatter = v => v } = {}) {
  // series: [{name: 'AgentName', data: [{x: 'Param', y: defectCount},...]}]
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(series); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'heatmap', height: Math.max(260, series.length * 28), id: elId },
    series,
    plotOptions: { heatmap: { shadeIntensity: 0.5, colorScale: { ranges: [
      { from: 0, to: 0,  color: '#1a2236', name: 'None' },
      { from: 1, to: 3,  color: '#1d4ed8', name: 'Low' },
      { from: 4, to: 7,  color: '#f59e0b', name: 'Medium' },
      { from: 8, to: 999, color: '#ef4444', name: 'High' },
    ]}}},
    dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '10px' } },
    xaxis: { labels: { style: { colors: '#64748b', fontSize: '10px' } } },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' } } },
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function funnelChart(elId, labels, values, { title = '', color = '#3b82f6' } = {}) {
  // Rendered as horizontal bar chart sorted descending (ApexCharts has no native funnel)
  const series = [{ name: 'Count', data: values }];
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(series); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'bar', height: 260, id: elId },
    colors: [color],
    series,
    plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true, barHeight: '70%' } },
    xaxis: { categories: labels, labels: { style: { colors: '#64748b' } } },
    yaxis: { labels: { style: { colors: '#94a3b8' } } },
    dataLabels: { enabled: true, style: { colors: ['#fff'] }, formatter: v => v.toLocaleString() },
    legend: { show: false },
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function gaugeChart(elId, value, max, label, { color = '#3b82f6' } = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries([value]); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'radialBar', height: 240, id: elId },
    series: [Math.round((value / max) * 100)],
    colors: [color],
    plotOptions: { radialBar: {
      startAngle: -135, endAngle: 135,
      hollow: { size: '65%' },
      dataLabels: { name: { show: true, color: '#94a3b8', fontSize: '12px', offsetY: 20 }, value: { show: true, fontSize: '28px', fontWeight: 700, color: '#e2e8f0', formatter: () => label } },
    }},
    labels: [label],
  });
  el._apexChart.render();
}

function destroyChart(elId) {
  const el = document.getElementById(elId);
  if (el && el._apexChart) { el._apexChart.destroy(); el._apexChart = null; }
}

function destroyAllCharts() {
  document.querySelectorAll('[id]').forEach(el => {
    if (el._apexChart) { el._apexChart.destroy(); el._apexChart = null; }
  });
}
