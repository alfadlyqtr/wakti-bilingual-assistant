// DIAGRAM GENERATOR
// Uses QuickChart Mermaid endpoint to generate professional diagrams

export interface DiagramConfig {
  type: 'flowchart' | 'sequence' | 'gantt' | 'pie' | 'mindmap' | 'timeline';
  title: string;
  content: string; // Mermaid syntax
  theme?: 'default' | 'forest' | 'dark' | 'neutral';
}

// Generate flowchart diagram
export function generateFlowchartDiagram(steps: Array<{
  id: string;
  label: string;
  type?: 'start' | 'process' | 'decision' | 'end';
}>, connections?: Array<{ from: string; to: string; label?: string }>): DiagramConfig {
  let mermaid = 'flowchart TD\\n';
  
  // Add nodes
  for (const step of steps) {
    const shape = step.type === 'start' || step.type === 'end' ? '([' + step.label + '])' :
                  step.type === 'decision' ? '{' + step.label + '}' :
                  '[' + step.label + ']';
    mermaid += `    ${step.id}${shape}\\n`;
  }
  
  // Add connections
  if (connections) {
    for (const conn of connections) {
      const label = conn.label ? `|${conn.label}|` : '';
      mermaid += `    ${conn.from} -->${label} ${conn.to}\\n`;
    }
  } else {
    // Auto-connect in sequence
    for (let i = 0; i < steps.length - 1; i++) {
      mermaid += `    ${steps[i].id} --> ${steps[i + 1].id}\\n`;
    }
  }
  
  return {
    type: 'flowchart',
    title: 'Process Flow',
    content: mermaid
  };
}

// Generate timeline diagram
export function generateTimelineDiagram(events: Array<{
  date: string;
  title: string;
  description?: string;
}>): DiagramConfig {
  let mermaid = 'timeline\\n';
  mermaid += '    title Project Timeline\\n';
  
  for (const event of events) {
    mermaid += `    ${event.date} : ${event.title}`;
    if (event.description) {
      mermaid += ` : ${event.description}`;
    }
    mermaid += '\\n';
  }
  
  return {
    type: 'timeline',
    title: 'Timeline',
    content: mermaid
  };
}

// Generate mind map diagram
export function generateMindMapDiagram(root: string, branches: Array<{
  label: string;
  children?: string[];
}>): DiagramConfig {
  let mermaid = 'mindmap\\n';
  mermaid += `  root((${root}))\\n`;
  
  for (const branch of branches) {
    mermaid += `    ${branch.label}\\n`;
    if (branch.children) {
      for (const child of branch.children) {
        mermaid += `      ${child}\\n`;
      }
    }
  }
  
  return {
    type: 'mindmap',
    title: 'Mind Map',
    content: mermaid
  };
}

// Generate sequence diagram
export function generateSequenceDiagram(participants: string[], interactions: Array<{
  from: string;
  to: string;
  message: string;
  type?: 'solid' | 'dotted';
}>): DiagramConfig {
  let mermaid = 'sequenceDiagram\\n';
  
  // Add participants
  for (const participant of participants) {
    mermaid += `    participant ${participant}\\n`;
  }
  
  // Add interactions
  for (const interaction of interactions) {
    const arrow = interaction.type === 'dotted' ? '-->' : '->';
    mermaid += `    ${interaction.from}${arrow}${interaction.to}: ${interaction.message}\\n`;
  }
  
  return {
    type: 'sequence',
    title: 'Sequence Diagram',
    content: mermaid
  };
}

// Generate Gantt chart
export function generateGanttDiagram(tasks: Array<{
  id: string;
  name: string;
  start: string;
  duration: string;
  dependencies?: string[];
}>): DiagramConfig {
  let mermaid = 'gantt\\n';
  mermaid += '    title Project Schedule\\n';
  mermaid += '    dateFormat YYYY-MM-DD\\n';
  
  for (const task of tasks) {
    const deps = task.dependencies ? ` after ${task.dependencies.join(' ')}` : '';
    mermaid += `    ${task.name} :${task.id}, ${task.start}, ${task.duration}${deps}\\n`;
  }
  
  return {
    type: 'gantt',
    title: 'Project Schedule',
    content: mermaid
  };
}

// Generate diagram URL using QuickChart Mermaid
export function generateDiagramURL(config: DiagramConfig, width: number = 800, height: number = 600): string {
  const theme = config.theme || 'default';
  const encodedMermaid = encodeURIComponent(config.content);
  
  return `https://quickchart.io/graphviz?format=png&width=${width}&height=${height}&graph=${encodedMermaid}`;
}

// Better: Use QuickChart's mermaid endpoint
export function generateMermaidURL(config: DiagramConfig, width: number = 800, height: number = 600): string {
  const mermaidConfig = {
    theme: config.theme || 'default',
    themeVariables: {
      primaryColor: '#4472C4',
      primaryTextColor: '#fff',
      primaryBorderColor: '#2C5AA0',
      lineColor: '#666',
      secondaryColor: '#ED7D31',
      tertiaryColor: '#70AD47'
    }
  };
  
  const fullConfig = {
    code: config.content,
    mermaid: mermaidConfig
  };
  
  const encodedConfig = encodeURIComponent(JSON.stringify(fullConfig));
  
  return `https://mermaid.ink/img/${btoa(config.content)}?type=png&width=${width}&height=${height}`;
}

// Download diagram image
export async function downloadDiagramImage(diagramUrl: string): Promise<Uint8Array> {
  try {
    const response = await fetch(diagramUrl);
    if (!response.ok) {
      throw new Error(`Failed to download diagram: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('Diagram download error:', error);
    throw error;
  }
}

// Generate diagram and return image data
export async function generateDiagramImage(config: DiagramConfig): Promise<{
  url: string;
  data: Uint8Array;
  base64: string;
}> {
  const url = generateMermaidURL(config);
  const data = await downloadDiagramImage(url);
  const base64 = btoa(String.fromCharCode(...data));
  
  return { url, data, base64 };
}

// Generate multiple diagrams
export async function generateMultipleDiagrams(configs: DiagramConfig[]): Promise<Array<{
  config: DiagramConfig;
  url: string;
  data: Uint8Array;
  base64: string;
}>> {
  const results = [];
  
  for (const config of configs) {
    try {
      const diagramData = await generateDiagramImage(config);
      results.push({
        config,
        ...diagramData
      });
      console.log(`✅ Generated diagram: ${config.title}`);
    } catch (error) {
      console.error(`❌ Failed to generate diagram: ${config.title}`, error);
    }
  }
  
  return results;
}

// Auto-generate diagrams from content
export function generateDiagramsFromContent(content: any): DiagramConfig[] {
  const diagrams: DiagramConfig[] = [];
  
  // Look for process descriptions
  if (content.sections) {
    for (const section of content.sections) {
      const text = section.content || '';
      
      // Detect process flow keywords
      if (text.match(/step|process|workflow|procedure/i)) {
        diagrams.push(generateFlowchartDiagram([
          { id: 'A', label: 'Start', type: 'start' },
          { id: 'B', label: 'Process', type: 'process' },
          { id: 'C', label: 'Review', type: 'decision' },
          { id: 'D', label: 'Complete', type: 'end' }
        ]));
      }
      
      // Detect timeline keywords
      if (text.match(/timeline|schedule|roadmap|history/i)) {
        diagrams.push(generateTimelineDiagram([
          { date: '2024-Q1', title: 'Planning Phase' },
          { date: '2024-Q2', title: 'Development' },
          { date: '2024-Q3', title: 'Testing' },
          { date: '2024-Q4', title: 'Launch' }
        ]));
      }
    }
  }
  
  // Add default process diagram if none generated
  if (diagrams.length === 0) {
    diagrams.push(generateFlowchartDiagram([
      { id: 'start', label: 'Start', type: 'start' },
      { id: 'analyze', label: 'Analyze Requirements', type: 'process' },
      { id: 'design', label: 'Design Solution', type: 'process' },
      { id: 'implement', label: 'Implement', type: 'process' },
      { id: 'test', label: 'Test & Validate', type: 'decision' },
      { id: 'deploy', label: 'Deploy', type: 'process' },
      { id: 'end', label: 'Complete', type: 'end' }
    ], [
      { from: 'start', to: 'analyze' },
      { from: 'analyze', to: 'design' },
      { from: 'design', to: 'implement' },
      { from: 'implement', to: 'test' },
      { from: 'test', to: 'deploy', label: 'Pass' },
      { from: 'test', to: 'implement', label: 'Fail' },
      { from: 'deploy', to: 'end' }
    ]));
  }
  
  return diagrams;
}

// Create sample diagrams
export function createSampleDiagrams(): DiagramConfig[] {
  return [
    generateFlowchartDiagram([
      { id: 'A', label: 'Start', type: 'start' },
      { id: 'B', label: 'Input Data', type: 'process' },
      { id: 'C', label: 'Valid?', type: 'decision' },
      { id: 'D', label: 'Process', type: 'process' },
      { id: 'E', label: 'End', type: 'end' }
    ], [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D', label: 'Yes' },
      { from: 'C', to: 'B', label: 'No' },
      { from: 'D', to: 'E' }
    ]),
    
    generateTimelineDiagram([
      { date: 'Jan 2024', title: 'Project Kickoff', description: 'Initial planning' },
      { date: 'Mar 2024', title: 'Development Start', description: 'Begin coding' },
      { date: 'Jun 2024', title: 'Beta Release', description: 'Testing phase' },
      { date: 'Sep 2024', title: 'Launch', description: 'Go live' }
    ]),
    
    generateMindMapDiagram('Project', [
      { label: 'Planning', children: ['Requirements', 'Timeline', 'Budget'] },
      { label: 'Development', children: ['Frontend', 'Backend', 'Database'] },
      { label: 'Testing', children: ['Unit Tests', 'Integration', 'UAT'] },
      { label: 'Deployment', children: ['Staging', 'Production', 'Monitoring'] }
    ])
  ];
}
