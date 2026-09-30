import type {Operation,Tone} from './types';
export const operations:Operation[]=[
 {dz:'GA',place:'Skydive Georgia',code:'GA',aircraft:'N708SD',type:'Twin Otter',pilot:'Corey Anderson',status:'Operating',tone:'green',loads:18,hours:5.7},
 {dz:'AL',place:'Skydive Alabama',code:'AL',aircraft:'N750SD',type:'PAC 750XL',pilot:'Jamie Rivera',status:'Operating',tone:'green',loads:14,hours:4.2},
 {dz:'TN',place:'Skydive Tennessee',code:'TN',aircraft:'N219SD',type:'Cessna Caravan',pilot:'Morgan Lee',status:'Weather hold',tone:'amber',loads:0,hours:0},
];
export const aircraft:{tail:string,type:string,dz:string,status:string,tone:Tone,time:string,maint:string}[]=[
 {tail:'N708SD',type:'Twin Otter',dz:'Georgia',status:'Operating',tone:'green',time:'12,487.3',maint:'42.7 hr'},
 {tail:'N750SD',type:'PAC 750XL',dz:'Alabama',status:'Operating',tone:'green',time:'6,284.1',maint:'18 days'},
 {tail:'N219SD',type:'Cessna Caravan',dz:'Tennessee',status:'Weather hold',tone:'amber',time:'8,921.8',maint:'73.2 hr'},
 {tail:'N846SD',type:'King Air 90',dz:'Georgia',status:'Maintenance',tone:'red',time:'9,104.6',maint:'OVERDUE'},
];
export const pilots:{name:string,initials:string,home:string,phone:string,status:string,tone:Tone,qual:string,until:string}[]=[
 {name:'Corey Anderson',initials:'CA',home:'Georgia',phone:'(404) 555-0128',status:'Flying today',tone:'green',qual:'Current',until:'Medical · 184 days'},
 {name:'Jamie Rivera',initials:'JR',home:'Alabama',phone:'(205) 555-0142',status:'Flying today',tone:'green',qual:'Due soon',until:'Flight review · 24 days'},
 {name:'Morgan Lee',initials:'ML',home:'Tennessee',phone:'(615) 555-0119',status:'Weather hold',tone:'amber',qual:'Current',until:'Medical · 213 days'},
 {name:'Taylor Brooks',initials:'TB',home:'Georgia',phone:'(470) 555-0177',status:'Available',tone:'blue',qual:'Expired',until:'Company check · 6 days ago'},
];
export const maintenance:{item:string,tail:string,due:string,remaining:string,percent:number,tone:Tone}[]=[
 {item:'100 Hour Inspection',tail:'N750SD',due:'6,302.0 hr',remaining:'17.9 hr',percent:82,tone:'amber'},
 {item:'Annual Inspection',tail:'N219SD',due:'Sep 24, 2026',remaining:'22 days',percent:76,tone:'amber'},
 {item:'Left Engine Inspection',tail:'N708SD',due:'12,530.0 hr',remaining:'42.7 hr',percent:58,tone:'green'},
 {item:'Landing Gear Inspection',tail:'N846SD',due:'Aug 28, 2026',remaining:'5 days overdue',percent:100,tone:'red'},
];
