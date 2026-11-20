// A validation extension point, not an exercise catalog or workout generator.
import Ajv2020 from 'ajv/dist/2020.js';
import schema from './exercise-mappings.schema.json' with {type:'json'};
const validate=new Ajv2020({strict:true}).compile(schema);

export function validateExerciseMappings(mapping,snapshot,{allowFictional=false}={}){
  if(!validate(mapping))throw new Error('Invalid exercise mapping exchange.');
  if(mapping.reviewStatus!=='reviewed'&&!allowFictional)throw new Error('Exercise mappings require joint review.');
  if(mapping.sourcePublicationId!==snapshot?.publication?.id)throw new Error('Revalidate mappings against this publication.');
  const byId=new Map(snapshot.layout.equipment.map(item=>[item.id,item])),exercises=new Set();
  for(const entry of mapping.mappings){
    if(exercises.has(entry.exerciseId))throw new Error('Duplicate exercise mapping.');exercises.add(entry.exerciseId);
    for(const id of entry.candidateEquipmentIds)if(!byId.has(id))throw new Error('Mapping must reference a published layout instance ID.');
  }
  // Availability must still be checked at workout resolution time.
  return structuredClone(mapping);
}
