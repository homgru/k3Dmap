window.MiniatureStyle={
 original:null,
 apply(map){
 const a=Cartography.config.appearance,mini=a.mode==='miniature';
 if(!this.original){this.original=map.getStyle().layers.filter(l=>l.type!=='custom').map(l=>({id:l.id,type:l.type,paint:structuredClone(l.paint||{}),sourceLayer:l['source-layer']}));this.light=structuredClone(map.getLight())}
 for(const l of this.original){let prop,value;
 if(l.type==='background'){prop='background-color';value='#eee9d8'}
 else if(l.id==='landuse_residential'){prop='fill-color';value='#e9e4d2'}
 else if(l.id==='water'){prop='fill-color';value='#a9d4d2'}
 else if(['landcover_grass','park'].includes(l.id)){prop='fill-color';value='#d4dda2'}
 else if(l.type==='line'&&l.sourceLayer==='transportation'){prop='line-color';value=l.id.includes('casing')?'#d3cbb5':'#fbf7e9'}
 if(prop)map.setPaintProperty(l.id,prop,mini?value:(l.paint[prop]??null));
 }
 if(mini){map.setPaintProperty('building-3d','fill-extrusion-color',a.wallColor);map.setPaintProperty('building-3d','fill-extrusion-opacity',1);map.setLight({anchor:'map',color:'#fff3db',intensity:.45,position:[1.5,210,35]})}else map.setLight(this.light);
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===a.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===a.mode))});
 document.getElementById('miniature-note').hidden=!mini;
 document.querySelector('.legend').hidden=mini;
 }
};
