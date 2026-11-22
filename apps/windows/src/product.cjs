const plantId=Boolean(require('../package.json').plantId);
const origin='https://gloriouscarnivorousplants.top';
module.exports=plantId?{
 name:'识植助手',entry:origin+'/plant-id/',id:'top.gloriouscarnivorousplants.plantid',
 partition:'persist:plant-id',icon:'plant-id.ico',pathPrefix:'/plant-id/',
}:{
 name:'植藏',entry:origin+'/collection',id:'top.gloriouscarnivorousplants.leafarchive',
 partition:'persist:leaf-archive',icon:'plant.ico',pathPrefix:'',
};
