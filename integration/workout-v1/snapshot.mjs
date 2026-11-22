// Shared identity checks for independent mapping and highlighting consumers.
export function indexPublishedEquipment(snapshot){
  if(snapshot?.apiVersion!==1||typeof snapshot.publication?.id!=='string'||!snapshot.publication.id||
      !Array.isArray(snapshot.layout?.equipment))throw new Error('Use a valid API v1 published snapshot.');
  const byId=new Map(),inventoryIds=new Set();
  for(const item of snapshot.layout.equipment){
    if(!item||typeof item.id!=='string'||byId.has(item.id)||
        !['available','out-of-service'].includes(item.status)||
        item.inventoryId!==undefined&&typeof item.inventoryId!=='string'||
        item.inventoryId&&inventoryIds.has(item.inventoryId)){
      const error=new Error('Published equipment identities must be unambiguous.');error.code='ambiguous_equipment';throw error;
    }
    byId.set(item.id,item);if(item.inventoryId)inventoryIds.add(item.inventoryId);
  }
  return byId;
}
