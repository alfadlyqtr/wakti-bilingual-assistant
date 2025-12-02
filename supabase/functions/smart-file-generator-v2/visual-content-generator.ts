// VISUAL CONTENT GENERATOR
// Automatically generates charts, graphs, and diagrams based on content

import type { ChartData, DiagramData } from './chart-generators.ts';

export interface VisualContent {
  charts: ChartData[];
  diagrams: DiagramData[];
  tables: TableData[];
  infographics: InfographicData[];
}

export interface TableData {
  title: string;
  headers: string[];
  rows: Array<Record<string, string | number>>;
  style?: 'simple' | 'striped' | 'bordered' | 'professional';
}

export interface InfographicData {
  type: 'stats' | 'comparison' | 'timeline' | 'process';
  title: string;
  items: Array<{
    label: string;
    value: string | number;
    icon?: string;
    color?: string;
  }>;
}

// Generate visual content suggestions based on text content
export async function generateVisualContentSuggestions(
  content: any,
  outputType: string,
  openaiApiKey: string
): Promise<VisualContent> {
  const prompt = buildVisualPrompt(content, outputType);
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a data visualization expert. Analyze content and suggest appropriate charts, graphs, and visual elements."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      console.error("OpenAI visual suggestions error:", response.statusText);
      return generateDefaultVisuals(content, outputType);
    }

    const result = await response.json();
    const suggestions = JSON.parse(result.choices?.[0]?.message?.content || '{}');
    
    return parseVisualSuggestions(suggestions, content);
  } catch (error) {
    console.error("Error generating visual suggestions:", error);
    return generateDefaultVisuals(content, outputType);
  }
}

function buildVisualPrompt(content: any, outputType: string): string {
  const contentSummary = JSON.stringify(content).substring(0, 2000);
  
  return `Analyze this ${outputType} content and suggest appropriate visual elements:

${contentSummary}

Return JSON with:
{
  "charts": [
    {
      "type": "bar|line|pie|area",
      "title": "Chart Title",
      "categories": ["Cat1", "Cat2", "Cat3"],
      "series": [
        {"name": "Series 1", "values": [10, 20, 30]}
      ],
      "placement": "after_section_1"
    }
  ],
  "diagrams": [
    {
      "type": "flowchart|orgchart|timeline|process",
      "title": "Diagram Title",
      "nodes": [
        {"id": "1", "label": "Step 1", "type": "start"}
      ],
      "connections": [
        {"from": "1", "to": "2"}
      ]
    }
  ],
  "tables": [
    {
      "title": "Data Table",
      "headers": ["Column 1", "Column 2"],
      "rows": [
        {"Column 1": "Value", "Column 2": 100}
      ]
    }
  ],
  "infographics": [
    {
      "type": "stats|comparison|timeline|process",
      "title": "Key Statistics",
      "items": [
        {"label": "Metric 1", "value": "85%", "color": "4472C4"}
      ]
    }
  ]
}

Suggest 2-4 visual elements that would enhance this content.`;
}

function parseVisualSuggestions(suggestions: any, content: any): VisualContent {
  return {
    charts: Array.isArray(suggestions.charts) ? suggestions.charts : [],
    diagrams: Array.isArray(suggestions.diagrams) ? suggestions.diagrams : [],
    tables: Array.isArray(suggestions.tables) ? suggestions.tables : [],
    infographics: Array.isArray(suggestions.infographics) ? suggestions.infographics : []
  };
}

function generateDefaultVisuals(content: any, outputType: string): VisualContent {
  const visuals: VisualContent = {
    charts: [],
    diagrams: [],
    tables: [],
    infographics: []
  };

  // Generate default chart based on content type
  if (outputType === 'pptx' && content.slides) {
    // Add a sample bar chart for presentations
    visuals.charts.push({
      type: 'bar',
      title: 'Key Metrics Overview',
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [
        {
          name: 'Performance',
          values: [65, 78, 82, 90]
        },
        {
          name: 'Target',
          values: [70, 75, 80, 85]
        }
      ]
    });

    // Add a pie chart
    visuals.charts.push({
      type: 'pie',
      title: 'Distribution Analysis',
      categories: ['Category A', 'Category B', 'Category C', 'Category D'],
      series: [
        {
          name: 'Share',
          values: [35, 25, 20, 20]
        }
      ]
    });
  }

  if (outputType === 'docx' || outputType === 'pdf') {
    // Add a line chart for documents
    visuals.charts.push({
      type: 'line',
      title: 'Trend Analysis',
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      series: [
        {
          name: 'Growth',
          values: [45, 52, 58, 63, 70, 78]
        }
      ]
    });

    // Add a data table
    visuals.tables.push({
      title: 'Summary Statistics',
      headers: ['Metric', 'Value', 'Change', 'Status'],
      rows: [
        { 'Metric': 'Revenue', 'Value': '$1.2M', 'Change': '+15%', 'Status': 'Up' },
        { 'Metric': 'Users', 'Value': '45K', 'Change': '+22%', 'Status': 'Up' },
        { 'Metric': 'Engagement', 'Value': '78%', 'Change': '+8%', 'Status': 'Up' }
      ],
      style: 'professional'
    });
  }

  // Add process diagram for all types
  visuals.diagrams.push({
    type: 'process',
    title: 'Process Flow',
    nodes: [
      { id: '1', label: 'Start', type: 'start' },
      { id: '2', label: 'Process', type: 'process' },
      { id: '3', label: 'Review', type: 'decision' },
      { id: '4', label: 'Complete', type: 'end' }
    ],
    connections: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '3', to: '4', label: 'Approved' }
    ]
  });

  // Add infographic stats
  visuals.infographics.push({
    type: 'stats',
    title: 'Key Highlights',
    items: [
      { label: 'Success Rate', value: '92%', color: '70AD47' },
      { label: 'Efficiency Gain', value: '+35%', color: '4472C4' },
      { label: 'User Satisfaction', value: '4.8/5', color: 'FFC000' },
      { label: 'ROI', value: '240%', color: 'ED7D31' }
    ]
  });

  return visuals;
}

// Generate chart data from Excel table
export function generateChartFromTable(table: any): ChartData[] {
  const charts: ChartData[] = [];
  
  if (!table || !table.headers || !table.rows || table.rows.length === 0) {
    return charts;
  }

  // Find numeric columns
  const numericColumns: number[] = [];
  const categoryColumn = 0; // First column as categories
  
  for (let i = 1; i < table.headers.length; i++) {
    const firstValue = table.rows[0][table.headers[i]];
    if (typeof firstValue === 'number') {
      numericColumns.push(i);
    }
  }

  if (numericColumns.length === 0) return charts;

  // Generate bar chart
  const categories = table.rows.map((row: any) => String(row[table.headers[categoryColumn]]));
  const series = numericColumns.map(colIdx => ({
    name: table.headers[colIdx],
    values: table.rows.map((row: any) => Number(row[table.headers[colIdx]]) || 0)
  }));

  charts.push({
    type: 'bar',
    title: `${table.title || 'Data'} - Bar Chart`,
    categories,
    series
  });

  // Generate line chart if there are multiple data points
  if (table.rows.length >= 3) {
    charts.push({
      type: 'line',
      title: `${table.title || 'Data'} - Trend Analysis`,
      categories,
      series
    });
  }

  // Generate pie chart for first numeric column
  if (table.rows.length <= 8) {
    charts.push({
      type: 'pie',
      title: `${table.title || 'Data'} - Distribution`,
      categories,
      series: [{
        name: table.headers[numericColumns[0]],
        values: table.rows.map((row: any) => Number(row[table.headers[numericColumns[0]]]) || 0)
      }]
    });
  }

  return charts;
}

// Generate sample data for charts
export function generateSampleChartData(topic: string, chartType: string): ChartData {
  const categories = ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'];
  
  switch (chartType) {
    case 'bar':
      return {
        type: 'bar',
        title: `${topic} - Quarterly Performance`,
        categories,
        series: [
          { name: 'Actual', values: [65, 78, 82, 90] },
          { name: 'Target', values: [70, 75, 80, 85] }
        ]
      };
    
    case 'line':
      return {
        type: 'line',
        title: `${topic} - Growth Trend`,
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        series: [
          { name: 'Revenue', values: [45, 52, 58, 63, 70, 78] },
          { name: 'Costs', values: [30, 32, 35, 38, 40, 42] }
        ]
      };
    
    case 'pie':
      return {
        type: 'pie',
        title: `${topic} - Market Share`,
        categories: ['Product A', 'Product B', 'Product C', 'Product D'],
        series: [
          { name: 'Share', values: [35, 25, 20, 20] }
        ]
      };
    
    case 'area':
      return {
        type: 'area',
        title: `${topic} - Cumulative Growth`,
        categories,
        series: [
          { name: 'Total', values: [100, 150, 220, 310] }
        ]
      };
    
    default:
      return {
        type: 'bar',
        title: `${topic} - Overview`,
        categories,
        series: [{ name: 'Value', values: [65, 78, 82, 90] }]
      };
  }
}
