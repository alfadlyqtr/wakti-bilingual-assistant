// ADVANCED CHART GENERATORS FOR OFFICE OPEN XML
// Generates professional charts for PowerPoint, Word, and Excel

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  title: string;
  categories: string[];
  series: Array<{
    name: string;
    values: number[];
    color?: string;
  }>;
}

export interface DiagramData {
  type: 'flowchart' | 'orgchart' | 'timeline' | 'process';
  title: string;
  nodes: Array<{
    id: string;
    label: string;
    type?: 'start' | 'process' | 'decision' | 'end';
  }>;
  connections?: Array<{
    from: string;
    to: string;
    label?: string;
  }>;
}

// Generate Office Open XML Chart
export function generateOfficeChart(chartData: ChartData, chartId: number): Record<string, string> {
  const files: Record<string, string> = {};
  
  // Chart colors
  const colors = chartData.series.map((s, i) => 
    s.color || ['4472C4', 'ED7D31', '70AD47', 'FFC000', '5B9BD5', 'C55A11'][i % 6]
  );
  
  // Chart XML based on type
  switch (chartData.type) {
    case 'bar':
      files[`ppt/charts/chart${chartId}.xml`] = generateBarChart(chartData, colors);
      break;
    case 'line':
      files[`ppt/charts/chart${chartId}.xml`] = generateLineChart(chartData, colors);
      break;
    case 'pie':
      files[`ppt/charts/chart${chartId}.xml`] = generatePieChart(chartData, colors);
      break;
    case 'area':
      files[`ppt/charts/chart${chartId}.xml`] = generateAreaChart(chartData, colors);
      break;
  }
  
  // Chart relationships
  files[`ppt/charts/_rels/chart${chartId}.xml.rels`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Microsoft_Excel_Worksheet${chartId}.xlsx"/>
</Relationships>`;
  
  return files;
}

function generateBarChart(data: ChartData, colors: string[]): string {
  const seriesXml = data.series.map((series, idx) => `
    <c:ser>
      <c:idx val="${idx}"/>
      <c:order val="${idx}"/>
      <c:tx>
        <c:strRef>
          <c:f>Sheet1!$${String.fromCharCode(66 + idx)}$1</c:f>
          <c:strCache>
            <c:ptCount val="1"/>
            <c:pt idx="0"><c:v>${escapeXml(series.name)}</c:v></c:pt>
          </c:strCache>
        </c:strRef>
      </c:tx>
      <c:spPr>
        <a:solidFill>
          <a:srgbClr val="${colors[idx]}"/>
        </a:solidFill>
      </c:spPr>
      <c:cat>
        <c:strRef>
          <c:f>Sheet1!$A$2:$A$${data.categories.length + 1}</c:f>
          <c:strCache>
            <c:ptCount val="${data.categories.length}"/>
            ${data.categories.map((cat, i) => `<c:pt idx="${i}"><c:v>${escapeXml(cat)}</c:v></c:pt>`).join('')}
          </c:strCache>
        </c:strRef>
      </c:cat>
      <c:val>
        <c:numRef>
          <c:f>Sheet1!$${String.fromCharCode(66 + idx)}$2:$${String.fromCharCode(66 + idx)}$${data.categories.length + 1}</c:f>
          <c:numCache>
            <c:formatCode>General</c:formatCode>
            <c:ptCount val="${series.values.length}"/>
            ${series.values.map((val, i) => `<c:pt idx="${i}"><c:v>${val}</c:v></c:pt>`).join('')}
          </c:numCache>
        </c:numRef>
      </c:val>
    </c:ser>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr><a:defRPr sz="1800" b="1"/></a:pPr>
            <a:r><a:rPr lang="en-US" sz="1800" b="1"/><a:t>${escapeXml(data.title)}</a:t></a:r>
          </a:p>
        </c:rich>
      </c:tx>
      <c:layout/>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:dLbls>
          <c:showLegendKey val="0"/>
          <c:showVal val="1"/>
          <c:showCatName val="0"/>
          <c:showSerName val="0"/>
          <c:showPercent val="0"/>
          <c:showBubbleSize val="0"/>
        </c:dLbls>
        <c:axId val="100"/>
        <c:axId val="101"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="100"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:axPos val="b"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:crossAx val="101"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="101"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:crossAx val="100"/>
        <c:crosses val="autoZero"/>
        <c:crossBetween val="between"/>
      </c:valAx>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="r"/>
      <c:layout/>
    </c:legend>
  </c:chart>
</c:chartSpace>`;
}

function generateLineChart(data: ChartData, colors: string[]): string {
  const seriesXml = data.series.map((series, idx) => `
    <c:ser>
      <c:idx val="${idx}"/>
      <c:order val="${idx}"/>
      <c:tx>
        <c:strRef>
          <c:f>Sheet1!$${String.fromCharCode(66 + idx)}$1</c:f>
          <c:strCache>
            <c:ptCount val="1"/>
            <c:pt idx="0"><c:v>${escapeXml(series.name)}</c:v></c:pt>
          </c:strCache>
        </c:strRef>
      </c:tx>
      <c:spPr>
        <a:ln w="28575">
          <a:solidFill>
            <a:srgbClr val="${colors[idx]}"/>
          </a:solidFill>
        </a:ln>
      </c:spPr>
      <c:marker>
        <c:symbol val="circle"/>
        <c:size val="5"/>
      </c:marker>
      <c:cat>
        <c:strRef>
          <c:f>Sheet1!$A$2:$A$${data.categories.length + 1}</c:f>
          <c:strCache>
            <c:ptCount val="${data.categories.length}"/>
            ${data.categories.map((cat, i) => `<c:pt idx="${i}"><c:v>${escapeXml(cat)}</c:v></c:pt>`).join('')}
          </c:strCache>
        </c:strRef>
      </c:cat>
      <c:val>
        <c:numRef>
          <c:f>Sheet1!$${String.fromCharCode(66 + idx)}$2:$${String.fromCharCode(66 + idx)}$${data.categories.length + 1}</c:f>
          <c:numCache>
            <c:formatCode>General</c:formatCode>
            <c:ptCount val="${series.values.length}"/>
            ${series.values.map((val, i) => `<c:pt idx="${i}"><c:v>${val}</c:v></c:pt>`).join('')}
          </c:numCache>
        </c:numRef>
      </c:val>
      <c:smooth val="0"/>
    </c:ser>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr><a:defRPr sz="1800" b="1"/></a:pPr>
            <a:r><a:rPr lang="en-US" sz="1800" b="1"/><a:t>${escapeXml(data.title)}</a:t></a:r>
          </a:p>
        </c:rich>
      </c:tx>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:lineChart>
        <c:grouping val="standard"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:dLbls>
          <c:showLegendKey val="0"/>
          <c:showVal val="0"/>
          <c:showCatName val="0"/>
          <c:showSerName val="0"/>
          <c:showPercent val="0"/>
          <c:showBubbleSize val="0"/>
        </c:dLbls>
        <c:axId val="100"/>
        <c:axId val="101"/>
      </c:lineChart>
      <c:catAx>
        <c:axId val="100"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:axPos val="b"/>
        <c:crossAx val="101"/>
        <c:crosses val="autoZero"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="101"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:crossAx val="100"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="r"/>
      <c:layout/>
    </c:legend>
  </c:chart>
</c:chartSpace>`;
}

function generatePieChart(data: ChartData, colors: string[]): string {
  const series = data.series[0]; // Pie charts use first series only
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr><a:defRPr sz="1800" b="1"/></a:pPr>
            <a:r><a:rPr lang="en-US" sz="1800" b="1"/><a:t>${escapeXml(data.title)}</a:t></a:r>
          </a:p>
        </c:rich>
      </c:tx>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:pieChart>
        <c:varyColors val="1"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:cat>
            <c:strRef>
              <c:f>Sheet1!$A$2:$A$${data.categories.length + 1}</c:f>
              <c:strCache>
                <c:ptCount val="${data.categories.length}"/>
                ${data.categories.map((cat, i) => `<c:pt idx="${i}"><c:v>${escapeXml(cat)}</c:v></c:pt>`).join('')}
              </c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>Sheet1!$B$2:$B$${data.categories.length + 1}</c:f>
              <c:numCache>
                <c:formatCode>General</c:formatCode>
                <c:ptCount val="${series.values.length}"/>
                ${series.values.map((val, i) => `<c:pt idx="${i}"><c:v>${val}</c:v></c:pt>`).join('')}
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
        <c:dLbls>
          <c:showLegendKey val="0"/>
          <c:showVal val="0"/>
          <c:showCatName val="1"/>
          <c:showSerName val="0"/>
          <c:showPercent val="1"/>
          <c:showBubbleSize val="0"/>
          <c:separator>, </c:separator>
        </c:dLbls>
      </c:pieChart>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="r"/>
      <c:layout/>
    </c:legend>
  </c:chart>
</c:chartSpace>`;
}

function generateAreaChart(data: ChartData, colors: string[]): string {
  const seriesXml = data.series.map((series, idx) => `
    <c:ser>
      <c:idx val="${idx}"/>
      <c:order val="${idx}"/>
      <c:tx>
        <c:strRef>
          <c:f>Sheet1!$${String.fromCharCode(66 + idx)}$1</c:f>
          <c:strCache>
            <c:ptCount val="1"/>
            <c:pt idx="0"><c:v>${escapeXml(series.name)}</c:v></c:pt>
          </c:strCache>
        </c:strRef>
      </c:tx>
      <c:spPr>
        <a:solidFill>
          <a:srgbClr val="${colors[idx]}">
            <a:alpha val="60000"/>
          </a:srgbClr>
        </a:solidFill>
        <a:ln>
          <a:solidFill>
            <a:srgbClr val="${colors[idx]}"/>
          </a:solidFill>
        </a:ln>
      </c:spPr>
      <c:cat>
        <c:strRef>
          <c:f>Sheet1!$A$2:$A$${data.categories.length + 1}</c:f>
          <c:strCache>
            <c:ptCount val="${data.categories.length}"/>
            ${data.categories.map((cat, i) => `<c:pt idx="${i}"><c:v>${escapeXml(cat)}</c:v></c:pt>`).join('')}
          </c:strCache>
        </c:strRef>
      </c:cat>
      <c:val>
        <c:numRef>
          <c:f>Sheet1!$${String.fromCharCode(66 + idx)}$2:$${String.fromCharCode(66 + idx)}$${data.categories.length + 1}</c:f>
          <c:numCache>
            <c:formatCode>General</c:formatCode>
            <c:ptCount val="${series.values.length}"/>
            ${series.values.map((val, i) => `<c:pt idx="${i}"><c:v>${val}</c:v></c:pt>`).join('')}
          </c:numCache>
        </c:numRef>
      </c:val>
    </c:ser>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr><a:defRPr sz="1800" b="1"/></a:pPr>
            <a:r><a:rPr lang="en-US" sz="1800" b="1"/><a:t>${escapeXml(data.title)}</a:t></a:r>
          </a:p>
        </c:rich>
      </c:tx>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:areaChart>
        <c:grouping val="standard"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:axId val="100"/>
        <c:axId val="101"/>
      </c:areaChart>
      <c:catAx>
        <c:axId val="100"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:axPos val="b"/>
        <c:crossAx val="101"/>
        <c:crosses val="autoZero"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="101"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:crossAx val="100"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="r"/>
      <c:layout/>
    </c:legend>
  </c:chart>
</c:chartSpace>`;
}

// Generate SmartArt Diagram
export function generateSmartArtDiagram(diagram: DiagramData): string {
  // Simplified SmartArt-like diagram using shapes
  const shapes = diagram.nodes.map((node, idx) => {
    const x = 914400 + (idx * 2000000);
    const y = 1828800;
    const color = node.type === 'start' ? '70AD47' : 
                  node.type === 'end' ? 'C55A11' :
                  node.type === 'decision' ? 'FFC000' : '4472C4';
    
    return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${idx + 10}" name="${escapeXml(node.label)}"/>
        <p:cNvSpPr/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="${x}" y="${y}"/>
          <a:ext cx="1828800" cy="914400"/>
        </a:xfrm>
        <a:prstGeom prst="${node.type === 'decision' ? 'diamond' : 'rect'}">
          <a:avLst/>
        </a:prstGeom>
        <a:solidFill>
          <a:srgbClr val="${color}"/>
        </a:solidFill>
        <a:ln>
          <a:solidFill>
            <a:srgbClr val="000000"/>
          </a:solidFill>
        </a:ln>
      </p:spPr>
      <p:txBody>
        <a:bodyPr/>
        <a:lstStyle/>
        <a:p>
          <a:pPr algn="ctr"/>
          <a:r>
            <a:rPr lang="en-US" sz="1400" b="1">
              <a:solidFill>
                <a:srgbClr val="FFFFFF"/>
              </a:solidFill>
            </a:rPr>
            <a:t>${escapeXml(node.label)}</a:t>
          </a:r>
        </a:p>
      </p:txBody>
    </p:sp>`;
  }).join('');
  
  return shapes;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
