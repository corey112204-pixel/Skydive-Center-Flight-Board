export type Window={start:Date;end:Date};
export const overlaps=(a:Window,b:Window)=>a.start<b.end&&b.start<a.end;
export function validatePilotSchedule(candidate:Window,existing:Window[],approvedTimeOff:Window[]){if(existing.some(x=>overlaps(candidate,x)))return 'Pilot is already scheduled during this period';if(approvedTimeOff.some(x=>overlaps(candidate,x)))return 'Pilot has approved time off during this period';return null}
export function validateAircraftSchedule(status:string,candidate:Window,existing:Window[],adminOverride=false){if(['grounded','maintenance'].includes(status)&&!adminOverride)return `Aircraft is ${status} and requires an administrator override`;if(existing.some(x=>overlaps(candidate,x)))return 'Aircraft is already scheduled during this period';return null}
export const maintenanceState=(remaining:number,warning:number):'ok'|'due_soon'|'overdue'=>remaining<=0?'overdue':remaining<=warning?'due_soon':'ok';
