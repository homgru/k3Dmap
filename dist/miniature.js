import * as THREE from './three.module.js';
// Decorative roofs/windows follow existing building footprints. They are not surveyed facades.
export function addMiniature(map){
 let renderer,scene,camera,roofs,windows,origin,unit,dirty=true,timer;
 const active=()=>Cartography.config.appearance.mode==='miniature'&&Cartography.config.buildings.enabled&&map.getZoom()>=15;
 const schedule=()=>{dirty=true;clearTimeout(timer);timer=setTimeout(()=>map.triggerRepaint(),180)};
 const source=e=>{if(e.isSourceLoaded&&['openmaptiles','terrain-dem'].includes(e.sourceId))schedule()};
 const rebuild=()=>{
 dirty=false;origin=maplibregl.MercatorCoordinate.fromLngLat(map.getCenter());unit=origin.meterInMercatorCoordinateUnits();
 const seen=new Set(),items=[];const canvas=map.getCanvas();
 for(const f of map.querySourceFeatures('openmaptiles',{sourceLayer:'building'})){
 const h=Number(f.properties.render_height??6);if(!Number.isFinite(h)||h<=0||h>120)continue;
 for(const rings of f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[]){
 const outer=rings[0];if(outer.length<4||outer.length>100)continue;
 const ll=[outer.slice(0,-1).reduce((s,p)=>s+p[0],0)/(outer.length-1),outer.slice(0,-1).reduce((s,p)=>s+p[1],0)/(outer.length-1)];
 const key=ll.map(n=>n.toFixed(6)).join(',')+':'+h;if(seen.has(key))continue;seen.add(key);
 const screen=map.project(ll);if(screen.x<0||screen.y<0||screen.x>canvas.clientWidth||screen.y>canvas.clientHeight)continue;
 const c=maplibregl.MercatorCoordinate.fromLngLat(ll);const d=((c.x-origin.x)/unit)**2+((c.y-origin.y)/unit)**2;if(d>1800**2)continue;
 const elevation=map.getTerrain()?map.queryTerrainElevation(ll):0;if(elevation==null)continue;
 items.push({rings,h,elevation,d});}}
 items.sort((a,b)=>a.d-b.d);const positions=[],colors=[];let count=0;
 const cfg=Cartography.config.appearance;windows.material.color.set(cfg.windowColor);
 const color=new THREE.Color(cfg.roofColor),flat=new THREE.Color('#cbbca7');
 const tri=(a,b,c,tint)=>{positions.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(tint.r,tint.g,tint.b)};
 const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3();
 for(const item of items.slice(0,240)){
 const rs=item.rings.map(r=>r.slice(0,-1).map(ll=>{const c=maplibregl.MercatorCoordinate.fromLngLat(ll);return new THREE.Vector2((c.x-origin.x)/unit,(c.y-origin.y)/unit)}));const ring=rs[0];const z=item.elevation+item.h+.3;
 const faces=THREE.ShapeUtils.triangulateShape(ring,rs.slice(1));const all=rs.flat();for(const [a,b,c] of faces)tri([all[a].x,all[a].y,z],[all[b].x,all[b].y,z],[all[c].x,all[c].y,z],item.h<25?color:flat);
 // Pitched roofs only on near-rectangular, low footprints; complex outlines retain flat roofs.
 if(cfg.roofs&&ring.length===4&&rs.length===1&&item.h<25){const edges=ring.map((p,i)=>ring[(i+1)%4].clone().sub(p));const rectangular=edges.every((e,i)=>Math.abs(e.clone().normalize().dot(edges[(i+1)%4].clone().normalize()))<.15);if(rectangular){const r=edges[0].length()>edges[1].length()?ring:[ring[1],ring[2],ring[3],ring[0]];const rise=Math.min(3,r[1].distanceTo(r[2])*.3);const a=[r[0].x,r[0].y,z],b=[r[1].x,r[1].y,z],c=[r[2].x,r[2].y,z],d=[r[3].x,r[3].y,z];const m=[(a[0]+d[0])/2,(a[1]+d[1])/2,z+rise],n=[(b[0]+c[0])/2,(b[1]+c[1])/2,z+rise];tri(a,b,n,color);tri(a,n,m,color);tri(m,n,c,color);tri(m,c,d,color);tri(a,m,d,color);tri(b,c,n,color)}}
 if(!cfg.windows)continue;
 for(let i=0;i<ring.length&&count<4000;i++){const a=ring[i],b=ring[(i+1)%ring.length],length=a.distanceTo(b);if(length<5||length>150)continue;const columns=Math.min(12,Math.floor(length/4)),floors=Math.min(15,Math.floor(item.h/3.5));rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.atan2(b.y-a.y,b.x-a.x));for(let floor=0;floor<floors&&count<4000;floor++)for(let col=0;col<columns&&count<4000;col++){const t=(col+.5)/columns;pos.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,item.elevation+2+floor*3.5);scale.set(1.1,.5,1.4);matrix.compose(pos,rotation,scale);windows.setMatrixAt(count++,matrix)}}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();roofs.geometry.dispose();roofs.geometry=geometry;windows.count=count;windows.instanceMatrix.needsUpdate=true;
 };
 map.addLayer({id:'miniature-buildings',type:'custom',renderingMode:'3d',onAdd(m,gl){scene=new THREE.Scene();camera=new THREE.Camera();scene.add(new THREE.AmbientLight('#fff4de',1.8));const light=new THREE.DirectionalLight('#fff5de',2);light.position.set(-100,-150,300);scene.add(light);roofs=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));windows=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:'#477771'}),4000);windows.count=0;roofs.frustumCulled=windows.frustumCulled=false;scene.add(roofs,windows);renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl});renderer.autoClear=false;map.on('moveend',schedule);map.on('sourcedata',source);map.on('terrain',schedule);map.on('cartographychange',schedule);document.getElementById('buildings').addEventListener('change',schedule)},render(gl,args){if(!active())return;if(dirty&&!map.isMoving())rebuild();if(!origin)return;camera.projectionMatrix.fromArray(args.defaultProjectionData?.mainMatrix||args).multiply(new THREE.Matrix4().makeTranslation(origin.x,origin.y,0).scale(new THREE.Vector3(unit,unit,unit)));renderer.resetState();renderer.render(scene,camera);renderer.resetState()},onRemove(){clearTimeout(timer);map.off('moveend',schedule);map.off('sourcedata',source);map.off('terrain',schedule);map.off('cartographychange',schedule);document.getElementById('buildings').removeEventListener('change',schedule);for(const mesh of [roofs,windows]){mesh.geometry.dispose();mesh.material.dispose()}windows.dispose();renderer.dispose()}});
}
