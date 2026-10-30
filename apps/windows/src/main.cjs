const {app,BrowserWindow,Menu,shell,session,dialog,ipcMain}=require('electron');
const path=require('node:path');
const {ORIGIN,isTrusted,isExternal,isDownload,isTrustedMainFrame}=require('./policy.cjs');
app.setName('植藏');app.setAppUserModelId('top.gloriouscarnivorousplants.leafarchive');
const lock=app.requestSingleInstanceLock();if(!lock)app.quit();
let window;
function openExternal(url){if(isExternal(url))shell.openExternal(url).catch(()=>{})}
function createWindow(){
 window=new BrowserWindow({width:1320,height:900,minWidth:800,minHeight:600,title:'植藏',icon:path.join(__dirname,'../assets/plant.ico'),backgroundColor:'#f8f9f5',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),partition:'persist:leaf-archive',nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,devTools:false}});
 const contents=window.webContents;
 contents.on('will-navigate',(event,url)=>{if(!isTrusted(url)){event.preventDefault();openExternal(url)}});
 contents.on('will-redirect',(event,url)=>{if(!isTrusted(url)){event.preventDefault();openExternal(url)}});
 contents.setWindowOpenHandler(({url})=>{if(isTrusted(url))contents.loadURL(url).catch(()=>{});else openExternal(url);return {action:'deny'}});
 contents.on('will-attach-webview',event=>event.preventDefault());
 contents.on('page-title-updated',event=>event.preventDefault());
 contents.on('did-fail-load',async(event,code,description,url,isMainFrame)=>{
  if(!isMainFrame||code===-3||!window||window.isDestroyed())return;
  const {response}=await dialog.showMessageBox(window,{type:'info',title:'暂时无法连接',message:'暂时无法连接植藏',detail:'请检查网络连接后重试。',buttons:['重试','关闭'],defaultId:0,cancelId:1});
  if(response===0&&window&&!window.isDestroyed())contents.loadURL(ORIGIN).catch(()=>{});
 });
 window.once('ready-to-show',()=>window.show());window.on('closed',()=>{window=null});
 contents.loadURL(ORIGIN).catch(()=>{});
}
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus()}});
app.whenReady().then(()=>{
 ipcMain.on('leaf:quit',event=>{if(window&&!window.isDestroyed()&&isTrustedMainFrame(event.senderFrame,window.webContents.mainFrame))app.quit()});
 const partition=session.fromPartition('persist:leaf-archive');partition.setPermissionRequestHandler((contents,permission,callback)=>callback(false));partition.setPermissionCheckHandler(()=>false);
 partition.on('will-download',async(event,item,contents)=>{
  if(!isTrusted(contents.getURL())||!item.getURLChain().every(isDownload)){event.preventDefault();return;}
  const filename=path.basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');
  item.setSaveDialogOptions({title:'保存植藏文件',defaultPath:path.join(app.getPath('downloads'),filename)});
 });
 Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'植藏',submenu:[{label:'返回',accelerator:'Alt+Left',click:()=>{if(window?.webContents.navigationHistory.canGoBack())window.webContents.navigationHistory.goBack()}},{label:'刷新',accelerator:'Ctrl+R',click:()=>window?.webContents.reload()},{type:'separator'},{label:'放大',role:'zoomIn'},{label:'缩小',role:'zoomOut'},{label:'恢复缩放',role:'resetZoom'},{type:'separator'},{label:'退出',role:'quit'}]}]));
 createWindow();
});
app.on('window-all-closed',()=>app.quit());
