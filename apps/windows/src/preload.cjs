const {contextBridge,ipcRenderer}=require('electron');
if(process.isMainFrame&&location.origin==='https://gloriouscarnivorousplants.top')contextBridge.exposeInMainWorld('leafApp',{platform:'windows',quit:()=>ipcRenderer.send('leaf:quit')});
