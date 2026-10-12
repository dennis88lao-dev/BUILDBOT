// Shared by the browser AND the server: parts database + compatibility engine + optimizer (plain code, no AI)
export const CATS=['cpu','gpu','motherboard','ram','storage','psu','case','cooler'];
const mk=(c,k,r)=>r.map((v,i)=>{const o={id:c+i,category:c,image_url:'https://placehold.co/80',purchase_url:'https://example.com/'+c+i};k.forEach((x,j)=>o[x]=v[j]);return o});
const DB={
cpu:mk('cpu',['name','brand','socket','cores','threads','tdp_w','price','benchmark_score','has_integrated_gpu'],[['Ryzen 5 7600','AMD','AM5',6,12,65,199,66,true],['Ryzen 5 9600X','AMD','AM5',6,12,65,279,74,true],['Ryzen 7 7800X3D','AMD','AM5',8,16,120,399,86,true],['Ryzen 7 9700X','AMD','AM5',8,16,65,329,80,true],['Ryzen 9 9950X','AMD','AM5',16,32,170,549,98,true],['Core Ultra 5 245K','Intel','LGA1851',14,14,125,309,76,true],['Core Ultra 7 265K','Intel','LGA1851',20,20,125,394,88,true],['Core Ultra 9 285K','Intel','LGA1851',24,24,125,589,97,true]]),
gpu:mk('gpu',['name','brand','chipset','vram_gb','length_mm','tdp_w','recommended_psu_w','power_connectors','price','benchmark_score'],[['RX 9060 XT 16GB','AMD','RX 9060 XT',16,270,182,550,'1x 8-pin',349,48],['RTX 5060 Ti 16GB','NVIDIA','RTX 5060 Ti',16,244,180,600,'1x 16-pin',429,54],['RTX 5070','NVIDIA','RTX 5070',12,300,250,650,'1x 16-pin',549,66],['RX 9070 XT','AMD','RX 9070 XT',16,320,304,750,'2x 8-pin',599,76],['RTX 5070 Ti','NVIDIA','RTX 5070 Ti',16,304,300,750,'1x 16-pin',749,80],['RTX 5080','NVIDIA','RTX 5080',16,304,360,850,'1x 16-pin',999,90],['RTX 5090','NVIDIA','RTX 5090',32,304,575,1000,'1x 16-pin',1999,100]]),
motherboard:mk('motherboard',['name','socket','chipset','form_factor','memory_type','max_ram_gb','ram_slots','m2_slots','price'],[['MSI B650 Gaming Plus WiFi','AM5','B650','ATX','DDR5',192,4,2,169],['Gigabyte B850M Aorus Elite','AM5','B850','mATX','DDR5',192,4,2,179],['ASUS TUF X870-Plus WiFi','AM5','X870','ATX','DDR5',192,4,3,289],['ASUS ROG Strix X870E-E','AM5','X870E','ATX','DDR5',192,4,4,499],['Gigabyte B860M Aorus Elite','LGA1851','B860','mATX','DDR5',192,4,2,169],['MSI PRO Z890-P WiFi','LGA1851','Z890','ATX','DDR5',192,4,3,239],['MSI MAG Z890 Tomahawk','LGA1851','Z890','ATX','DDR5',192,4,4,329]]),
ram:mk('ram',['name','type','capacity_gb','speed_mhz','modules','price'],[['Corsair Vengeance 16GB (2x8) DDR5-5600','DDR5',16,5600,2,62],['G.Skill Ripjaws S5 32GB (2x16) DDR5-6000','DDR5',32,6000,2,104],['Kingston Fury Beast 32GB (2x16) DDR5-6400','DDR5',32,6400,2,119],['Corsair Vengeance 64GB (2x32) DDR5-6000','DDR5',64,6000,2,219]]),
storage:mk('storage',['name','type','capacity_gb','price'],[['WD Blue SN5000 1TB','NVMe',1000,79],['Samsung 990 EVO Plus 1TB','NVMe',1000,89],['Samsung 990 Pro 2TB','NVMe',2000,169],['Crucial MX500 1TB','SATA',1000,79]]),
psu:mk('psu',['name','wattage','efficiency_rating','modular','price'],[['Corsair RM650e','650','80+ Gold','Full',99],['MSI MAG A750GL','750','80+ Gold','Full',109],['Corsair RM850e','850','80+ Gold','Full',129],['Corsair RM1000x','1000','80+ Gold','Full',189],['Corsair HX1200i','1200','80+ Platinum','Full',249]]).map(p=>({...p,wattage:+p.wattage})),
case:mk('case',['name','supported_form_factors','max_gpu_length_mm','max_cooler_height_mm','price'],[['Cooler Master NR200P','mATX,ITX','330','155',99],['Fractal Pop Air','ATX,mATX,ITX','405','170',89],['NZXT H5 Flow','ATX,mATX,ITX','365','165',94],['Lian Li Lancool 216','ATX,mATX,ITX','392','180',99],['Fractal North','ATX,mATX,ITX','355','170',139]]).map(p=>({...p,supported_form_factors:p.supported_form_factors.split(','),max_gpu_length_mm:+p.max_gpu_length_mm,max_cooler_height_mm:+p.max_cooler_height_mm})),
cooler:mk('cooler',['name','supported_sockets','height_mm','type','price'],[['Thermalright Peerless Assassin 120 SE','AM5,LGA1851',155,'air',38],['DeepCool AK620','AM5,LGA1851',160,'air',65],['Noctua NH-D15 G2','AM5,LGA1851',168,'air',149],['Arctic Liquid Freezer III 360','AM5,LGA1851',55,'AIO',119]]).map(p=>({...p,supported_sockets:p.supported_sockets.split(',')}))};
const all=Object.values(DB).flat(),byId=id=>all.find(p=>p.id===id);
function validateBuild(b){const E=[],W=[],e=(c,m)=>E.push({cats:c,msg:m});const{cpu,gpu,motherboard:mb,ram,psu,case:cs,cooler:cl}=b;
if(cpu&&mb&&cpu.socket!==mb.socket)e(['cpu','motherboard'],`CPU socket ${cpu.socket} doesn't match board socket ${mb.socket}`);
if(ram&&mb&&ram.type!==mb.memory_type)e(['ram','motherboard'],`RAM is ${ram.type} but board needs ${mb.memory_type}`);
if(mb&&cs&&!cs.supported_form_factors.includes(mb.form_factor))e(['motherboard','case'],`Case doesn't support ${mb.form_factor} boards`);
if(gpu&&cs&&gpu.length_mm>cs.max_gpu_length_mm)e(['gpu','case'],`GPU ${gpu.length_mm}mm exceeds case limit ${cs.max_gpu_length_mm}mm`);
if(cl&&cs&&cl.height_mm>cs.max_cooler_height_mm)e(['cooler','case'],`Cooler ${cl.height_mm}mm exceeds case limit ${cs.max_cooler_height_mm}mm`);
if(cl&&cpu&&!cl.supported_sockets.includes(cpu.socket))e(['cooler','cpu'],`Cooler doesn't support ${cpu.socket}`);
if(psu&&gpu&&psu.wattage<gpu.recommended_psu_w)e(['psu','gpu'],`PSU ${psu.wattage}W is below GPU's recommended ${gpu.recommended_psu_w}W`);
if(psu&&cpu&&gpu){const n=Math.ceil((cpu.tdp_w+gpu.tdp_w+150)*1.2);if(psu.wattage<n)e(['psu','cpu','gpu'],`PSU ${psu.wattage}W is below required ${n}W`)}
if(ram&&mb&&ram.capacity_gb>mb.max_ram_gb)e(['ram','motherboard'],`RAM ${ram.capacity_gb}GB exceeds board max ${mb.max_ram_gb}GB`);
if(ram&&mb&&ram.modules>mb.ram_slots)e(['ram','motherboard'],`RAM needs ${ram.modules} slots; board has ${mb.ram_slots}`);
if(cpu&&gpu&&Math.abs(cpu.benchmark_score-gpu.benchmark_score)>30)W.push(`Possible bottleneck: CPU ${cpu.benchmark_score} vs GPU ${gpu.benchmark_score} benchmark gap`);
return{errors:E,warnings:W,complete:CATS.every(c=>b[c]),verified:CATS.every(c=>b[c])&&!E.length}}
const okWith=(b,c,p)=>!validateBuild({...b,[c]:p}).errors.some(x=>x.cats.includes(c));

export const sub=b=>CATS.reduce((s,c)=>s+(b[c]?.price||0),0);
export const total=(b,tax=8.5)=>sub(b)*(1+tax/100);
export const watts=b=>(b.cpu?.tdp_w||0)+(b.gpu?.tdp_w||0)+(b.cpu||b.gpu?150:0);
export const perf=b=>b.gpu&&b.cpu?+(b.gpu.benchmark_score*.6+b.cpu.benchmark_score*.4).toFixed(1):0;
export const money=n=>'$'+n.toFixed(2).replace(/\.00$/,'');
function optimize(B,use='gaming',must={},tax=8.5){const lim=B/(1+tax/100),[wg,wc]=use==='editing'?[.4,.6]:use==='gaming'?[.65,.35]:[.5,.5];let best=null,bs=-1;
const cheap=(c,b,f=()=>true)=>DB[c].filter(p=>f(p)&&okWith(b,c,p)).sort((x,y)=>x.price-y.price)[0];
const pool=c=>must[c]?DB[c].filter(p=>p.id===must[c]):DB[c];
for(const cpu of pool('cpu'))for(const gpu of pool('gpu')){let b={cpu,gpu};
for(const[c,f]of[['motherboard'],['ram',p=>p.capacity_gb>=(lim>1000?32:16)],['storage',p=>p.type==='NVMe'&&p.capacity_gb>=1000],['psu'],['case'],['cooler']]){const p=must[c]?DB[c].find(x=>x.id===must[c]):cheap(c,b,f);if(!p||!okWith(b,c,p)){b=null;break}b[c]=p}
if(!b)continue;const t=CATS.reduce((s,c)=>s+b[c].price,0);if(t>lim)continue;const sc=gpu.benchmark_score*wg+cpu.benchmark_score*wc;if(sc>bs){bs=sc;best=b}}
return best}

export{DB,all,byId,validateBuild,okWith,optimize};
