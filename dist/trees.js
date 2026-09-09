import * as THREE from './three.module.js';
const LIMIT=1800;
const noise=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v)};
function inside(p,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
export function addTrees(map){
 let dirty=true,timer,origin,scale=1,renderer,camera,scene,trunk,crown;
 const enabled=()=>document.getElementById('landcover').checked&&Cartography.config.forest.trees&&map.getZoom()>=Cartography.config.forest.minZoom;
 const update=()=>{dirty=false;if(!enabled()){trunk.count=crown.count=0;return}
 const cfg=treeConfig();const STEP=0.0000015/Math.sqrt(cfg.density);
 const center=maplibregl.MercatorCoordinate.fromLngLat(map.getCenter());origin=center;scale=center.meterInMercatorCoordinateUnits();
 const polygons=[];for(const f of map.querySourceFeatures('openmaptiles',{sourceLayer:'landcover',filter:['==','class','wood']})){const ps=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[];for(const rings of ps){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of rings[0]){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1])}polygons.push({rings,minX,minY,maxX,maxY})}}
 const candidates=[];const cx=Math.floor(center.x/STEP),cy=Math.floor(center.y/STEP);for(let x=cx-40;x<=cx+40;x++)for(let y=cy-40;y<=cy+40;y++){const mx=(x+.2+.6*noise(x,y))*STEP,my=(y+.2+.6*noise(y,x))*STEP;candidates.push({x,y,mx,my,d:(mx-center.x)**2+(my-center.y)**2})}candidates.sort((a,b)=>a.d-b.d);
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),size=new THREE.Vector3();let count=0;const canvas=map.getCanvas();
 for(const c of candidates){if(count>=Math.min(LIMIT,Math.floor(cfg.maxTrees)))break;const ll=new maplibregl.MercatorCoordinate(c.mx,c.my).toLngLat();const screen=map.project(ll);if(screen.x< -80||screen.y< -80||screen.x>canvas.clientWidth+80||screen.y>canvas.clientHeight+80)continue;
 const p=[ll.lng,ll.lat];if(!polygons.some(o=>p[0]>=o.minX&&p[0]<=o.maxX&&p[1]>=o.minY&&p[1]<=o.maxY&&inside(p,o.rings[0])&&!o.rings.slice(1).some(r=>inside(p,r))))continue;
 const altitude=map.getTerrain()?map.queryTerrainElevation(ll):0;if(altitude==null)continue;
 const h=9+noise(c.x+91,c.y)*7;v.set((c.mx-origin.x)/scale,(c.my-origin.y)/scale,altitude);size.set(cfg.widthScale,cfg.widthScale,h/12*cfg.heightScale);matrix.compose(v,q,size);trunk.setMatrixAt(count,matrix);crown.setMatrixAt(count,matrix);crown.setColorAt(count,new THREE.Color(cfg.crownColor).multiplyScalar(.85+noise(c.x,c.y)*.3));count++;
 }
 trunk.count=crown.count=count;trunk.instanceMatrix.needsUpdate=crown.instanceMatrix.needsUpdate=true;if(crown.instanceColor)crown.instanceColor.needsUpdate=true;
 };
 let currentShape;const treeConfig=()=>Cartography.config.appearance.mode==='miniature'?{...Cartography.config.forest,shape:'round',crownColor:'#7fa573',widthScale:Cartography.config.forest.widthScale*1.2}:Cartography.config.forest;
 const configure=()=>{const cfg=treeConfig();trunk.material.color.set(cfg.trunkColor);if(currentShape!==cfg.shape){const g=cfg.shape==='round'?new THREE.SphereGeometry(4.5,8,6):new THREE.ConeGeometry(4.5,10,7);if(cfg.shape==='cone')g.rotateX(Math.PI/2);g.translate(0,0,8);crown.geometry.dispose();crown.geometry=g;currentShape=cfg.shape}schedule()};
 const schedule=()=>{dirty=true;clearTimeout(timer);timer=setTimeout(()=>map.triggerRepaint(),180)};
 const layer={id:'forest-trees',type:'custom',renderingMode:'3d',onAdd(m,gl){scene=new THREE.Scene();camera=new THREE.Camera();scene.add(new THREE.AmbientLight(0xffffff,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-100,-100,200);scene.add(sun);
 const stem=new THREE.CylinderGeometry(.65,.9,4,5);stem.rotateX(Math.PI/2);stem.translate(0,0,2);const canopy=new THREE.ConeGeometry(4.5,10,7);canopy.rotateX(Math.PI/2);canopy.translate(0,0,8);
 trunk=new THREE.InstancedMesh(stem,new THREE.MeshLambertMaterial({color:'#766048'}),LIMIT);crown=new THREE.InstancedMesh(canopy,new THREE.MeshLambertMaterial({color:'#ffffff',flatShading:true}),LIMIT);trunk.count=crown.count=0;trunk.frustumCulled=crown.frustumCulled=false;scene.add(trunk,crown);renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl});renderer.autoClear=false;
 configure();map.on('cartographychange',configure);map.on('moveend',schedule);map.on('sourcedata',onSource);map.on('terrain',schedule);document.getElementById('landcover').addEventListener('change',schedule);
 },render(gl,args){if(!enabled())return;if(dirty&&!map.isMoving())update();if(!origin||!trunk.count)return;const projection=args.defaultProjectionData?.mainMatrix||args;camera.projectionMatrix.fromArray(projection).multiply(new THREE.Matrix4().makeTranslation(origin.x,origin.y,0).scale(new THREE.Vector3(scale,scale,scale)));renderer.resetState();renderer.render(scene,camera);renderer.resetState()},onRemove(){clearTimeout(timer);map.off('cartographychange',configure);map.off('moveend',schedule);map.off('sourcedata',onSource);map.off('terrain',schedule);document.getElementById('landcover').removeEventListener('change',schedule);for(const mesh of [trunk,crown]){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose()}renderer.dispose()}};
 function onSource(e){if(e.isSourceLoaded&&['openmaptiles','terrain-dem'].includes(e.sourceId))schedule()}
 map.addLayer(layer);schedule();
}
