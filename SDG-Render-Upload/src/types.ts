export type DZ='ALL'|'GA'|'AL'|'TN';
export type Page='dashboard'|'schedule'|'aircraft'|'pilots'|'maintenance'|'squawks'|'daily'|'timeoff'|'reports'|'documents'|'admin';
export type Tone='green'|'amber'|'red'|'blue'|'gray';
export interface Operation {dz:Exclude<DZ,'ALL'>; place:string; code:string; aircraft:string; type:string; pilot:string; status:string; tone:Tone; loads:number; hours:number}
