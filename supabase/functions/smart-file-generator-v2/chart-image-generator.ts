// CHART IMAGE GENERATOR
// Uses QuickChart.io (free, no API key needed) to generate chart images

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter';
  title: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }>;
  width?: number;
  height?: number;
}

// Professional color palettes
const COLOR_PALETTES = {
  business: ['#4472C4', '#ED7D31', '#70AD47', '#FFC000', '#5B9BD5', '#C55A11'],
  vibrant: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
  pastel: ['#FFB6C1', '#87CEEB', '#98FB98', '#DDA0DD', '#F0E68C', '#FFE4B5'],
  professional: ['#2C3E50', '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6'],
  modern: ['#1ABC9C', '#E67E22', '#3498DB', '#E74C3C', '#9B59B6', '#F1C40F']
};

// Generate chart URL using QuickChart.io
export function generateChartURL(config: ChartConfig, palette: keyof typeof COLOR_PALETTES = 'business'): string {
  const colors = COLOR_PALETTES[palette];
  
  // Apply colors to datasets if not specified
  const datasets = config.datasets.map((dataset, idx) => ({
    ...dataset,
    backgroundColor: dataset.backgroundColor || (config.type === 'pie' || config.type === 'doughnut' 
      ? colors 
      : colors[idx % colors.length]),
    borderColor: dataset.borderColor || colors[idx % colors.length],
    borderWidth: dataset.borderWidth || 2
  }));
  
  const chartConfig = {
    type: config.type,
    data: {
      labels: config.labels,
      datasets
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: config.title,
          font: {
            size: 18,
            weight: 'bold'
          }
        },
        legend: {
          display: true,
          position: 'bottom'
        }
      },
      scales: config.type !== 'pie' && config.type !== 'doughnut' ? {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      } : undefined
    }
  };
  
  const width = config.width || 800;
  const height = config.height || 500;
  
  // Encode chart config for URL
  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  
  return `https://quickchart.io/chart?c=${encodedConfig}&width=${width}&height=${height}&format=png&backgroundColor=white`;
}

// Generate multiple chart types from data
export function generateChartsFromData(data: {
  title: string;
  categories: string[];
  series: Array<{ name: string; values: number[] }>;
}): ChartConfig[] {
  const charts: ChartConfig[] = [];
  
  // Bar Chart
  charts.push({
    type: 'bar',
    title: `${data.title} - Bar Chart`,
    labels: data.categories,
    datasets: data.series.map(s => ({
      label: s.name,
      data: s.values
    }))
  });
  
  // Line Chart (if multiple data points)
  if (data.categories.length >= 3) {
    charts.push({
      type: 'line',
      title: `${data.title} - Trend Analysis`,
      labels: data.categories,
      datasets: data.series.map(s => ({
        label: s.name,
        data: s.values,
        borderWidth: 3
      }))
    });
  }
  
  // Pie Chart (first series only, if reasonable number of categories)
  if (data.categories.length <= 8 && data.series.length > 0) {
    charts.push({
      type: 'pie',
      title: `${data.title} - Distribution`,
      labels: data.categories,
      datasets: [{
        label: data.series[0].name,
        data: data.series[0].values
      }]
    });
  }
  
  return charts;
}

// Generate chart from table data
export function generateChartFromTable(table: {
  title: string;
  headers: string[];
  rows: Array<Record<string, any>>;
}): ChartConfig[] {
  const charts: ChartConfig[] = [];
  
  if (!table.headers || table.headers.length < 2 || !table.rows || table.rows.length === 0) {
    return charts;
  }
  
  // Find numeric columns
  const numericColumns: string[] = [];
  const categoryColumn = table.headers[0]; // First column as categories
  
  for (let i = 1; i < table.headers.length; i++) {
    const header = table.headers[i];
    const firstValue = table.rows[0][header];
    if (typeof firstValue === 'number' || !isNaN(Number(firstValue))) {
      numericColumns.push(header);
    }
  }
  
  if (numericColumns.length === 0) return charts;
  
  // Extract data
  const categories = table.rows.map(row => String(row[categoryColumn]));
  const series = numericColumns.map(col => ({
    name: col,
    values: table.rows.map(row => Number(row[col]) || 0)
  }));
  
  return generateChartsFromData({
    title: table.title || 'Data Analysis',
    categories,
    series
  });
}

// Download chart image
export async function downloadChartImage(chartUrl: string): Promise<Uint8Array> {
  try {
    const response = await fetch(chartUrl);
    if (!response.ok) {
      throw new Error(`Failed to download chart: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('Chart download error:', error);
    throw error;
  }
}

// Generate chart and return image data
export async function generateChartImage(config: ChartConfig, palette?: keyof typeof COLOR_PALETTES): Promise<{
  url: string;
  data: Uint8Array;
  base64: string;
}> {
  const url = generateChartURL(config, palette);
  const data = await downloadChartImage(url);
  const base64 = btoa(String.fromCharCode(...data));
  
  return { url, data, base64 };
}

// Generate multiple charts
export async function generateMultipleCharts(configs: ChartConfig[], palette?: keyof typeof COLOR_PALETTES): Promise<Array<{
  config: ChartConfig;
  url: string;
  data: Uint8Array;
  base64: string;
}>> {
  const results = [];
  
  for (const config of configs) {
    try {
      const chartData = await generateChartImage(config, palette);
      results.push({
        config,
        ...chartData
      });
      console.log(`✅ Generated chart: ${config.title}`);
    } catch (error) {
      console.error(`❌ Failed to generate chart: ${config.title}`, error);
    }
  }
  
  return results;
}

// Create sample chart for testing
export function createSampleChart(type: ChartConfig['type'] = 'bar'): ChartConfig {
  const baseConfig = {
    title: 'Sample Chart',
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [{
      label: 'Revenue',
      data: [65, 78, 82, 90]
    }]
  };
  
  switch (type) {
    case 'line':
      return {
        ...baseConfig,
        type: 'line',
        title: 'Trend Analysis',
        datasets: [
          { label: 'Revenue', data: [65, 78, 82, 90] },
          { label: 'Costs', data: [45, 52, 58, 63] }
        ]
      };
    
    case 'pie':
      return {
        type: 'pie',
        title: 'Market Share',
        labels: ['Product A', 'Product B', 'Product C', 'Product D'],
        datasets: [{
          label: 'Share',
          data: [35, 25, 20, 20]
        }]
      };
    
    case 'doughnut':
      return {
        type: 'doughnut',
        title: 'Distribution',
        labels: ['Category 1', 'Category 2', 'Category 3'],
        datasets: [{
          label: 'Values',
          data: [45, 30, 25]
        }]
      };
    
    default:
      return {
        ...baseConfig,
        type
      };
  }
}

// Validate chart configuration
export function validateChartConfig(config: ChartConfig): boolean {
  if (!config.type || !config.title) {
    console.error('Chart config missing type or title');
    return false;
  }
  
  if (!config.labels || config.labels.length === 0) {
    console.error('Chart config missing labels');
    return false;
  }
  
  if (!config.datasets || config.datasets.length === 0) {
    console.error('Chart config missing datasets');
    return false;
  }
  
  for (const dataset of config.datasets) {
    if (!dataset.data || dataset.data.length !== config.labels.length) {
      console.error('Dataset data length does not match labels length');
      return false;
    }
  }
  
  return true;
}
