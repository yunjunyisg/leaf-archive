package top.gloriouscarnivorousplants.leafarchive;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

public class MainActivity extends Activity {
    private static final String ORIGIN="https://gloriouscarnivorousplants.top";
    private static final int PICK_PHOTOS=10,SAVE_FILE=11,MAX_FILE=24*1024*1024;
    private WebView web;
    private LinearLayout root;
    private TextView notice;
    private ValueCallback<Uri[]> photoCallback;
    private byte[] pendingFile;
    private String downloadScript;
    private boolean destroyed=false;
    private final ExecutorService io=Executors.newSingleThreadExecutor();

    static boolean trusted(Uri uri){return uri!=null&&"https".equals(uri.getScheme())&&"gloriouscarnivorousplants.top".equals(uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443)&&uri.getUserInfo()==null;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);
        root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(248,249,245));
        root.setOnApplyWindowInsetsListener((view,insets)->{
            if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());view.setPadding(bars.left,bars.top,bars.right,bars.bottom);}
            else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(8),0,dp(8),0);
        Button back=new Button(this);back.setText("返回");back.setOnClickListener(v->goBack());bar.addView(back);
        TextView title=new TextView(this);title.setText("植藏");title.setTextSize(20);title.setTextColor(Color.rgb(36,75,57));title.setGravity(Gravity.CENTER);bar.addView(title,new LinearLayout.LayoutParams(0,dp(52),1));
        Button refresh=new Button(this);refresh.setText("刷新");refresh.setOnClickListener(v->{notice.setVisibility(View.GONE);web.setVisibility(View.VISIBLE);if(trusted(Uri.parse(web.getUrl()==null?ORIGIN:web.getUrl())))web.reload();else web.loadUrl(ORIGIN);});bar.addView(refresh);root.addView(bar);
        notice=new TextView(this);notice.setText("暂时无法连接植藏，请检查网络后点击上方刷新。");notice.setPadding(dp(24),dp(40),dp(24),dp(40));notice.setTextSize(17);notice.setVisibility(View.GONE);root.addView(notice);
        web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setGeolocationEnabled(false);settings.setSupportMultipleWindows(true);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);WebView.setWebContentsDebuggingEnabled(false);
        try(InputStream input=getAssets().open("downloads.js")){ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] chunk=new byte[4096];int count;while((count=input.read(chunk))!=-1)bytes.write(chunk,0,count);downloadScript=bytes.toString(StandardCharsets.UTF_8.name());}catch(IOException e){downloadScript="";}
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(web,"LeafDownloads",java.util.Collections.singleton(ORIGIN),(view,message,source,isMainFrame,reply)->{
            if(!isMainFrame||!trusted(source)||!trusted(Uri.parse(view.getUrl()==null?"":view.getUrl())))return;
            String raw=message.getData();if(raw==null||raw.length()>MAX_FILE*4/3+4096)return;
            if(pendingFile!=null){toast("请先完成当前文件保存");return;}
            io.execute(()->{
                try{
                    JSONObject data=new JSONObject(raw);String mime=data.getString("mime");if(!mime.equals("image/png")&&!mime.equals("application/json"))return;
                    byte[] decoded=android.util.Base64.decode(data.getString("data"),android.util.Base64.DEFAULT);if(decoded.length>MAX_FILE)return;
                    String name=data.optString("name","植藏文件").replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_");if(name.length()>150)name=name.substring(0,150);
                    final String filename=name;
                    runOnUiThread(()->{if(destroyed||pendingFile!=null)return;pendingFile=decoded;Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);save.addCategory(Intent.CATEGORY_OPENABLE);save.setType(mime);save.putExtra(Intent.EXTRA_TITLE,filename);try{startActivityForResult(save,SAVE_FILE);}catch(ActivityNotFoundException e){pendingFile=null;toast("无法打开文件保存窗口");}});
                }catch(Exception e){runOnUiThread(()->toast("文件保存失败，请重试"));}
            });
        });
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){Uri url=request.getUrl();if(trusted(url))return false;if(request.isForMainFrame())openExternal(url);return true;}
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){if(!trusted(Uri.parse(url))){view.stopLoading();openExternal(Uri.parse(url));}}
            @Override public void onPageFinished(WebView view,String url){CookieManager.getInstance().flush();if(trusted(Uri.parse(url))&&WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))view.evaluateJavascript(downloadScript,null);}
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())showOffline();}
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response){if(request.isForMainFrame()&&response.getStatusCode()>=500)showOffline();}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(!trusted(Uri.parse(view.getUrl()==null?"":view.getUrl()))){callback.onReceiveValue(null);return true;}
                if(photoCallback!=null)photoCallback.onReceiveValue(null);photoCallback=callback;
                Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.setType("image/*");pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
                try{startActivityForResult(pick,PICK_PHOTOS);}catch(ActivityNotFoundException e){photoCallback.onReceiveValue(null);photoCallback=null;toast("无法打开照片选择器");}return true;
            }
            @Override public boolean onJsAlert(WebView view,String url,String text,JsResult result){if(!trusted(Uri.parse(url))){result.cancel();return true;}new AlertDialog.Builder(MainActivity.this).setTitle("植藏").setMessage(text).setPositiveButton("确定",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView view,String url,String text,JsResult result){if(!trusted(Uri.parse(url))){result.cancel();return true;}new AlertDialog.Builder(MainActivity.this).setTitle("请确认").setMessage(text).setPositiveButton("确定",(d,w)->result.confirm()).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsPrompt(WebView view,String url,String text,String initial,JsPromptResult result){if(!trusted(Uri.parse(url))){result.cancel();return true;}EditText input=new EditText(MainActivity.this);input.setSingleLine(true);input.setText(initial);new AlertDialog.Builder(MainActivity.this).setTitle("植藏").setMessage(text).setView(input).setPositiveButton("确定",(d,w)->result.confirm(input.getText().toString())).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onCreateWindow(WebView view,boolean dialog,boolean userGesture,Message message){
                if(!userGesture)return false;
                WebView popup=new WebView(MainActivity.this);popup.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){Uri url=request.getUrl();if(trusted(url))web.loadUrl(url.toString());else openExternal(url);popup.destroy();return true;}});
                ((WebView.WebViewTransport)message.obj).setWebView(popup);message.sendToTarget();return true;
            }
        });
        web.setDownloadListener((url,userAgent,disposition,mime,length)->{if(!url.startsWith("blob:"))saveHttpDownload(url,mime,userAgent);});
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::goBack);
        if(saved==null||web.restoreState(saved)==null)web.loadUrl(ORIGIN);
    }
    private void toast(String text){if(!destroyed)Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
    private void showOffline(){notice.setVisibility(View.VISIBLE);web.setVisibility(View.GONE);}
    private void goBack(){if(web.canGoBack()){notice.setVisibility(View.GONE);web.setVisibility(View.VISIBLE);web.goBack();}else finish();}
    @Override public void onBackPressed(){goBack();}
    private void openExternal(Uri url){if(!"https".equals(url.getScheme())||url.getUserInfo()!=null)return;try{startActivity(new Intent(Intent.ACTION_VIEW,url));}catch(ActivityNotFoundException e){toast("无法打开外部链接");}}
    private void saveHttpDownload(String url,String mime,String agent){
        Uri uri=Uri.parse(url);if(!trusted(uri)||!trusted(Uri.parse(web.getUrl()==null?"":web.getUrl())))return;
        new AlertDialog.Builder(this).setTitle("下载文件").setMessage("将此文件保存到下载目录？").setPositiveButton("保存",(dialog,which)->{
            try{String name=URLUtil.guessFileName(url,null,mime).replaceAll("[\\\\/:*?\"<>|]","_");android.app.DownloadManager.Request request=new android.app.DownloadManager.Request(uri);String cookies=CookieManager.getInstance().getCookie(url);if(cookies!=null)request.addRequestHeader("Cookie",cookies);request.addRequestHeader("User-Agent",agent);request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS,name);((android.app.DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(request);toast("已开始下载");}catch(Exception e){toast("下载失败，请重试");}
        }).setNegativeButton("取消",null).show();
    }
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
        if(request==PICK_PHOTOS&&photoCallback!=null){Uri[] selected=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){int count=data.getClipData().getItemCount();selected=new Uri[count];for(int i=0;i<count;i++)selected[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)selected=new Uri[]{data.getData()};}photoCallback.onReceiveValue(selected);photoCallback=null;}
        if(request==SAVE_FILE){byte[] bytes=pendingFile;pendingFile=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){Uri uri=data.getData();io.execute(()->{try(OutputStream output=getContentResolver().openOutputStream(uri)){if(output==null)throw new IOException();output.write(bytes);runOnUiThread(()->toast("文件已保存"));}catch(IOException e){runOnUiThread(()->toast("保存失败，请重试"));}});}}
    }
    @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);web.saveState(out);}
    @Override protected void onPause(){super.onPause();CookieManager.getInstance().flush();web.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){destroyed=true;if(photoCallback!=null)photoCallback.onReceiveValue(null);pendingFile=null;io.shutdown();web.destroy();super.onDestroy();}
}
