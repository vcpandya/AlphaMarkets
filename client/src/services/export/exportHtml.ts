import type { AnalysisResults } from "../../types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signalColor(signal: string): string {
  switch (signal) {
    case "bullish":
      return "#22c55e";
    case "bearish":
      return "#ef4444";
    default:
      return "#a3a3a3";
  }
}

function buildQASection(results: AnalysisResults): string {
  if (!results.qa || results.qa.length === 0) return "";
  const items = results.qa
    .map(
      (q) => `
    <div class="qa-item">
      <h3>${escapeHtml(q.question)}</h3>
      <p>${escapeHtml(q.answer)}</p>
      <span class="confidence confidence-${q.confidence}">${q.confidence} confidence</span>
    </div>`,
    )
    .join("\n");
  return `<section><h2>Q&amp;A Analysis</h2>${items}</section>`;
}

function buildStocksSection(results: AnalysisResults): string {
  if (!results.stocks || results.stocks.length === 0) return "";
  const rows = results.stocks
    .map(
      (s) => `
      <tr>
        <td><strong>${escapeHtml(s.ticker)}</strong></td>
        <td>${escapeHtml(s.company)}</td>
        <td>${escapeHtml(s.market || "-")}</td>
        <td style="color:${signalColor(s.signal)}">${s.signal}</td>
        <td>${s.impactScore}</td>
        <td>${escapeHtml(s.reasoning)}</td>
      </tr>`,
    )
    .join("\n");
  return `
  <section>
    <h2>Stock Recommendations</h2>
    <table>
      <thead><tr><th>Ticker</th><th>Company</th><th>Market</th><th>Signal</th><th>Impact</th><th>Reasoning</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function buildGraphSection(results: AnalysisResults): string {
  if (!results.graph) return "";
  const graphJson = JSON.stringify(results.graph);
  return `
  <section>
    <h2>Impact Graph</h2>
    <p class="note">Interactive graphs are best viewed in the AlphaMarkets app. A basic visualization is rendered below.</p>
    <div id="graph-container" style="width:100%;height:500px;border:1px solid #333;border-radius:8px;overflow:hidden;"></div>
    <script src="https://d3js.org/d3.v7.min.js"><\/script>
    <script>
    (function() {
      var data = ${graphJson};
      var container = document.getElementById("graph-container");
      var width = container.clientWidth;
      var height = 500;
      var svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

      var simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.edges).id(function(d){return d.id;}).distance(100))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width/2, height/2));

      var link = svg.append("g").selectAll("line")
        .data(data.edges).enter().append("line")
        .attr("stroke", function(d){return d.direction==="positive"?"#22c55e":"#ef4444";})
        .attr("stroke-opacity", 0.6).attr("stroke-width", function(d){return Math.max(1,d.strength*3);});

      var node = svg.append("g").selectAll("circle")
        .data(data.nodes).enter().append("circle")
        .attr("r", function(d){return Math.max(5,d.size*2);})
        .attr("fill", function(d){
          if(d.signal==="bullish") return "#22c55e";
          if(d.signal==="bearish") return "#ef4444";
          return "#7c3aed";
        }).call(d3.drag()
          .on("start", function(e,d){if(!e.active) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y;})
          .on("drag", function(e,d){d.fx=e.x; d.fy=e.y;})
          .on("end", function(e,d){if(!e.active) simulation.alphaTarget(0); d.fx=null; d.fy=null;}));

      var label = svg.append("g").selectAll("text")
        .data(data.nodes).enter().append("text")
        .text(function(d){return d.label;})
        .attr("font-size", 10).attr("fill", "#ccc").attr("dx", 10).attr("dy", 4);

      simulation.on("tick", function(){
        link.attr("x1",function(d){return d.source.x;}).attr("y1",function(d){return d.source.y;})
            .attr("x2",function(d){return d.target.x;}).attr("y2",function(d){return d.target.y;});
        node.attr("cx",function(d){return d.x;}).attr("cy",function(d){return d.y;});
        label.attr("x",function(d){return d.x;}).attr("y",function(d){return d.y;});
      });
    })();
    <\/script>
  </section>`;
}

export function exportAsHtml(results: AnalysisResults, title: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f1a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; line-height: 1.6; }
  h1 { color: #a78bfa; margin-bottom: 1.5rem; font-size: 1.75rem; }
  h2 { color: #c4b5fd; margin: 2rem 0 1rem; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
  h3 { color: #ddd; margin-bottom: 0.5rem; }
  section { margin-bottom: 2rem; }
  .qa-item { background: #1e1e2e; border: 1px solid #333; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  .qa-item p { margin: 0.5rem 0; color: #bbb; }
  .confidence { font-size: 0.75rem; border-radius: 9999px; padding: 2px 8px; }
  .confidence-high { background: #22c55e33; color: #22c55e; }
  .confidence-medium { background: #eab30833; color: #eab308; }
  .confidence-low { background: #ef444433; color: #ef4444; }
  table { width: 100%; border-collapse: collapse; background: #1e1e2e; border-radius: 8px; overflow: hidden; }
  th { background: #2a2a3e; text-align: left; padding: 0.75rem 1rem; font-size: 0.85rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 0.75rem 1rem; border-top: 1px solid #333; font-size: 0.9rem; }
  .note { color: #888; font-style: italic; margin-bottom: 1rem; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${buildQASection(results)}
${buildStocksSection(results)}
${buildGraphSection(results)}
<footer style="margin-top:3rem;color:#555;font-size:0.8rem;">Generated by AlphaMarkets</footer>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
