(function(){
  const $=id=>document.getElementById(id);
  const money=value=>value>=100000000?(value/100000000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'억':Math.round(value/10000).toLocaleString('ko-KR')+'만';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let all={type:'FeatureCollection',features:[]};
  let map;

  function filter(){
    const type=$('auction-type').value;
    const discount=+$('auction-discount').value;
    const failed=+$('auction-failed').value;
    const features=all.features.filter(f=>(type==='all'||f.properties.type===type)&&f.properties.discountRate>=discount&&f.properties.failedCount>=failed);
    map.getSource('auctions').setData({type:'FeatureCollection',features});
    $('auction-count').textContent=features.length+'건 표시';
  }

  function popup(feature,coordinates){
    const p=feature.properties;
    const root=document.createElement('article');
    root.className='auction-popup';
    const eventDate=p.bidEnd?new Date(p.bidEnd.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/,'$1-$2-$3T$4:$5:00+09:00')).toLocaleString('ko-KR',{dateStyle:'medium',timeStyle:'short'}):'일정 미정';
    const ratio=typeof p.priceRatio==='number'?'감정가 대비 '+p.priceRatio+'%':'최저가 비공개';
    const locationNote=p.locationPrecision==='neighborhood'?'<p class="auction-location-note">주소 좌표를 찾지 못해 읍·면·동 중심의 근사 위치로 표시합니다.</p>':p.locationPrecision==='district'?'<p class="auction-location-note">주소 좌표를 찾지 못해 구 중심의 근사 위치로 표시합니다.</p>':'';
    root.innerHTML='<span class="auction-badge">온비드 공매 · '+escape(p.type)+'</span><h3>'+escape(p.address)+'</h3>'+locationNote+'<div class="auction-price"><strong>'+money(p.minimumPrice)+'</strong><span>최저입찰가 · '+ratio+'</span></div><dl><div><dt>감정가</dt><dd>'+money(p.appraisalPrice)+'</dd></div><div><dt>유찰</dt><dd>'+p.failedCount+'회</dd></div><div><dt>입찰 마감</dt><dd>'+escape(eventDate)+'</dd></div><div><dt>진행 상태</dt><dd>'+escape(p.status)+'</dd></div><div><dt>물건관리번호</dt><dd>'+escape(p.id)+'</dd></div><div><dt>면적</dt><dd>'+escape(p.area||'정보 없음')+'</dd></div></dl><a href="'+escape(p.sourceUrl)+'" target="_blank" rel="noreferrer">온비드에서 확인 ↗</a><small>한국자산관리공사 온비드 공매 정보 · 마지막 갱신 '+escape(p.updatedAt||'')+'</small>';
    new maplibregl.Popup({offset:18,maxWidth:'330px'}).setLngLat(coordinates).setDOMContent(root).addTo(map);
  }

  function addLayers(){
    map.addSource('auctions',{type:'geojson',data:all,cluster:true,clusterMaxZoom:14,clusterRadius:52});
    map.addLayer({id:'auction-clusters',type:'circle',source:'auctions',filter:['has','point_count'],paint:{'circle-color':['step',['get','point_count'],'#f6ad55',10,'#ed8936',30,'#c05621'],'circle-radius':['step',['get','point_count'],20,10,25,30,31],'circle-stroke-color':'#fff','circle-stroke-width':2}});
    map.addLayer({id:'auction-cluster-count',type:'symbol',source:'auctions',filter:['has','point_count'],layout:{'text-field':['concat','공매 ',['get','point_count_abbreviated']],'text-size':12,'text-font':['Noto Sans Regular']},paint:{'text-color':'#2d1b0b'}});
    map.addLayer({id:'auction-points',type:'circle',source:'auctions',filter:['!', ['has','point_count']],paint:{'circle-color':['interpolate',['linear'],['get','discountRate'],0,'#f6ad55',30,'#ed8936',50,'#c53030'],'circle-radius':8,'circle-stroke-color':'#fff','circle-stroke-width':2}});
    map.addLayer({id:'auction-labels',type:'symbol',source:'auctions',filter:['!', ['has','point_count']],minzoom:14,layout:{'text-field':['concat',['case',['>=',['get','minimumPrice'],100000000],['concat',['number-format',['/', ['get','minimumPrice'],100000000],{'max-fraction-digits':1}],'억'],['concat',['number-format',['/', ['get','minimumPrice'],10000],{}],'만']],['concat','  ↓ ',['get','discountRate'],'%']],'text-size':12,'text-offset':[0,-1.7],'text-anchor':'bottom','text-allow-overlap':false,'text-padding':5},paint:{'text-color':'#4a2509','text-halo-color':'#fffaf0','text-halo-width':5}});
    map.on('click','auction-clusters',e=>{const feature=map.queryRenderedFeatures(e.point,{layers:['auction-clusters']})[0];map.getSource('auctions').getClusterExpansionZoom(feature.properties.cluster_id).then(zoom=>map.easeTo({center:feature.geometry.coordinates,zoom}))});
    map.on('click','auction-points',e=>popup(e.features[0],e.features[0].geometry.coordinates.slice()));
    ['auction-clusters','auction-points'].forEach(id=>{map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',id,()=>map.getCanvas().style.cursor='')});
  }

  async function init(target){
    map=target;
    try{all=await window.AuctionData.getFeatures();$('auction-data-state').textContent=(all.metadata?.updatedAt?'갱신 '+new Date(all.metadata.updatedAt).toLocaleString('ko-KR'):'첫 배치 수집 대기 중');}
    catch(error){all={type:'FeatureCollection',features:[]};$('auction-data-state').textContent='데이터를 준비하지 못했습니다';console.error(error)}
    const select=$('auction-type');
    const types=[...new Set(all.features.map(f=>f.properties.type).filter(Boolean))].sort();
    types.forEach(type=>{const option=document.createElement('option');option.value=type;option.textContent=type;select.append(option)});
    addLayers();
    ['auction-type','auction-discount','auction-failed'].forEach(id=>$(id).addEventListener('change',filter));
    $('auctions').addEventListener('change',()=>setVisible($('auctions').checked));
    filter();
    setVisible($('auctions').checked);
  }
  function setVisible(on){
    if(!map?.getLayer('auction-points'))return;
    ['auction-clusters','auction-cluster-count','auction-points','auction-labels'].forEach(id=>map.setLayoutProperty(id,'visibility',on?'visible':'none'));
    $('auction-filters').hidden=!on;
  }
  window.Auctions={init,setVisible};
})();
