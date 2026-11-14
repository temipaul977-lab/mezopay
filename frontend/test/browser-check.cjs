const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const v = require('viem');
const abi = require('../src/contracts/MezoPayInvoices.json').abi;
const tokenAbi = v.parseAbi(['function balanceOf(address) view returns(uint256)', 'function allowance(address,address) view returns(uint256)', 'function approve(address,uint256) returns(bool)']);
const invoiceAddress = '0x3a9bD911dD099F1e8fB30070527891AE1d89a80f';
const musd = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503';
const account = '0x1111111111111111111111111111111111111111';
const creator = '0x2222222222222222222222222222222222222222';
const blockHash = '0x' + 'b'.repeat(64);
const amount = 25n * 10n ** 18n;
const state = { approved: false, paid: false, receipts: {}, transactions: {}, holds: false, sent: 0, block: 256, balance: amount * 10n, failInvoice: false };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, chrome, socket;
const errors = [];
async function until(fn, label, timeout = 18000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await sleep(150); }
  throw new Error('Timeout: ' + label);
}
function receipt(hash, kind) {
  const event = kind === 'approve' ? v.parseAbi(['event Approval(address indexed owner,address indexed spender,uint256 value)']) : abi;
  const eventName = kind === 'approve' ? 'Approval' : kind === 'create' ? 'InvoiceCreated' : 'InvoicePaid';
  const args = kind === 'approve' ? { owner: account, spender: invoiceAddress } : kind === 'create' ? { id: 43n, creator: account } : { id: 42n, creator, payer: account };
  const data = kind === 'create' ? v.encodeAbiParameters([{type:'uint256'},{type:'string'}], [amount, 'Audit']) : v.encodeAbiParameters([{type:'uint256'}], [amount]);
  const target = kind === 'approve' ? musd : invoiceAddress;
  return { transactionHash: hash, transactionIndex:'0x0', blockHash, blockNumber:'0x100', from: account, to: target,
    cumulativeGasUsed:'0x5208', gasUsed:'0x5208', effectiveGasPrice:'0x1', contractAddress:null, status:'0x1', type:'0x0', logsBloom:'0x'+'0'.repeat(512),
    logs:[{address:target, topics:v.encodeEventTopics({abi:event,eventName,args}),data,blockHash,blockNumber:'0x100',transactionHash:hash,transactionIndex:'0x0',logIndex:'0x0',removed:false}] };
}
function rpc(request) {
  const {method,params=[]} = request;
  if (method === 'eth_chainId') return '0x7b7b';
  if (method === 'eth_blockNumber') return v.toHex(++state.block);
  if (method === 'eth_getTransactionByHash') return state.transactions[params[0]] ?? null;
  if (method === 'eth_getTransactionReceipt') return state.holds ? null : state.receipts[params[0]] ?? null;
  if (method === 'eth_getCode') return '0x6000';
  if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
  if (method === 'eth_estimateGas') return '0x186a0';
  if (method === 'eth_gasPrice') return '0x1';
  if (method === 'eth_call') {
    const tx = params[0];
    const isToken = tx.to.toLowerCase() === musd.toLowerCase();
    const decoded = v.decodeFunctionData({ abi:isToken ? tokenAbi : abi, data:tx.data });
    let result;
    if (decoded.functionName === 'balanceOf') result = state.balance;
    else if (decoded.functionName === 'allowance') result = state.approved ? amount : 0n;
    else if (decoded.functionName === 'approve') result = true;
    else if (decoded.functionName === 'payInvoice') return '0x';
    else if (decoded.functionName === 'createInvoice') result = 43n;
    else if (decoded.functionName === 'getCreatorInvoices') result = state.sent ? [43n] : [];
    else if (decoded.functionName === 'getPayerInvoices') result = state.paid ? [42n] : [];
    else if (decoded.functionName === 'getInvoice') {
      if(state.failInvoice) throw new Error('RPC temporarily unavailable');
      const id = decoded.args[0];
      result = { id,creator:id===43n?account:creator,payer:state.paid?account:v.zeroAddress,amount,title:id===43n?'Audit':'Design sprint',memo:'Project reference 2026',paid:id===42n&&state.paid,createdAt:1760000000n,paidAt:state.paid?1760000600n:0n };
    }
    return v.encodeFunctionResult({abi:isToken?tokenAbi:abi,functionName:decoded.functionName,result});
  }
  if (method === 'eth_getBlockByNumber') return { number:'0x100', hash:blockHash, parentHash:blockHash,timestamp:'0x69000000',transactions:[], gasLimit:'0x1000000',gasUsed:'0x5208',baseFeePerGas:'0x1' };
  throw new Error('Unhandled RPC: ' + method);
}
let counter=0;
const waiting = new Map();
function cdp(method, params={}) { return new Promise((resolve,reject) => {
  const id=++counter;
  const timer=setTimeout(()=>{waiting.delete(id);reject(new Error('CDP timeout '+method));},15000);
  waiting.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});socket.send(JSON.stringify({id,method,params}));
}); }
async function evaluate(expression) {
  const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function clickText(text) {
  const found=await until(()=>evaluate(`(()=>{const e=[...document.querySelectorAll('button,a,summary')].find(e=>e.getClientRects().length&&e.textContent.trim()===${JSON.stringify(text)});if(!e||e.disabled)return false;e.click();return true})()`), 'click '+text);
  return found;
}
async function fill(id,value) { await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); }
async function page(url) { await cdp('Page.navigate',{url:'http://127.0.0.1:3100'+url});await until(()=>evaluate('document.readyState === "complete"'),'page ready');await sleep(450); }
async function checkText(text) { return until(()=>evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), text); }
async function screenshot(name) { const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join('.qa',name+'.png'),Buffer.from(shot.data,'base64')); }

(async()=>{
  fs.mkdirSync('.qa',{recursive:true});
  for(const port of [3100,9227]) {
    try { const r=await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(1000)}); if(r) throw new Error(`QA port ${port} is in use`); }
    catch(error) { if(error.message.startsWith('QA port')) throw error; }
  }
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3100'],{windowsHide:true,stdio:'pipe'});
  await until(async()=>{try{return (await fetch('http://127.0.0.1:3100')).ok;}catch{return false;}},'Next server',30000);
  const browserPath=process.env.BROWSER_BIN ?? (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/chromium');
  if(!fs.existsSync(browserPath)) throw new Error('Set BROWSER_BIN to an installed Chrome or Chromium executable.');
  chrome=spawn(browserPath,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9227','--user-data-dir='+path.resolve('.qa/chrome'),'about:blank'],{windowsHide:true,stdio:'ignore'});
  await until(async()=>{try{return (await fetch('http://127.0.0.1:9227/json/version')).ok;}catch{return false;}},'Chrome');
  const targets=await (await fetch('http://127.0.0.1:9227/json/list')).json();
  const target=targets.find(t=>t.type==='page');
  console.log('Browser target:', target.url);
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  socket.addEventListener('message',async event=>{
    const message=JSON.parse(event.data);
    if(process.env.QA_DEBUG) console.log('CDP',message.id??message.method,message.error??'');
    if(message.id) { const pending=waiting.get(message.id);if(pending){waiting.delete(message.id);message.error?pending.reject(new Error(JSON.stringify(message.error))):pending.resolve(message.result);}return; }
    if(message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if(message.method==='Fetch.requestPaused') {
      const {requestId,request}=message.params;
      try {
        if(request.method==='OPTIONS') { await cdp('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:[{name:'access-control-allow-origin',value:'*'},{name:'access-control-allow-methods',value:'POST, OPTIONS'},{name:'access-control-allow-headers',value:'content-type'}]});return; }
        const body=JSON.parse(request.postData);
        const wrap=r=>{try{return {jsonrpc:'2.0',id:r.id,result:rpc(r)};}catch(e){return {jsonrpc:'2.0',id:r.id,error:{code:-32603,message:e.message}};}};
        const response=Array.isArray(body)?body.map(wrap):wrap(body);
        await cdp('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'},{name:'access-control-allow-origin',value:'*'}],body:Buffer.from(JSON.stringify(response)).toString('base64')});
      }catch(e){errors.push(e.message);await cdp('Fetch.failRequest',{requestId,errorReason:'Failed'});}
    }
    if(message.method==='Runtime.bindingCalled') {
      const {id,tx}=JSON.parse(message.params.payload);
      const decoded=v.decodeFunctionData({abi:tx.to.toLowerCase()===musd.toLowerCase()?tokenAbi:abi,data:tx.data});
      const kind=decoded.functionName==='approve'?'approve':decoded.functionName==='payInvoice'?'pay':'create';
      state.sent++;const hash='0x'+state.sent.toString(16).padStart(64,'0');
      if(kind==='approve')state.approved=true;if(kind==='pay')state.paid=true;
      state.receipts[hash]=receipt(hash,kind);
      state.transactions[hash]={...tx,from:account,hash,input:tx.data,nonce:'0x0',gas:'0x186a0',gasPrice:'0x1',value:'0x0',blockHash:null,blockNumber:null,transactionIndex:null,type:'0x0',v:'0x1b',r:'0x'+'1'.repeat(64),s:'0x'+'2'.repeat(64)};
      await evaluate(`window.__walletRequests[${id}](${JSON.stringify(hash)})`);
    }
  });
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Runtime.addBinding',{name:'__testSendTransaction'});
  await cdp('Fetch.enable',{patterns:[{urlPattern:'https://rpc.test.mezo.org/*'}]});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{let connected=sessionStorage.getItem('__testConnected')==='1',chain='0x7b7b',id=0;const listeners={};window.__setChain=c=>{chain=c;(listeners.chainChanged??[]).forEach(f=>f(c));};window.__walletRequests={};window.ethereum={isMetaMask:true,on:(e,f)=>(listeners[e]??=[]).push(f),removeListener:(e,f)=>{listeners[e]=(listeners[e]??[]).filter(x=>x!==f)},request:async({method,params})=>{if(method==='eth_chainId')return chain;if(method==='eth_accounts')return connected?['${account}']:[];if(method==='eth_requestAccounts'){connected=true;sessionStorage.setItem('__testConnected','1');return ['${account}'];}if(method==='wallet_switchEthereumChain'){window.__setChain(params[0].chainId);return null;}if(method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}];if(method==='wallet_getPermissions')return connected?[{parentCapability:'eth_accounts'}]:[];if(method==='eth_sendTransaction'){if(window.__rejectNext){window.__rejectNext=false;throw Object.assign(new Error('User declined'),{code:4001});}return new Promise(resolve=>{const n=++id;window.__walletRequests[n]=resolve;window.__testSendTransaction(JSON.stringify({id:n,tx:params[0]}));});}throw Object.assign(new Error('Unsupported '+method),{code:-32601});}};})();`});
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await page('/');await checkText('New invoice');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'mobile overflow');
  await fill('invoice-title','Audit');await fill('invoice-amount','25');
  await clickText('My Invoices');await checkText('Invoice history');
  await evaluate('document.getElementById("created-tab").focus()');await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
  assert.equal(await evaluate('document.getElementById("paid-tab").getAttribute("aria-selected")'),'true','keyboard tab navigation');
  await clickText('New Invoice');await until(()=>evaluate('document.getElementById("invoice-title")?.value === "Audit"'),'draft retained');
  await screenshot('mobile');
  await page('/pay/42');await checkText('Design sprint');await checkText('Connect to pay');assert.equal(state.sent,0,'public invoice read needs no wallet');await page('/');
  await clickText('Connect wallet');await checkText('Browser wallet');await clickText('Browser wallet');await until(()=>evaluate('!document.querySelector("dialog[open]")'),'wallet connected');
  await fill('invoice-amount','-1');await clickText('Create payment link');await checkText('Enter a positive MUSD amount');assert.equal(state.sent,0);await fill('invoice-amount','25');
  await evaluate('window.__rejectNext=true');await clickText('Create payment link');await checkText('Nothing was submitted');assert.equal(state.sent,0,'rejected transaction was not broadcast');
  state.holds=true;await clickText('Create payment link');await checkText('Invoice creation: waiting for confirmation');
  await clickText('My Invoices');await checkText('Invoice creation: waiting for confirmation');
  await cdp('Page.reload');await checkText('Invoice creation: waiting for confirmation');
  state.holds=false;await until(()=>evaluate('!document.querySelector(".transaction-activity")'),'receipt recovered',25000);
  await clickText('New Invoice');await checkText('Your payment link is ready.');
  assert.equal(state.sent,1,'no duplicate creation');
  await page('/pay/42');await checkText('Review your invoice');await checkText('Design sprint');
  if(await evaluate('[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="Connect wallet")')) { await clickText('Connect wallet');await clickText('Browser wallet'); }
  await evaluate('window.__setChain("0x1")');await checkText('Switch to Mezo Testnet');await clickText('Switch to Mezo Testnet');await until(()=>evaluate('!document.body.innerText.includes("Your invoice is on Mezo Testnet. Switch networks to continue.")'),'network switch');
  state.balance=0n;await page('/pay/42');await checkText('Insufficient MUSD');assert.equal(await evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="1. Approve MUSD")?.disabled'),true);
  state.balance=amount*10n;await page('/pay/42');await clickText('1. Approve MUSD');await checkText('MUSD spending approved');await clickText('Pay 25 MUSD');await checkText('Invoice paid');await checkText('View payment transaction');
  assert.equal(state.sent,3,'create, approve, pay exactly once');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="Pay 25 MUSD")'),false,'no double-pay action');
  state.failInvoice=true;await until(()=>evaluate('document.body.innerText.includes("Latest refresh failed")'),'stale invoice warning',26000);await checkText('Design sprint');state.failInvoice=false;
  await page('/pay/invalid');await checkText('That invoice ID');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await page('/');assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'desktop overflow');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".bottom-nav")).position'),'sticky');
  await screenshot('desktop');
  await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'320px overflow');
  assert.deepEqual(errors,[],'browser exceptions');
  console.log('PASS browser: 320/390/1280px layout, navigation, persistent draft, public invoice reads, wallet selection, invalid amounts, rejected signature, pending reload recovery, network switch, insufficient balance, approval+payment, double-pay prevention, stale receipt preservation, invalid ID, no browser exceptions.');
})().catch(async error=>{console.error(error);console.error('RPC/browser errors:',errors);if(socket?.readyState===1){try{console.log(await evaluate('document.body.innerText'));await screenshot('failure');}catch{}}process.exitCode=1;}).finally(async()=>{
  if(socket?.readyState===1){try{await cdp('Browser.close');}catch{}socket.close();}
  server?.kill();chrome?.kill();
});
