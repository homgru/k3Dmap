// Small reusable cartographic textures; no per-tree geometry or extra tile requests.
function addLandcover(map){
 const pattern=(id,draw)=>{const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');draw(ctx);map.addImage(id,ctx.getImageData(0,0,32,32),{pixelRatio:2})};
 pattern('field-rows',c=>{c.strokeStyle='rgba(121,91,45,0.55)';c.lineWidth=1.5;for(let x=-32;x<64;x+=8){c.beginPath();c.moveTo(x,0);c.lineTo(x+32,32);c.stroke()}});
 const layers=map.getStyle().layers;const before=layers.find(l=>l.id==='terrain-hillshade')?.id||layers.find(l=>l.type==='line')?.id;
 const farm=['==',['get','class'],'farmland'];const wood=['==',['get','class'],'wood'];
 const base={source:'openmaptiles','source-layer':'landcover'};
 const add=l=>map.addLayer({...base,...l},before);
 add({id:'farmland-surface',type:'fill',filter:farm,paint:{'fill-color':'#d4c397','fill-opacity':0.65}});
 add({id:'farmland-texture',type:'fill',filter:farm,minzoom:12,paint:{'fill-pattern':'field-rows','fill-opacity':['interpolate',['linear'],['zoom'],12,0,14,0.7,16,0.85]}});
 add({id:'farmland-boundary',type:'line',filter:farm,minzoom:13,paint:{'line-color':'#9c8757','line-width':['interpolate',['linear'],['zoom'],13,0.4,17,1.3],'line-opacity':0.65}});
 const ids=['farmland-surface','farmland-texture','farmland-boundary'];
 const toggle=document.getElementById('landcover');const apply=()=>ids.forEach(id=>map.setLayoutProperty(id,'visibility',toggle.checked?'visible':'none'));toggle.onchange=apply;apply();
 import("./trees.js").then(m=>m.addTrees(map)).catch(()=>{document.getElementById("status").textContent="입체 나무를 불러오지 못했습니다. 새로고침해 주세요."});
}