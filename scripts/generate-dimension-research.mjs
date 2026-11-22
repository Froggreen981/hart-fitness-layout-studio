import {readFileSync,writeFileSync} from 'node:fs';
import {equipmentCatalog,getDimensionInfo,getDimensionCoverage} from '../dist/equipment-catalog.mjs';

const baseline=JSON.parse(readFileSync(new URL('../research/dimensions-baseline.json',import.meta.url)));
const originalIds=new Set(baseline.records.map(e=>e.id));
const reasons={
 'CHK-012':'RSL0714B suffix not established by the RSL0714 source. Photograph full model/serial label; measure footprint.',
 'CHK-048':'No model code. Identify and measure both Hoist plate trees; do not copy a generic plate-tree size.',
 'CHK-049':'No model code. Identify and measure both Hammer Strength curl-bar trees.',
 'CHK-050':'Manufacturer and model unknown. Photograph and measure EZ-bar rack.',
 'CHK-051':'20 Hoist adjustable benches lack model codes. Check every label and variant; measure each distinct frame/pad configuration.',
 'CHK-056':'Hammer Strength hip-thrust model unknown. Confirm plate-loaded model and generation; measure.',
 'CHK-057':'BSQUAT code not established on official Belt Squat page. Identify fixed versus portable variant and measure both units.',
 'CHK-059':'No model code. Identify and measure all four Hoist plate trees; do not assume CHK-048 is identical.',
 'CHK-062':'GPL617BKP code equivalence to GPL0617 is unproven. Photograph complete label before using comparable specifications.',
 'CHK-069':'IL-BP code has a Hammer Strength source, but survey manufacturer is Unspecified; generations differ. Identify manufacturer and measure.',
 'CHK-071':'PLCALF appears in secondary Hammer Strength listings; surveyed manufacturer remains Unknown. Identify label and manufacturer, then measure.',
 'CHK-074':'AR-TBAR not established by official Reloaded T Bar Row page. Official current and older dealer sizes differ. Identify generation and measure both.',
 'CHK-075':'Throwdown is only suspected; no label/model code. Confirm HIITMill X brand/generation; do not substitute StairMaster or non-X model dimensions.',
 'CHK-086':'MJCORE specifies the tower component, not the complete Lat Pulldown + Low Row arrangement. Record station modules and total assembled envelope.',
 'CHK-087':'HDCR8 sources found, but no verified B04 configuration envelope. Identify all six rack configurations, storage horns, platforms and overall footprint.',
 'CHK-088':'Three single squat racks lack manufacturer/model. Identify and measure each configuration.',
 'CHK-091':'EliteFTS core trainer model unknown. Photograph attachment/base and measure assembled floor envelope.',
 'CHK-094':'Unidentified rectangular equipment. Photograph, identify function/manufacturer, and measure all axes.'
};
const attemptedSources={
 'CHK-012':['https://www.precor.com/en-US/products/RSL0714'],
 'CHK-062':['https://www.precor.com/en-US/products/GPL0617'],
 'CHK-071':['https://www.renewfit.com/en/seated-calf-raise-plcalf-hammer-strength%2Ca648.php'],
 'CHK-087':['https://www.globalfitness.com/products/used-hammer-strength-8-foot-heavy-duty-combo-rack','https://www.fitness24.nl/upload/docs/lifefitness-brochure-totale-collectie.pdf']
};
const rows=equipmentCatalog.map(entry=>{
 const info=getDimensionInfo(entry);
 return {...entry,dimensionCategory:info.kind,hasSourceDimensions:info.sourced,
  researchStatus:originalIds.has(entry.id)?'prior-source-retained':info.sourced?'new-source':entry.dimensionReference?'reference-only':'unresolved',
  convertedCm:info.convertedCm,automaticSourcePrefill:info.canPrefill,
  onSiteMeasurementRecorded:false,
  staffAction:reasons[entry.id]||(entry.dimensionEvidence?.reviewRequired?'Confirm serial/model generation and resolve source conflict; measure actual footprint.':'Confirm physical model and measure before verified placement.'),
  researchMethod:originalIds.has(entry.id)?'Prior attribution retained; not independently reverified.':info.sourced?'Exact model code or named product checked in linked specification table.':entry.modelNumber?'Brand/model, alternate formatting and product-series searches; no reliable complete physical configuration established.':'Exact model research blocked by missing model identification; generic dimensions not substituted.',
  examinedReferences:[...new Set([info.evidence?.sourceUrl,...(entry.dimensionEvidence?.conflicts||[]).map(c=>c.sourceUrl),...(attemptedSources[entry.id]||[])].filter(Boolean))]
 };
});
const coverage=getDimensionCoverage(),newRows=rows.filter(r=>r.researchStatus==='new-source'),remaining=rows.filter(r=>!r.hasSourceDimensions);
const inventory={date:'2026-11-22',baselineCommit:baseline.sourceCommit,initial:{groups:baseline.sourcedGroups,units:baseline.sourcedUnits},coverage,
 newlySourced:{groups:newRows.length,units:newRows.reduce((n,e)=>n+e.quantity,0)},remaining:{groups:remaining.length,units:remaining.reduce((n,e)=>n+e.quantity,0)},records:rows};
const csvCell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
const csv=(records)=>[['Catalog ID','Manufacturer','Equipment','Model','Model confidence','Quantity','Physical IDs','Dimension evidence','Source URL','Staff action'],...records.map(e=>[e.id,e.manufacturer,e.name,e.modelNumber,e.modelStatus,e.quantity,e.inventoryIds.join(' | '),getDimensionInfo(e).label,getDimensionInfo(e).evidence?.sourceUrl||'',e.staffAction])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
const cell=value=>String(value??'Unknown').replaceAll('|','\\|').replaceAll('\n',' ');
const size=e=>{const d=e.dimensionEvidence.original;return [d.length,d.width,...(d.height===undefined?[]:[d.height])].join(' × ')+' '+e.dimensionEvidence.originalUnits+(d.height===undefined?' (L × W; height unknown)':' (L × W × H)');};
const report=`# Hart equipment dimensions research — November 22, 2026

The catalog retains all **95 groups / 155 physical IDs**, model confidence, survey notes and original dimensions. No placement, rotation, manual footprint, saved layout, geometry, schema, migration or production data was changed. Model identity and dimensional evidence are independent.

## Coverage and the 20-versus-23 discrepancy

At GitHub baseline \`${baseline.sourceCommit}\`, **20 groups / 25 units** contain sourced dimensions. The inspected catalog, planner and checklist all derive that same 20; the reported local 23 could not be reproduced. There is no evidence establishing which local build or counting rule produced 23. The new UI explicitly computes catalog **groups and units**, labels source categories, and has a regression for the total.

Final coverage is **${coverage.sourced.groups} / 95 groups (${(coverage.sourced.groups/95*100).toFixed(1)}%) / ${coverage.sourced.units} / 155 represented units (${(coverage.sourced.units/155*100).toFixed(1)}%)**. **${newRows.length} groups / ${inventory.newlySourced.units} units** gained a source. Categories: **${coverage.manufacturer.groups} new manufacturer-source groups**, **${coverage.secondary.groups} secondary-source groups**, **${coverage.legacy.groups} prior manufacturer attributions retained without fresh page-level verification**. The prior 20 are not counted as newly researched exact specifications. There are **${coverage.reference.groups} reference-only groups** and **${coverage.unknown.groups} groups without usable dimension evidence**; neither contributes to sourced coverage.

**${remaining.length} groups / ${inventory.remaining.units} units** still require identification/configuration work and measurement to obtain their own usable dimensions. All ${remaining.length} are blocked by missing or unresolved model/manufacturer/configuration evidence (not a claim that their survey confidence was changed). **No physical measurements were supplied: all 95 groups / 155 units still need physical confirmation before a verified gym map.** Published dimensions do not prove individual unit size or clearance. ${coverage.conflicts.groups} sourced groups have documented conflicts; additional generation-review records are explicitly flagged. Two sourced groups lack a single fixed published height (platform, adjustable Floor Glute); height remains absent rather than invented. Rogue Abram GHD 2.0 uses the manufacturer’s 48 in overall height, separately from its 43 in hip-pad height.

## Method and limits

Public searches covered the unsourced exact codes, alternate formatting and product families; manufacturer pages, manuals and indexed catalog tables were preferred. A verified model code alone did not certify a gym measurement. Freemotion 2022 tables (printed pp. 252–255) and matching 2024 indexed tables supplied EPIC dimensions; direct legacy PDF redirects failed, so the access limitation is retained on each record. The manufacturer Iso-Lateral manual is 1000419-0001 AC; the cited section distinguishes equipment size without plates from live area. TuffStuff's legacy official PDF was located but its text/drawing axes were not reliably extractable; a traceable civic equipment proposal supplies the exact PPF-800 table, labeled secondary and requiring configuration review. Unidentified trees, racks, benches and the rectangular item cannot acquire exact dimensions from brand-only searches.

Lengths and widths describe equipment itself, not shipping crates, nominal pad/mat size, live area or mandated safety clearance. Rogue's deadlift platform uses the **100 × 52 in overall frame**, not nominal 96 × 48 in flooring. Inch originals are retained; displayed metric conversions use exactly **2.54 cm/in** and round only for display. Conflicting paired metric values are not substituted for accurate conversions. Source review dates describe research, never on-site verification.

Existing baseline dimensions are unchanged. Their prior source links remain available, but the 50 MB Precor catalog could not be freshly opened through the research tool; individual baseline page numbers remain unrecorded. Rogue competition bench height is rack overall height, not pad height; Thompson Fat Pad is a variant to check on site. No comparable reference is automatically used as a footprint. Conflicting specifications are shown with links and no automatic source prefill. Linking a catalog model changes metadata only; saved manual sizes and positions are preserved. Editing manufacturer/model hides unrelated source dimensions, including when a checklist observation rejects the catalog model.

## Newly sourced groups

Source quality below concerns the document, while model confidence remains the original survey value. Exact model code does not resolve a manufacturing generation conflict.

| Group | Equipment / model | Qty | Original dimensions | Evidence | Source / reference |
|---|---|---:|---|---|---|
${newRows.map(e=>`| ${e.id} | ${cell(e.manufacturer+' '+e.name+' / '+e.modelNumber)} (${e.modelStatus}) | ${e.quantity} | ${size(e)} | ${e.dimensionEvidence.quality}${e.dimensionEvidence.reviewRequired?' · review required':''} | [Source](${e.dimensionEvidence.sourceUrl}) · ${cell(e.dimensionEvidence.reference)} |`).join('\n')}

## Conflicting specifications

No average or guessed reconciliation was applied. Each conflict is retained in catalog provenance and blocks automatic source prefill. Resolve it using the unit label, manufacturing generation and a tape measure.

| Group / model | Selected source dimensions | Discrepancy and second reference |
|---|---|---|
${rows.filter(e=>e.dimensionEvidence?.conflicts?.length).flatMap(e=>e.dimensionEvidence.conflicts.map(c=>`| ${e.id} / ${e.modelNumber} | ${size(e)} | ${cell(c.note)}${c.original?' Alternative: '+[c.original.length,c.original.width,c.original.height].filter(n=>n!==undefined).join(' × ')+' '+c.originalUnits+'.':''} [Reference](${c.sourceUrl}) |`)).join('\n')}

## Remaining walkthrough inventory

These ${remaining.length} groups represent ${inventory.remaining.units} units. Reference-only sizes belong to a comparable product or component and are excluded from source coverage. Staff should record manufacturer, complete model/serial label, generation/options, actual L/W/H, and photos with physical IDs. Measure the assembled equipment envelope; record operating clearance separately. If multiple units differ, record each physical ID rather than applying one measurement to a group.

| Group | Manufacturer / equipment / reported model | Qty | Physical IDs | Evidence / required staff action |
|---|---|---:|---|---|
${remaining.map(e=>`| ${e.id} | ${cell(e.manufacturer+' / '+e.name+' / '+(e.modelNumber||'unidentified'))} | ${e.quantity} | ${e.inventoryIds.join(', ')} | ${cell(e.staffAction)}${e.dimensionReference?' [Reference only]('+e.dimensionReference.sourceUrl+')':''} |`).join('\n')}

## Reproducible inventory and validation

[Structured inventory](research/equipment-research-inventory.json) contains all 95 groups, original identity/confidence/notes, dimension evidence, conversions, candidate source references, conflicts and staff actions. [All-groups CSV](research/equipment-research-inventory.csv) and [walkthrough CSV](research/remaining-dimensions-walkthrough.csv) support the next visit. [Baseline identities](research/equipment-identities-baseline.json) and [baseline dimensions](research/dimensions-baseline.json) are immutable preservation fixtures. [New findings](research/dimension-findings.json) records 57 research additions. Run \`node scripts/generate-dimension-research.mjs --check\` to verify generated reports against the current catalog.

Automated checks cover all baseline identities and dimension values, source/model binding, finite dimensions, optional height, inch conversions, secondary/reference labels, generation conflicts, unchanged geometry on linking, corrected-model isolation, derived checklist counts and source/Worker desktop/mobile workflows. Exact completed check totals and commit status are recorded in DEVELOPMENT-STATUS.md. No deployment, merge, production D1 write, access change, gym publication or workout activation is authorized by this research.
`;
const outputs={'research/equipment-research-inventory.json':JSON.stringify(inventory,null,2)+'\n','research/equipment-research-inventory.csv':csv(rows),'research/remaining-dimensions-walkthrough.csv':csv(remaining),'DIMENSIONS-RESEARCH.md':report};
for(const [path,value] of Object.entries(outputs)){
 const url=new URL('../'+path,import.meta.url);
 if(process.argv.includes('--check')){if(readFileSync(url,'utf8')!==value)throw Error('Research report is stale: '+path);}
 else writeFileSync(url,value);
}
console.log(JSON.stringify({coverage,newlySourced:inventory.newlySourced,remaining:inventory.remaining}));
