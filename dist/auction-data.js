(function(){
  const DATA_URL='https://raw.githubusercontent.com/homgru/k3Dmap/main/dist/onbid-auctions.geojson';
  window.AuctionData={
    async getFeatures(){
      const response=await fetch(DATA_URL+'?v='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw new Error('공매 데이터 파일을 불러오지 못했습니다.');
      const data=await response.json();
      if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('공매 데이터 형식이 올바르지 않습니다.');
      return data;
    }
  };
})();
