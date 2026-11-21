const find = id => document.getElementById(id);
const fileInput = find('ocr-file');
const consent = find('ocr-consent');
const start = find('ocr-start');
const result = find('ocr-result');
const output = find('ocr-text');
const notice = find('ocr-notice');
let available = false;

async function api(path, options){
 const response = await fetch('/plant-id/api/' + path, options);
 const data = await response.json().catch(() => ({}));
 if(response.status === 401){
  available = false;
  find('ocr-login').hidden = false;
 }
 if(!response.ok)throw Error(data.error || '识别服务暂时不可用，请稍后重试。');
 return data;
}

function showAvailability(){
 find('ocr-session').textContent = '站内不限每日识别次数，仍受模型服务额度和并发限制。';
}

api('session').then(data => {
 find('ocr-login').hidden = Boolean(data.user);
 available = Boolean(data.user && data.configured);
 start.disabled = !available;
 if(!data.user) find('ocr-session').textContent = '请先登录识植助手，再回到这里提取文字。';
 else if(!data.configured) find('ocr-session').textContent = '视觉服务尚未配置。';
 else showAvailability();
 if(data.provider)consent.nextElementSibling.textContent = '同意把图片发送给' + data.provider + '。本站不保存本次图片或识别文字。';
}).catch(error => { find('ocr-session').textContent = error.message; });

fileInput.addEventListener('change', () => {
 result.hidden = true;
 output.value = '';
 notice.textContent = '';
 find('ocr-copy-status').textContent = '';
});

find('ocr-form').addEventListener('submit', async event => {
 event.preventDefault();
 if(!available || start.disabled)return;
 const file = fileInput.files[0];
 if(!file || !['image/jpeg','image/png'].includes(file.type) || file.size > 5 * 1024 * 1024){
  notice.textContent = '请选择不超过 5 MiB 的 JPG 或 PNG 图片。';
  return;
 }
 const form = new FormData();
 form.set('images', file);
 form.set('consent', 'yes');
 start.disabled = fileInput.disabled = consent.disabled = true;
 result.hidden = true;
 output.value = '';
 find('ocr-copy-status').textContent = '';
 notice.textContent = '正在提取文字…';
 try{
  const data = await api('ocr', {method:'POST', body:form});
  output.value = data.text;
  result.hidden = !data.text;
  showAvailability();
  notice.textContent = data.truncated ? '结果达到长度上限，请把图片分段后再识别。' :
   data.text ? '文字已提取。' : '没有找到可辨认的文字。';
 }catch(error){ notice.textContent = error.message; }
 finally{
  fileInput.disabled = consent.disabled = false;
  start.disabled = !available;
 }
});

find('ocr-copy').addEventListener('click', async () => {
 const status = find('ocr-copy-status');
 try{
  await navigator.clipboard.writeText(output.value);
  status.textContent = '已复制。';
 }catch{
  output.focus();
  output.select();
  status.textContent = '已选中文字，可以手动复制。';
 }
});
