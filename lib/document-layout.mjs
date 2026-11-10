// Shared estimates for pagination decisions and their user-visible limitations.
// They are not measured font geometry or a promise of source-identical layout.
import {documentColumnGroups} from './document-model.mjs';
export const COLUMN_GAP_TWIPS=300;
export function columnWidthsTwips(widths,bodyWidth){const available=bodyWidth-COLUMN_GAP_TWIPS*(widths.length-1),result=widths.map(width=>Math.round(available*width/100));result[result.length-1]=available-result.slice(0,-1).reduce((sum,width)=>sum+width,0);return result;}
export const bodyHeightTwips=layout=>16838-Math.round(layout.margin*1440/25.4)*2-400;
export function estimatedRowHeight(row,widths,layout){
 const lines=Math.max(1,...widths.map((width,index)=>String(row[index]||'').split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/Math.max(1,width/(layout.fontSize*10)))),0)));
 return lines*layout.fontSize*layout.lineHeight*20+200;
}
export function modelLayoutIssues(document,layout){
 const issues=[],bodyWidth=11906-Math.round(layout.margin*1440/25.4)*2,height=bodyHeightTwips(layout),groups=document?documentColumnGroups(document):new Map();
 for(const group of groups.values())issues.push({code:'column-layout-review',blockId:group.firstBlockId,estimated:true,message:'Die Spalten sind strukturiert gesetzt. Lesereihenfolge und Seitenumbrüche am Original prüfen.'});
 for(const block of document?.blocks||[]){if(block.type!=='table')continue;
  const group=groups.get(block.properties?.columnGroup),available=group?columnWidthsTwips(group.widths,bodyWidth)[block.properties.columnIndex]:bodyWidth;
  const automatic=block.properties?.source==='legacy-text'&&!block.properties?.widthsExplicit&&block.relativeColumnWidths.length===2&&block.relativeColumnWidths.every(width=>Math.abs(width-50)<.01),weights=automatic?[layout.tableLabelWidth,100-layout.tableLabelWidth]:block.relativeColumnWidths,widths=weights.map(width=>available*width/100),rows=block.rows.map(row=>row.map(cell=>cell.text)),headerRows=block.properties?.headerRows||0;
  if(layout.keepRows&&block.keepRows!==false&&rows.some(row=>estimatedRowHeight(row,widths,layout)>height))issues.push({code:'oversized-table-row',blockId:block.id,estimated:true,message:'Eine Tabellenzeile ist voraussichtlich höher als eine Seite und darf umbrechen. Fortsetzung prüfen.'});
  if(headerRows&&rows.slice(0,headerRows).reduce((sum,row)=>sum+estimatedRowHeight(row,widths,layout),0)>height)issues.push({code:'oversized-table-header',blockId:block.id,estimated:true,message:'Der Tabellenkopf ist voraussichtlich zu hoch für eine Seite und wird nicht wiederholt. Darstellung prüfen.'});
 }
 return issues;
}
